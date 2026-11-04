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
      FACTORY_RUNNER_TOKEN: "runner-secret-value", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 401);
});

test("runner event rejects out-of-range progress", async () => {
  const response = await worker.fetch(
    new Request("https://api.example.test/v1/tasks/00000000-0000-4000-8000-000000000000/events", {
      method: "POST",
      headers: { Origin: allowedOrigin, Authorization: "Bearer runner-secret-value" },
      body: JSON.stringify({ type: "progress", summary: "Working", progressPercent: 140 })
    }),
    { DB: {}, FACTORY_RUNNER_TOKEN: "runner-secret-value", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_progress");
});
