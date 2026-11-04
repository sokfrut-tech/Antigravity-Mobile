# Durable provider run ledger

Status: schema contract / not deployed, 2026-11-04.

## Purpose

The task idempotency key protects task creation. It does not protect provider dispatch. This ledger adds a separate durable identity for each logical provider run.

## Storage

Cloudflare D1 migration: `migrations/0002_task_runs.sql`.

- `task_runs` is the authoritative run record.
- `UNIQUE(task_id, run_key)` prevents two claims for the same logical run.
- `dispatch_token` is a unique opaque identifier for the single dispatch claim.
- `provider_request_id` is unique per provider when present.
- `task_run_events` is append-only run history with a per-run sequence.

## Required dispatch protocol

1. Authenticate the trusted orchestrator/runner, not the Android client.
2. Validate task ownership, provider allowlist, role, policy and approval requirements.
3. Calculate a stable request fingerprint from the normalized provider, role, model and payload. Never store credentials or raw secret values in it.
4. Atomically insert a `claimed` row using the caller's stable `run_key`. The unique constraint is the concurrency guard. If the key already exists, return the existing run and do not dispatch again.
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
