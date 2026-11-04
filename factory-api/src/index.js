import { transitionProviderRun } from "./run-lifecycle.js";
import { executeProvider, providerAvailability } from "./provider-adapters.js";

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

async function readJsonBodyLimited(request, maxBytes) {
  if (!request.body) return { invalid: true };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { invalid: true };
  }
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

  const parsed = await readJsonBodyLimited(request, 256_000);
  if (parsed.tooLarge) return error("payload_too_large", "Request body exceeds 256 KB.", 413);
  if (parsed.invalid) return error("invalid_json", "Request body must be valid UTF-8 JSON.", 400);
  const body = parsed.body;
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


function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

async function claimProviderRun(request, taskId, env) {
  const parsed = await readJsonBodyLimited(request, 64_000);
  if (parsed.tooLarge) return error("payload_too_large", "Run request exceeds 64 KB.", 413);
  if (parsed.invalid || !parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) {
    return error("invalid_run", "Run request must be a JSON object.", 400);
  }
  const body = parsed.body;
  if (!validString(body.runKey, 8, 128) ||
      !["claude", "gemini", "openai"].includes(body.provider) ||
      !["implementer", "reviewer", "researcher", "tester"].includes(body.role) ||
      !validString(body.model, 1, 120) ||
      !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return error("invalid_run", "runKey, an allowed provider and role, model, and object payload are required.", 400);
  }
  const payloadJson = JSON.stringify(canonicalize(body.payload));
  if (payloadJson.length > 48_000) return error("payload_too_large", "Normalized provider payload exceeds 48 KB.", 413);
  const fingerprint = await sha256Hex(JSON.stringify({
    provider: body.provider,
    role: body.role,
    model: body.model.trim(),
    payload: JSON.parse(payloadJson)
  }));
  const task = await env.DB.prepare(
    "SELECT id,user_id,preferred_provider,preferred_role FROM tasks WHERE id=?"
  ).bind(taskId).first();
  if (!task) return error("not_found", "Task not found.", 404);
  if ((task.preferred_provider && task.preferred_provider !== body.provider) ||
      (task.preferred_role && task.preferred_role !== body.role)) {
    return error("run_policy_conflict", "Provider or role does not match this task's configured preference.", 409);
  }

  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  const dispatchToken = crypto.randomUUID();
  try {
    // D1 batch is transactional: claim and first audit event commit together.
    // OR IGNORE makes same-key and active-run races resolve at the unique indexes.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO task_runs
         (id,task_id,user_id,run_key,provider,role,status,attempt,dispatch_token,request_fingerprint,created_at,updated_at)
         SELECT ?,?,?,?,?,?,'claimed',1,?,?,?,?
         WHERE EXISTS (SELECT 1 FROM tasks WHERE id=?)`
      ).bind(runId, taskId, task.user_id, body.runKey.trim(), body.provider, body.role,
        dispatchToken, fingerprint, now, now, taskId),
      env.DB.prepare(
        `INSERT OR IGNORE INTO task_run_events(id,run_id,task_id,sequence,type,timestamp,summary,data_json)
         SELECT ?,?, ?,1,'claimed',?,'Provider run claimed',?
         WHERE EXISTS (SELECT 1 FROM task_runs WHERE id=? AND task_id=? AND status='claimed')`
      ).bind(crypto.randomUUID(), runId, taskId, now,
        JSON.stringify({ provider: body.provider, role: body.role, model: body.model.trim() }), runId, taskId)
    ]);
  } catch {
    return error("run_claim_conflict", "Run claim could not be committed. No provider request was sent.", 409);
  }

  const existing = await env.DB.prepare(
    "SELECT id,task_id,run_key,provider,role,status,attempt,request_fingerprint,created_at,updated_at,provider_request_id FROM task_runs WHERE task_id=? AND run_key=?"
  ).bind(taskId, body.runKey.trim()).first();
  if (existing) {
    if (existing.request_fingerprint !== fingerprint) {
      return error("run_key_conflict", "This runKey is already bound to a different normalized request.", 409);
    }
    return json({
      runId: existing.id, taskId: existing.task_id, runKey: existing.run_key,
      provider: existing.provider, role: existing.role, status: existing.status,
      attempt: existing.attempt, createdAt: existing.created_at,
      updatedAt: existing.updated_at, providerRequestId: existing.provider_request_id,
      replayed: existing.id !== runId
    }, existing.id === runId ? 201 : 200);
  }
  const active = await env.DB.prepare(
    "SELECT id,status FROM task_runs WHERE task_id=? AND status NOT IN ('failed','completed','cancelled') ORDER BY created_at DESC LIMIT 1"
  ).bind(taskId).first();
  if (active) return error("active_run_exists", "Another non-terminal run already reserves this task.", 409);
  return error("run_claim_conflict", "Run claim was not created. No provider request was sent.", 409);
}

async function dispatchTask(request, taskId, env, userId) {
  if (!env.FACTORY_RUNNER_TOKEN) return error("runner_not_configured", "Trusted Factory runner is not configured.", 503);
  const task = await env.DB.prepare(
    "SELECT id,user_id,title,brief,acceptance_criteria_json,preferred_provider,preferred_role FROM tasks WHERE id=? AND user_id=?"
  ).bind(taskId, userId).first();
  if (!task) return error("not_found", "Task not found.", 404);

  const parsed = await readJsonBodyLimited(request, 8_192);
  if (parsed.tooLarge) return error("payload_too_large", "Dispatch request exceeds 8 KB.", 413);
  if (parsed.invalid || !parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) {
    return error("invalid_dispatch", "Dispatch request must be a JSON object.", 400);
  }
  const body = parsed.body;
  if (!validString(body.runKey, 8, 128)) return error("invalid_run_key", "A stable runKey (8–128 characters) is required.", 400);
  const requestedProvider = body.provider || "auto";
  if (!["auto", "claude", "gemini", "openai"].includes(requestedProvider)) {
    return error("invalid_provider", "Choose auto, claude, gemini or openai.", 400);
  }
  const availability = providerAvailability(env);
  const configured = availability.filter(item => item.configured);
  const selected = requestedProvider === "auto"
    ? configured.find(item => !task.preferred_provider || item.id === task.preferred_provider)
    : availability.find(item => item.id === requestedProvider && item.configured);
  if (!selected) {
    return json({
      error: { code: "provider_not_configured", message: "No configured provider is available for this task. Add provider API credentials as Worker secrets; no run was created." },
      providers: availability.map(({ id, configured: ready }) => ({ id, configured: ready }))
    }, 503);
  }
  if (task.preferred_provider && task.preferred_provider !== selected.id) {
    return error("run_policy_conflict", "Selected provider does not match this task's configured preference.", 409);
  }
  if (task.preferred_role && body.role && task.preferred_role !== body.role) {
    return error("run_policy_conflict", "Selected role does not match this task's configured preference.", 409);
  }
  const role = body.role || task.preferred_role || "implementer";
  const allowedRoles = ["implementer", "reviewer", "researcher", "tester"];
  if (!allowedRoles.includes(role)) return error("invalid_role", "Unsupported agent role.", 400);
  const model = body.model || selected.defaultModel;
  const criteria = JSON.parse(task.acceptance_criteria_json || "[]");
  const prompt = [
    "You are an AI specialist working inside Universal AI Factory.",
    `Role: ${role}. Return a substantive, evidence-based response. Do not claim to have edited repositories, run tests, deployed or contacted other agents unless the request explicitly supplies evidence.`,
    `Task title: ${task.title}`,
    `Task brief:\n${task.brief}`,
    `Acceptance criteria:\n${criteria.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    "If implementation is requested, provide exact file-level changes or a complete patch proposal and list tests that must be run. Clearly separate completed work from recommendations and unknowns."
  ].join("\n\n");
  const claimRequest = new Request(`https://factory.internal/v1/tasks/${taskId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runKey: body.runKey,
      provider: selected.id,
      role,
      model,
      payload: { prompt }
    })
  });
  const claim = await claimProviderRun(claimRequest, taskId, env);
  if (claim.status !== 201) {
    if (claim.status === 200) {
      const replay = await claim.json();
      return json({ error: { code: "run_already_claimed", message: "This run key already exists. It was not dispatched again." }, run: replay }, 409);
    }
    return claim;
  }
  const run = await claim.json();
  const runnerRequest = (payload) => new Request(`https://factory.internal/v1/runs/${run.runId}/transitions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.FACTORY_RUNNER_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const started = await transitionProviderRun(runnerRequest({
    expectedStatus: "claimed", nextStatus: "dispatching", summary: `Dispatching to ${selected.id}`
  }), run.runId, env);
  if (started.status !== 201) return error("run_start_failed", "Run was claimed but dispatch could not safely start. Do not retry with a new run key.", 503);

  let result;
  try {
    result = await executeProvider({ provider: selected.id, model, prompt, env });
  } catch (failure) {
    const ambiguous = failure.kind === "ambiguous";
    await transitionProviderRun(runnerRequest(ambiguous ? {
      expectedStatus: "dispatching", nextStatus: "outcome_unknown",
      outcomeKind: "ambiguous_response", summary: "Provider outcome is unknown; automatic retry is blocked"
    } : {
      expectedStatus: "dispatching", nextStatus: "failed",
      failureKind: "definite_rejection", reasonCode: failure.reasonCode || "provider_rejected",
      summary: "Provider rejected the request before accepting work"
    }), run.runId, env);
    return json({
      runId: run.runId,
      status: ambiguous ? "outcome_unknown" : "failed",
      error: { code: ambiguous ? "provider_outcome_unknown" : "provider_rejected", message: failure.message }
    }, ambiguous ? 202 : 502);
  }

  const accepted = await transitionProviderRun(runnerRequest({
    expectedStatus: "dispatching", nextStatus: "accepted",
    ...(result.providerRequestId ? { providerRequestId: result.providerRequestId } : { responseReceived: true }),
    summary: "Provider returned a valid response"
  }), run.runId, env);
  if (accepted.status !== 201) {
    return json({ runId: run.runId, status: "outcome_unknown", error: { code: "ledger_acceptance_unconfirmed", message: "A provider response arrived, but its acceptance could not be recorded. Do not retry automatically." } }, 202);
  }

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO task_run_outputs(run_id,task_id,user_id,provider,model,provider_request_id,output_text,created_at) VALUES(?,?,?,?,?,?,?,?)"
    ).bind(run.runId, taskId, userId, result.provider, result.model, result.providerRequestId, result.output, now).run();
  } catch {
    return error("output_persistence_failed", "Provider responded, but the output could not be saved. The run remains accepted and must not be repeated.", 503);
  }
  const reviewed = await transitionProviderRun(runnerRequest({
    expectedStatus: "accepted", nextStatus: "review", summary: "Provider output saved and awaits independent review"
  }), run.runId, env);
  if (reviewed.status !== 201) {
    return json({ runId: run.runId, status: "accepted", output: result.output, error: { code: "review_transition_pending", message: "Output is saved; review state needs reconciliation." } }, 202);
  }
  await env.DB.prepare("UPDATE tasks SET status='review',updated_at=? WHERE id=? AND user_id=?")
    .bind(now, taskId, userId).run();
  return json({
    runId: run.runId, taskId, provider: result.provider, model: result.model,
    providerRequestId: result.providerRequestId, status: "review", output: result.output
  }, 201);
}

