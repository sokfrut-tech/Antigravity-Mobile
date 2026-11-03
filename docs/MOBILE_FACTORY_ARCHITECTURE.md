# Antigravity Mobile × Universal AI Factory architecture

Status: proposed implementation contract, 2026-11-03.

## Product boundary

The Android application is the user's mobile command center. It does not embed the Antigravity desktop IDE, run Gemini/Claude/OpenAI models locally, or execute arbitrary MCP stdio servers. Long-running work runs in remote workers controlled by a factory orchestrator.

## High-level topology

    Android app
      | HTTPS + authenticated event stream
      v
    Factory API / Orchestrator
      |-- Task and session service
      |-- Agent registry and capability discovery
      |-- Approval and policy engine
      |-- Event log and artifact index
      |-- Provider adapters
      |     |-- Antigravity CLI / SDK worker
      |     |-- Claude worker
      |     |-- Gemini worker
      |     |-- OpenAI worker
      |-- MCP gateway (allowlisted tools)
      |-- GitHub adapter
      v
    Universal-AI-Factory + project repositories
      |-- coordination/<agent>/inbox and outbox
      |-- task/decision records
      |-- branches, PRs, commits, Actions and artifacts

## Core domain objects

- Task: id, title, brief, project/repository, priority, status, timestamps, parent task, dependencies and acceptance criteria.
- Agent: id, provider, role, availability, capabilities, allowed tools, model label and last heartbeat. No credentials.
- Run: id, task id, agent id, provider, status, timestamps, workspace/branch and correlation id.
- Event: id, task/run id, sequence, type, timestamp and safe structured payload. Examples: accepted, plan_created, tool_started, approval_required, progress, test_result, artifact_created, blocked, completed.
- Approval: id, task/run id, action summary, risk, requested scopes, status, approver and decision timestamp.
- Artifact: id, task/run id, type, filename, storage reference, MIME type, size, SHA-256, retention and visibility.
- Provider: id, provider type, connection state, supported capabilities and model catalogue timestamp. Never claim connected without a successful health check.

## Suggested API surface (versioned)

- GET /v1/health
- GET /v1/projects
- GET /v1/tasks; POST /v1/tasks; GET /v1/tasks/{id}
- POST /v1/tasks/{id}/runs — dispatch to selected role/provider
- GET /v1/tasks/{id}/events — cursor-based event history
- GET /v1/events/stream — SSE for live updates (WebSocket may follow)
- GET /v1/agents and GET /v1/providers
- GET /v1/approvals and POST /v1/approvals/{id}/decision
- GET /v1/artifacts/{id} — short-lived authorized download
- POST /v1/github/webhook — validated GitHub webhook ingress

These are design contracts, not existing endpoints. Do not configure the Android app to call them until a real backend is deployed and authenticated.

## Provider adapter contract

Each adapter must implement capability discovery, dispatch, event streaming/polling, cancellation where supported, artifact publication and health checks. Normalize statuses into:

queued → accepted → planning → running → review → completed

Alternative states: blocked, failed, cancelled, needs_approval, partial.

Provider-specific model names and capabilities remain metadata; never assume all providers support browser control, subagents, code editing, image input, tool use or the same context limits.

## GitHub and current factory protocol

The existing Universal AI Factory protocol defines inbox/outbox messages and a real-exchange verification sequence. The mobile app must:
1. Create a task record and correlation ID.
2. Publish a task message to the appropriate inbox through a trusted backend GitHub adapter.
3. Display automatic workflow receipts as dispatcher receipt, not proof that Claude/Gemini/ChatGPT accepted or executed the task.
4. Wait for a real agent response in its outbox, matching source filename and correlation ID.
5. Verify referenced commit, PR, test run or artifact before marking work complete.

The current inbox-dispatcher workflow writes an automatic acknowledgement containing the source task. Its own text explicitly says execution is not confirmed. The mobile UI must keep this as a separate state.

## Mobile screens

1. Overview — active tasks, queued runs, blockers and provider health.
2. Tasks — board/list, filters by project/status/agent.
3. Task detail — brief, acceptance criteria, child tasks, timeline, files, branch/PR.
4. Agents — roles, provider, health, supported capabilities and current load.
5. Run monitor — plan, live events, tool calls, tests and elapsed time.
6. Approvals — exact action, repository/environment, risk, allow/deny.
7. Artifacts — diffs, reports, screenshots, APKs, logs and checksums.
8. Connections — GitHub, Antigravity worker, Claude, Gemini, OpenAI and MCP gateway; status and least-privilege scopes.

## Delivery order

1. Keep the current working APK as baseline.
2. Implement domain models, Room persistence and repository abstraction.
3. Implement authentication and API client only after backend exists.
4. Implement GitHub-backed task creation and real inbox/outbox state mapping.
5. Add event stream, approvals and artifact viewer.
6. Add provider adapters one by one, starting with one end-to-end provider.
7. Add parallel runs, subtask dependency graph and independent review.

## Acceptance criteria

- Tasks survive app restart and offline/online transitions.
- A task submitted from phone is traceable to its GitHub inbox file and commit.
- Dispatcher ACK and real agent response are visibly different.
- Each run shows provider, model, branch/worktree, timestamps, logs, test outcomes and artifacts.
- Approval gates block protected actions until a human decision is recorded.
- No provider token or GitHub PAT is stored in source, APK resources or logs.
- A run is completed only after acceptance checks and required review pass.
