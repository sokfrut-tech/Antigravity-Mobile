import test from "node:test";
import assert from "node:assert/strict";
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

test("health reports degraded when D1 probe fails", async () => {\n  const response = await worker.fetch(\n    new Request("https://api.example.test/v1/health"),\n    { DB: { prepare: () => ({ first: async () => { throw new Error("offline"); } }) }, API_TOKEN_SHA256: "configured", CORS_ORIGIN: allowedOrigin }\n  );\n  assert.equal(response.status, 200);\n  assert.deepEqual(await response.json(), { status: "degraded", apiVersion: "1.0.0" });\n});\n\ntest("wildcard CORS configuration is rejected", async () => {
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
    new Request("https://api.example.test/v1/tasks"),
    { DB: {}, API_TOKEN_SHA256: "configured", CORS_ORIGIN: allowedOrigin }
  );
  assert.equal(response.status, 401);
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
