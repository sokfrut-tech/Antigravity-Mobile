# Factory API deployment readiness — 2026-11-04

## Current verified integration state

- Integration PR: [#19](https://github.com/sokfrut-tech/Antigravity-Mobile/pull/19), branch `feat/antigravity-integrated-agent-runtime-final-2026-11-04`.
- Verified head at this review: `f32ec45775084637aec8a79d67a8a0ef61b4dbae`.
- Factory API checks: PASS, run [41897846007](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41897846007).
- Android debug build + unit tests + Compose emulator UI: PASS, run [41897846860](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41897846860).
- Security gate: PASS, run [41897846886](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41897846886), including Gitleaks, Semgrep, Trivy and CodeQL.
- These are CI and emulator results for this exact head. They do not prove physical OPPO/ColorOS behavior, production deployment, live provider credentials, or successful external agent dispatch.
- PR #19 remains draft/open. No live Worker deployment, remote D1 migration, secret update, provider call or merge has been performed.

## Deployment boundary and available controls

The connected GitHub integration can inspect/edit repository content and read Actions runs. It does not expose a workflow-dispatch operation. No connected Cloudflare account/Workers/D1 management tool is available in this session. GitHub Actions secret values cannot be read through the integration. Do not claim these operations or settings were verified.

The deploy workflow is manual (`workflow_dispatch`) and performs remote D1 migrations before deploying the Worker. **Do not run it without explicit owner approval.**

## Required repository configuration

Repository secrets:
- `CLOUDFLARE_API_TOKEN` — narrowly scoped to Workers deployment and D1 management for the intended account.
- `CLOUDFLARE_ACCOUNT_ID`.
- `FACTORY_D1_DATABASE_ID` — UUID of the intended D1 database named `universal-ai-factory`.
- `FACTORY_API_TOKEN_SHA256` — SHA-256 digest of a separately generated high-entropy owner bearer token.
- `FACTORY_RUNNER_TOKEN` — separate high-entropy runner credential, minimum 32 characters.

Repository variable:
- `FACTORY_API_CORS_ORIGIN` — one exact HTTPS origin; no wildcard.

Never place raw tokens/API keys in Git, chat, APK resources, workflow logs or public issue comments. Keep the raw owner token in a password manager for private entry on Android; keep the runner token server-side only.

## Controlled deployment checklist — approval required

1. Confirm the intended Cloudflare account and existing D1 database; do not create or migrate anything implicitly.
2. Confirm all required repository secrets/variables privately in GitHub Settings. Secret values cannot be read back; verify presence through the workflow preflight only.
3. Obtain explicit owner approval for the named Worker and D1 migration.
4. Open [the manual deployment workflow](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/workflows/deploy-factory-api.yml), select branch `feat/antigravity-integrated-agent-runtime-final-2026-11-04`, and run only after approval.
5. If preflight fails, stop. Never paste secret values into chat.
6. After deployment, verify `/v1/health`, authenticated API access, D1 migration state and Android connection. Do not dispatch a provider as a deployment test.

## Provider billing boundary

- Keep `ALLOW_LIVE_PROVIDERS=false`.
- Do not configure optional Claude, Gemini or OpenAI keys during bootstrap.
- A provider's secret-presence status is not proof that its key is valid.
- Live dispatch requires separate explicit approval and per-task cost acknowledgement. No paid provider calls are needed for deployment verification.
- If no provider is available, continue offline/local deterministic work; never fabricate agent responses.

## Public exposure control

Cloudflare-side rate limiting for `/v1/*` must be configured and verified before broad public exposure. The current deploy workflow does not provision that rule. Until rate limiting and access controls are confirmed, keep exposure restricted and the owner token private.

## Next engineering stage

Before treating this as a general-purpose coding agent, add a separately gated local/repository execution runner:
- fetch an exact repository and pinned base commit;
- work only in an isolated temporary checkout/worktree;
- validate paths and reject traversal, symlinks escaping the workspace, oversized patches and binary surprises;
- apply a bounded patch without direct pushes;
- run the target project's declared tests/build/security checks in a sandbox with no secrets and restricted network;
- produce a diff, test logs, hashes and a machine-readable evidence manifest;
- require independent review and explicit owner approval before creating a PR;
- never merge, deploy or modify production resources automatically.

This execution stage is NOT IMPLEMENTED by PR #19. The current provider response is stored as immutable review output; it is not applied to source code.