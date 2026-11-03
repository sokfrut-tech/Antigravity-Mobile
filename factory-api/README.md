# Universal AI Factory API — Cloudflare Worker (bootstrap)

This is the first backend implementation slice for Antigravity Mobile. It provides authenticated health, task creation/list/detail, and task event history using Cloudflare Workers + D1.

**It is not deployed yet.** The mobile APK does not call this API yet. Provider dispatch is deliberately disabled and returns `503 provider_not_configured`; no fake agent run is created.

## Security model (single-owner bootstrap)

- The Android client sends a bearer token over HTTPS.
- The Worker stores only `API_TOKEN_SHA256`, a SHA-256 digest of a high-entropy random token, as a Worker secret.
- The raw token must never be committed, placed in `wrangler.toml`, embedded in APK resources, or written to logs.
- Current bootstrap identity is a single owner principal. Before inviting other users, replace it with per-user OAuth/OIDC/JWT validation and row-level identity mapping.
- Configure `CORS_ORIGIN` to one exact HTTPS origin. Wildcard CORS is rejected.
- Configure Cloudflare rate limiting for `/v1/*` before public exposure.
- Do not expose this API publicly until the token is generated, stored as a Worker secret, and the D1 migration is applied.

## Endpoints

- `GET /v1/health` — unauthenticated health.
- `GET /v1/tasks` — authenticated task list.
- `POST /v1/tasks` — authenticated task creation; requires `Idempotency-Key`.
- `GET /v1/tasks/{uuid}` — task detail.
- `GET /v1/tasks/{uuid}/events` — ordered event history.
- `POST /v1/tasks/{uuid}/runs` — intentionally returns `503 provider_not_configured` until a real provider adapter exists.

## Deploy prerequisites

The repository contains a guarded manual GitHub Actions deploy workflow at `.github/workflows/deploy-factory-api.yml`. It is deliberately manual and refuses to deploy while placeholders or required secrets are missing.

Configure these in **Antigravity-Mobile → Settings → Secrets and variables → Actions**:

**Repository secrets**
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with permission to deploy Workers and manage the selected D1 database.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `FACTORY_D1_DATABASE_ID` — UUID of a D1 database named `universal-ai-factory`.
- `FACTORY_API_TOKEN_SHA256` — SHA-256 hex digest of a random token with at least 32 bytes of entropy. Store the raw token separately in a password manager; never send it in chat or commit it.

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

The user-facing app login/token entry and secure Android Keystore storage are a separate client task; do not expose the API until that client-side storage is ready and the deployment workflow succeeds.
