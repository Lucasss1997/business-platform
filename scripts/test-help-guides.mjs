import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
if (!process.env.PGLITE_MODULE)
  throw new Error(
    "Set PGLITE_MODULE to the PGlite module path. This uses an isolated database only.",
  );
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE));
const db = new PGlite();
let checks = 0;
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
const admin = "20000000-0000-4000-8000-000000000001",
  user = "20000000-0000-4000-8000-000000000002",
  outsider = "20000000-0000-4000-8000-000000000003";
const pdf = org + "/30000000-0000-4000-8000-000000000001/guide.pdf";
async function as(id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
async function q(sql, args = []) {
  return (await db.query(sql, args)).rows;
}
async function denied(sql, args = []) {
  let rejected = false;
  try {
    await db.query(sql, args);
  } catch {
    rejected = true;
  }
  assert.ok(rejected);
  checks++;
}
function ok(value) {
  assert.ok(value);
  checks++;
}
try {
  await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.organisations(id uuid primary key,active boolean not null default true);
 create table public.organisation_members(organisation_id uuid,user_id uuid,role text,active boolean default true);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to authenticated,anon;
 grant select,insert,update,delete on storage.objects to authenticated,anon;
 create policy existing_permissive_storage_policy on storage.objects for all to public using(true) with check(true);
 insert into auth.users values('${admin}'),('${user}'),('${outsider}');
 insert into public.organisations(id) values('${org}'),('${other}');
 insert into public.organisation_members values('${org}','${admin}','admin',true),('${org}','${user}','user',true),('${other}','${outsider}','admin',true);
 `);
  await db.exec(
    await readFile(
      new URL(
        "../database/migrations/20261118_help_guides.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const bucket = (await q("select * from storage.buckets"))[0];
  ok(
    bucket.public === false &&
      bucket.file_size_limit === 10485760 &&
      bucket.allowed_mime_types[0] === "application/pdf",
  );
  await as(admin);
  const article = (
    await q(
      "insert into public.help_guides(organisation_id,title,category,content)values($1,'Calling guide','Calling and tasks','How to claim a call.')returning *",
      [org],
    )
  )[0];
  ok(
    article.created_by === admin &&
      article.updated_by === admin &&
      article.version === 0,
  );
  await q(
    "insert into storage.objects(bucket_id,name)values('platform-help-guides',$1)",
    [pdf],
  );
  const guide = (
    await q(
      "insert into public.help_guides(organisation_id,title,file_path,file_name,file_size)values($1,'Team PDF',$2,'team-guide.pdf',1000)returning *",
      [org, pdf],
    )
  )[0];
  ok(guide.file_path === pdf);
  await as(user);
  ok((await q("select id from public.help_guides")).length === 2);
  ok(
    (
      await q(
        "select * from storage.objects where bucket_id='platform-help-guides'",
      )
    ).length === 1,
  );
  await denied(
    "insert into public.help_guides(organisation_id,title,content)values($1,'Spoof','Not allowed')",
    [org],
  );
  ok(
    (
      await q(
        "update public.help_guides set title='Spoof' where id=$1 returning id",
        [article.id],
      )
    ).length === 0,
  );
  await denied("delete from public.help_guides where id=$1", [article.id]);
  await denied(
    "insert into storage.objects(bucket_id,name)values('platform-help-guides',$1)",
    [org + "/ordinary-user/guide.pdf"],
  );
  ok(
    (await q("delete from storage.objects where name=$1 returning id", [pdf]))
      .length === 0,
  );
  await as(outsider);
  ok((await q("select id from public.help_guides")).length === 0);
  ok(
    (
      await q(
        "select * from storage.objects where bucket_id='platform-help-guides'",
      )
    ).length === 0,
  );
  await denied(
    "insert into public.help_guides(organisation_id,title,content)values($1,'Cross tenant','Not allowed')",
    [org],
  );
  await denied(
    "insert into storage.objects(bucket_id,name)values('platform-help-guides',$1)",
    [org + "/other-admin/guide.pdf"],
  );
  await as(null, "anon");
  await denied("select * from public.help_guides");
  ok(
    (
      await q(
        "select * from storage.objects where bucket_id='platform-help-guides'",
      )
    ).length === 0,
  );
  await denied(
    "insert into storage.objects(bucket_id,name)values('platform-help-guides',$1)",
    [org + "/anonymous/guide.pdf"],
  );
  await as(admin);
  await denied(
    "insert into storage.objects(bucket_id,name)values('platform-help-guides',$1)",
    [org + "/wrong-extension.html"],
  );
  ok(
    (
      await q("update storage.objects set name=$1 where name=$2 returning id", [
        org + "/changed/guide.pdf",
        pdf,
      ])
    ).length === 0,
  );
  ok(
    (await q("delete from storage.objects where name=$1 returning id", [pdf]))
      .length === 0,
  );
  const orphan = org + "/orphan/guide.pdf";
  await q(
    "insert into storage.objects(bucket_id,name)values('platform-help-guides',$1)",
    [orphan],
  );
  await as(user);
  ok(
    (await q("select * from storage.objects where name=$1", [orphan]))
      .length === 0,
  );
  await as(admin);
  ok(
    (await q("select * from storage.objects where name=$1", [orphan]))
      .length === 1,
  );
  ok(
    (
      await q("delete from storage.objects where name=$1 returning id", [
        orphan,
      ])
    ).length === 1,
  );
  const archived = (
    await q(
      "update public.help_guides set archived=true where id=$1 and version=0 returning *",
      [guide.id],
    )
  )[0];
  ok(archived.version === 1);
  await as(user);
  ok(
    (await q("select id from public.help_guides where id=$1", [guide.id]))
      .length === 0,
  );
  ok(
    (await q("select * from storage.objects where name=$1", [pdf])).length ===
      0,
  );
  await as(admin);
  ok(
    (await q("select id from public.help_guides where id=$1", [guide.id]))
      .length === 1,
  );
  ok(
    (await q("select * from storage.objects where name=$1", [pdf])).length ===
      1,
  );
  ok(
    (
      await q(
        "update public.help_guides set archived=false where id=$1 and version=1 returning id",
        [guide.id],
      )
    ).length === 1,
  );
  ok(
    (
      await q(
        "update public.help_guides set title='Stale' where id=$1 and version=0 returning id",
        [guide.id],
      )
    ).length === 0,
  );
  const stamped = (
    await q(
      "update public.help_guides set organisation_id=$1,created_by=$2,updated_by=$2,version=900 where id=$3 returning *",
      [other, outsider, guide.id],
    )
  )[0];
  ok(
    stamped.organisation_id === org &&
      stamped.created_by === admin &&
      stamped.updated_by === admin &&
      stamped.version === 3,
  );
  await denied(
    "insert into public.help_guides(organisation_id,title,content,file_path,file_name,file_size)values($1,'Bad path','Body',$2,'x.pdf',1)",
    [org, other + "/wrong/guide.pdf"],
  );
  await denied(
    "insert into public.help_guides(organisation_id,title)values($1,'Empty')",
    [org],
  );
  await denied(
    "insert into public.help_guides(organisation_id,title,file_path,file_name,file_size)values($1,'Too big',$2,'x.pdf',10485761)",
    [org, org + "/too-big/guide.pdf"],
  );
  await db.exec("reset role");
  await q(
    "update public.organisation_members set active=false where user_id=$1",
    [user],
  );
  await as(user);
  ok((await q("select id from public.help_guides")).length === 0);
  ok(
    (
      await q(
        "select * from storage.objects where bucket_id='platform-help-guides'",
      )
    ).length === 0,
  );
  await db.exec("reset role");
  await q("update public.organisations set active=false where id=$1", [org]);
  await as(admin);
  ok((await q("select id from public.help_guides")).length === 0);
  await denied(
    "insert into public.help_guides(organisation_id,title,content)values($1,'Inactive','Denied')",
    [org],
  );
  ok(
    (
      await q(
        "select * from storage.objects where bucket_id='platform-help-guides'",
      )
    ).length === 0,
  );
  await db.exec("reset role");
  await q(
    "insert into storage.objects(bucket_id,name)values('legacy-bucket','public-file.pdf')",
  );
  await as(null, "anon");
  ok(
    (await q("select * from storage.objects where bucket_id='legacy-bucket'"))
      .length === 1,
  );
  console.log(
    `${checks} help-guide database checks passed, including tenant isolation, role checks, archive/restore, immutable files, optimistic editing and legacy-policy safeguards.`,
  );
} finally {
  await db.close();
}
