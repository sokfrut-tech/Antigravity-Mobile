import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import worker from "../src/index.js";

const allowedOrigin = "https://mobile.example.test";

test("health endpoint reports configured bootstrap service", async () => {
  const request = new Request("https://api.example.test/v1/health", {
    headers: { Origin: allowedOrigin }
  });
  const response = await worker.fetch(request, {
    DB: { prepare: () => ({ first: async () => ({ ok: 1 }) }) },
    API_TOKEN_SHA256: "configured",
    CORS_ORIGIN: allowedOrigin
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", apiVersion: "1.0.0" });
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("health endpoint reports degraded when D1 is not configured", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/health"),
    { API_TOKEN_SHA256: "configured", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "degraded", apiVersion: "1.0.0" });
});

test("health reports degraded when D1 probe fails", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/health"),
    { DB: { prepare: () => ({ first: async () => { throw new Error("offline"); } }) }, API_TOKEN_SHA256: "configured", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "degraded", apiVersion: "1.0.0" });
});

test("wildcard CORS configuration is rejected", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/health", {
      headers: { Origin: allowedOrigin }
    }),
    { DB: {}, API_TOKEN_SHA256: "configured", CORS_ORIGIN: "*" }
  );
  assert.equal(response.status, 403);
});

test("unlisted browser origin is rejected", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/health", {
      headers: { Origin: "https://attacker.example" }
    }),
    { DB: {}, API_TOKEN_SHA256: "configured", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 403);
});

test("task endpoints reject requests without a bearer token", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks", { headers: { Origin: allowedOrigin } }),
    { DB: {}, API_TOKEN_SHA256: "configured", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.deepEqual(await response.json(), {
    error: { code: "unauthorized", message: "A valid bearer token is required." }
  });
});

test("unsupported HTTP methods are rejected before authentication", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks", { method: "DELETE" }),
    { DB: {}, API_TOKEN_SHA256: "configured", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 405);
});

test("task creation rejects a body over 256 KB even without Content-Length", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks", {
      method: "POST",
      headers: {
        Origin: allowedOrigin,
        Authorization: "Bearer 0123456789abcdef0123456789abcdef",
        "Idempotency-Key": "oversized-request-key"
      },
      body: JSON.stringify({ title: "Large", brief: "x".repeat(257_000), projectId: "test", acceptanceCriteria: ["test"] })
    }),
    { DB: {}, API_TOKEN_SHA256: createHash("sha256").update("0123456789abcdef0123456789abcdef").digest("hex"), CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 413);
});


test("runner events require a separate runner credential", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks/00000000-0000-4000-8000-000000000000/events", {
      method: "POST",
      headers: { Origin: allowedOrigin, Authorization: "Bearer owner-token" },
      body: JSON.stringify({ type: "progress", summary: "Working", progressPercent: 25 })
    }),
    { DB: {}, API_TOKEN_SHA256: createHash("sha256").update("0123456789abcdef0123456789abcdef").digest("hex"),
      FACTORY_RUNNER_TOKEN: "runner-secret-value-0123456789abcdef0123456789", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 401);
});

test("runner event rejects out-of-range progress", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks/00000000-0000-4000-8000-000000000000/events", {
      method: "POST",
      headers: { Origin: allowedOrigin, Authorization: "Bearer runner-secret-value-0123456789abcdef0123456789" },
      body: JSON.stringify({ type: "progress", summary: "Working", progressPercent: 140 })
    }),
    { DB: {}, FACTORY_RUNNER_TOKEN: "runner-secret-value-0123456789abcdef0123456789", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_progress");
});


test("trusted runner can append a bounded progress event", async () => {
  let batches = 0;
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => ({ id: "00000000-0000-4000-8000-000000000000", user_id: "owner" }),
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
        sql, args
      })
    }),
    batch: async () => { batches += 1; return []; }
  };
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks/00000000-0000-4000-8000-000000000000/events", {
      method: "POST",
      headers: { Origin: allowedOrigin, Authorization: "Bearer runner-secret-value-0123456789abcdef0123456789", "Content-Type": "application/json" },
      body: JSON.stringify({ type: "progress", summary: "Agent completed analysis", progressPercent: 42, status: "running" })
    }),
    { DB: db, FACTORY_RUNNER_TOKEN: "runner-secret-value-0123456789abcdef0123456789", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 201);
  assert.equal(batches, 1);
  assert.equal((await response.json()).accepted, true);
});


test("provider run route rejects the mobile owner token", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks/00000000-0000-4000-8000-000000000000/runs", {
      method: "POST",
      headers: { Origin: allowedOrigin, Authorization: "Bearer 0123456789abcdef0123456789abcdef", "Content-Type": "application/json" },
      body: JSON.stringify({ runKey: "mobile-run-key-001", provider: "claude", role: "implementer" })
    }),
    {
      DB: {},
      API_TOKEN_SHA256: createHash("sha256").update("0123456789abcdef0123456789abcdef").digest("hex"),
      FACTORY_RUNNER_TOKEN: "runner-secret-value-0123456789abcdef0123456789",
      CORS_ORIGIN: allowedOrigin
    }
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "unauthorized_runner");
});

