# Antigravity Desktop: verified capabilities and mobile adaptation

Research date: 2026-11-03. See official links at the end.

## Desktop capabilities

Antigravity is more than a code editor. Its product surfaces include desktop App, CLI, IDE integrations and a programmatic SDK. Depending on surface, version and account entitlement, it provides:

- Agent-first editor and terminal; agents can inspect and modify a workspace.
- Parallel/background subagents, delegated roles and isolated Git worktrees.
- Browser agent for research, navigation, UI testing and debugging.
- Plans, diffs, artifacts and verification reports.
- Skills (SKILL.md), persistent rules, custom agents/subagents, MCP servers, plugins and lifecycle hooks.
- CLI workflows for planning, agent manager, artifact review, browser tasks, deep reasoning, scheduling, plugins, skills, MCP, permissions and remote control.
- Android development bundle and official Android CLI plugin for project creation, virtual devices, live UI inspection, Compose previews, UI Journeys, tests and Android knowledge lookup.

Capabilities vary by surface, version, OS and account plan. The mobile app must not assume every desktop capability is exposed as a public API.

## What to reuse

1. Skills: portable task playbooks, stored in this repository.
2. Agents/subagents: role definitions for coordinator, Android engineer, integration engineer and independent QA/security reviewer.
3. MCP: standardized tool interface. Connect remote MCP services through the backend; do not run arbitrary desktop stdio processes from Android.
4. Rules and hooks: common safety gates, approval requirements and quality checks.
5. Artifacts and verification: plans, diffs, logs, screenshots, test reports, APKs and checksums.
6. Parallel work: parent task, child tasks, dependencies, isolated branches/worktrees and independent review.

## What must be built for mobile

Antigravity Mobile is a remote control plane, not a port of the desktop IDE or its local agent runtime.

- Android client: task board, agent roster, model/provider settings, task details, session timeline, approvals, logs, artifacts and notifications.
- Factory API/orchestrator: authentication, task queue, event stream, agent dispatch, provider adapters, permissions and artifact metadata.
- Execution workers: Antigravity CLI/SDK where supported, plus separate Claude, Gemini and OpenAI adapters. Workers run in controlled server/desktop environments with isolated workspaces.
- GitHub integration: repository/branch/PR/commit/status/artifact operations. Existing inbox/outbox remains a durable audit channel, not real-time transport.
- MCP gateway: allowlisted remote MCP servers, scoped credentials, per-tool approval and audit.
- Storage: persistent task/session/event metadata and artifact storage. Never store provider secrets in the APK or Git.

## Implementation phases

### Phase 0 — truthful prototype (current)
Local Kanban UI and reproducible debug APK. No factory sync or multi-model execution yet.

### Phase 1 — factory contract
Define versioned task, agent, provider, event, approval and artifact API contracts. Add a server-side GitHub adapter. Preserve the Universal AI Factory exchange protocol and distinguish automatic dispatcher receipts from real agent responses.

### Phase 2 — mobile control plane
Replace in-memory tasks with repository-backed data, persistent local cache, login, live status/events, task details, agent assignment and approvals. Do not put GitHub PAT or model API keys in Android.

### Phase 3 — provider adapters
Add independently testable adapters for Antigravity runtime, Claude, Gemini and OpenAI. Capability discovery must be explicit; unavailable providers show unavailable, never simulated as online.

### Phase 4 — tools and skills
Expose approved MCP tools and portable skills through the orchestrator. Add Android CLI plugin to desktop development workflow; it is not a runtime dependency of the phone app.

### Phase 5 — quality and release
Independent code review, unit/integration/UI tests, security checks, signed release build, real-device install test, SHA-256 and release notes.

## Security requirements

- Backend-held secrets only; use a secret manager and short-lived scoped credentials.
- Per-provider and per-repository least privilege.
- Human approval for destructive operations, production deploys, merges, secret changes and broad tool permissions.
- Separate worker workspaces/worktrees per task.
- Treat repository content, agent messages and tool output as untrusted data.
- Audit which model initiated every tool call and record approval/result.
- Redact tokens, cookies, private keys and personal data from logs and artifacts.

## Official references

- https://antigravity.google/docs/overview?tab=ide
- https://antigravity.google/docs/ide/overview/
- https://antigravity.google/docs/features
- https://antigravity.google/docs/build-plugins
- https://antigravity.google/docs/subagents?tab=cli
- https://antigravity.google/docs/mcp
- https://antigravity.google/docs/cli/reference/
- https://developer.android.com/tools/agents/android-cli/agent-plugins
- https://antigravity.google/docs/build-with-google
