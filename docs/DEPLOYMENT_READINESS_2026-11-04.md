# Factory API deployment readiness — 2026-11-04

## Current verified state
- Integration PR #19 head: `06f71717274d8024c480a0f9605ceb840f470175`.
- Factory API CI: PASS (run 41887155989).
- Android build + unit tests: PASS; Compose emulator UI: PASS (2/2).
- Security gate: Gitleaks, Semgrep, Trivy and CodeQL all PASS (run 41887157631).
- D1 migrations present: 0001 through 0004. Local/integration tests passed; remote D1 not yet inspected or migrated.
- Deploy workflow exists in this branch and on main. It is manual (`workflow_dispatch`) and applies remote D1 migrations before deploying Worker.
- No live deployment or remote database mutation has been performed.

## Why deployment did not run from this session
The connected GitHub integration can inspect and edit repository content and read Actions runs, but it exposes no workflow-dispatch operation. There is also no connected Cloudflare account/Workers/D1 management tool. GitHub's sensitive Actions secrets API is not exposed, so secret presence cannot be verified from this session. We must not pretend these controls or credentials are available.

## Required repository configuration
Repository secrets:
- `CLOUDFLARE_API_TOKEN` — scoped to Workers deployment and D1 management for the intended account.
- `CLOUDFLARE_ACCOUNT_ID`.
- `FACTORY_D1_DATABASE_ID` — existing D1 database UUID named `universal-ai-factory`.
- `FACTORY_API_TOKEN_SHA256` — SHA-256 digest of a separately generated 32-byte-or-stronger random API bearer token.
- `FACTORY_RUNNER_TOKEN` — separate random token, minimum 32 characters.

Repository variable:
- `FACTORY_API_CORS_ORIGIN` — one exact HTTPS origin; no wildcard. Native Android requests without an Origin header are accepted; choose the actual owned web origin if a browser client will be used.

Do not place raw tokens or API keys in Git, chat, APK files, workflow logs, or public issue comments. Keep the raw owner API token in a password manager for private entry on the Android device. Keep the runner token server-side only.

## Dispatch procedure
1. Open https://github.com/sokfrut-tech/Antigravity-Mobile/actions/workflows/deploy-factory-api.yml
2. Choose branch `feat/antigravity-integrated-agent-runtime-final-2026-11-04`.
3. Select **Run workflow**. The workflow first validates required configuration, then runs `npm run check` and `npm test`, applies migrations 0001–0004 to the named remote D1 database, sets API digest and runner token as Worker secrets, and deploys Worker.
4. If preflight fails, stop and resolve missing settings; do not paste secret values into chat.
5. After a successful run, verify Worker `/v1/health`, authenticated API access, D1 migration state, and Android connection without submitting a provider dispatch.

## Provider billing boundary
The deployment workflow in this branch does not copy optional Claude, Gemini or OpenAI keys into Worker secrets. Do not add them during initial deployment. The Worker should report providers as unconfigured until separately configured and explicitly authorized. No provider calls should be used for deployment verification.

## Outstanding operational control
The repository README says Cloudflare rate limiting for `/v1/*` must be configured before public exposure. The current deploy workflow does not provision that rule. Add/verify Cloudflare-side rate limiting before treating the Worker as ready for broad public access. Until then, restrict exposure and keep the high-entropy owner token private.
