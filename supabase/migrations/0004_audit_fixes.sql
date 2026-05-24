-- Fastele audit remediation (fixes #6-#20).
-- Tighten RLS, add storage, add triggers for config-driven defaults, expand realtime.

-- ============================================================================
-- 1. PRIVACY (#6): drop world-read on users; expose only safe columns via view.
-- ============================================================================

drop policy if exists users_public_read on public.users;

-- View exposes only public-safe columns.
create or replace view public.user_profiles as
select
  id, full_name,
  requester_rating_avg, requester_rating_count,
  runner_rating_avg, runner_rating_count,
  is_runner_verified
from public.users;

grant select on public.user_profiles to authenticated, anon;

-- ============================================================================
-- 2. SELF-UPDATE GUARD (#7): block self mutation of privileged columns.
-- ============================================================================

create or replace function public.protect_privileged_user_cols()
returns trigger language plpgsql as $$
begin
  if public.is_admin() then return new; end if;
  if auth.uid() = old.id then
    if new.is_runner_verified is distinct from old.is_runner_verified
       or new.is_suspended is distinct from old.is_suspended
       or new.is_banned is distinct from old.is_banned then
      raise exception 'Cannot self-modify privileged columns';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_protect_privileged on public.users;
create trigger users_protect_privileged
  before update on public.users
  for each row execute function public.protect_privileged_user_cols();

-- ============================================================================
-- 3. STORAGE BUCKETS + RLS (#8).
-- ============================================================================

insert into storage.buckets (id, name, public) values
  ('nrc', 'nrc', false),
  ('selfies', 'selfies', false),
  ('items', 'items', true),
  ('handoff', 'handoff', true),
  ('disputes', 'disputes', false),
  ('reports', 'reports', false)
on conflict (id) do nothing;

-- Helper: extract userId from storage path (paths are "<userId>/...").
-- For items/handoff buckets, path is "<requestId>/<file>" — auth via requests table.

-- NRC + selfies: owner-only insert; admin-only read.
drop policy if exists "nrc_owner_insert" on storage.objects;
create policy "nrc_owner_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('nrc','selfies')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "nrc_owner_read" on storage.objects;
create policy "nrc_owner_read" on storage.objects
  for select to authenticated using (
    bucket_id in ('nrc','selfies')
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- Items + handoff: party (requester or runner) can insert/read.
drop policy if exists "items_party_insert" on storage.objects;
create policy "items_party_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('items','handoff')
    and exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[1]
        and (auth.uid() = r.requester_id or auth.uid() = r.runner_id)
    )
  );

drop policy if exists "items_party_read" on storage.objects;
create policy "items_party_read" on storage.objects
  for select using (bucket_id in ('items','handoff'));  -- public bucket; safe because URL contains random ID

-- Disputes: party + admin.
drop policy if exists "disputes_party_rw" on storage.objects;
create policy "disputes_party_rw" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'disputes'
    and exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[1]
        and (auth.uid() = r.requester_id or auth.uid() = r.runner_id)
    )
  );

drop policy if exists "disputes_party_read" on storage.objects;
create policy "disputes_party_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'disputes'
    and (public.is_admin() or exists (
      select 1 from public.requests r
      where r.id::text = (storage.foldername(name))[1]
        and (auth.uid() = r.requester_id or auth.uid() = r.runner_id)
    ))
  );

-- Reports bucket: reporter inserts under their own user folder; admin reads.
drop policy if exists "reports_owner_insert" on storage.objects;
create policy "reports_owner_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "reports_admin_read" on storage.objects;
create policy "reports_admin_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'reports' and (public.is_admin() or auth.uid()::text = (storage.foldername(name))[1])
  );

-- ============================================================================
-- 4. ADD in_transit_at + escrow_funded COLUMNS.
-- in_transit_at fixes #11 (accurate 48h auto-release timing).
-- escrow_funded prevents unpaid requests from appearing in the Runner feed.
-- ============================================================================

alter table public.requests
  add column if not exists in_transit_at timestamptz,
  add column if not exists escrow_funded boolean not null default false;

-- Trigger: set in_transit_at when status flips to in_transit.
create or replace function public.set_in_transit_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'in_transit' and old.status <> 'in_transit' then
    new.in_transit_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists requests_set_in_transit_at on public.requests;
create trigger requests_set_in_transit_at
  before update of status on public.requests
  for each row execute function public.set_in_transit_at();

-- ============================================================================
-- 5. DISPUTES RLS EXPAND (#12) — allow in_transit + 48h after delivered.
-- ============================================================================

drop policy if exists disputes_insert on public.disputes;
create policy disputes_insert on public.disputes
  for insert with check (
    auth.uid() = raised_by
    and raised_by <> coalesce((select runner_id from public.requests where id = request_id), '00000000-0000-0000-0000-000000000000'::uuid)
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and auth.uid() = r.requester_id
        and (
          r.status = 'in_transit'
          or (r.status = 'delivered' and r.delivered_at > now() - interval '48 hours')
        )
    )
  );

