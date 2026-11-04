-- Durable run ledger. A logical run key is unique per task.
-- A network timeout is recorded as outcome_unknown and MUST NOT be auto-retried.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  run_key TEXT NOT NULL CHECK(length(run_key) BETWEEN 8 AND 128),
  provider TEXT NOT NULL CHECK(length(provider) BETWEEN 1 AND 80),
  role TEXT NOT NULL CHECK(length(role) BETWEEN 1 AND 80),
  status TEXT NOT NULL DEFAULT 'claimed'
    CHECK(status IN (
      'claimed','dispatching','accepted','running','review',
      'outcome_unknown','blocked','partial','failed','completed','cancelled'
    )),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt >= 1),
  dispatch_token TEXT NOT NULL UNIQUE,
  provider_request_id TEXT,
  request_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dispatched_at TEXT,
  finished_at TEXT,
  outcome_note TEXT,
  UNIQUE(task_id, run_key)
);

CREATE INDEX IF NOT EXISTS idx_task_runs_task_created
  ON task_runs(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_runs_user_status
  ON task_runs(user_id, status, updated_at DESC);
-- A task may have only one non-terminal run, even when callers use different run keys.
-- Unknown/blocked/partial runs remain active until explicitly reconciled or cancelled.
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_runs_one_active_per_task
  ON task_runs(task_id)
  WHERE status NOT IN ('failed','completed','cancelled');
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_runs_provider_request
  ON task_runs(provider, provider_request_id)
  WHERE provider_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES task_runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  type TEXT NOT NULL CHECK(type IN (
    'claimed','dispatch_started','provider_accepted','provider_progress',
    'outcome_unknown','reconciled','review_started','completed',
    'blocked','failed','cancelled','retry_authorized'
  )),
  timestamp TEXT NOT NULL,
  summary TEXT NOT NULL CHECK(length(summary) BETWEEN 1 AND 500),
  data_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(run_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_sequence
  ON task_run_events(run_id, sequence);

-- No automatic transition from outcome_unknown to dispatching is permitted.
-- A retry requires an explicit retry_authorized event and a new run_key.
