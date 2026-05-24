-- =====================================================================
-- Fastele DEV-ONLY seed: two test accounts that bypass SMS / phone OTP.
-- DO NOT place this file in supabase/migrations/. It must never run on
-- production. Run manually once per dev environment via:
--   * Supabase Dashboard -> SQL Editor -> paste & Run
--   * or:  supabase db execute --file supabase/dev_seed.sql
--
-- Creates:
--   dev-test@fastele.local    password DevTest1234!  -> Requester
--   dev-runner@fastele.local  password DevTest1234!  -> Runner
--
-- Idempotent: safe to re-run. Cleanup snippet at the bottom.
-- =====================================================================

begin;

-- pgcrypto provides crypt() / gen_salt(); already enabled by migration 0001.
create extension if not exists "pgcrypto";

do $seed$
declare
  r record;
  v_uid uuid;
begin
  for r in
    select * from (values
      ('11111111-1111-1111-1111-111111111111'::uuid,
       'dev-test@fastele.local',
       '+260000000001',
       'Dev Requester',
       'requester',
       false),
      ('22222222-2222-2222-2222-222222222222'::uuid,
       'dev-runner@fastele.local',
       '+260000000002',
       'Dev Runner',
       'runner',
       true)
    ) as t(preferred_id, email, phone, full_name, mode, is_verified)
  loop
    -- 1) Ensure auth.users row exists. Use preferred uuid if email is new;
    --    otherwise keep whatever id is already there.
    select id into v_uid from auth.users where email = r.email;

    if v_uid is null then
      v_uid := r.preferred_id;
      insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        is_super_admin, is_sso_user
      ) values (
        v_uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', r.email,
        crypt('DevTest1234!', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        now(), now(),
        false, false
      );
    else
      -- Refresh password + confirm email so dev sign-in always works,
      -- regardless of how the row originally got there.
      update auth.users
         set encrypted_password = crypt('DevTest1234!', gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             raw_app_meta_data  = '{"provider":"email","providers":["email"]}'::jsonb,
             updated_at         = now()
       where id = v_uid;
    end if;

    -- 2) Ensure an email identity points at this user.
    if not exists (
      select 1 from auth.identities
       where provider = 'email' and user_id = v_uid
    ) then
      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        v_uid::text,
        v_uid,
        jsonb_build_object(
          'sub', v_uid::text,
          'email', r.email,
          'email_verified', true,
          'provider', 'email'
        ),
        'email',
        now(), now(), now()
      );
    end if;

    -- 3) Ensure public.users row exists for this user.
    if not exists (select 1 from public.users where id = v_uid) then
      insert into public.users (
        id, phone_number, full_name, default_mode, is_runner_verified, created_at
      ) values (
        v_uid, r.phone, r.full_name, r.mode, r.is_verified, now()
      );
    end if;
  end loop;
end
$seed$;

commit;

-- Quick verification (run as separate query if you like):
--   select id, email, email_confirmed_at is not null as confirmed
--   from auth.users where email like 'dev-%@fastele.local';
--
--   select id, full_name, default_mode, phone_number
--   from public.users where phone_number like '+26000000000%';

-- =====================================================================
-- CLEANUP (uncomment and run to remove dev accounts):
--
-- begin;
-- with victims as (
--   select id from auth.users
--   where email in ('dev-test@fastele.local', 'dev-runner@fastele.local')
-- )
-- delete from public.users      where id      in (select id from victims);
-- with victims as (
--   select id from auth.users
--   where email in ('dev-test@fastele.local', 'dev-runner@fastele.local')
-- )
-- delete from auth.identities   where user_id in (select id from victims);
-- delete from auth.users
--  where email in ('dev-test@fastele.local', 'dev-runner@fastele.local');
-- commit;
-- =====================================================================
