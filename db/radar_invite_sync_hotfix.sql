-- Radar invite sync hotfix for web/mobile/admin parity.
-- Safe to run multiple times in Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'radar_invites'
  ) then
    create table public.radar_invites (
      id uuid primary key default gen_random_uuid(),
      inviter_id uuid not null references public.profiles(id) on delete cascade,
      invitee_id uuid not null references public.profiles(id) on delete cascade,
      radar_id uuid,
      source text not null default 'RADAR_GROUP',
      status text not null default 'PENDING',
      note text,
      expires_at timestamptz,
      responded_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end;
$$;

alter table if exists public.radar_invites
  add column if not exists inviter_id uuid references public.profiles(id) on delete cascade,
  add column if not exists invitee_id uuid references public.profiles(id) on delete cascade,
  add column if not exists radar_id uuid,
  add column if not exists source text default 'RADAR_GROUP',
  add column if not exists status text default 'PENDING',
  add column if not exists note text,
  add column if not exists expires_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.radar_invites
  drop constraint if exists radar_invites_radar_id_fkey;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'radar_invites'
  ) then
    begin
      alter table public.radar_invites
        add constraint radar_invites_unique_triplet
        unique (inviter_id, invitee_id, radar_id);
    exception
      when duplicate_object then
        null;
      when duplicate_table then
        null;
      when undefined_column then
        null;
    end;
  end if;
end;
$$;

create index if not exists idx_radar_invites_invitee_status_created
  on public.radar_invites(invitee_id, status, created_at desc);
create index if not exists idx_radar_invites_inviter_status_created
  on public.radar_invites(inviter_id, status, created_at desc);
create index if not exists idx_radar_invites_radar_id
  on public.radar_invites(radar_id);

grant select, insert, update, delete on table public.radar_invites to authenticated;

alter table if exists public.radar_invites enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'radar_invites'
  ) then
    drop policy if exists radar_invites_select_own on public.radar_invites;
    create policy radar_invites_select_own
    on public.radar_invites
    for select
    to authenticated
    using (inviter_id = auth.uid() or invitee_id = auth.uid());

    drop policy if exists radar_invites_insert_self_inviter on public.radar_invites;
    create policy radar_invites_insert_self_inviter
    on public.radar_invites
    for insert
    to authenticated
    with check (
      inviter_id = auth.uid()
      and invitee_id is not null
    );

    drop policy if exists radar_invites_update_scope on public.radar_invites;
    create policy radar_invites_update_scope
    on public.radar_invites
    for update
    to authenticated
    using (invitee_id = auth.uid() or inviter_id = auth.uid())
    with check (
      invitee_id = auth.uid() or inviter_id = auth.uid()
    );

    drop policy if exists radar_invites_delete_scope on public.radar_invites;
    create policy radar_invites_delete_scope
    on public.radar_invites
    for delete
    to authenticated
    using (invitee_id = auth.uid() or inviter_id = auth.uid());
  end if;
end;
$$;

create or replace function public.respond_radar_invite(
  p_invite_id uuid,
  p_accept boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.radar_invites
  set
    status = case when p_accept then 'ACCEPTED' else 'DECLINED' end,
    responded_at = now(),
    updated_at = now()
  where id = p_invite_id
    and invitee_id = v_uid;
end;
$$;

revoke all on function public.respond_radar_invite(uuid, boolean) from public;
grant execute on function public.respond_radar_invite(uuid, boolean) to authenticated;
