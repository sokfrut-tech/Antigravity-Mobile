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

1. Create a Cloudflare D1 database named `universal-ai-factory`.
2. Replace the placeholder `database_id` in `wrangler.toml`.
3. Set the exact allowed HTTPS origin in `CORS_ORIGIN`.
4. Generate a random token with at least 32 bytes of entropy. Compute its SHA-256 digest locally and set **only the digest**:
   `npx wrangler secret put API_TOKEN_SHA256`.
5. Apply the migration:
   `npx wrangler d1 migrations apply universal-ai-factory --remote`.
6. Deploy:
   `npx wrangler deploy`.
7. Verify `GET /v1/health`, then authenticated task create/list/read and idempotency replay.

The user-facing app login/token entry and secure Android Keystore storage are a separate client task; do not ask users to paste tokens into chat.
