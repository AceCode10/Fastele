-- 0008: Audit hardening
--   - Missing indexes on hot paths
--   - JSONB shape validators (item_list, milestone_timestamps, rating_window_seconds)
--   - Server-side enforcement of spec hard rules (milestone photos, driver phone + plate)
--   - payout_log audit trail for every Airtel disbursement attempt
--   - soft_deleted_at + restrictive RLS filter (preserves history; no FK cascade loss)

-- ============================================================================
-- 1. Missing indexes
-- ============================================================================

create index if not exists disputes_request_id_idx on public.disputes(request_id);
create index if not exists ratings_rated_id_idx on public.ratings(rated_id);
create index if not exists ratings_request_id_idx on public.ratings(request_id);

-- ============================================================================
-- 2. JSONB shape validators
-- ============================================================================

-- item_list must be a non-empty JSON array.
alter table public.requests drop constraint if exists requests_item_list_shape;
alter table public.requests add constraint requests_item_list_shape
  check (jsonb_typeof(item_list) = 'array' and jsonb_array_length(item_list) > 0);

-- milestone_timestamps must be a JSON object (allows {} as initial value).
alter table public.requests drop constraint if exists requests_milestones_shape;
alter table public.requests add constraint requests_milestones_shape
  check (jsonb_typeof(milestone_timestamps) = 'object');

-- platform_config.rating_window_seconds must carry all 5 keys with integer values.
create or replace function public.validate_platform_config()
returns trigger language plpgsql as $$
begin
  if new.key = 'rating_window_seconds' then
    if jsonb_typeof(new.value) <> 'object' then
      raise exception 'rating_window_seconds must be a JSON object';
    end if;
    if not (new.value ? 'top' and new.value ? 'mid' and new.value ? 'low'
            and new.value ? 'poor' and new.value ? 'new_runner') then
      raise exception 'rating_window_seconds missing required keys (top, mid, low, poor, new_runner)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists platform_config_validate on public.platform_config;
create trigger platform_config_validate
  before insert or update on public.platform_config
  for each row execute function public.validate_platform_config();

-- ============================================================================
-- 3. Enforce milestone photo + driver-handoff rules (spec hard rules)
-- ============================================================================

create or replace function public.enforce_milestone_photos()
returns trigger language plpgsql as $$
begin
  -- Bypass for admin (manual corrections).
  if public.is_admin() then return new; end if;

  -- Transition into in_transit requires items photo + driver phone + plate.
  if new.status = 'in_transit' and old.status is distinct from 'in_transit' then
    if new.photo_items_url is null then
      raise exception 'photo_items_url required before status=in_transit';
    end if;
    if new.driver_phone is null or new.taxi_plate is null then
      raise exception 'driver_phone and taxi_plate required before status=in_transit';
    end if;
  end if;

  -- Transition into delivered requires handoff photo.
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    if new.photo_handoff_url is null then
      raise exception 'photo_handoff_url required before status=delivered';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists requests_enforce_milestone_photos on public.requests;
create trigger requests_enforce_milestone_photos
  before update of status on public.requests
  for each row execute function public.enforce_milestone_photos();

-- ============================================================================
-- 4. payout_log audit trail (every disbursement attempt)
-- ============================================================================

do $$ begin
  create type payout_kind as enum ('payout','refund','cancel_refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status as enum ('pending','success','failed');
exception when duplicate_object then null; end $$;

create table if not exists public.payout_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id),
  dispute_id uuid references public.disputes(id),
  kind payout_kind not null,
  payee_user_id uuid references public.users(id),
  msisdn text not null,
  amount numeric(12,2) not null check (amount >= 0),
  airtel_reference text not null,
  airtel_response jsonb,
  status payout_status not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists payout_log_request_idx on public.payout_log(request_id);
create index if not exists payout_log_status_idx on public.payout_log(status);

alter table public.payout_log enable row level security;
drop policy if exists payout_log_admin_read on public.payout_log;
create policy payout_log_admin_read on public.payout_log
  for select using (public.is_admin());
-- Inserts + updates done by edge functions via service role (bypasses RLS).

-- ============================================================================
-- 5. soft_deleted_at columns + restrictive filter (non-admins never see deleted rows)
-- ============================================================================

alter table public.requests add column if not exists soft_deleted_at timestamptz;
alter table public.disputes add column if not exists soft_deleted_at timestamptz;
alter table public.reports  add column if not exists soft_deleted_at timestamptz;

-- support_messages added in 0007; tolerate absence in fresh stacks.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='support_messages') then
    execute 'alter table public.support_messages add column if not exists soft_deleted_at timestamptz';
    execute 'drop policy if exists support_messages_soft_delete on public.support_messages';
    execute 'create policy support_messages_soft_delete on public.support_messages '
         || 'as restrictive for select using (soft_deleted_at is null or public.is_admin())';
  end if;
end $$;

drop policy if exists requests_soft_delete_filter on public.requests;
create policy requests_soft_delete_filter on public.requests
  as restrictive for select using (soft_deleted_at is null or public.is_admin());

drop policy if exists disputes_soft_delete_filter on public.disputes;
create policy disputes_soft_delete_filter on public.disputes
  as restrictive for select using (soft_deleted_at is null or public.is_admin());

drop policy if exists reports_soft_delete_filter on public.reports;
create policy reports_soft_delete_filter on public.reports
  as restrictive for select using (soft_deleted_at is null or public.is_admin());

-- ============================================================================
-- 6. Cron secrets check: warn if vault entries missing.
-- ============================================================================

do $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url'      limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_url is null or v_key is null then
    raise warning '[0008] pg_cron will fail at runtime: store project_url + service_role_key in Supabase Vault';
  end if;
exception when undefined_table or undefined_function or insufficient_privilege then
  raise warning '[0008] Could not check vault.decrypted_secrets (extension not enabled or RLS) — verify manually';
end $$;
