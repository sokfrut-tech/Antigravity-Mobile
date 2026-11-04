-- Enforce the append-only and ownership-consistency guarantees of task_run_events.
-- D1/SQLite triggers reject event rows that point at a different task than their run.
CREATE TRIGGER IF NOT EXISTS trg_task_run_events_task_matches_run
BEFORE INSERT ON task_run_events
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM task_runs
  WHERE id = NEW.run_id AND task_id = NEW.task_id
)
BEGIN
  SELECT RAISE(ABORT, 'task_run_event_task_mismatch');
END;

-- Run history is immutable once written. Corrections must be represented by a
-- new event, never by rewriting or deleting prior evidence.
CREATE TRIGGER IF NOT EXISTS trg_task_run_events_no_update
BEFORE UPDATE ON task_run_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'task_run_events_are_append_only');
END;

CREATE TRIGGER IF NOT EXISTS trg_task_run_events_no_delete
BEFORE DELETE ON task_run_events
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'task_run_events_are_append_only');
END;
