// Run with @electric-sql/pglite installed in a separate test workspace.
// PGLITE_MODULE may be an absolute path to its dist/index.js.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1),
  otherOrg = id(2),
  admin = id(10),
  caller = id(11),
  manager = id(12),
  outsider = id(13);
await db.exec(`
 create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table auth.users(id uuid primary key);
 create table public.organisations(id uuid primary key,active boolean default true);
 create table public.organisation_members(organisation_id uuid,user_id uuid,role text,active boolean);
 create table public.profiles(id uuid,display_name text,email text);
 create table public.companies(id uuid primary key,organisation_id uuid,phone text,mobile text);
 insert into auth.users values('${admin}'),('${caller}'),('${manager}'),('${outsider}');
 insert into organisations values('${org}',true),('${otherOrg}',true);
 insert into organisation_members values('${org}','${admin}','admin',true),('${org}','${caller}','user',true),('${org}','${manager}','user',true),('${otherOrg}','${outsider}','admin',true);
 insert into profiles values('${admin}','Admin','admin@example.test'),('${caller}','Caller','caller@example.test'),('${manager}','Manager','manager@example.test');
 insert into companies values('${id(100)}','${org}','01234 000100',null),('${id(101)}','${org}','01234 000101',null),('${id(102)}','${org}','01234 000102',null),('${id(103)}','${org}','+44 1234 000101',null),('${id(104)}','${org}',null,null),('${id(105)}','${otherOrg}','01234 000105',null),('${id(106)}','${org}','01234 000106',null);
`);
await db.exec(
  await readFile(
    new URL(
      "../database/migrations/20261118_calling_workflow.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
async function actor(user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
async function rpc(name, args) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(",");
  return (
    await db.query(`select public.${name}(${placeholders}) as result`, args)
  ).rows[0].result;
}
async function fails(fn, pattern) {
  await assert.rejects(fn, pattern);
}
async function enqueue(companies, screened = true) {
  return rpc("crm_call_enqueue", [
    org,
    companies,
    "Rail research",
    "Discuss portable power",
    new Date().toISOString().slice(0, 10),
    null,
    screened,
  ]);
}
async function openTask(company) {
  return (
    await db.query(
      "select * from crm_call_tasks where company_id=$1 and status='open'",
      [company],
    )
  ).rows[0];
}
await actor(admin);
await fails(() => enqueue([id(100)], false), /screening/i);
assert.deepEqual(await enqueue([id(100), id(101), id(102), id(104), id(106)]), {
  added: 4,
  skipped: 1,
});
assert.deepEqual(await enqueue([id(100)]), { added: 0, skipped: 1 });
await fails(() => enqueue([id(105)]), /access denied/i);
await fails(
  () => db.query("update crm_call_tasks set status='completed'"),
  /permission denied/i,
);
await rpc("crm_call_set_manager", [org, manager, true]);
await actor(caller);
await fails(() => enqueue([id(103)]), /admin/i);
let task = await openTask(id(100));
task = await rpc("crm_call_assign", [task.id, task.version, caller]);
await fails(() => rpc("crm_call_assign", [task.id, 0, caller]), /changed/i);
await fails(
  () =>
    rpc("crm_call_record", [
      task.id,
      task.version,
      "qualified",
      4,
      "Interested",
      null,
      outsider,
    ]),
  /manager/i,
);
assert.equal(
  (await openTask(id(100))).version,
  task.version,
  "Failed outcome must leave parent unchanged",
);
const nextDate = (
  await db.query(
    "select (current_date+interval '3 months')::date::text as value",
  )
).rows[0].value;
const saved = await rpc("crm_call_record", [
  task.id,
  task.version,
  "callback",
  4,
  "Call in three months",
  nextDate,
  null,
]);
assert.ok(saved.next_task_id);
let next = await openTask(id(100));
assert.equal(new Date(next.due_date).toISOString().slice(0, 10), nextDate);
assert.equal(next.parent_id, task.id);
assert.equal(next.assigned_user_id, caller);
await fails(
  () =>
    rpc("crm_call_record", [
      task.id,
      task.version,
      "callback",
      4,
      "Duplicate",
      nextDate,
      null,
    ]),
  /already handled/i,
);
await fails(
  () =>
    rpc("crm_call_record", [
      next.id,
      next.version,
      "not_suitable",
      1,
      "Early call",
      null,
      null,
    ]),
  /not due/i,
);
task = await openTask(id(101));
task = await rpc("crm_call_assign", [task.id, task.version, caller]);
await rpc("crm_call_record", [
  task.id,
  task.version,
  "do_not_contact",
  null,
  "Asked not to be called again",
  null,
  null,
]);
await actor(admin);
assert.deepEqual(
  await enqueue([id(101), id(103)]),
  { added: 0, skipped: 2 },
  "Suppressed phone must survive duplicate-company reimport",
);
await fails(
  () => rpc("crm_call_reactivate", [id(101), "Retry"]),
  /cannot be reactivated/i,
);
await actor(caller);
task = await openTask(id(102));
task = await rpc("crm_call_assign", [task.id, task.version, caller]);
await rpc("crm_call_record", [
  task.id,
  task.version,
  "qualified",
  5,
  "Needs quotation, manager follow-up",
  new Date().toISOString().slice(0, 10),
  manager,
]);
assert.equal((await openTask(id(102))).assigned_user_id, manager);
await fails(
  async () => rpc("crm_call_assign", [(await openTask(id(102))).id, 0, caller]),
  /owns this task/i,
);
await actor(outsider);
assert.equal(
  (await db.query("select * from crm_call_tasks")).rows.length,
  0,
  "RLS must hide other organisations",
);
assert.equal(
  (await db.query("select * from crm_call_team($1)", [org])).rows.length,
  0,
);
await fails(
  () =>
    rpc("crm_call_record", [
      next.id,
      next.version,
      "not_suitable",
      1,
      "Cross tenant",
      null,
      null,
    ]),
  /access denied/i,
);
await actor(caller);
for (let i = 0; i < 3; i++) {
  let retry = await openTask(id(106));
  retry = await rpc("crm_call_assign", [retry.id, retry.version, caller]);
  await rpc("crm_call_record", [
    retry.id,
    retry.version,
    "no_answer",
    null,
    "No answer",
    new Date().toISOString().slice(0, 10),
    null,
  ]);
}
assert.equal(
  await openTask(id(106)),
  undefined,
  "Three unanswered attempts must stop automatic retries",
);
await actor(admin);
await rpc("crm_call_reactivate", [
  id(106),
  "Number verified; deliberate new campaign",
]);
assert.deepEqual(await enqueue([id(106)]), { added: 1, skipped: 0 });
await db.exec("reset role");
await db.query(
  "update organisation_members set active=false where user_id=$1",
  [caller],
);
await actor(caller);
assert.equal(
  (await db.query("select * from crm_call_tasks")).rows.length,
  0,
  "Inactive users must lose access",
);
await db.close();
console.log(
  "Passed: batch deduplication, access control, stale writes, atomic rollback, callback dates, future callbacks, manager handover, suppression, reimport protection, retry limit and reactivation.",
);
