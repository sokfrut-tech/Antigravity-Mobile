# Universal AI Factory API — Cloudflare Worker

This is the first backend implementation slice for Antigravity Mobile. It provides authenticated health, task creation/list/detail and task event history using Cloudflare Workers + D1.

## Deployment status

The main-branch bootstrap was deployed successfully on 2026-11-04:

- Worker: `https://universal-ai-factory-api.sokfrut.workers.dev`
- GitHub Actions: [Deploy Factory API run 41895896111](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41895896111)
- Source commit: `51c45cdc39645efe49dda5160d5b7e7f14fb4b80`
- D1 migrations applied: `0002_task_runs.sql`, `0003_task_run_event_guards.sql`, `0004_task_run_outputs.sql`
- Actions reported successful upload of the Worker secrets `API_TOKEN_SHA256` and `FACTORY_RUNNER_TOKEN`. Secret values are never recorded here.

A successful deploy job is not an independent runtime health check. Before relying on the service from a phone, request `GET /v1/health` from the app or another trusted client and record the response. The deployment log reported `CORS_ORIGIN=https://localhost`; review this setting before adding any browser-based client. Native Android HTTPS requests do not use browser CORS enforcement.

## Current capability boundary

- The deployed main-branch Worker supports authenticated health, task create/list/detail and task event history.
- The main-branch `POST /v1/tasks/{uuid}/runs` endpoint remains disabled and returns `503 provider_not_configured`.
- Draft PR [#19](https://github.com/sokfrut-tech/Antigravity-Mobile/pull/19) contains the first integrated Claude/Gemini/OpenAI server-side provider dispatch path. Its Android, Factory API and security CI passed on its exact head, but the PR is not merged or deployed.
- No live provider credentials or live model invocation have been verified. Provider API use may be billable; do not invoke providers without the user's explicit acknowledgement and approval.

## Security model (single-owner bootstrap)

- The Android client sends a bearer token over HTTPS.
- The Worker stores only `API_TOKEN_SHA256`, a SHA-256 digest of a high-entropy random token, as a Worker secret.
- The raw token must never be committed, placed in `wrangler.toml`, embedded in APK resources or written to logs.
- Current bootstrap identity is a single owner principal. Before inviting other users, replace it with per-user OAuth/OIDC/JWT validation and row-level identity mapping.
- Configure `CORS_ORIGIN` to one exact HTTPS origin. Wildcard CORS is rejected.
- Configure and verify Cloudflare rate limiting for `/v1/*` before broader public exposure.
- The trusted runner uses the separate `FACTORY_RUNNER_TOKEN` secret to append validated progress events; this token must never be put in the Android app or exposed to users.

## Endpoints

- `GET /v1/health` — unauthenticated health.
- `GET /v1/tasks` — authenticated task list.
- `POST /v1/tasks` — authenticated task creation; requires `Idempotency-Key`.
- `GET /v1/tasks/{uuid}` — task detail.
- `GET /v1/tasks/{uuid}/events` — ordered event history for the mobile owner client.
- `POST /v1/tasks/{uuid}/events` — append a validated progress/status event from a trusted runner only; requires the separate `FACTORY_RUNNER_TOKEN` secret.
- `POST /v1/tasks/{uuid}/runs` — disabled on main until the provider-dispatch integration is reviewed, merged and deployed.

## Deployment workflow

The guarded manual workflow is `.github/workflows/deploy-factory-api.yml`. It validates source branch and configuration, runs tests, configures D1 and CORS, applies migrations, uploads secret digests/tokens and deploys the Worker.

Required GitHub Actions secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `FACTORY_D1_DATABASE_ID`
- `FACTORY_API_TOKEN_SHA256`
- `FACTORY_RUNNER_TOKEN`

Required repository variable:
- `FACTORY_API_CORS_ORIGIN` — one exact HTTPS origin; no wildcard.

Never paste the raw token, token digest, Cloudflare token, account identifier or other credentials into chat, Git, screenshots or logs.

## Android connection

The Android app provides a secure token-entry screen and Android Keystore storage. Enter the Worker HTTPS URL and raw bearer token privately on the device. Do not paste either value into chat. Verify `/v1/health` before submitting tasks.

## Verification

For the current provider integration candidate, see PR #19 and its exact-head checks:

- Android build/unit/emulator: [41894926976](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41894926976)
- Factory API, SQLite/D1 migration and concurrency tests: [41894926000](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41894926000)
- Security gate: [41894926673](https://github.com/sokfrut-tech/Antigravity-Mobile/actions/runs/41894926673)

These are CI checks for the PR branch, not proof that the provider integration is deployed or that any live provider has accepted a request.
