# Skills, plugins and model integrations — priority matrix

Date: 2026-11-03. Priorities are for the Antigravity Mobile + Universal AI Factory target, not a claim that these integrations are already connected.

## P0 — required for the first useful mobile factory

| Component | Kind | Why we need it | Where it runs |
|---|---|---|---|
| Universal AI Factory — Mobile | Custom Antigravity plugin pack | Shared skills, role profiles, rules and repeatable procedures | Antigravity desktop/CLI; reusable docs for other agents |
| Android CLI | Official Android agent plugin + skill | Android project tooling, device/emulator management, UI inspection, Compose previews and Journeys | Desktop Antigravity; also official installs for Claude Code and Codex |
| GitHub | MCP server / GitHub integration | Repositories, branches, PRs, commits, Actions, artifacts and inbox/outbox | Factory worker / desktop agent; backend owns credentials |
| Google Developer Knowledge | MCP server | Current official Android, Antigravity, Firebase and Google Cloud documentation | Desktop agent / worker |
| Factory API + GitHub adapter | Custom backend service | Secure mobile login, task creation, task events, inbox/outbox writes, status reconciliation | Server-side only |
| Provider adapters | Custom backend modules | Normalize auth, streaming, tool calls, model metadata, errors and usage across providers | Server-side only |

## P1 — add once P0 works end to end

| Component | Kind | Why |
|---|---|---|
| Antigravity SDK | Python runtime/worker, not an Android plugin | Runs the Antigravity agent harness with tools, skills, MCP and subagents in an isolated worker |
| Chrome DevTools | MCP server / skill bundle | Browser-based UI tests, accessibility, performance and web debugging |
| Firebase | Official skills/MCP bundle, optional | Only if Firebase is selected for auth, database, hosting or telemetry |
| Cloudflare adapter | Custom MCP/API integration | Candidate backend path if Cloudflare Workers/D1/Queues/R2 are selected |
| PostHog | MCP / analytics integration | Usage, reliability and workflow analytics once mobile has real users |
| Independent QA/security agent | Custom subagent | Read-only review of diffs, permissions, secrets, tests and release evidence |

## P2 — optional, do not install by default

- Figma/Miro/Mobbin: only if design collaboration becomes a bottleneck.
- Linear/Atlassian/Notion: only if task tracking or knowledge management moves outside GitHub.
- Database-specific MCP servers (Postgres, Redis, Supabase, etc.): only after the chosen backend requires them.
- Additional search/research MCP servers: only if they provide a concrete capability not already available.

## Provider strategy: models are not plugins

Do not try to install a separate "Claude plugin", "Gemini plugin" or "OpenAI plugin" into the Android APK. Implement provider adapters behind the Factory API:

- **Antigravity:** dedicated Python worker using the official Antigravity SDK where supported. The SDK is a runtime package, not a direct phone API; remote hosted execution must not be assumed.
- **Gemini:** Gemini API adapter with streaming and function calling.
- **Claude:** Anthropic Messages API adapter with tool use and streaming.
- **OpenAI:** Responses API adapter with streaming, function calling and remote MCP tools.

Each adapter must publish a health check and capability list. The model router chooses only from connected providers and records provider/model, cost/usage metadata where available, latency, tool permissions and correlation ID. Fallback is policy-controlled, not silent.

## Initial role map

| Role | Default work | Preferred routing policy |
|---|---|---|
| Planner / coordinator | Break down request, define acceptance criteria, dispatch tasks | Strong reasoning model; no destructive tools |
| Researcher | Official docs and repository investigation | Fast research-capable model; read-only tools |
| Android engineer | Kotlin/Compose implementation and tests | Coding-capable model + Android CLI tools |
| Integration engineer | API, GitHub, MCP and provider adapters | Coding-capable model + scoped backend tools |
| Reviewer | Independent diff review | Different provider/model from implementer where possible; read-only |
| QA/security | Test evidence, secrets, permissions, release gates | Independent model; read-only by default |

## Official setup references

- Android CLI agent plugin: https://developer.android.com/tools/agents/android-cli/agent-plugins
- Antigravity plugins and Skills: https://antigravity.google/docs/build-plugins
- Antigravity MCP: https://antigravity.google/docs/mcp
- Antigravity subagents: https://antigravity.google/docs/subagents?tab=cli
- Antigravity SDK: https://antigravity.google/product/antigravity-sdk
- Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
- OpenAI Responses and tools: https://developers.openai.com/api/docs/guides/tools
- Anthropic MCP: https://docs.anthropic.com/en/docs/mcp

## Install notes for the PC

For Antigravity CLI, install the Android plugin with:

    agy plugin install android-cli-plugin@antigravity-plugins-official

For Claude Code and Codex, follow the separate official install commands on the Android Developers page linked above. Do not copy a CLI plugin command into the Android phone app; this setup belongs on the development PC/worker environment.

The custom plugin in this repository can be validated with:

    agy plugin validate --strict ./antigravity-plugin

Then installed with:

    agy plugin install ./antigravity-plugin

Strict CLI validation has not yet been run in this environment because the Antigravity CLI is not installed here.
