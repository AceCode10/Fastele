// ============================================================================
// dev-fund-request — TEST MODE ONLY
// ----------------------------------------------------------------------------
// Flips `escrow_funded = true` on a request without going through Airtel STK.
// Mirrors what airtel-webhook does, but for the DEV_SKIP_PAYMENTS test flow.
//
// Self-disables unless `FASTELE_ALLOW_DEV_FUND=true` is set as a function
// secret. DELETE THIS FUNCTION (or unset the env var) before public release.
//
// Deploy:
//   supabase functions deploy dev-fund-request
//   supabase secrets set FASTELE_ALLOW_DEV_FUND=true
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Inlined helpers (copied from ../_shared/auth.ts).
// Kept inline so this function deploys cleanly via the Supabase dashboard,
// which does NOT include sibling folders in its bundle.
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type AuthOk = { ok: true; userId: string; serviceClient: SupabaseClient };
type AuthErr = { ok: false; status: number; message: string };

async function authenticate(req: Request): Promise<AuthOk | AuthErr> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return { ok: false, status: 401, message: 'Missing Authorization' };

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(url, service);

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, message: 'Invalid token' };

  return { ok: true, userId: data.user.id, serviceClient };
}

// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Hard kill-switch — refuses to run unless explicitly enabled.
  if (Deno.env.get('FASTELE_ALLOW_DEV_FUND') !== 'true') {
    return jsonResponse(
      { error: 'dev-fund-request is disabled. Set FASTELE_ALLOW_DEV_FUND=true to enable.' },
      403
    );
  }

  const auth = await authenticate(req);
  if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);
  const { userId, serviceClient } = auth;

  const { requestId } = await req.json().catch(() => ({}));
  if (!requestId) return jsonResponse({ error: 'requestId required' }, 400);

  // Confirm caller owns the request.
  const { data: r, error: lookupErr } = await serviceClient
    .from('requests')
    .select('id, requester_id, status, escrow_funded')
    .eq('id', requestId)
    .maybeSingle();

  if (lookupErr) return jsonResponse({ error: lookupErr.message }, 500);
  if (!r) return jsonResponse({ error: 'Request not found' }, 404);
  if (r.requester_id !== userId) return jsonResponse({ error: 'Not your request' }, 403);
  if (r.status !== 'open') return jsonResponse({ error: 'Request not in open state' }, 409);
  if (r.escrow_funded) return jsonResponse({ ok: true, alreadyFunded: true });

  const ref = `DEV-${requestId.slice(0, 8).toUpperCase()}`;
  const { error: updateErr } = await serviceClient
    .from('requests')
    .update({ escrow_funded: true, escrow_reference: ref })
    .eq('id', requestId);

  if (updateErr) return jsonResponse({ error: updateErr.message }, 500);

  return jsonResponse({ ok: true, reference: ref, devMode: true });
});
