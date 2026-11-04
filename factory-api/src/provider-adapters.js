const PROVIDERS = {
  gemini: {
    secret: "GEMINI_API_KEY",
    defaultModel: "gemini-3.8-flash"
  },
  claude: {
    secret: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5-5"
  },
  openai: {
    secret: "OPENAI_API_KEY",
    defaultModel: "gpt-6-astra"
  }
};

export function providerAvailability(env) {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    configured: typeof env[config.secret] === "string" && env[config.secret].length > 0,
    defaultModel: config.defaultModel
  }));
}

async function readResponseTextLimited(response, maxBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("provider_response_too_large");
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
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function extractText(provider, body) {
  if (provider === "claude") {
    return (body.content || []).filter(part => part.type === "text").map(part => part.text || "").join("\n").trim();
  }
  if (provider === "gemini") {
    return (body.candidates?.[0]?.content?.parts || []).map(part => part.text || "").join("\n").trim();
  }
  if (provider === "openai") {
    if (typeof body.output_text === "string") return body.output_text.trim();
    return (body.output || []).flatMap(item => item.content || [])
      .filter(part => part.type === "output_text")
      .map(part => part.text || "").join("\n").trim();
  }
  return "";
}

export async function executeProvider({ provider, model, prompt, env, fetchImpl = fetch }) {
  const config = PROVIDERS[provider];
  if (!config) throw Object.assign(new Error("Unsupported provider."), { kind: "definite_rejection", reasonCode: "provider_unsupported" });
  const apiKey = env[config.secret];
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw Object.assign(new Error("Provider credentials are not configured."), { kind: "definite_rejection", reasonCode: "provider_not_configured" });
  }
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 48_000) {
    throw Object.assign(new Error("Provider prompt is invalid or too large."), { kind: "definite_rejection", reasonCode: "invalid_prompt" });
  }
  const selectedModel = (model || config.defaultModel).trim();
  if (!/^[A-Za-z0-9._:-]{1,120}$/.test(selectedModel)) {
    throw Object.assign(new Error("Provider model identifier is invalid."), { kind: "definite_rejection", reasonCode: "invalid_model" });
  }

  let endpoint;
  let headers;
  let body;
  if (provider === "claude") {
    endpoint = "https://api.anthropic.com/v1/messages";
    headers = {
      "authorization": `Bearer ${apiKey}`,
      "anthropic-version": "2026-10-21",
      "content-type": "application/json"
    };
    body = { model: selectedModel, max_tokens: 4096, messages: [{ role: "user", content: prompt }] };
  } else if (provider === "gemini") {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`;
    headers = { "x-goog-api-key": apiKey, "content-type": "application/json" };
    body = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
  } else {
    endpoint = "https://api.openai.com/v1/responses";
    headers = { "authorization": `Bearer ${apiKey}`, "content-type": "application/json" };
    body = { model: selectedModel, input: prompt, max_output_tokens: 4096 };
  }

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000)
    });
  } catch {
    throw Object.assign(new Error("Provider request ended without a confirmed response; outcome is unknown."), {
      kind: "ambiguous",
      reasonCode: "provider_transport_unknown"
    });
  }

  if (!response.ok) {
    const status = response.status;
    if (status >= 500) {
      throw Object.assign(new Error("Provider returned a server error; acceptance is not known."), {
        kind: "ambiguous",
        reasonCode: "provider_http_5xx"
      });
    }
    throw Object.assign(new Error(`Provider rejected the request (HTTP ${status}).`), {
      kind: "definite_rejection",
      reasonCode: `provider_http_${status}`
    });
  }

  let data;
  try {
    const raw = await readResponseTextLimited(response, 256_000);
    data = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Provider returned an unreadable response; outcome is unknown."), {
      kind: "ambiguous",
      reasonCode: "provider_response_invalid"
    });
  }
  const output = extractText(provider, data);
  if (!output) {
    throw Object.assign(new Error("Provider returned no usable text; outcome is unknown."), {
      kind: "ambiguous",
      reasonCode: "provider_response_empty"
    });
  }
  const candidateRequestId = typeof data.id === "string" ? data.id :
    response.headers.get("x-request-id") || response.headers.get("x-goog-request-id") || null;
  const providerRequestId = typeof candidateRequestId === "string" &&
    /^[A-Za-z0-9._:-]{1,200}$/.test(candidateRequestId) ? candidateRequestId : null;
  return {
    provider,
    model: selectedModel,
    output: output.slice(0, 50_000),
    providerRequestId
  };
}
