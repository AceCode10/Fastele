-- ============================================================================
-- 0009_lipila.sql — Lipila payment gateway columns + reconciliation table
-- ----------------------------------------------------------------------------
-- Adds first-class Lipila referenceId columns to requests and payout_log,
-- plus a lipila_callbacks table for any callback we receive that doesn't
-- match a known row (manual reconciliation surface).
--
-- Airtel columns (escrow_reference, airtel_reference, airtel_response) are
-- left in place. Lipila is layered alongside so we can run sandbox before
-- ripping the Airtel path. A follow-up migration drops the Airtel columns.
-- ============================================================================

alter table public.requests
  add column if not exists lipila_reference text;

create index if not exists idx_requests_lipila_reference
  on public.requests (lipila_reference)
  where lipila_reference is not null;

alter table public.payout_log
  add column if not exists lipila_reference text;

create index if not exists idx_payout_log_lipila_reference
  on public.payout_log (lipila_reference)
  where lipila_reference is not null;

-- Unmatched callbacks land here. Admin reconciles manually.
create table if not exists public.lipila_callbacks (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  reference_id text not null,
  status text,
  amount numeric,
  account_number text,
  payment_type text,
  transaction_type text,
  identifier text,
  message text,
  external_id text,
  raw_payload jsonb,
  reconciled boolean not null default false
);

create index if not exists idx_lipila_callbacks_reference_id
  on public.lipila_callbacks (reference_id);

create index if not exists idx_lipila_callbacks_unreconciled
  on public.lipila_callbacks (received_at desc)
  where reconciled = false;

-- Service-role only — no end-user access.
alter table public.lipila_callbacks enable row level security;
