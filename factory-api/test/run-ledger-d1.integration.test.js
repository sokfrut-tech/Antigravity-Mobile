import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, test } from "node:test";
import { Miniflare } from "miniflare";
import { transitionProviderRun } from "../src/run-lifecycle.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const token = "runner-secret-value-0123456789abcdef0123456789";
const runId = "00000000-0000-4000-8000-000000000001";
const taskId = "00000000-0000-4000-8000-000000000002";
const timestamp = "2026-11-04T12:00:00.000Z";

let mf;
let DB;

async function seed() {
  await DB.prepare(`INSERT INTO tasks
    (id,user_id,title,brief,project_id,priority,status,correlation_id,
     acceptance_criteria_json,created_at,updated_at)
    VALUES(?,?,?,?,?,'normal','new',?,'[]',?,?)`)
    .bind(taskId,"owner","Test task","D1 integration","factory","corr-test",timestamp,timestamp).run();
  await DB.prepare(`INSERT INTO task_runs
    (id,task_id,user_id,run_key,provider,role,status,attempt,dispatch_token,
     request_fingerprint,created_at,updated_at)
    VALUES(?,?,?,'run-key-001','claude','implementer','claimed',1,?,?,?,?)`)
    .bind(runId,taskId,"owner","dispatch-token-0001","fingerprint",timestamp,timestamp).run();
  await DB.prepare(`INSERT INTO task_run_events
    (id,run_id,task_id,sequence,type,timestamp,summary,data_json)
    VALUES('event-claimed',?,?,1,'claimed',?,'Claimed','{}')`)
    .bind(runId,taskId,timestamp).run();
}

function request(body) {
  return new Request(`https://factory.test/v1/runs/${runId}/transitions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function status() {
  const row = await DB.prepare("SELECT status FROM task_runs WHERE id=?").bind(runId).first();
  return row.status;
}

beforeEach(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } };",
    d1Databases: { DB: "00000000-0000-4000-8000-000000000099" }
  });
  await mf.ready;
  DB = await mf.getD1Database("DB");
  for (const name of ["0001_initial.sql", "0002_task_runs.sql", "0003_task_run_event_guards.sql"]) {
    const sql = (await readFile(join(migrationsDir, name), "utf8"))
      .replace("PRAGMA foreign_keys = ON;", "")
      .split(/\r?\n/).filter(line => !line.trimStart().startsWith("--")).join("\n");
    // Miniflare D1 exec accepts one statement at a time. Keep trigger bodies intact.
    let statement = "";
    let inTrigger = false;
    for (const line of sql.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!statement.trim() && /^CREATE TRIGGER\b/i.test(trimmed)) inTrigger = true;
      statement += line + "\n";
      if (inTrigger ? /^END;$/i.test(trimmed) : trimmed.endsWith(";")) {
        if (statement.trim()) await DB.prepare(statement).run();
        statement = "";
        inTrigger = false;
      }
    }
    if (statement.trim()) await DB.prepare(statement).run();
  }
  await seed();
});

afterEach(async () => {
  await mf?.dispose();
});

test("D1 batch compare-and-set permits only one concurrent transition and event", async () => {
  const payload = { expectedStatus:"claimed", nextStatus:"dispatching", summary:"Dispatch started" };
  const [a,b] = await Promise.all([
    transitionProviderRun(request(payload),runId,{DB,FACTORY_RUNNER_TOKEN:token}),
    transitionProviderRun(request(payload),runId,{DB,FACTORY_RUNNER_TOKEN:token})
  ]);
  assert.deepEqual([a.status,b.status].sort(),[201,409]);
  assert.equal(await status(),"dispatching");
  const event = await DB.prepare("SELECT COUNT(*) AS count FROM task_run_events WHERE run_id=? AND type='dispatch_started'").bind(runId).first();
  assert.equal(event.count,1);
});

test("D1 batch rolls back status when audit event insert fails", async () => {
  await DB.prepare(`CREATE TRIGGER reject_dispatch_audit
    BEFORE INSERT ON task_run_events WHEN NEW.type='dispatch_started'
    BEGIN SELECT RAISE(ABORT,'forced audit failure'); END;`).run();
  const response = await transitionProviderRun(
    request({expectedStatus:"claimed",nextStatus:"dispatching",summary:"Dispatch started"}),
    runId,{DB,FACTORY_RUNNER_TOKEN:token}
  );
  assert.equal(response.status,503);
  assert.equal(await status(),"claimed");
  const event = await DB.prepare("SELECT COUNT(*) AS count FROM task_run_events WHERE run_id=? AND type='dispatch_started'").bind(runId).first();
  assert.equal(event.count,0);
});

test("D1 migration rejects cross-task events and event updates", async () => {
  await DB.prepare(`INSERT INTO tasks
    (id,user_id,title,brief,project_id,priority,status,correlation_id,
     acceptance_criteria_json,created_at,updated_at)
    VALUES('other-task','owner','Other','Other task','factory','normal','new',
           'corr-other','[]',?,?)`).bind(timestamp,timestamp).run();
  await assert.rejects(DB.prepare(`INSERT INTO task_run_events
    (id,run_id,task_id,sequence,type,timestamp,summary,data_json)
    VALUES('wrong-owner',?,'other-task',2,'blocked',?,'Bad','{}')`)
    .bind(runId,timestamp).run());
  await assert.rejects(DB.prepare("UPDATE task_run_events SET summary='rewritten' WHERE id='event-claimed'").run());
  await assert.rejects(DB.prepare("DELETE FROM task_run_events WHERE id='event-claimed'").run());
  const retained = await DB.prepare("SELECT COUNT(*) AS count FROM task_run_events WHERE id='event-claimed'").first();
  assert.equal(retained.count,1);
});
