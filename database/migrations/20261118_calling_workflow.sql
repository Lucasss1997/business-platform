-- Run once in Supabase SQL Editor. Existing tasks and assignment text are untouched.
begin;

create table public.crm_call_company_state (
  company_id uuid primary key references public.companies(id),
  organisation_id uuid not null references public.organisations(id),
  disposition text not null default 'active' check (disposition in
    ('active','not_suitable','do_not_contact','invalid_number','unreachable')),
  reason text not null default '',
  updated_at timestamptz not null default now()
);
create table public.crm_call_managers (
  organisation_id uuid not null references public.organisations(id),
  user_id uuid not null references auth.users(id),
  primary key (organisation_id,user_id)
);
create function public.crm_call_phone(p_phone text) returns text
language sql immutable set search_path='' as $$
  select regexp_replace(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'^(0044|44)','0');
$$;
create table public.crm_call_suppressed_numbers (
  organisation_id uuid not null references public.organisations(id),
  phone text not null,
  created_at timestamptz not null default now(),
  primary key(organisation_id,phone)
);
create table public.crm_call_tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  company_id uuid not null references public.companies(id),
  parent_id uuid references public.crm_call_tasks(id),
  batch_name text not null default '',
  brief text not null default '',
  kind text not null default 'call' check (kind in ('call','callback','information_followup','manager_followup')),
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  assigned_user_id uuid references auth.users(id),
  due_date date not null default ((now() at time zone 'Europe/London')::date),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  version integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index crm_call_one_open_per_company on public.crm_call_tasks(company_id) where status='open';
create index crm_call_queue_due on public.crm_call_tasks(organisation_id,status,due_date);
create table public.crm_call_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  company_id uuid not null references public.companies(id),
  task_id uuid not null references public.crm_call_tasks(id),
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  outcome text,
  rating smallint check (rating between 1 and 5),
  notes text not null default '',
  next_task_id uuid references public.crm_call_tasks(id),
  created_at timestamptz not null default now()
);

-- Internal access helper; never trusts an organisation supplied by the browser.
create function public.crm_call_member(p_org uuid, p_admin boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organisation_members m join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_org and m.user_id=auth.uid() and m.active and o.active
      and (not p_admin or m.role='admin'));
$$;
revoke all on function public.crm_call_member(uuid,boolean) from public;
grant execute on function public.crm_call_member(uuid,boolean) to authenticated;

alter table public.crm_call_company_state enable row level security;
alter table public.crm_call_managers enable row level security;
alter table public.crm_call_tasks enable row level security;
alter table public.crm_call_events enable row level security;
alter table public.crm_call_suppressed_numbers enable row level security;
create policy call_suppressed_read on public.crm_call_suppressed_numbers for select to authenticated using(public.crm_call_member(organisation_id));
create policy call_state_read on public.crm_call_company_state for select to authenticated using(public.crm_call_member(organisation_id));
create policy call_managers_read on public.crm_call_managers for select to authenticated using(public.crm_call_member(organisation_id));
create policy call_tasks_read on public.crm_call_tasks for select to authenticated using(public.crm_call_member(organisation_id));
create policy call_events_read on public.crm_call_events for select to authenticated using(public.crm_call_member(organisation_id));
revoke all on public.crm_call_company_state, public.crm_call_managers, public.crm_call_tasks, public.crm_call_events from anon,authenticated;
grant select on public.crm_call_company_state, public.crm_call_managers, public.crm_call_tasks, public.crm_call_events to authenticated;
revoke all on public.crm_call_suppressed_numbers from anon,authenticated;
grant select on public.crm_call_suppressed_numbers to authenticated;