-- ============================================================================
-- 6. REQUESTS COLUMN-LEVEL UPDATE GUARDS (#13).
-- ============================================================================

create or replace function public.protect_request_financial_cols()
returns trigger language plpgsql as $$
begin
  if public.is_admin() then return new; end if;
  if new.requester_id is distinct from old.requester_id
     or new.runner_fee is distinct from old.runner_fee
     or new.item_budget is distinct from old.item_budget
     or new.platform_fee is distinct from old.platform_fee
     or new.dispute_reserve is distinct from old.dispute_reserve
     or new.escrow_reference is distinct from old.escrow_reference
     or new.payout_reference is distinct from old.payout_reference then
    raise exception 'Cannot modify financial columns';
  end if;
  return new;
end;
$$;

drop trigger if exists requests_protect_financial on public.requests;
create trigger requests_protect_financial
  before update on public.requests
  for each row execute function public.protect_request_financial_cols();

-- Runner can only set runner_id on accept (open → matched). Once matched, runner_id locked.
create or replace function public.protect_runner_id()
returns trigger language plpgsql as $$
begin
  if public.is_admin() then return new; end if;
  if old.runner_id is not null and new.runner_id is distinct from old.runner_id then
    raise exception 'Runner already assigned';
  end if;
  -- Runner can only assign themselves.
  if new.runner_id is not null and old.runner_id is null and new.runner_id <> auth.uid() then
    raise exception 'Can only assign yourself as runner';
  end if;
  return new;
end;
$$;

drop trigger if exists requests_protect_runner_id on public.requests;
create trigger requests_protect_runner_id
  before update on public.requests
  for each row execute function public.protect_runner_id();

-- ============================================================================
-- 7. REPORTS SELF-BAN (#14).
-- ============================================================================

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert with check (
    auth.uid() = reporter_id
    and reporter_id <> reported_id
  );

-- ============================================================================
-- 8. EXPIRES_AT FROM CONFIG (#15) + DISPUTE_RESERVE FROM CONFIG (#16).
-- ============================================================================

alter table public.requests alter column expires_at drop not null;
alter table public.requests alter column expires_at drop default;

create or replace function public.set_request_defaults_from_config()
returns trigger language plpgsql as $$
declare
  v_expire_min int;
  v_reserve_pct numeric;
begin
  if new.expires_at is null then
    select (value::text)::int into v_expire_min from public.platform_config where key = 'expire_minutes';
    new.expires_at := now() + (v_expire_min || ' minutes')::interval;
  end if;
  if new.dispute_reserve is null or new.dispute_reserve = 0 then
    select (value::text)::numeric into v_reserve_pct from public.platform_config where key = 'dispute_reserve_pct';
    new.dispute_reserve := round(new.runner_fee * v_reserve_pct / 100.0, 2);
  end if;
  return new;
end;
$$;

drop trigger if exists requests_set_defaults on public.requests;
create trigger requests_set_defaults
  before insert on public.requests
  for each row execute function public.set_request_defaults_from_config();

-- ============================================================================
-- 9. is_visible_to_runner SCALAR FORM (#20) + REWORK POLICY.
-- ============================================================================

drop policy if exists requests_runner_read on public.requests;

create or replace function public.runner_can_see(
  p_status request_status,
  p_escrow_funded boolean,
  p_posted_at timestamptz,
  p_rating numeric,
  p_count int,
  p_is_verified boolean,
  p_is_suspended boolean,
  p_is_banned boolean
) returns boolean
language plpgsql stable as $$
declare
  win jsonb;
  delay_sec int;
begin
  if p_status <> 'open' then return false; end if;
  if not p_escrow_funded then return false; end if;
  if not p_is_verified then return false; end if;
  if p_is_suspended or p_is_banned then return false; end if;

  select value into win from public.platform_config where key = 'rating_window_seconds';

  if coalesce(p_count, 0) < 5 then
    delay_sec := (win->>'new_runner')::int;
  elsif coalesce(p_rating, 0) >= 4.5 then
    delay_sec := (win->>'top')::int;
  elsif coalesce(p_rating, 0) >= 4.0 then
    delay_sec := (win->>'mid')::int;
  elsif coalesce(p_rating, 0) >= 3.0 then
    delay_sec := (win->>'low')::int;
  else
    delay_sec := (win->>'poor')::int;
  end if;

  return now() >= p_posted_at + (delay_sec || ' seconds')::interval;
end;
$$;

create policy requests_runner_read on public.requests
  for select using (
    auth.uid() = runner_id
    or (
      status = 'open'
      and exists (
        select 1 from public.users u
        where u.id = auth.uid()
          and public.runner_can_see(
            requests.status, requests.escrow_funded, requests.posted_at,
            u.runner_rating_avg, u.runner_rating_count,
            u.is_runner_verified, u.is_suspended, u.is_banned
          )
      )
    )
  );

-- ============================================================================
-- 10. REALTIME PUBLICATION (#19).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    execute 'alter publication supabase_realtime add table public.requests';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'disputes'
  ) then
    execute 'alter publication supabase_realtime add table public.disputes';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    execute 'alter publication supabase_realtime add table public.reports';
  end if;
end $$;

-- ============================================================================
-- 11. BOOTSTRAP ADMIN HELPER (#29).
-- ============================================================================

-- Admin promotes a user by phone (service role only).
create or replace function public.promote_admin(p_phone text, p_role admin_role default 'super_admin')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from public.users where phone_number = p_phone;
  if v_user_id is null then
    raise exception 'No user with phone %', p_phone;
  end if;
  insert into public.admins (user_id, role) values (v_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;
  return v_user_id;
end;
$$;

-- Usage from Supabase SQL editor (NOT from client):
--   select public.promote_admin('+260971234567', 'super_admin');
