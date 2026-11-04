-- Store provider output as a user-owned artifact linked to a durable run.
CREATE TABLE IF NOT EXISTS task_run_outputs (
  run_id TEXT PRIMARY KEY REFERENCES task_runs(id) ON DELETE RESTRICT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_request_id TEXT,
  output_text TEXT NOT NULL CHECK(length(output_text) BETWEEN 1 AND 50000),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_run_outputs_user_created
  ON task_run_outputs(user_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_task_run_outputs_no_update
BEFORE UPDATE ON task_run_outputs
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'task_run_outputs_are_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_task_run_outputs_no_delete
BEFORE DELETE ON task_run_outputs
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'task_run_outputs_are_immutable');
END;
