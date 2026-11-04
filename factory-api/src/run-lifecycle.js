const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer"
};

const TRANSITIONS = {
  claimed: {
    dispatching: { event: "dispatch_started", requires: "dispatch" }
  },
  dispatching: {
    accepted: { event: "provider_accepted", requires: "providerRequestId" },
    failed: { event: "failed", requires: "definite_rejection" },
    outcome_unknown: { event: "outcome_unknown", requires: "ambiguous" }
  },
  accepted: {
    running: { event: "provider_progress" },
    review: { event: "review_started" },
    outcome_unknown: { event: "outcome_unknown", requires: "ambiguous" }
  },
  running: {
    review: { event: "review_started" },
    failed: { event: "failed", requires: "execution_failed" },
    outcome_unknown: { event: "outcome_unknown", requires: "ambiguous" }
  },
  review: {
    failed: { event: "failed", requires: "execution_failed" }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function error(code, message, status) {
  return json({ error: { code, message } }, status);
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readLimitedJson(request, limit = 8192) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return false;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export async function transitionProviderRun(request, runId, env) {
  const expectedToken = env.FACTORY_RUNNER_TOKEN;
  const match = /^Bearer ([A-Za-z0-9._~-]{32,512})$/.exec(request.headers.get("Authorization") || "");
  if (!expectedToken || !match || !safeEqual(match[1], expectedToken)) {
    return error("unauthorized_runner", "A valid factory runner credential is required.", 401);
  }
  if (!env.DB) return error("service_unavailable", "D1 database binding is missing.", 503);

  const body = await readLimitedJson(request);
  if (body === false) return error("payload_too_large", "Transition body exceeds 8 KB.", 413);
  if (!body) return error("invalid_transition", "Transition body must be a JSON object.", 400);

  const { expectedStatus, nextStatus, summary } = body;
  if (typeof expectedStatus !== "string" || typeof nextStatus !== "string" ||
      typeof summary !== "string" || !summary.trim() || summary.length > 500) {
    return error("invalid_transition", "expectedStatus, nextStatus and a short summary are required.", 400);
  }
  const transition = TRANSITIONS[expectedStatus]?.[nextStatus];
  if (!transition) {
    return error("transition_not_allowed", "This run status transition is not enabled.", 409);
  }

  let extraData = {};
  if (transition.requires === "providerRequestId") {
    if (typeof body.providerRequestId !== "string" ||
        !/^[A-Za-z0-9._:-]{1,200}$/.test(body.providerRequestId)) {
      return error("provider_request_id_required", "A validated providerRequestId is required for acceptance.", 400);
    }
    extraData.providerRequestId = body.providerRequestId;
  } else if (transition.requires === "definite_rejection" || transition.requires === "execution_failed") {
    const requiredKind = transition.requires;
    if (body.failureKind !== requiredKind || typeof body.reasonCode !== "string" ||
        !/^[A-Za-z0-9._-]{1,80}$/.test(body.reasonCode)) {
      return error("failure_evidence_required", "A bounded failureKind and reasonCode are required.", 400);
    }
    extraData.failureKind = requiredKind;
    extraData.reasonCode = body.reasonCode;
  } else if (transition.requires === "ambiguous") {
    if (body.outcomeKind !== "timeout" && body.outcomeKind !== "connection_lost" &&
        body.outcomeKind !== "process_interrupted" && body.outcomeKind !== "ambiguous_response") {
      return error("outcome_evidence_required", "A recognized ambiguous outcomeKind is required.", 400);
    }
    extraData.outcomeKind = body.outcomeKind;
  }

  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const dataJson = JSON.stringify(extraData);
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE task_runs
         SET status=?, updated_at=?,
             provider_request_id=CASE WHEN ? IS NOT NULL THEN ? ELSE provider_request_id END,
             dispatched_at=CASE WHEN ?='dispatching' AND dispatched_at IS NULL THEN ? ELSE dispatched_at END,
             finished_at=CASE WHEN ?='failed' THEN ? ELSE finished_at END,
             outcome_note=CASE WHEN ? IN ('failed','outcome_unknown') THEN ? ELSE outcome_note END
         WHERE id=? AND status=?`
      ).bind(
        nextStatus, now,
        extraData.providerRequestId ?? null, extraData.providerRequestId ?? null,
        nextStatus, now, nextStatus, now, nextStatus,
        extraData.reasonCode || extraData.outcomeKind || null,
        runId, expectedStatus
      ),
      env.DB.prepare(
        `INSERT INTO task_run_events
         (id,run_id,task_id,sequence,type,timestamp,summary,data_json)
         SELECT ?,?,task_id,
           (SELECT COALESCE(MAX(sequence),0)+1 FROM task_run_events WHERE run_id=?),
           ?,?,?,?
         FROM task_runs
         WHERE id=? AND status=? AND updated_at=?`
      ).bind(eventId, runId, runId, transition.event, now, summary.trim(), dataJson,
        runId, nextStatus, now),
      env.DB.prepare(
        `INSERT INTO task_run_events
         (id,run_id,task_id,sequence,type,timestamp,summary,data_json)
         SELECT NULL,NULL,NULL,1,'blocked',?,'Transition event guard failed','{}'
         WHERE EXISTS (
           SELECT 1 FROM task_runs WHERE id=? AND status=? AND updated_at=?
         )
         AND NOT EXISTS (
           SELECT 1 FROM task_run_events WHERE id=? AND run_id=?
         )`
      ).bind(now, runId, nextStatus, now, eventId, runId)
    ]);
    const changed = results?.[0]?.meta?.changes;
    if (changed !== 1) return error("stale_run_state", "Run was not changed: its current status differs from expectedStatus.", 409);
    return json({ accepted: true, runId, previousStatus: expectedStatus, status: nextStatus, eventId, timestamp: now }, 201);
  } catch {
    return error("transition_write_failed", "Transition and audit event could not be committed atomically.", 503);
  }
}