async function getRunOutput(taskId, runId, env, userId) {
  const row = await env.DB.prepare(
    "SELECT o.run_id,o.task_id,o.provider,o.model,o.provider_request_id,o.output_text,o.created_at FROM task_run_outputs o JOIN tasks t ON t.id=o.task_id WHERE o.task_id=? AND o.run_id=? AND o.user_id=? AND t.user_id=?"
  ).bind(taskId, runId, userId, userId).first();
  if (!row) return error("not_found", "Run output not found.", 404);
  return json({
    runId: row.run_id, taskId: row.task_id, provider: row.provider, model: row.model,
    providerRequestId: row.provider_request_id, output: row.output_text, createdAt: row.created_at
  });
}

async function recordRunnerEvent(request, id, env) {
  const expected = env.FACTORY_RUNNER_TOKEN;
  const match = /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(request.headers.get("Authorization") || "");
  const supplied = match?.[1] || "";
  if (!expected || !match || !constantTimeEqual(supplied, expected)) {
    return error("unauthorized_runner", "A valid factory runner credential is required.", 401);
  }
  const parsed = await readJsonBodyLimited(request, 8_192);
  if (parsed.tooLarge) return error("payload_too_large", "Event body exceeds 8 KB.", 413);
  if (parsed.invalid || !parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) {
    return error("invalid_event", "Event body must be a JSON object.", 400);
  }
  const body = parsed.body;
  const allowedTypes = new Set(["progress", "status", "log", "failed"]);
  if (!allowedTypes.has(body.type)) return error("invalid_event_type", "Unsupported runner event type.", 400);
  if (!validString(body.summary, 1, 500)) return error("invalid_summary", "A short event summary is required.", 400);
  if (body.progressPercent != null &&
      (!Number.isInteger(body.progressPercent) || body.progressPercent < 0 || body.progressPercent > 100)) {
    return error("invalid_progress", "progressPercent must be an integer from 0 to 100.", 400);
  }
  const allowedStatuses = new Set(["queued", "accepted", "planning", "running", "review", "needs_approval", "blocked", "partial", "failed", "cancelled"]);
  if (body.status != null && !allowedStatuses.has(body.status)) {
    return error("invalid_status", "Unsupported runner task status.", 400);
  }
  const task = await env.DB.prepare("SELECT id,user_id FROM tasks WHERE id=?").bind(id).first();
  if (!task) return error("not_found", "Task not found.", 404);

  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const data = {
    ...(body.progressPercent == null ? {} : { progressPercent: body.progressPercent }),
    ...(body.status == null ? {} : { status: body.status }),
    ...(validString(body.provider, 1, 80) ? { provider: body.provider } : {}),
    ...(validString(body.role, 1, 80) ? { role: body.role } : {})
  };
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO task_events(id,task_id,user_id,sequence,type,timestamp,summary,data_json)
         SELECT ?,?,?,COALESCE(MAX(sequence),0)+1,?,?,?,?
         FROM task_events WHERE task_id=? AND user_id=?`
      ).bind(eventId, id, task.user_id, body.type, now, body.summary.trim(), JSON.stringify(data), id, task.user_id),
      ...(body.status ? [env.DB.prepare(
        "UPDATE tasks SET status=?,updated_at=? WHERE id=?"
      ).bind(body.status, now, id)] : [])
    ]);
  } catch {
    return error("event_write_conflict", "Runner event could not be committed. Retry with a new event request.", 503);
  }
  return json({ accepted: true, eventId, taskId: id, timestamp: now }, 201);
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
    const respond = response => {
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(cors)) headers.set(name, value);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    };

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
      return respond(json({ status: healthy ? "ok" : "degraded", apiVersion: "1.0.0" }));
    }
    if (!["GET", "POST"].includes(request.method)) return respond(error("method_not_allowed", "Method not allowed.", 405));

    const runnerEventMatch = /^\/v1\/tasks\/([0-9a-f-]{36})\/events$/.exec(path);
    if (runnerEventMatch && request.method === "POST") {
      if (!env.DB) return respond(error("service_unavailable", "D1 database binding is missing.", 503));
      return respond(await recordRunnerEvent(request, runnerEventMatch[1], env));
    }

    const runTransitionMatch = /^\/v1\/runs\/([0-9a-f-]{36})\/transitions$/.exec(path);
    if (runTransitionMatch && request.method === "POST") {
      return respond(await transitionProviderRun(request, runTransitionMatch[1], env));
    }

    const runnerRunMatch = /^\/v1\/tasks\/([0-9a-f-]{36})\/runs$/.exec(path);
    if (runnerRunMatch && request.method === "POST") {
      const expected = env.FACTORY_RUNNER_TOKEN;
      const match = /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(request.headers.get("Authorization") || "");
      const supplied = match?.[1] || "";
      if (!expected || !match || !constantTimeEqual(supplied, expected)) {
        return respond(error("unauthorized_runner", "A valid factory runner credential is required.", 401));
      }
      if (!env.DB) return respond(error("service_unavailable", "D1 database binding is missing.", 503));
      try {
        return respond(await claimProviderRun(request, runnerRunMatch[1], env));
      } catch {
        return respond(error("internal_error", "Run claim failed safely. No provider request was sent.", 500));
      }
    }

    const userId = await authenticate(request, env);
    if (!userId) return respond(error("unauthorized", "A valid bearer token is required.", 401));
    if (!env.DB) return respond(error("service_unavailable", "D1 database binding is missing.", 503));

    try {
      if (path === "/v1/providers" && request.method === "GET") {
        return respond(json({ providers: providerAvailability(env).map(({ id, configured, defaultModel }) => ({ id, configured, defaultModel })) }));
      }
      const dispatchMatch = /^\\/v1\\/tasks\\/([0-9a-f-]{36})\\/dispatch$/.exec(path);
      if (dispatchMatch && request.method === "POST") return respond(await dispatchTask(request, dispatchMatch[1], env, userId));
      const outputMatch = /^\\/v1\\/tasks\\/([0-9a-f-]{36})\\/runs\\/([0-9a-f-]{36})\\/output$/.exec(path);
      if (outputMatch && request.method === "GET") return respond(await getRunOutput(outputMatch[1], outputMatch[2], env, userId));
      if (path === "/v1/tasks" && request.method === "GET") return respond(await listTasks(url, env, userId));
      if (path === "/v1/tasks" && request.method === "POST") return respond(await createTask(request, env, userId));
      const match = /^\/v1\/tasks\/([0-9a-f-]{36})(?:\/(events|runs))?$/.exec(path);
      if (match) {
        const [, id, child] = match;
        if (child === "events" && request.method === "GET") return respond(await getEvents(id, url, env, userId));
        if (!child && request.method === "GET") return respond(await getTask(id, env, userId));
      }
      return respond(error("not_found", "Endpoint not found.", 404));
    } catch {
      return respond(error("internal_error", "Unexpected server error. No internal details were exposed.", 500));
    }
  }
};
