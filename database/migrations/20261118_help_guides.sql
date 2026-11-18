-- Run once. Private, organisation-scoped help articles and PDF attachments.
begin;
create function public.help_guide_member(p_org text, p_admin boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organisation_members m
    join public.organisations o on o.id = m.organisation_id
    where m.organisation_id::text = p_org and m.user_id = auth.uid()
      and m.active and o.active and (not p_admin or m.role = 'admin')
  );
$$;
revoke all on function public.help_guide_member(text, boolean) from public;
grant execute on function public.help_guide_member(text, boolean) to authenticated, anon;

create table public.help_guides (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  title text not null check (length(btrim(title)) between 1 and 160),
  category text not null default 'Getting started' check (length(btrim(category)) between 1 and 80),
  summary text not null default '' check (length(summary) <= 600),
  content text not null default '' check (length(content) <= 60000),
  file_path text unique,
  file_name text check (length(file_name) between 1 and 250),
  file_size integer check (file_size between 1 and 10485760),
  archived boolean not null default false,
  version integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(content)) > 0 or file_path is not null),
  check ((file_path is null and file_name is null and file_size is null) or
    (file_path is not null and file_name is not null and file_size is not null
      and split_part(file_path, '/', 1) = organisation_id::text
      and lower(right(file_path, 4)) = '.pdf'))
);
create index help_guides_org_updated on public.help_guides(organisation_id, updated_at desc, id);
create function public.help_guide_stamp() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.organisation_id := old.organisation_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.version := old.version + 1;
  else
    new.created_by := auth.uid();
    new.created_at := now();
    new.version := 0;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.help_guide_stamp() from public;
create trigger help_guides_stamp before insert or update on public.help_guides
for each row execute function public.help_guide_stamp();
alter table public.help_guides enable row level security;
revoke all on public.help_guides from anon, authenticated;
grant select, insert, update on public.help_guides to authenticated;
create policy help_guides_read on public.help_guides for select to authenticated
using (public.help_guide_member(organisation_id::text) and
  (not archived or public.help_guide_member(organisation_id::text, true)));
create policy help_guides_create on public.help_guides for insert to authenticated
with check (public.help_guide_member(organisation_id::text, true) and created_by = auth.uid() and updated_by = auth.uid());
create policy help_guides_edit on public.help_guides for update to authenticated
using (public.help_guide_member(organisation_id::text, true))
with check (public.help_guide_member(organisation_id::text, true));

-- Helpers also guard against pre-existing permissive Storage policies.
create function public.help_guide_file_read(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.help_guide_member(split_part(p_path, '/', 1), true) or exists (
    select 1 from public.help_guides g where g.file_path = p_path and not g.archived
      and public.help_guide_member(g.organisation_id::text)
  );
$$;
create function public.help_guide_file_remove(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.help_guide_member(split_part(p_path, '/', 1), true) and not exists (
    select 1 from public.help_guides g where g.file_path = p_path
  );
$$;
revoke all on function public.help_guide_file_read(text) from public;
revoke all on function public.help_guide_file_remove(text) from public;
grant execute on function public.help_guide_file_read(text), public.help_guide_file_remove(text) to authenticated, anon;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('platform-help-guides', 'platform-help-guides', false, 10485760, array['application/pdf']);

create policy help_files_read on storage.objects for select to authenticated
using (bucket_id = 'platform-help-guides' and public.help_guide_file_read(name));
create policy help_files_read_guard on storage.objects as restrictive for select to public
using (bucket_id is distinct from 'platform-help-guides' or public.help_guide_file_read(name));
create policy help_files_upload on storage.objects for insert to authenticated
with check (bucket_id = 'platform-help-guides' and public.help_guide_member(split_part(name, '/', 1), true) and lower(right(name, 4)) = '.pdf');
create policy help_files_upload_guard on storage.objects as restrictive for insert to public
with check (bucket_id is distinct from 'platform-help-guides' or
  (public.help_guide_member(split_part(name, '/', 1), true) and lower(right(name, 4)) = '.pdf'));
-- Files are immutable: replacements get a new path, never overwrite a version.
create policy help_files_update_guard on storage.objects as restrictive for update to public
using (bucket_id is distinct from 'platform-help-guides')
with check (bucket_id is distinct from 'platform-help-guides');
-- Only unreferenced uploads can be removed (e.g. a failed metadata save).
create policy help_files_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'platform-help-guides' and public.help_guide_file_remove(name));
create policy help_files_cleanup_guard on storage.objects as restrictive for delete to public
using (bucket_id is distinct from 'platform-help-guides' or public.help_guide_file_remove(name));
commit;
