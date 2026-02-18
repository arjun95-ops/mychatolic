-- Register location read hotfix for web/mobile parity.
-- Run this in Supabase SQL Editor using a privileged role.
-- Safe to run multiple times.

grant usage on schema public to anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'countries'
  ) then
    grant select on table public.countries to anon, authenticated;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'countries' and c.relrowsecurity
    ) then
      drop policy if exists countries_public_read on public.countries;
      create policy countries_public_read
      on public.countries
      for select
      to anon, authenticated
      using (true);
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'dioceses'
  ) then
    grant select on table public.dioceses to anon, authenticated;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'dioceses' and c.relrowsecurity
    ) then
      drop policy if exists dioceses_public_read on public.dioceses;
      create policy dioceses_public_read
      on public.dioceses
      for select
      to anon, authenticated
      using (true);
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'churches'
  ) then
    grant select on table public.churches to anon, authenticated;

    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'churches' and c.relrowsecurity
    ) then
      drop policy if exists churches_public_read on public.churches;
      create policy churches_public_read
      on public.churches
      for select
      to anon, authenticated
      using (true);
    end if;
  end if;
end;
$$;
