# Antigravity Mobile — product and delivery roadmap

**Updated:** 2026-11-04  
**Canonical factory plan:** [Universal AI Factory master roadmap](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/docs/ANTIGRAVITY_MOBILE_MASTER_ROADMAP_2026-11-04.md)  
**Factory exchange protocol:** [AGENT_EXCHANGE_PROTOCOL.md](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/shared/AGENT_EXCHANGE_PROTOCOL.md)

## Product promise

Antigravity Mobile is a Russian-first Android command center for the Universal AI Factory. It lets the owner give one goal to a coordinator, observe real agents working, switch between projects and independent sessions, review artifacts, approve sensitive actions and receive a verified result.

It is not a conventional multi-chat app and not a desktop IDE clone. Agent runtimes, browser automation, tools, provider credentials and long-running work execute in isolated workers behind the authenticated Factory API.

**Important execution rule:** Claude and Gemini are optional collaborators, not dependencies. If they are unavailable or have not returned a substantive response, ChatGPT continues implementation, repository changes, tests and documentation directly. Mark external review NOT_RECEIVED; never invent a reply or label self-review as independent.

## Existing capabilities to preserve

- Android Kotlin + Jetpack Compose; minSdk 24 / Android 7.0+.
- Existing Kanban board, local task persistence and task status transitions.
- Existing API settings and Android Keystore AES-GCM token storage.
- Existing Factory API health check, task submission with stable idempotency and real remote progress polling.
- Existing Cloudflare Worker + D1 bootstrap and durable provider-run ledger work from PR #15.
- Existing GitHub Actions debug APK, unit-test and Compose emulator UI workflows.

No navigation or visual refactor may remove or fake these capabilities. Existing local tasks must survive migration to any future Room database.

## Product destinations

The visual direction remains Fallout / Wasteland / Pip-Boy, based on the eight-panel reference contract in PR #14. Do not stretch the 4x2 collage into a wallpaper. Use distinct native Compose screens and locally bundled artwork.

Primary navigation:
1. Overview / command center.
2. Tasks and task detail.
3. Agents and capability/health registry.
4. Sessions / independent windows.
5. Projects / workspaces.
6. Approvals / protected actions.
7. Artifacts / reports, diffs, screenshots, logs, APKs and checksums.
8. Connections / Factory API, GitHub, Antigravity worker, Claude, Gemini, OpenAI and future custom agent.

The original visual reference also defines Splash, Home, Voice, Tools, Information, Tasks, Settings and About. Reconcile these as the final screen hierarchy; avoid duplicate destinations and excessive navigation depth.

### Interaction and visual requirements

- Short fade + directional slide when switching destinations; subtle parallax/HUD motion only where it improves orientation.
- Reduced-motion support and Android accessibility settings respected.
- Preserve Fallout colors, brass/olive framing, phosphor-green accents, readable warm-white text and clear focus/pressed/disabled states.
- Russian-first text, scalable typography, TalkBack labels, accessible touch targets and no clipped text.
- A progress percentage or active spinner is allowed only when backed by a real operation/event. Local decorative animation must never imply remote execution.
- Keep drafts, session history, selected project and agent context when switching windows.

## Agent collaboration model

A coordinator creates a parent task and bounded child tasks. Independent child tasks may run in parallel; conflicting repository writes must be serialized or isolated in separate worktrees/branches.

Every run records:
- task and parent task IDs;
- correlation ID and idempotency key;
- provider, model, role, capabilities and actual health state;
- project/repository and isolated branch/worktree;
- acceptance criteria and allowed tools;
- ordered status events and timestamps;
- provider request/execution ID only when truly returned;
- substantive response, artifacts and reviewer decision.

Statuses are distinct: received, accepted, queued, dispatched, running, review, done, partial, blocked, failed, outcome_unknown, rejected and cancelled.

A dispatcher ACK, GitHub file, D1 claim or inbox receipt is not a provider response. An ambiguous timeout after dispatch may have begun becomes outcome_unknown and cannot be automatically retried. Reuse PR #15's durable ledger; do not build a competing ledger.

## Provider and fallback policy

- Support Antigravity worker, Claude, Gemini and OpenAI behind server-side adapters; add our own agent through a provider-neutral interface later.
- Query actual health and capabilities before routing. Never mark an unconfigured provider online.
- Route only to an available provider with the required capability. No silent model substitution.
- If Claude/Gemini are unavailable, ChatGPT is the primary implementer and coordinator. Continue local/repository work; leave provider execution visibly blocked until a real provider is configured.
- Independent review remains desirable for release. If no external reviewer responds, report NOT_RECEIVED, perform deterministic tests/scans and a clearly labelled self-review; high-risk release gates remain unresolved until independent evidence exists.
- Provider credentials and GitHub credentials stay server-side. Never embed secrets in the APK.

## Delivery sequence

