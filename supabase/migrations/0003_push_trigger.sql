-- Fire send-push edge function on every request status change.
-- Runs as pg_net HTTP call (Supabase pg_net extension).

create extension if not exists pg_net;

create or replace function public.notify_milestone_change()
returns trigger language plpgsql as $$
declare
  v_req_token text;
  v_run_token text;
  v_msg_req text;
  v_msg_run text;
  v_title text;
  v_push_url text;
begin
  if new.status = old.status then return new; end if;

  -- Get push tokens.
  select expo_push_token into v_req_token from public.users where id = new.requester_id;
  select expo_push_token into v_run_token from public.users where id = new.runner_id;

  v_push_url := current_setting('app.supabase_url', true) || '/functions/v1/send-push';

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
    when 'disputed' then
      v_msg_run := 'A dispute was raised on your job. Tap to respond.';
    else null;
  end case;

  -- Push to requester.
  if v_req_token is not null and v_msg_req is not null then
    perform net.http_post(
      url := v_push_url,
      body := jsonb_build_object('tokens', jsonb_build_array(v_req_token), 'title', 'Fastele', 'body', v_msg_req)
    );
  end if;

  -- Push to runner.
  if v_run_token is not null and v_msg_run is not null then
    perform net.http_post(
      url := v_push_url,
      body := jsonb_build_object('tokens', jsonb_build_array(v_run_token), 'title', 'Fastele', 'body', v_msg_run)
    );
  end if;

  return new;
end;
$$;

create trigger requests_status_push
  after update of status on public.requests
  for each row execute function public.notify_milestone_change();

-- Store Supabase URL for use in trigger.
-- Set this in your Supabase project: Settings > Database > Extensions > pg_net
-- Then run: ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
