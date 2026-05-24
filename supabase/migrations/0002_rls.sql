-- RLS + visibility function. Spec §7.2 + §11.4.

alter table public.users enable row level security;
alter table public.requests enable row level security;
alter table public.ratings enable row level security;
alter table public.disputes enable row level security;
alter table public.reports enable row level security;
alter table public.admins enable row level security;
alter table public.admin_actions enable row level security;
alter table public.platform_config enable row level security;

-- Helper: is current auth user an admin?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- USERS ----------------------------------------------------------------------
create policy users_self_read on public.users
  for select using (auth.uid() = id or public.is_admin());

create policy users_public_read on public.users
  for select using (true);  -- field-level filtering done client-side via select list

create policy users_self_upsert on public.users
  for insert with check (auth.uid() = id);

create policy users_self_update on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy users_admin_update on public.users
  for update using (public.is_admin()) with check (public.is_admin());

-- VISIBILITY FUNCTION: Spec §7.2 rating-window priority.
-- Returns true if the request should appear to this runner right now.
create or replace function public.is_visible_to_runner(req public.requests, runner public.users)
returns boolean
language plpgsql stable as $$
declare
  delay_sec int;
  win jsonb;
  rating numeric;
  count_jobs int;
begin
  if req.status <> 'open' then return false; end if;
  if runner.is_runner_verified is not true then return false; end if;
  if runner.is_suspended or runner.is_banned then return false; end if;

  select value into win from public.platform_config where key = 'rating_window_seconds';
  rating := coalesce(runner.runner_rating_avg, 0);
  count_jobs := coalesce(runner.runner_rating_count, 0);

  if count_jobs < 5 then
    delay_sec := (win->>'new_runner')::int;
  elsif rating >= 4.5 then
    delay_sec := (win->>'top')::int;
  elsif rating >= 4.0 then
    delay_sec := (win->>'mid')::int;
  elsif rating >= 3.0 then
    delay_sec := (win->>'low')::int;
  else
    delay_sec := (win->>'poor')::int;
  end if;

  return now() >= req.posted_at + (delay_sec || ' seconds')::interval;
end;
$$;

-- REQUESTS -------------------------------------------------------------------
create policy requests_requester_read on public.requests
  for select using (auth.uid() = requester_id);

create policy requests_runner_read on public.requests
  for select using (
    auth.uid() = runner_id
    or (
      status = 'open'
      and exists (
        select 1 from public.users u
        where u.id = auth.uid()
          and public.is_visible_to_runner(requests, u)
      )
    )
  );

create policy requests_admin_read on public.requests
  for select using (public.is_admin());

create policy requests_insert on public.requests
  for insert with check (auth.uid() = requester_id);

create policy requests_requester_update on public.requests
  for update using (auth.uid() = requester_id) with check (auth.uid() = requester_id);

create policy requests_runner_update on public.requests
  for update using (auth.uid() = runner_id) with check (auth.uid() = runner_id);

create policy requests_admin_update on public.requests
  for update using (public.is_admin()) with check (public.is_admin());

-- RATINGS --------------------------------------------------------------------
create policy ratings_read_all on public.ratings for select using (true);

create policy ratings_insert on public.ratings
  for insert with check (
    auth.uid() = rater_id
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.status in ('delivered')
        and (auth.uid() = r.requester_id or auth.uid() = r.runner_id)
        and (rated_id = r.requester_id or rated_id = r.runner_id)
        and rated_id <> rater_id
    )
  );

-- DISPUTES -------------------------------------------------------------------
create policy disputes_parties_read on public.disputes
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.requests r
      where r.id = request_id and (auth.uid() = r.requester_id or auth.uid() = r.runner_id)
    )
  );

create policy disputes_insert on public.disputes
  for insert with check (
    auth.uid() = raised_by
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.status = 'delivered'
        and auth.uid() = r.requester_id
        and r.delivered_at > now() - interval '48 hours'
    )
  );

create policy disputes_runner_update on public.disputes
  for update using (
    exists (
      select 1 from public.requests r
      where r.id = request_id and auth.uid() = r.runner_id
    )
  );

create policy disputes_admin_update on public.disputes
  for update using (public.is_admin()) with check (public.is_admin());

-- REPORTS --------------------------------------------------------------------
create policy reports_admin_read on public.reports for select using (public.is_admin());
create policy reports_self_read on public.reports for select using (auth.uid() = reporter_id);
create policy reports_insert on public.reports for insert with check (auth.uid() = reporter_id);
create policy reports_admin_update on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- ADMINS / CONFIG ------------------------------------------------------------
create policy admins_admin_only on public.admins for select using (public.is_admin());
create policy admin_actions_admin_only on public.admin_actions for select using (public.is_admin());
create policy admin_actions_insert on public.admin_actions for insert with check (public.is_admin());
create policy platform_config_read on public.platform_config for select using (true);
create policy platform_config_admin_update on public.platform_config
  for update using (public.is_admin()) with check (public.is_admin());

-- TRIGGERS: ratings recompute averages on insert ----------------------------
create or replace function public.recompute_rating_averages()
returns trigger language plpgsql as $$
declare
  v_avg numeric;
  v_count int;
  v_is_runner boolean;
begin
  -- Determine whether rated user was the runner on the request.
  select (r.runner_id = new.rated_id) into v_is_runner
  from public.requests r where r.id = new.request_id;

  if v_is_runner then
    select avg(stars)::numeric(3,2), count(*) into v_avg, v_count
    from public.ratings rt
    join public.requests rq on rq.id = rt.request_id
    where rt.rated_id = new.rated_id and rq.runner_id = new.rated_id;
    update public.users
      set runner_rating_avg = v_avg, runner_rating_count = v_count
      where id = new.rated_id;
  else
    select avg(stars)::numeric(3,2), count(*) into v_avg, v_count
    from public.ratings rt
    join public.requests rq on rq.id = rt.request_id
    where rt.rated_id = new.rated_id and rq.requester_id = new.rated_id;
    update public.users
      set requester_rating_avg = v_avg, requester_rating_count = v_count
      where id = new.rated_id;
  end if;
  return new;
end;
$$;

create trigger ratings_after_insert
  after insert on public.ratings
  for each row execute function public.recompute_rating_averages();
