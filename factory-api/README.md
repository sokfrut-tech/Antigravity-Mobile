# Universal AI Factory API — Cloudflare Worker (bootstrap)

This is the first backend implementation slice for Antigravity Mobile. It provides authenticated health, task creation/list/detail, and task event history using Cloudflare Workers + D1.

**It is not deployed yet.** The Android app has secure connection settings, a health check and a per-task submit action, but those actions require a deployed API and a privately configured bearer token. Provider dispatch is available through server-side Claude, Gemini and OpenAI adapters when their secrets are configured. If no provider key is configured, dispatch returns `503 provider_not_configured` and creates no fake run.

## Security model (single-owner bootstrap)

- The Android client sends a bearer token over HTTPS.
- The Worker stores only `API_TOKEN_SHA256`, a SHA-256 digest of a high-entropy random token, as a Worker secret.
- The raw token must never be committed, placed in `wrangler.toml`, embedded in APK resources, or written to logs.
- Current bootstrap identity is a single owner principal. Before inviting other users, replace it with per-user OAuth/OIDC/JWT validation and row-level identity mapping.
- Configure `CORS_ORIGIN` to one exact HTTPS origin. Wildcard CORS is rejected.
- Configure Cloudflare rate limiting for `/v1/*` before public exposure.
- Do not expose this API publicly until the token is generated, stored as a Worker secret, and the D1 migration is applied.

## Durable provider run ledger

Migration `0002_task_runs.sql` adds a persistent run registry with unique `(task_id, run_key)` claims, provider request IDs, append-only run events and an `outcome_unknown` state. The ledger supports one-shot provider dispatch with idempotent claims, guarded lifecycle transitions and immutable output storage. Provider execution still requires server-side credentials. Gemini uses the current Interactions API with provider-side storage disabled (`store: false`); Claude uses Messages and OpenAI uses Responses. See `docs/PROVIDER_RUN_LEDGER.md` for the required atomic claim, timeout and retry rules.

## Endpoints

- `GET /v1/health` — unauthenticated health.
- `GET /v1/tasks` — authenticated task list.
- `POST /v1/tasks` — authenticated task creation; requires `Idempotency-Key`.
- `GET /v1/tasks/{uuid}` — task detail.
- `GET /v1/tasks/{uuid}/events` — ordered event history for the mobile owner client.
- `POST /v1/tasks/{uuid}/events` — append non-terminal progress/status events from a trusted runner only; it cannot declare a task completed. Requires the separate `FACTORY_RUNNER_TOKEN` secret.
- `GET /v1/providers` — owner-authenticated provider secret-presence status; never returns secrets.
- `POST /v1/tasks/{uuid}/dispatch` — owner-authenticated one-shot provider call; requires explicit `costAcknowledged: true` and automatically selects the first configured provider (Gemini, Claude, OpenAI).
- `GET /v1/tasks/{uuid}/runs/{runUuid}/output` — owner-authenticated retrieval of the immutable provider response.
- `POST /v1/tasks/{uuid}/runs` — trusted-runner-only durable claim endpoint; does not itself call a provider. Requires `FACTORY_RUNNER_TOKEN`.
- `POST /v1/runs/{uuid}/transitions` — runner-only compare-and-set transition with an append-only event in one D1 batch. Completion, cancellation, unknown-outcome reconciliation and retry remain disabled. Requires `FACTORY_RUNNER_TOKEN`.

## Deploy prerequisites

The repository contains a guarded manual GitHub Actions deploy workflow at `.github/workflows/deploy-factory-api.yml`. It is deliberately manual and refuses to deploy while placeholders or required secrets are missing. First create a D1 database named `universal-ai-factory` in the intended Cloudflare account (for example, with `npx wrangler d1 create universal-ai-factory` on a trusted computer) and copy its UUID into `FACTORY_D1_DATABASE_ID`. The workflow applies the migration before deploying the Worker.

Configure these in **Antigravity-Mobile → Settings → Secrets and variables → Actions**:

**Repository secrets**
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with permission to deploy Workers and manage the selected D1 database.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `FACTORY_D1_DATABASE_ID` — UUID of a D1 database named `universal-ai-factory`.
- `FACTORY_API_TOKEN_SHA256` — SHA-256 hex digest of a random token with at least 32 bytes of entropy. Store the raw token separately in a password manager; never send it in chat or commit it.
- `FACTORY_RUNNER_TOKEN` — a separate high-entropy secret used only for trusted lifecycle updates. Never put this token in the Android app or expose it to users.
- `ANTHROPIC_API_KEY` — optional Claude API key.
- `GEMINI_API_KEY` — optional Gemini API key.
- `OPENAI_API_KEY` — optional OpenAI API key.
- `ALLOW_LIVE_PROVIDERS` — non-secret Worker variable; must be exactly `true` to permit live calls. Defaults to `false`. Each mobile task still requires a separate explicit cost acknowledgement before dispatch.

Add provider keys as GitHub repository secrets. The manual deployment workflow copies any configured optional provider key into Cloudflare Worker secrets. If a GitHub secret is absent, the workflow leaves any existing Cloudflare Worker secret unchanged; remove a previously configured key explicitly with `wrangler secret delete KEY_NAME` only after owner approval. Do not paste keys into chat, Git, APK settings or logs.

**Repository variable**
- `FACTORY_API_CORS_ORIGIN` — one exact HTTPS origin; no wildcard.

Then open **Actions → Deploy Factory API → Run workflow**. The workflow runs tests, substitutes the D1 ID and CORS origin, applies migrations, sets the token digest as a Worker secret and deploys.

To create the token on a trusted computer:

```bash
TOKEN=$(openssl rand -hex 32)
printf 'Save this token in your password manager: %s\\n' "$TOKEN"
printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1
```

Use the printed SHA-256 digest as `FACTORY_API_TOKEN_SHA256`; retain the raw token privately for the future Android secure-connection screen. Do not paste either value into this chat.

The Android app now provides the secure token-entry screen and Keystore storage. After deployment, enter the Worker HTTPS URL and the raw token privately on the device. Do not paste either value into chat. Verify `/v1/health` before submitting tasks.
