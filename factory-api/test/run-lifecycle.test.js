import test from "node:test";
import assert from "node:assert/strict";
import { transitionProviderRun } from "../src/run-lifecycle.js";

const token = "runner-secret-value-0123456789abcdef0123456789";
const runId = "00000000-0000-4000-8000-000000000001";

function request(body, auth = `Bearer ${token}`) {
  return new Request(`https://api.example.test/v1/runs/${runId}/transitions`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function env({ changes = 1 } = {}) {
  const calls = [];
  return {
    calls,
    FACTORY_RUNNER_TOKEN: token,
    DB: {
      prepare(sql) {
        return { sql, args: [], bind(...args) { this.args = args; return this; } };
      },
      async batch(statements) {
        calls.push(statements);
        return [{ meta: { changes } }, { meta: { changes: 1 } }, { meta: { changes: 0 } }];
      }
    }
  };
}

test("run transition requires the dedicated runner token", async () => {
  const response = await transitionProviderRun(request({
    expectedStatus: "claimed", nextStatus: "dispatching", summary: "Dispatch started"
  }, "Bearer mobile-owner-token"), runId, env());
  assert.equal(response.status, 401);
});

test("run transition rejects completion and other disabled transitions", async () => {
  const store = env();
  const response = await transitionProviderRun(request({
    expectedStatus: "review", nextStatus: "completed", summary: "Done"
  }), runId, store);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "transition_not_allowed");
  assert.equal(store.calls.length, 0);
});

test("acceptance requires a provider request ID", async () => {
  const store = env();
  const response = await transitionProviderRun(request({
    expectedStatus: "dispatching", nextStatus: "accepted", summary: "Accepted"
  }), runId, store);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "provider_request_id_required");
  assert.equal(store.calls.length, 0);
});

test("a valid transition batches compare-and-set and append-only event with rollback guard", async () => {
  const store = env();
  const response = await transitionProviderRun(request({
    expectedStatus: "dispatching",
    nextStatus: "accepted",
    providerRequestId: "provider-request-123",
    summary: "Provider accepted request"
  }), runId, store);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, "accepted");
  assert.equal(store.calls.length, 1);
  assert.equal(store.calls[0].length, 3);
  assert.match(store.calls[0][0].sql, /WHERE id=\? AND status=\?/);
  assert.match(store.calls[0][1].sql, /INSERT INTO task_run_events/);
  assert.match(store.calls[0][2].sql, /AND NOT EXISTS/);
});

test("stale expected status returns conflict", async () => {
  const store = env({ changes: 0 });
  const response = await transitionProviderRun(request({
    expectedStatus: "claimed", nextStatus: "dispatching", summary: "Dispatch started"
  }), runId, store);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "stale_run_state");
});
