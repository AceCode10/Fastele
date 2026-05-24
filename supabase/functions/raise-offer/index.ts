import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authenticate, corsHeaders, jsonResponse } from '../_shared/auth.ts';

// Requester increases runner_fee on a still-open request and resets posted_at so it re-enters feed window.
// Body: { requestId, newRunnerFee, additionalMsisdn? }
// Note: any added amount needs a top-up STK push (caller initiates separately if escrow needs more funds).

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);
  const { userId, serviceClient } = auth;

  const { requestId, newRunnerFee } = await req.json();
  if (!requestId || typeof newRunnerFee !== 'number') return jsonResponse({ error: 'requestId + newRunnerFee required' }, 400);

  const { data: r } = await serviceClient
    .from('requests')
    .select('id, requester_id, status, runner_fee, posted_at, expires_at')
    .eq('id', requestId)
    .maybeSingle();

  if (!r) return jsonResponse({ error: 'Request not found' }, 404);
  if (r.requester_id !== userId) return jsonResponse({ error: 'Forbidden' }, 403);
  if (r.status !== 'open') return jsonResponse({ error: 'Only open requests can be raised' }, 409);
  if (newRunnerFee <= r.runner_fee) return jsonResponse({ error: 'New fee must be higher' }, 400);

  // Read both knobs in one go.
  const { data: cfgRows } = await serviceClient
    .from('platform_config')
    .select('key, value')
    .in('key', ['expire_minutes', 'commission_pct']);
  const cfg = Object.fromEntries((cfgRows ?? []).map((r: any) => [r.key, r.value]));
  const minutes = (cfg['expire_minutes'] as number) ?? 60;
  const commissionPct = ((cfg['commission_pct'] as number) ?? 10) / 100;
  const now = new Date();
  const newExpiry = new Date(now.getTime() + minutes * 60 * 1000).toISOString();

  await serviceClient.from('requests').update({
    runner_fee: newRunnerFee,
    platform_fee: +(newRunnerFee * commissionPct).toFixed(2),
    posted_at: now.toISOString(),
    expires_at: newExpiry,
  }).eq('id', requestId);

  return jsonResponse({ ok: true, newRunnerFee, newExpiry });
});
