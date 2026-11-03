const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
};

const TASK_STATUSES = new Set([
  "new", "queued", "accepted", "planning", "running", "review",
  "needs_approval", "blocked", "partial", "failed", "completed", "cancelled"
]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function error(code, message, status) {
  return json({ error: { code, message } }, status);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = env.CORS_ORIGIN;
  if (!allowed || allowed === "*" || (origin && origin !== allowed)) return null;
  const headers = {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, Idempotency-Key",
    "access-control-max-age": "600",
    "vary": "Origin"
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authenticate(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(header);
  if (!match || !env.API_TOKEN_SHA256) return null;
  const actual = await sha256Hex(match[1]);
  if (!constantTimeEqual(actual, env.API_TOKEN_SHA256.toLowerCase())) return null;
  // Single-owner bootstrap mode. Replace with verified user identity/OAuth before multi-user rollout.
  return "owner";
}

function validString(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.length <= max;
}

function parseTask(row) {
  return {
    id: row.id,
    title: row.title,
    brief: row.brief,
    projectId: row.project_id,
    repository: row.repository,
    priority: row.priority,
    status: row.status,
    correlationId: row.correlation_id,
    acceptanceCriteria: JSON.parse(row.acceptance_criteria_json),
    preferredProvider: row.preferred_provider,
    preferredRole: row.preferred_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createTask(request, env, userId) {
  const key = request.headers.get("Idempotency-Key");
  if (!validString(key, 8, 128)) return error("invalid_idempotency_key", "Idempotency-Key (8–128 chars) is required.", 400);

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 256_000) return error("payload_too_large", "Request body exceeds 256 KB.", 413);
  let body;
  try { body = await request.json(); } catch { return error("invalid_json", "Request body must be valid JSON.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return error("invalid_task", "Request body must be a JSON object.", 400);
  if (!validString(body.title, 1, 200) ||
      !validString(body.brief, 1, 20000) ||
      !validString(body.projectId, 1, 128) ||
      !Array.isArray(body.acceptanceCriteria) ||
      body.acceptanceCriteria.length < 1 ||
      body.acceptanceCriteria.length > 30 ||
      !body.acceptanceCriteria.every(x => validString(x, 1, 1000))) {
    return error("invalid_task", "title, brief, projectId and 1–30 non-empty acceptanceCriteria are required.", 400);
  }
  const priority = body.priority || "normal";
  if (!PRIORITIES.has(priority)) return error("invalid_priority", "Unsupported task priority.", 400);
  if (body.preferredProvider != null && !validString(body.preferredProvider, 1, 80)) return error("invalid_provider", "preferredProvider is invalid.", 400);
  if (body.preferredRole != null && !validString(body.preferredRole, 1, 80)) return error("invalid_role", "preferredRole is invalid.", 400);

  const now = new Date().toISOString();
  const proposedId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  try {
    // The conditional insert makes retries safe: only the request that owns the key creates a task.
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO idempotency_keys(user_id,idempotency_key,task_id,created_at) VALUES(?,?,?,?)"
      ).bind(userId, key, proposedId, now),
      env.DB.prepare(
        `INSERT OR IGNORE INTO tasks
        (id,user_id,title,brief,project_id,repository,priority,status,correlation_id,acceptance_criteria_json,preferred_provider,preferred_role,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,'new',?,?,?,?,?,?
        WHERE EXISTS (SELECT 1 FROM idempotency_keys WHERE user_id=? AND idempotency_key=? AND task_id=?)`
      ).bind(
        proposedId, userId, body.title.trim(), body.brief.trim(), body.projectId,
        typeof body.repository === "string" ? body.repository.slice(0, 300) : null,
        priority, correlationId, JSON.stringify(body.acceptanceCriteria),
        body.preferredProvider || null, body.preferredRole || null, now, now,
        userId, key, proposedId
      ),
      env.DB.prepare(
        `INSERT OR IGNORE INTO task_events(id,task_id,user_id,sequence,type,timestamp,summary,data_json)
        SELECT ?,?, ?,1,'created',?,'Task created from mobile client','{}'
        WHERE EXISTS (SELECT 1 FROM tasks WHERE id=? AND user_id=?)`
      ).bind(crypto.randomUUID(), proposedId, userId, now, proposedId, userId)
    ]);
  } catch {
    return error("storage_error", "Task could not be saved. Retry with the same Idempotency-Key.", 503);
  }

  const row = await env.DB.prepare(
    `SELECT t.* FROM tasks t
     JOIN idempotency_keys i ON i.task_id=t.id
     WHERE i.user_id=? AND i.idempotency_key=? AND t.user_id=?`
  ).bind(userId, key, userId).first();
  if (!row) return error("storage_error", "Task was not committed. Retry with the same Idempotency-Key.", 503);
  return json(parseTask(row), 201, { "idempotency-replayed": row.id === proposedId ? "false" : "true" });
}

async function listTasks(url, env, userId) {
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");
  const requestedLimit = Number(url.searchParams.get("limit") || 30);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 30;
  if (status && !TASK_STATUSES.has(status)) return error("invalid_status", "Unsupported task status.", 400);
  const clauses = ["user_id=?"];
  const args = [userId];
  if (projectId) { clauses.push("project_id=?"); args.push(projectId); }
  if (status) { clauses.push("status=?"); args.push(status); }
  args.push(limit);
  const rows = await env.DB.prepare(
    `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`
  ).bind(...args).all();
  return json({ items: (rows.results || []).map(parseTask), nextCursor: null });
}

async function getTask(id, env, userId) {
  const row = await env.DB.prepare("SELECT * FROM tasks WHERE id=? AND user_id=?").bind(id, userId).first();
  return row ? json(parseTask(row)) : error("not_found", "Task not found.", 404);
}

async function getEvents(id, url, env, userId) {
  const task = await env.DB.prepare("SELECT id FROM tasks WHERE id=? AND user_id=?").bind(id, userId).first();
  if (!task) return error("not_found", "Task not found.", 404);
  const requestedAfter = Number(url.searchParams.get("after") || 0);
  const after = Number.isFinite(requestedAfter) ? Math.max(Math.trunc(requestedAfter), 0) : 0;
  const requestedLimit = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500) : 100;
  const rows = await env.DB.prepare(
    "SELECT id,task_id,sequence,type,timestamp,summary,data_json FROM task_events WHERE task_id=? AND user_id=? AND sequence>? ORDER BY sequence LIMIT ?"
  ).bind(id, userId, after, limit).all();
  return json((rows.results || []).map(row => ({
    id: row.id, taskId: row.task_id, sequence: row.sequence, type: row.type,
    timestamp: row.timestamp, summary: row.summary, data: JSON.parse(row.data_json)
  })));
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors) return error("origin_not_allowed", "Configure CORS_ORIGIN to the exact allowed HTTPS origin.", 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "GET" && path === "/v1/health") {
      let healthy = false;
      if (env.DB && env.API_TOKEN_SHA256) {
        try {
          const probe = await env.DB.prepare("SELECT 1 AS ok").first();
          healthy = probe?.ok === 1;
        } catch {
          healthy = false;
        }
      }
      return json({ status: healthy ? "ok" : "degraded", apiVersion: "1.0.0" }, 200, cors);
    }
    if (!["GET", "POST"].includes(request.method)) return error("method_not_allowed", "Method not allowed.", 405);

    const userId = await authenticate(request, env);
    if (!userId) return error("unauthorized", "A valid bearer token is required.", 401);
    if (!env.DB) return error("service_unavailable", "D1 database binding is missing.", 503);

    try {
      if (path === "/v1/tasks" && request.method === "GET") return await listTasks(url, env, userId);
      if (path === "/v1/tasks" && request.method === "POST") return await createTask(request, env, userId);
      const match = /^\/v1\/tasks\/([0-9a-f-]{36})(?:\/(events|runs))?$/.exec(path);
      if (match) {
        const [, id, child] = match;
        if (child === "events" && request.method === "GET") return await getEvents(id, url, env, userId);
        if (child === "runs" && request.method === "POST") {
          return error("provider_not_configured", "No provider worker is connected yet; task dispatch is intentionally disabled.", 503);
        }
        if (!child && request.method === "GET") return await getTask(id, env, userId);
      }
      return error("not_found", "Endpoint not found.", 404);
    } catch {
      return error("internal_error", "Unexpected server error. No internal details were exposed.", 500);
    }
  }
};
