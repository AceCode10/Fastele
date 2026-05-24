-- pg_cron schedules for stale request expiry + auto-release.
--
-- BEFORE applying, store project URL + service role key in Supabase Vault:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>',        'service_role_key');
--
-- ALTER DATABASE is not permitted on Supabase hosted (permission denied for
-- non-superusers), so the legacy app.* settings approach won't work — vault is
-- the supported path.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoke_edge_function(p_fn text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url'      limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_url is null or v_key is null then
    raise exception
      'pg_cron cannot run: store project_url + service_role_key in Supabase Vault before applying this migration';
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/' || p_fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Remove any prior schedules so re-running migration is idempotent.
select cron.unschedule(jobid) from cron.job where jobname in ('expire-stale-requests', 'auto-release-timer');

select cron.schedule(
  'expire-stale-requests',
  '*/5 * * * *',
  $$ select public.invoke_edge_function('expire-stale-requests') $$
);

select cron.schedule(
  'auto-release-timer',
  '*/15 * * * *',
  $$ select public.invoke_edge_function('auto-release-timer') $$
);