### P0 — reconcile the current branches
- Inspect exact PR #14, #15 and #17 heads and diffs.
- Integrate Fallout theme, navigation and durable run ledger without dropping commits.
- Preserve MainActivity task board, API settings, Keystore, idempotent submission, remote task ID and progress polling.
- Resolve duplicate navigation and version metadata.
- Add Compose navigation tests for every destination, plus persistence/API/reduced-motion checks.

### P1 — sessions and timeline
- Add project/session/task domain models and Room-backed local cache with a safe migration from existing task storage.
- Add create/switch/rename/archive sessions and preserve independent drafts/context.
- Add cursor-based event timeline with offline cache and server reconciliation.
- Show provider health, capability and task execution as separate concepts.

### P2 — backend control plane
- Reuse the existing Worker/D1 API and run ledger.
- Add authenticated session, agent/provider, approval and artifact APIs only after contract tests.
- Add server-side GitHub adapter for inbox/outbox writes and correlated response validation.
- Keep remote D1 migration and Worker deployment behind explicit owner approval.

### P3 — provider execution
- Reconcile Factory PR #11 provider adapter/guard contracts with Mobile PR #15 ledger.
- Complete mock-provider and failure-path tests before live calls.
- Start with whichever provider is genuinely configured and healthy; Claude and Gemini are not mandatory.
- Run one controlled non-production provider request and verify request ID plus substantive correlated response.
- If no provider is configured, ship only a clearly labelled control-plane preview; never simulate agent execution.

### P4 — collaboration and tools
- Add parent/child task orchestration, dependencies and bounded parallel runs.
- Add reviewer role and artifact comparison.
- Expose portable Skills and allowlisted MCP tools through the backend.
- Keep browser/terminal/code execution in isolated workers, not the APK.
- Require human approval for merges, deployments, secrets, destructive operations and broad tool permissions.

### P5 — release candidate
- Fresh independent review or explicit NOT_RECEIVED status.
- Gitleaks, CodeQL where supported, dependency audit, backend/D1 tests, Android unit tests and emulator UI tests.
- Build APK from the exact reviewed commit; publish artifact, SHA-256, logs, emulator reports and release notes.
- Physical-device testing is a separate check and must not be claimed before it happens.
- No Google Play publishing. First delivery is a sideloadable APK.

## Current PR reconciliation map

| PR | Scope | Required action |
|---|---|---|
| #14 | Fallout visual foundation and progress UI | Keep as source of visual contract; complete screens and non-regression tests |
| #15 | Durable D1 provider-run ledger | Preserve idempotency, compare-and-set, append-only events and outcome_unknown safety; no live dispatch until reviewed |
| #17 | Eight-screen command-center navigation and transitions | Reconcile with #14 and #15; do not merge independently from stale main |

PR #17 currently has no confirmed CI evidence in the status query at the time of this update. Its Android build and emulator test results must be obtained on the final integrated head. Keep all three PRs draft until the integration line is verified.

## Release gates

A release is not ready until:
- navigation and existing task/API features pass on the same commit;
- task/session state survives app restart and offline/online transitions;
- provider status is truthful and no fake progress/replies exist;
- the durable run ledger and adapter contract pass duplicate, timeout, concurrency and audit-integrity tests;
- required security checks pass and no critical/high findings remain;
- APK provenance and SHA-256 match the reviewed commit;
- remaining device-test limitations are disclosed.

No merge to protected main, production deployment, remote D1 migration, secret changes or Google Play publishing without the owner's explicit approval.


## Live implementation evidence — 2026-11-04 17:30 UTC

- PR #17: https://github.com/sokfrut-tech/Antigravity-Mobile/pull/17
- First artifact run `41877110598` produced an APK, but the downloaded emulator report showed **2 tests, 2 failures, 0 errors, 0 skipped**. The failures exposed an outdated test entry point/title and an off-screen assertion. This run is failed evidence, not a passing release check.
- The APK ZIP contained `app-debug.apk` (10,181,006 bytes); SHA-256: `d90ac5d1233a84283a72bfc5b697a93c0d1396fece5f7ee55d585cb931baf5ba`. It is a debug artifact only and must not be distributed as a release.
- Corrective changes were committed: app title aligned, legacy test now opens Tasks before API settings, agent status assertion scrolls into view, and inert placeholder cards are no longer clickable.
- Latest observed PR #17 head: `7656ef494fdaa195b4b3e98ca3f1c943b84a008e`.
- Fresh workflow run `41877993846` is queued. Await its actual job conclusion before treating the fixes as verified.
- No substantive Claude or Gemini report has been verified. Their optional review tasks are in the Factory inbox. ChatGPT continues direct implementation and will not wait for external agent availability.


### Security onboarding evidence

PR #7 contains the project's Factory Security Gate (Gitleaks, Semgrep, Trivy and Kotlin/Java CodeQL). The exact PR head `66520370eb950dbc80a14b56c88a6a7992b7bd75` passed run `41706087791`, with all four security jobs completed successfully. PR #7 is still open/unmerged, and this evidence does not automatically cover the newer PR #17 head. Its manual DAST workflow was not run. Reconcile PR #7 into the final integration line and require a fresh security run on the exact release candidate.
