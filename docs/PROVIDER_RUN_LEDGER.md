# Durable provider run ledger

Status: claim endpoint implemented on the feature branch; not deployed, 2026-11-04.

## Implemented claim endpoint

`POST /v1/tasks/:id/runs` authenticates only the trusted runner and creates a durable claim plus its first append-only event in one D1 batch. It accepts an allowlisted provider (`claude` or `gemini`), role, model, run key and object payload. The normalized request is fingerprinted; raw provider payload and credentials are not stored. Task-level preferred provider/role constraints are enforced.

- New claim: `201`; same key and same fingerprint: existing claim with `200`.
- Same key with a different fingerprint: `409 run_key_conflict`.
- Different key while a non-terminal run exists: `409 active_run_exists`.
- Provider network dispatch is still disabled. A claimed run is not evidence that Claude or Gemini received work.

## Purpose

The task idempotency key protects task creation. It does not protect provider dispatch. This ledger adds a separate durable identity for each logical provider run.

## Storage

Cloudflare D1 migration: `migrations/0002_task_runs.sql`.

- `task_runs` is the authoritative run record.
- `UNIQUE(task_id, run_key)` prevents two claims for the same logical run.
- A partial unique index permits only one non-terminal run per task, even if concurrent callers choose different run keys. `failed`, `completed` and `cancelled` are terminal; `blocked`, `partial` and `outcome_unknown` continue to reserve the task until explicitly reconciled or cancelled.
- `dispatch_token` is a unique opaque identifier for the single dispatch claim.
- `provider_request_id` is unique per provider when present.
- `task_run_events` is append-only run history with a per-run sequence.

## Required dispatch protocol

1. Authenticate the trusted orchestrator/runner, not the Android client.
2. Validate task ownership, provider allowlist, role, policy and approval requirements.
3. Calculate a stable request fingerprint from the normalized provider, role, model and payload. Never store credentials or raw secret values in it.
4. In one D1 transaction/batch, atomically insert a `claimed` row using the caller's stable `run_key` and append its first event. The `(task_id, run_key)` constraint deduplicates the same logical request; the one-active-run partial index rejects different keys racing for the same task. If the key already exists, return the existing run only when its normalized request fingerprint matches; otherwise return a conflict. Neither case may dispatch again.
5. Persist `dispatch_started` before making the outbound provider request.
6. On a definite provider rejection that proves no work was accepted, record `failed` with a sanitized reason. A retry must be explicitly authorized and use a new run key.
7. On a provider response, persist its provider request ID and `accepted` state before polling or doing more work.
8. On timeout, connection loss, malformed response or process crash after dispatch may have begun, persist `outcome_unknown`. Do not automatically send the request again.
9. Reconcile an unknown outcome using provider request lookup/webhook or a human decision. If it cannot be reconciled, keep it blocked; do not assume failure.
10. Mark `completed` only after independent acceptance checks and evidence are recorded.

## Retry and concurrency rules

- Repeated request with the same `(task_id, run_key)`: return the existing run; never issue another provider call.
- Different key while an active run exists for the same task: reject until the active run is terminal or explicitly cancelled.
- `outcome_unknown` is non-retryable automatically.
- A retry after a confirmed non-acceptance needs an explicit authorization event and a new run key.
- A provider's own idempotency feature may be used only after its official contract is verified; do not assume Claude and Gemini offer equivalent guarantees.
- D1 unique constraints are the final duplicate guard. GitHub Actions concurrency, files in inbox/outbox and in-memory locks are not substitutes.

## Security

- Provider credentials are retrieved by the trusted worker from secret bindings at dispatch time. Never store them in D1, task payloads, events, artifacts, logs or Git.
- Store only sanitized provider error codes/messages; do not persist raw response headers or exception text.
- Android users can read only their own task/run history. Only a trusted runner can claim or update runs.
- No endpoint in this change performs a provider network request. Provider dispatch remains disabled until the protocol has integration tests and a separately reviewed adapter.

## Verification boundary

Applying this migration locally in CI proves SQL syntax and migration compatibility only. It does not prove a remote D1 database exists, the Worker is deployed, or Claude/Gemini are connected.


## Legacy task-event boundary

The older task-level runner event endpoint is retained for progress/status compatibility, but it cannot emit a `completed` event or set task status to `completed`. Completion must be introduced through a separately reviewed run-lifecycle operation that validates completion evidence against the durable run. A progress event, a provider response, or a runner assertion alone is not completion evidence.
