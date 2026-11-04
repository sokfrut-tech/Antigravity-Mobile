# Universal AI Factory API — Cloudflare Worker (bootstrap)

This is the first backend implementation slice for Antigravity Mobile. It provides authenticated health, task creation/list/detail, and task event history using Cloudflare Workers + D1.

**It is not deployed yet.** The Android app has secure connection settings, a health check and a per-task submit action, but those actions require a deployed API and a privately configured bearer token. Provider dispatch is deliberately disabled and returns `503 provider_not_configured`; no fake agent run is created.

## Security model (single-owner bootstrap)

- The Android client sends a bearer token over HTTPS.
- The Worker stores only `API_TOKEN_SHA256`, a SHA-256 digest of a high-entropy random token, as a Worker secret.
- The raw token must never be committed, placed in `wrangler.toml`, embedded in APK resources, or written to logs.
- Current bootstrap identity is a single owner principal. Before inviting other users, replace it with per-user OAuth/OIDC/JWT validation and row-level identity mapping.
- Configure `CORS_ORIGIN` to one exact HTTPS origin. Wildcard CORS is rejected.
- Configure Cloudflare rate limiting for `/v1/*` before public exposure.
- Do not expose this API publicly until the token is generated, stored as a Worker secret, and the D1 migration is applied.

## Durable provider run ledger

Migration `0002_task_runs.sql` adds a persistent run registry with unique `(task_id, run_key)` claims, provider request IDs, append-only run events and an `outcome_unknown` state. This is schema groundwork only: no provider dispatch endpoint is enabled by this migration. See `docs/PROVIDER_RUN_LEDGER.md` for the required atomic claim, timeout and retry rules.

## Endpoints

- `GET /v1/health` — unauthenticated health.
- `GET /v1/tasks` — authenticated task list.
- `POST /v1/tasks` — authenticated task creation; requires `Idempotency-Key`.
- `GET /v1/tasks/{uuid}` — task detail.
- `GET /v1/tasks/{uuid}/events` — ordered event history for the mobile owner client.\n- `POST /v1/tasks/{uuid}/events` — append a validated progress/status event from a trusted runner only; requires the separate `FACTORY_RUNNER_TOKEN` secret.
- `POST /v1/tasks/{uuid}/runs` — intentionally returns `503 provider_not_configured` until a real provider adapter exists.

## Deploy prerequisites

The repository contains a guarded manual GitHub Actions deploy workflow at `.github/workflows/deploy-factory-api.yml`. It is deliberately manual and refuses to deploy while placeholders or required secrets are missing. First create a D1 database named `universal-ai-factory` in the intended Cloudflare account (for example, with `npx wrangler d1 create universal-ai-factory` on a trusted computer) and copy its UUID into `FACTORY_D1_DATABASE_ID`. The workflow applies the migration before deploying the Worker.

Configure these in **Antigravity-Mobile → Settings → Secrets and variables → Actions**:

**Repository secrets**
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with permission to deploy Workers and manage the selected D1 database.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `FACTORY_D1_DATABASE_ID` — UUID of a D1 database named `universal-ai-factory`.
- `FACTORY_API_TOKEN_SHA256` — SHA-256 hex digest of a random token with at least 32 bytes of entropy. Store the raw token separately in a password manager; never send it in chat or commit it.\n- `FACTORY_RUNNER_TOKEN` — a separate high-entropy secret used only by trusted Factory runner workers to append progress events. Never put this token in the Android app or expose it to users.

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