test("provider run route accepts only runner authentication but keeps dispatch disabled", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks/00000000-0000-4000-8000-000000000000/runs", {
      method: "POST",
      headers: { Origin: allowedOrigin, Authorization: "Bearer runner-secret-value-0123456789abcdef0123456789", "Content-Type": "application/json" },
      body: JSON.stringify({ runKey: "runner-run-key-001", provider: "claude", role: "implementer" })
    }),
    {
      DB: {},
      API_TOKEN_SHA256: createHash("sha256").update("0123456789abcdef0123456789abcdef").digest("hex"),
      FACTORY_RUNNER_TOKEN: "runner-secret-value-0123456789abcdef0123456789",
      CORS_ORIGIN: allowedOrigin
    }
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "provider_not_configured");
});


function providerRunDb({ preferredProvider = null, preferredRole = null } = {}) {
  const taskId = "00000000-0000-4000-8000-000000000000";
  const runs = new Map();
  const events = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          if (sql.includes("FROM tasks WHERE id=?")) {
            return { id: taskId, user_id: "owner", preferred_provider: preferredProvider, preferred_role: preferredRole };
          }
          if (sql.includes("FROM task_runs WHERE task_id=? AND run_key=?")) {
            return [...runs.values()].find(row => row.task_id === this.args[0] && row.run_key === this.args[1]) || null;
          }
          if (sql.includes("FROM task_runs WHERE task_id=? AND status NOT IN")) {
            return [...runs.values()].find(row => row.task_id === this.args[0] && !["failed", "completed", "cancelled"].includes(row.status)) || null;
          }
          return null;
        }
      };
    },
    async batch(statements) {
      const claim = statements[0];
      const [id, task, user, runKey, provider, role, dispatchToken, fingerprint, now] = claim.args;
      const sameKey = [...runs.values()].find(row => row.task_id === task && row.run_key === runKey);
      const active = [...runs.values()].find(row => row.task_id === task && !["failed", "completed", "cancelled"].includes(row.status));
      if (!sameKey && !active) {
        runs.set(id, {
          id, task_id: task, user_id: user, run_key: runKey, provider, role,
          status: "claimed", attempt: 1, dispatch_token: dispatchToken,
          request_fingerprint: fingerprint, created_at: now, updated_at: now,
          provider_request_id: null
        });
        events.push({ runId: id, taskId: task, sequence: 1, type: "claimed" });
      }
      return [];
    }
  };
  return { DB: db, runs, events, taskId };
}

function providerRunRequest(taskId, token, body) {
  return new Request(`https://api.example.test/v1/tasks/${taskId}/runs`, {
    method: "POST",
    headers: { Origin: allowedOrigin, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const runnerToken = "runner-secret-value-0123456789abcdef0123456789";
const validRunBody = {
  runKey: "stable-run-key-001",
  provider: "claude",
  role: "implementer",
  model: "claude-sonnet",
  payload: { prompt: "Review task", options: { temperature: 0 } }
};

test("provider run claim is durable and same-key retry returns the existing run", async () => {
  const store = providerRunDb();
  const first = await worker.fetch(providerRunRequest(store.taskId, runnerToken, validRunBody), {
    ...store, FACTORY_RUNNER_TOKEN: runnerToken, CORS_ORIGIN: allowedOrigin
  });
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.status, "claimed");
  assert.equal(firstBody.replayed, false);
  const replay = await worker.fetch(providerRunRequest(store.taskId, runnerToken, {
    ...validRunBody, payload: { options: { temperature: 0 }, prompt: "Review task" }
  }), { ...store, FACTORY_RUNNER_TOKEN: runnerToken, CORS_ORIGIN: allowedOrigin });
  assert.equal(replay.status, 200);
  const replayBody = await replay.json();
  assert.equal(replayBody.runId, firstBody.runId);
  assert.equal(replayBody.replayed, true);
  assert.equal(store.runs.size, 1);
  assert.equal(store.events.length, 1);
});

test("provider run claim rejects a reused key with a different fingerprint", async () => {
  const store = providerRunDb();
  await worker.fetch(providerRunRequest(store.taskId, runnerToken, validRunBody), {
    ...store, FACTORY_RUNNER_TOKEN: runnerToken, CORS_ORIGIN: allowedOrigin
  });
  const response = await worker.fetch(providerRunRequest(store.taskId, runnerToken, {
    ...validRunBody, payload: { prompt: "Different work" }
  }), { ...store, FACTORY_RUNNER_TOKEN: runnerToken, CORS_ORIGIN: allowedOrigin });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "run_key_conflict");
  assert.equal(store.runs.size, 1);
  assert.equal(store.events.length, 1);
});

test("provider run claim blocks a different key while a run is active", async () => {
  const store = providerRunDb();
  await worker.fetch(providerRunRequest(store.taskId, runnerToken, validRunBody), {
    ...store, FACTORY_RUNNER_TOKEN: runnerToken, CORS_ORIGIN: allowedOrigin
  });
  const response = await worker.fetch(providerRunRequest(store.taskId, runnerToken, {
    ...validRunBody, runKey: "another-run-key-002"
  }), { ...store, FACTORY_RUNNER_TOKEN: runnerToken, CORS_ORIGIN: allowedOrigin });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "active_run_exists");
  assert.equal(store.runs.size, 1);
});

test("provider run claim enforces task provider and role preferences", async () => {
  const store = providerRunDb({ preferredProvider: "gemini", preferredRole: "reviewer" });
  const response = await worker.fetch(providerRunRequest(store.taskId, runnerToken, validRunBody), {
    ...store, FACTORY_RUNNER_TOKEN: runnerToken, CORS_ORIGIN: allowedOrigin
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "run_policy_conflict");
  assert.equal(store.runs.size, 0);
});