create function public.crm_call_team(p_org uuid)
returns table(user_id uuid, display_name text, role text, is_manager boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id,coalesce(nullif(p.display_name,''),p.email,'Unnamed user'),m.role,
    exists(select 1 from public.crm_call_managers x where x.organisation_id=p_org and x.user_id=m.user_id)
  from public.organisation_members m left join public.profiles p on p.id=m.user_id
  where m.organisation_id=p_org and m.active and public.crm_call_member(p_org);
$$;

create function public.crm_call_set_manager(p_org uuid,p_user uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.crm_call_member(p_org,true) then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.organisation_members where organisation_id=p_org and user_id=p_user and active) then
    raise exception 'Choose an active organisation member'; end if;
  if p_enabled then insert into public.crm_call_managers values(p_org,p_user) on conflict do nothing;
  else delete from public.crm_call_managers where organisation_id=p_org and user_id=p_user; end if;
end; $$;

-- Explicit batch enqueue. Locks companies in stable order; retries skip existing open tasks.
create function public.crm_call_enqueue(p_org uuid,p_companies uuid[],p_batch text,p_brief text,p_due date,p_assignee uuid default null,p_screened boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.companies%rowtype; v_task uuid; v_added integer:=0; v_skipped integer:=0;
begin
  if not public.crm_call_member(p_org,true) then raise exception 'Admin access required'; end if;
  if p_screened is distinct from true then raise exception 'Confirm TPS/CTPS and internal suppression screening before queueing'; end if;
  if coalesce(cardinality(p_companies),0) not between 1 and 500 or p_due is null
    or char_length(coalesce(p_batch,'')) not between 1 and 160 or char_length(coalesce(p_brief,''))>4000 then
    raise exception 'Choose 1–500 companies, a batch name and due date'; end if;
  if p_assignee is not null and not exists(select 1 from public.organisation_members
    where organisation_id=p_org and user_id=p_assignee and active) then raise exception 'Invalid assignee'; end if;
  if exists(select 1 from unnest(p_companies) x where not exists
    (select 1 from public.companies where id=x and organisation_id=p_org)) then raise exception 'Company access denied'; end if;
  for c in select * from public.companies where id=any(p_companies) and organisation_id=p_org order by id for update loop
    if coalesce(nullif(btrim(c.phone),''),nullif(btrim(c.mobile),'')) is null
      or exists(select 1 from public.crm_call_company_state where company_id=c.id and disposition<>'active')
      or exists(select 1 from public.crm_call_suppressed_numbers s where s.organisation_id=p_org
        and s.phone in (public.crm_call_phone(c.phone),public.crm_call_phone(c.mobile)))
      or exists(select 1 from public.crm_call_tasks where company_id=c.id and status='open') then
      v_skipped:=v_skipped+1; continue;
    end if;
    insert into public.crm_call_tasks(organisation_id,company_id,batch_name,brief,due_date,assigned_user_id,created_by)
      values(p_org,c.id,btrim(p_batch),btrim(coalesce(p_brief,'')),p_due,p_assignee,auth.uid()) returning id into v_task;
    insert into public.crm_call_events(organisation_id,company_id,task_id,actor_id,event_type,notes)
      values(p_org,c.id,v_task,auth.uid(),'queued','TPS/CTPS and internal suppression screening confirmed by queue creator. '||btrim(coalesce(p_brief,'')));
    v_added:=v_added+1;
  end loop;
  return jsonb_build_object('added',v_added,'skipped',v_skipped);
end; $$;

-- Claim, return to team, and admin reassignment all use the same row lock/version.
create function public.crm_call_assign(p_task uuid,p_version integer,p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.crm_call_tasks%rowtype;
begin
  select * into t from public.crm_call_tasks where id=p_task for update;
  if not found or not public.crm_call_member(t.organisation_id) then raise exception 'Task access denied'; end if;
  if t.status<>'open' or p_version is null or t.version<>p_version then raise exception 'Task changed. Refresh the queue.'; end if;
  if not public.crm_call_member(t.organisation_id,true) and not (
    (t.assigned_user_id is null and p_user=auth.uid()) or (t.assigned_user_id=auth.uid() and (p_user is null or p_user=auth.uid()))) then
    raise exception 'Another salesperson owns this task'; end if;
  if p_user is not null and not exists(select 1 from public.organisation_members
    where organisation_id=t.organisation_id and user_id=p_user and active) then raise exception 'Invalid assignee'; end if;
  if exists(select 1 from public.crm_call_company_state where company_id=t.company_id and disposition<>'active') then
    raise exception 'This company is closed or suppressed'; end if;
  if exists(select 1 from public.crm_call_suppressed_numbers s join public.companies c on c.id=t.company_id
    where s.organisation_id=t.organisation_id and s.phone in (public.crm_call_phone(c.phone),public.crm_call_phone(c.mobile))) then
    raise exception 'This phone number has been suppressed'; end if;
  update public.crm_call_tasks set assigned_user_id=p_user,version=version+1 where id=t.id returning * into t;
  insert into public.crm_call_events(organisation_id,company_id,task_id,actor_id,event_type,notes)
    values(t.organisation_id,t.company_id,t.id,auth.uid(),'assignment',case when p_user is null then 'Returned to team queue' else 'Assigned to '||p_user::text end);
  return to_jsonb(t);
end; $$;

create function public.crm_call_record(p_task uuid,p_version integer,p_outcome text,p_rating integer,p_notes text,p_due date default null,p_manager uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.crm_call_tasks%rowtype; v_next uuid; v_kind text; v_disposition text:='active';
  v_assignee uuid; v_due date; v_attempt integer; v_contact text;
begin
  select * into t from public.crm_call_tasks where id=p_task for update;
  if not found or not public.crm_call_member(t.organisation_id) then raise exception 'Task access denied'; end if;
  if t.status<>'open' or p_version is null or t.version<>p_version then raise exception 'Task already handled or changed. Refresh the queue.'; end if;
  if t.due_date>((now() at time zone 'Europe/London')::date) then raise exception 'This callback is not due yet'; end if;
  if t.assigned_user_id is distinct from auth.uid() then raise exception 'Claim this task before recording a call'; end if;
  -- Same lock as enqueue serialises callbacks, closing and batch queue operations.
  perform 1 from public.companies where id=t.company_id and organisation_id=t.organisation_id for update;
  if not found then raise exception 'Company access denied'; end if;
  if exists(select 1 from public.crm_call_company_state where company_id=t.company_id and disposition<>'active') then
    raise exception 'This company is closed or suppressed'; end if;
  if exists(select 1 from public.crm_call_suppressed_numbers s join public.companies c on c.id=t.company_id
    where s.organisation_id=t.organisation_id and s.phone in (public.crm_call_phone(c.phone),public.crm_call_phone(c.mobile))) then
    raise exception 'This phone number has been suppressed'; end if;
  if p_outcome is null or p_outcome not in ('no_answer','voicemail','callback','send_information','qualified','not_suitable','do_not_contact','wrong_number','opportunity_started')
    or char_length(btrim(coalesce(p_notes,''))) not between 1 and 10000
    or (p_rating is not null and p_rating not between 1 and 5) then raise exception 'Choose an outcome and enter call notes'; end if;
  if p_outcome in ('callback','send_information','qualified','opportunity_started') and p_rating is null then
    raise exception 'Rate this lead before following up'; end if;
  v_assignee:=t.assigned_user_id; v_attempt:=0;
  if p_outcome in ('no_answer','voicemail') then
    v_attempt:=t.attempt_count+1;
    if v_attempt>=3 then v_disposition:='unreachable';
    else v_kind:='callback'; v_due:=p_due; end if;
  elsif p_outcome='callback' then v_kind:='callback'; v_due:=p_due;
  elsif p_outcome='send_information' then v_kind:='information_followup'; v_due:=p_due;
  elsif p_outcome='qualified' then
    if p_manager is null or not exists(select 1 from public.crm_call_managers g join public.organisation_members m
      on m.user_id=g.user_id and m.organisation_id=g.organisation_id and m.active
      where g.organisation_id=t.organisation_id and g.user_id=p_manager) then raise exception 'Choose an active designated sales manager'; end if;
    v_kind:='manager_followup'; v_assignee:=p_manager; v_due:=p_due;
  elsif p_outcome='not_suitable' then v_disposition:='not_suitable';
  elsif p_outcome='do_not_contact' then v_disposition:='do_not_contact';
  elsif p_outcome='wrong_number' then v_disposition:='invalid_number';
  elsif p_outcome='opportunity_started' then
    if not exists(select 1 from public.crm_call_managers where organisation_id=t.organisation_id and user_id=auth.uid())
      and not public.crm_call_member(t.organisation_id,true) then raise exception 'Sales manager access required'; end if;
  end if;
  if v_kind is not null and (v_due is null or v_due<((now() at time zone 'Europe/London')::date)) then raise exception 'Choose a follow-up date of today or later'; end if;
  if p_outcome='do_not_contact' then
    insert into public.crm_call_suppressed_numbers(organisation_id,phone)
      select t.organisation_id,public.crm_call_phone(n.phone) from public.companies c
      cross join lateral (values(c.phone),(c.mobile)) n(phone)
      where c.id=t.company_id and public.crm_call_phone(n.phone)<>'' on conflict do nothing;
  end if;
  update public.crm_call_tasks set status='completed',completed_at=now(),version=version+1 where id=t.id;
  insert into public.crm_call_company_state(company_id,organisation_id,disposition,reason)
    values(t.company_id,t.organisation_id,v_disposition,p_notes)
    on conflict(company_id) do update set disposition=excluded.disposition,reason=excluded.reason,updated_at=now();
  if v_kind is not null then
    insert into public.crm_call_tasks(organisation_id,company_id,parent_id,batch_name,brief,kind,assigned_user_id,due_date,attempt_count,created_by)
      values(t.organisation_id,t.company_id,t.id,t.batch_name,t.brief,v_kind,v_assignee,v_due,v_attempt,auth.uid()) returning id into v_next;
  end if;
  insert into public.crm_call_events(organisation_id,company_id,task_id,actor_id,event_type,outcome,rating,notes,next_task_id)
    values(t.organisation_id,t.company_id,t.id,auth.uid(),'outcome',p_outcome,p_rating,btrim(p_notes),v_next);
  return jsonb_build_object('next_task_id',v_next,'disposition',v_disposition);
end; $$;

-- Explicit admin reactivation never overrides a do-not-contact request.
create function public.crm_call_reactivate(p_company uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_task uuid;
begin
  select organisation_id into v_org from public.companies where id=p_company for update;
  if v_org is null or not public.crm_call_member(v_org,true) then raise exception 'Admin access required'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception 'Record a reason'; end if;
  if exists(select 1 from public.crm_call_company_state where company_id=p_company and disposition='do_not_contact') then
    raise exception 'Do-not-contact records cannot be reactivated here'; end if;
  select id into v_task from public.crm_call_tasks where company_id=p_company order by created_at desc,id desc limit 1;
  if v_task is not null then
    insert into public.crm_call_events(organisation_id,company_id,task_id,actor_id,event_type,notes)
      values(v_org,p_company,v_task,auth.uid(),'reactivated',p_reason);
  end if;
  update public.crm_call_company_state set disposition='active',reason='Reactivated: '||p_reason,updated_at=now() where company_id=p_company;
end; $$;

revoke all on function public.crm_call_team(uuid),public.crm_call_set_manager(uuid,uuid,boolean),
  public.crm_call_enqueue(uuid,uuid[],text,text,date,uuid,boolean),public.crm_call_assign(uuid,integer,uuid),
  public.crm_call_record(uuid,integer,text,integer,text,date,uuid),public.crm_call_reactivate(uuid,text) from public;
grant execute on function public.crm_call_team(uuid),public.crm_call_set_manager(uuid,uuid,boolean),
  public.crm_call_enqueue(uuid,uuid[],text,text,date,uuid,boolean),public.crm_call_assign(uuid,integer,uuid),
  public.crm_call_record(uuid,integer,text,integer,text,date,uuid),public.crm_call_reactivate(uuid,text) to authenticated;
commit;
