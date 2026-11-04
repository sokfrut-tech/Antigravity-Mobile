#!/usr/bin/env python3
"""SQLite integration checks for the provider run ledger migrations and transaction invariants.

This exercises the actual migration SQL and SQLite transaction/CAS behavior. It is
not a Cloudflare D1 emulator; Wrangler's local migration/deploy checks remain separate.
"""
import concurrent.futures
import pathlib
import sqlite3
import tempfile
import threading
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"


def connect(path):
    db = sqlite3.connect(path, timeout=10, isolation_level=None)
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA busy_timeout = 10000")
    return db


def apply_migrations(db):
    for migration in sorted(MIGRATIONS.glob("*.sql")):
        db.executescript(migration.read_text(encoding="utf-8"))


def seed(db, task_id="task-1", run_id="run-1"):
    now = "2026-11-04T12:00:00.000Z"
    db.execute(
        """INSERT INTO tasks
        (id,user_id,title,brief,project_id,priority,status,correlation_id,
         acceptance_criteria_json,created_at,updated_at)
        VALUES(?,?,?,?,?,'normal','new',?,'[]',?,?)""",
        (task_id, "owner", "Test task", "Integration test", "test-project",
         "corr-" + task_id, now, now),
    )
    db.execute(
        """INSERT INTO task_runs
        (id,task_id,user_id,run_key,provider,role,status,attempt,dispatch_token,
         request_fingerprint,created_at,updated_at)
        VALUES(?,?,?,'run-key-001','claude','implementer','claimed',1,?,?,?,?)""",
        (run_id, task_id, "owner", "dispatch-" + run_id, "fingerprint", now, now),
    )
    db.execute(
        """INSERT INTO task_run_events
        (id,run_id,task_id,sequence,type,timestamp,summary,data_json)
        VALUES(?,?,?,1,'claimed',?,'Claimed','{}')""",
        ("event-" + run_id, run_id, task_id, now),
    )


def cas_transition(db, run_id, expected, target, event_id):
    now = "2026-11-04T12:01:00.000Z"
    db.execute("BEGIN IMMEDIATE")
    try:
        changed = db.execute(
            """UPDATE task_runs SET status=?,updated_at=?
               WHERE id=? AND status=?""",
            (target, now, run_id, expected),
        ).rowcount
        if changed == 1:
            task_id = db.execute(
                "SELECT task_id FROM task_runs WHERE id=? AND status=? AND updated_at=?",
                (run_id, target, now),
            ).fetchone()[0]
            sequence = db.execute(
                "SELECT COALESCE(MAX(sequence),0)+1 FROM task_run_events WHERE run_id=?",
                (run_id,),
            ).fetchone()[0]
            db.execute(
                """INSERT INTO task_run_events
                   (id,run_id,task_id,sequence,type,timestamp,summary,data_json)
                   VALUES(?,?,?,?,?,?,?,?)""",
                (event_id, run_id, task_id, sequence, "dispatch_started", now,
                 "Dispatch started", "{}"),
            )
        db.execute("COMMIT")
        return changed == 1
    except BaseException:
        db.execute("ROLLBACK")
        raise


class RunLedgerIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.tmp.name) / "ledger.sqlite"
        db = connect(self.path)
        apply_migrations(db)
        seed(db)
        db.close()

    def tearDown(self):
        self.tmp.cleanup()

    def test_concurrent_compare_and_set_creates_exactly_one_event(self):
        barrier = threading.Barrier(2)

        def contender(event_id):
            db = connect(self.path)
            try:
                barrier.wait(timeout=5)
                return cas_transition(db, "run-1", "claimed", "dispatching", event_id)
            finally:
                db.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(contender, ("event-a", "event-b")))

        self.assertEqual(sum(results), 1)
        db = connect(self.path)
        try:
            status = db.execute(
                "SELECT status FROM task_runs WHERE id='run-1'"
            ).fetchone()[0]
            events = db.execute(
                "SELECT COUNT(*) FROM task_run_events WHERE run_id='run-1' AND type='dispatch_started'"
            ).fetchone()[0]
            self.assertEqual(status, "dispatching")
            self.assertEqual(events, 1)
        finally:
            db.close()

    def test_audit_insert_failure_rolls_back_status_update(self):
        db = connect(self.path)
        try:
            db.execute(
                """CREATE TRIGGER reject_dispatch_audit
                   BEFORE INSERT ON task_run_events
                   WHEN NEW.type='dispatch_started'
                   BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END"""
            )
            with self.assertRaises(sqlite3.IntegrityError):
                cas_transition(db, "run-1", "claimed", "dispatching", "event-fail")
            status = db.execute(
                "SELECT status FROM task_runs WHERE id='run-1'"
            ).fetchone()[0]
            events = db.execute(
                "SELECT COUNT(*) FROM task_run_events WHERE run_id='run-1' AND type='dispatch_started'"
            ).fetchone()[0]
            self.assertEqual(status, "claimed")
            self.assertEqual(events, 0)
        finally:
            db.close()

    def test_migrations_enforce_event_task_ownership_and_append_only(self):
        db = connect(self.path)
        try:
            db.execute(
                """INSERT INTO tasks
                (id,user_id,title,brief,project_id,priority,status,correlation_id,
                 acceptance_criteria_json,created_at,updated_at)
                VALUES('task-2','owner','Other','Other task','test','normal','new',
                       'corr-task-2','[]','now','now')"""
            )
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    """INSERT INTO task_run_events
                    (id,run_id,task_id,sequence,type,timestamp,summary,data_json)
                    VALUES('wrong-owner','run-1','task-2',2,'blocked','now','Bad','{}')"""
                )
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    "UPDATE task_run_events SET summary='rewritten' WHERE id='event-run-1'"
                )
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
