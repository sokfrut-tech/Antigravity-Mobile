# Provider run lifecycle transition contract

Status: partial implementation on the feature branch; limited runner-only transition endpoint exists. Completion, cancellation, reconciliation and retry remain disabled.

## Security boundary

- Every mutation is authenticated with the dedicated `FACTORY_RUNNER_TOKEN`; the mobile owner token is never accepted.
- The route addresses a run ID, not an arbitrary task status. The server resolves the task from the run row and never trusts a task ID supplied by the caller.
- Every transition uses compare-and-set: the caller supplies the expected current status and the database update includes that status in its WHERE clause.
- The server owns the allowed transition graph and event type mapping. Callers cannot choose arbitrary event types or target statuses.
- The transition and append-only event insert must commit in one D1 `batch()`. Inspect the update statement's `meta.changes`; zero means stale/invalid transition. The event insert must be conditional on the update having changed one row (for example, `changes() = 1` in the immediately following statement of the same batch). If either statement fails, the batch must roll back.
- The event sequence is allocated in the same batch from `MAX(sequence)+1`; the unique `(run_id, sequence)` constraint is the final guard.
- Do not make a provider network request inside a lifecycle mutation request.

## Allowed transitions

| Current | Next | Event | Notes |
|---|---|---|---|
| claimed | dispatching | dispatch_started | Persist before any outbound provider request. |
| dispatching | accepted | provider_accepted | Requires a validated provider request ID. |
| dispatching | failed | failed | Only for a definite rejection proving no work was accepted. |
| dispatching | outcome_unknown | outcome_unknown | Timeout, connection loss, crash, or ambiguous response. |
| accepted | running | provider_progress | Provider work is confirmed and being tracked. |
| accepted | review | review_started | Work returned and awaits independent review. |
| accepted | outcome_unknown | outcome_unknown | Provider outcome can no longer be established. |
| running | review | review_started | Work submitted for acceptance review. |
| running | outcome_unknown | outcome_unknown | Ambiguous loss of provider state. |
| running | failed | failed | Confirmed failure, with sanitized reason. |
| review | completed | completed | **Disabled until evidence validation is implemented.** |
| review | failed | failed | Acceptance checks failed or execution failed. |
| outcome_unknown | accepted/running/failed | reconciled | **Disabled until a separate reconciliation policy is implemented.** |
| any non-terminal | cancelled | cancelled | **Disabled until cancellation semantics and provider-side cancellation are reviewed.** |

No implicit transition, arbitrary status assignment, or automatic retry is allowed. `outcome_unknown` must reserve the task. A retry after confirmed non-acceptance requires a separately authorized retry event and a new run key.

For an `outcome_unknown` run:
- A replay using the same `run_key` and identical request fingerprint returns the existing run and does not create another run or dispatch.
- Reusing that key with a changed request fingerprint returns `run_key_conflict`.
- A new run key is rejected while the unknown run remains active (`active_run_exists`).
- No automatic retry or transition out of `outcome_unknown` is enabled. Reconciliation requires a separately reviewed workflow and evidence from the provider.


## Completion evidence gate

A future completion operation must not accept a free-form `completed=true` assertion. It must load the task's acceptance criteria from the database and require a structured evidence record that:
1. identifies the exact run and task;
2. maps every acceptance criterion to one or more evidence items;
3. identifies evidence type and immutable reference (for example, commit SHA, test run URL/ID, artifact digest, or review record);
4. records verifier identity, verification time, and result;
5. rejects missing, stale, mismatched, or failed evidence;
6. preserves the evidence and completion event in the same atomic database commit as the status change.

Provider response text, a progress event, a PR comment, an ACK, or a runner assertion alone is not acceptance evidence. A code task should normally require a commit/ref plus successful relevant CI and an independent review result. Non-code tasks need a separately defined evidence policy.

## D1 implementation notes

Cloudflare D1 `batch()` is the atomic multi-statement primitive. Use a conditional `UPDATE ... WHERE id=? AND status=?` followed by a conditional event insert in the same batch. Check the update result's `meta.changes`; do not infer success from a subsequent read alone. Test the real SQL against local D1/SQLite-compatible Wrangler, including two concurrent requests with the same expected status, and assert exactly one transition and one event.

## Current implementation boundary

The endpoint `POST /v1/tasks/:id/runs` creates a durable claim only. The runner-only endpoint `POST /v1/runs/:runId/transitions` implements only the enabled transitions in the table above (excluding completion, cancellation, and reconciliation). The legacy task-level event endpoint cannot mark a task completed. No provider network dispatch is enabled. Unit tests currently use a D1 test double; real local-D1 concurrency and rollback verification remain a release gate.
