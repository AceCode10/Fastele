-- Replaces 0003 push trigger with authed version using app.* settings.
-- Requires:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

drop trigger if exists requests_status_push on public.requests;

create or replace function public.notify_milestone_change()
returns trigger language plpgsql as $$
declare
  v_req_token text;
  v_run_token text;
  v_msg_req text;
  v_msg_run text;
  v_url text := current_setting('app.supabase_url', true);
  v_key text := current_setting('app.service_role_key', true);
begin
  if new.status = old.status then return new; end if;
  if v_url is null or v_key is null then
    raise notice 'Push skipped: app.supabase_url or app.service_role_key not set';
    return new;
  end if;

  select expo_push_token into v_req_token from public.users where id = new.requester_id;
  select expo_push_token into v_run_token from public.users where id = new.runner_id;

  case new.status
    when 'matched' then
      v_msg_req := 'A Runner accepted your request and is heading to ' || new.pickup_location || '.';
    when 'items_purchased' then
      v_msg_req := 'Your items have been bought. Tap to see the photo.';
    when 'in_transit' then
      v_msg_req := 'On the way! Taxi ' || coalesce(new.taxi_plate, '—') || '. Tap to call the driver.';
    when 'delivered' then
      v_msg_req := 'Delivered! Tap to rate your Runner.';
    when 'cancelled' then
      v_msg_req := 'Your request was cancelled. Full refund on its way.';
    when 'expired' then
      v_msg_req := 'Your request expired with no Runner. Refund on its way.';
    when 'disputed' then
      v_msg_run := 'A dispute was raised on your job. Tap to respond.';
    else null;
  end case;

  if v_req_token is not null and v_msg_req is not null then
    perform net.http_post(
      url := v_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'tokens', jsonb_build_array(v_req_token),
        'title', 'Fastele',
        'body', v_msg_req,
        'data', jsonb_build_object('requestId', new.id::text)
      )
    );
  end if;

  if v_run_token is not null and v_msg_run is not null then
    perform net.http_post(
      url := v_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'tokens', jsonb_build_array(v_run_token),
        'title', 'Fastele',
        'body', v_msg_run,
        'data', jsonb_build_object('requestId', new.id::text)
      )
    );
  end if;

  return new;
end;
$$;

create trigger requests_status_push
  after update of status on public.requests
  for each row execute function public.notify_milestone_change();

-- Lock down send-push: require service_role auth via verify_jwt in supabase/config.toml.
-- For functions configured verify_jwt = true, the trigger's service_role bearer is accepted; anon is rejected.
