# Fastele

Errand exchange platform for Lusaka, Zambia. Soweto + City Market first.

> "Get it done. Fast."

## Stack
Expo SDK 54 • React Native 0.81 • expo-router 6 • Supabase (Postgres + Auth + Storage + Edge Functions + Realtime) • Zustand • React Query • Airtel Money • Expo Notifications (FCM)

## Run
```bash
npm install
cp .env.example .env   # fill in Supabase keys
npx expo start --android
```

## First-time setup (one-time per environment)

### 1. Supabase project
```bash
supabase link --project-ref <ref>
supabase db push                      # applies migrations 0001..0007
supabase functions deploy             # deploys all 10 edge functions
```

### 2. Environment secrets (server-side)
```bash
# Airtel Money sandbox (request from Airtel Developer Portal)
supabase secrets set AIRTEL_API_URL=https://openapiuat.airtel.africa
supabase secrets set AIRTEL_CLIENT_ID=...
supabase secrets set AIRTEL_CLIENT_SECRET=...
supabase secrets set AIRTEL_ENCRYPTION_KEY=...   # PIN for disbursements
```

### 3. SMS provider (Phone OTP)
Supabase Dashboard → Authentication → Phone → enable Twilio/MessageBird.
Without this, `phone` auth in `(auth)/welcome.tsx` returns 422.

### 4. Bootstrap first admin
After your first user signs up via the app, promote them from the Supabase SQL editor:
```sql
select public.promote_admin('+260971234567', 'super_admin');
```
(Function defined in migration `0004_audit_fixes.sql`. The phone must match `users.phone_number` exactly, including the leading `+260`.)

### 5. Cron jobs
Migration `0005_cron.sql` schedules `expire-stale-requests` (every 5 min) and `auto-release-timer` (every 15 min) via `pg_cron`. Replace the `<supabase_url>` and `<service_role_key>` placeholders in that migration before applying, or use `ALTER DATABASE postgres SET app.supabase_url=...` and `app.service_role_key=...` if your `0005_cron.sql` reads from settings.

### 6. Admin web panel
Open the same Expo dev server in a desktop browser (`npx expo start --web`). Login as the admin user (you must have run step 4 first). Mobile users see "Admin panel — Web only" message.

## Tap targets
- **Requester tabs:** Requests · History · Profile
- **Runner tabs:** Feed · Active Job · Earnings · Profile
- **Shared screens:** Wallet, Settings, Help (accessible from Profile)

## Layout
```
app/                   Expo Router routes (auth, requester, runner, shared, admin)
components/ui/         Design system primitives
hooks/                 React Query data hooks
lib/                   supabase, theme, threeTap, airtel client
stores/                authStore, modeStore
supabase/migrations/   SQL schema + RLS
supabase/functions/    Edge Functions (Airtel webhooks, escrow, feed, cron)
```

## Hard Rules
- **3-tap rule.** Every core task ≤ 3 taps from home. `lib/threeTap.ts` enforces in dev.
- **One screen, one action.** Single primary CTA per screen.
- **Skeleton over spinner.** Never show "Loading…".
- **Mode lock.** Cannot switch Requester ↔ Runner mid-transaction.
- **Photo required at milestones 3 & 4.** No skip.
- **Driver phone + plate captured at milestone 4.** Tap-to-call from Requester.

See `Fastele_System_Specification_v1.3.docx` for the full spec.
