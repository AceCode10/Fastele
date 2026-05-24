-- Fastele initial schema. Spec §14.2.

create extension if not exists "pgcrypto";

-- USERS ----------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone_number text not null unique,
  full_name text not null,
  default_mode text not null default 'requester' check (default_mode in ('requester','runner')),
  is_runner_verified boolean not null default false,
  nrc_photo_url text,
  selfie_url text,
  requester_rating_avg numeric(3,2),
  runner_rating_avg numeric(3,2),
  runner_rating_count integer not null default 0,
  requester_rating_count integer not null default 0,
  is_suspended boolean not null default false,
  is_banned boolean not null default false,
  expo_push_token text,
  airtel_msisdn text,
  created_at timestamptz not null default now()
);

-- REQUESTS -------------------------------------------------------------------
create type request_status as enum (
  'open','matched','items_purchased','in_transit','delivered','disputed','cancelled','expired'
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id),
  runner_id uuid references public.users(id),
  status request_status not null default 'open',
  pickup_location text not null,
  delivery_address text not null,
  delivery_lat numeric(10,6),
  delivery_lng numeric(10,6),
  item_list jsonb not null,
  item_budget numeric(12,2) not null check (item_budget >= 0),
  runner_fee numeric(12,2) not null check (runner_fee >= 0),
  platform_fee numeric(12,2) not null default 0,
  dispute_reserve numeric(12,2) not null default 0,
  escrow_reference text,
  payout_reference text,
  photo_items_url text,
  photo_handoff_url text,
  driver_phone text,
  taxi_plate text,
  milestone_timestamps jsonb not null default '{}'::jsonb,
  posted_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  created_at timestamptz not null default now()
);

create index requests_status_idx on public.requests(status);
create index requests_requester_idx on public.requests(requester_id);
create index requests_runner_idx on public.requests(runner_id);
create index requests_posted_at_idx on public.requests(posted_at desc);

-- RATINGS --------------------------------------------------------------------
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  rater_id uuid not null references public.users(id),
  rated_id uuid not null references public.users(id),
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 200),
  created_at timestamptz not null default now(),
  unique (request_id, rater_id)
);

-- DISPUTES -------------------------------------------------------------------
create type dispute_reason as enum ('wrong_items','missing_items','not_delivered','damaged','other');
create type dispute_status as enum ('open','runner_responded','resolved');
create type dispute_ruling as enum ('full_refund','partial_refund','no_refund','pending');

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  raised_by uuid not null references public.users(id),
  reason dispute_reason not null,
  description text,
  evidence_url text,
  runner_response text,
  runner_evidence_url text,
  status dispute_status not null default 'open',
  ruling dispute_ruling not null default 'pending',
  refund_amount numeric(12,2),
  admin_id uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- REPORTS --------------------------------------------------------------------
create type report_reason as enum ('wrong_items','not_delivered','fraud','threatening','other');
create type report_outcome as enum ('pending','warning','suspension','ban','dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete set null,
  reporter_id uuid not null references public.users(id),
  reported_id uuid not null references public.users(id),
  reason report_reason not null,
  description text,
  evidence_url text,
  outcome report_outcome not null default 'pending',
  admin_id uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ADMIN ROLES + AUDIT --------------------------------------------------------
create type admin_role as enum ('super_admin','support_agent');

create table public.admins (
  user_id uuid primary key references public.users(id) on delete cascade,
  role admin_role not null default 'support_agent',
  created_at timestamptz not null default now()
);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- PLATFORM CONFIG (admin-editable knobs from spec §13) ----------------------
create table public.platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_config (key, value) values
  ('commission_pct', '10'::jsonb),
  ('dispute_reserve_pct', '1'::jsonb),
  ('auto_release_hours', '48'::jsonb),
  ('expire_minutes', '60'::jsonb),
  ('rating_window_seconds', '{"top":0,"mid":90,"low":180,"poor":300,"new_runner":90}'::jsonb)
on conflict (key) do nothing;
