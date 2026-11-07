import test from "node:test";
import assert from "node:assert/strict";
import { executeProvider, providerAvailability } from "../src/provider-adapters.js";

test("provider availability exposes only configured booleans and model defaults", () => {
  const status = providerAvailability({ GEMINI_API_KEY: "secret-value" });
  assert.deepEqual(status.map(item => [item.id, item.configured]), [
    ["gemini", true], ["claude", false], ["openai", false]
  ]);
  assert.equal(JSON.stringify(status).includes("secret-value"), false);
});

test("Gemini adapter sends key in header and extracts response text", async () => {
  let captured;
  const result = await executeProvider({
    provider: "gemini",
    model: "gemini-3.8-flash",
    prompt: "Review this task",
    env: { GEMINI_API_KEY: "never-log-this" },
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({
        id: "interaction_123",
        status: "completed",
        steps: [{ type: "model_output", content: [{ type: "text", text: "Review complete." }] }]
      }), { status: 200, headers: { "x-goog-request-id": "google-request-123" } });
    }
  });
  assert.equal(captured.url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(captured.init.headers["x-goog-api-key"], "never-log-this");
  assert.equal(JSON.parse(captured.init.body).model, "gemini-3.8-flash");
  assert.equal(JSON.parse(captured.init.body).store, false);
  assert.equal(JSON.parse(captured.init.body).generation_config.max_output_tokens, 4096);
  assert.equal(result.output, "Review complete.");
  assert.equal(result.providerRequestId, "interaction_123");
});

test("Claude adapter uses official Messages API and extracts text", async () => {
  let captured;
  const result = await executeProvider({
    provider: "claude",
    prompt: "Implement this task",
    env: { ANTHROPIC_API_KEY: "claude-secret" },
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({
        id: "msg_123",
        content: [{ type: "text", text: "Implementation plan." }]
      }), { status: 200 });
    }
  });
  assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
  assert.equal(captured.init.headers["anthropic-version"], "2026-10-21");
  assert.equal(captured.init.headers.authorization, "Bearer claude-secret");
  assert.equal(JSON.parse(captured.init.body).model, "claude-sonnet-5");
  assert.equal(result.model, "claude-sonnet-5");
  assert.equal(result.output, "Implementation plan.");
  assert.equal(result.providerRequestId, "msg_123");
});

test("OpenAI adapter uses Responses API and extracts output_text", async () => {
  let captured;
  const result = await executeProvider({
    provider: "openai",
    model: "gpt-6.1-sol",
    prompt: "Check this patch",
    env: { OPENAI_API_KEY: "openai-secret" },
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: "resp_123", output_text: "Independent review." }), { status: 200 });
    }
  });
  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.init.headers.authorization, "Bearer openai-secret");
  assert.equal(result.output, "Independent review.");
  assert.equal(result.providerRequestId, "resp_123");
});

test("missing provider secret is a definite rejection without network call", async () => {
  let called = false;
  await assert.rejects(
    executeProvider({ provider: "claude", model: "claude-sonnet-5-5", prompt: "hello", env: {}, fetchImpl: async () => { called = true; } }),
    error => error.kind === "definite_rejection" && error.reasonCode === "provider_not_configured"
  );
  assert.equal(called, false);
});

test("provider 5xx is marked ambiguous and not treated as a safe retry", async () => {
  await assert.rejects(
    executeProvider({ provider: "gemini", model: "gemini-3.8-flash", prompt: "hello", env: { GEMINI_API_KEY: "secret" }, fetchImpl: async () => new Response("server error", { status: 503 }) }),
    error => error.kind === "ambiguous" && error.reasonCode === "provider_http_5xx"
  );
});

test("provider 4xx is a definite rejection with sanitized error", async () => {
  await assert.rejects(
    executeProvider({ provider: "openai", model: "gpt-6", prompt: "hello", env: { OPENAI_API_KEY: "secret" }, fetchImpl: async () => new Response("private provider body", { status: 401 }) }),
    error => error.kind === "definite_rejection" && error.reasonCode === "provider_http_401" && !error.message.includes("private provider body")
  );
});
