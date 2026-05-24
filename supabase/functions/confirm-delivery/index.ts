import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authenticate, corsHeaders, jsonResponse, requireAdmin } from '../_shared/auth.ts';
import { disburse } from '../_shared/airtel.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);
  const { userId, serviceClient } = auth;

  const { requestId, viaCron } = await req.json();

  const { data: r } = await serviceClient
    .from('requests')
    .select('id, status, runner_id, runner_fee, escrow_reference, requester_id, in_transit_at')
    .eq('id', requestId)
    .maybeSingle();

  if (!r) return jsonResponse({ error: 'Request not found' }, 404);

  const isAdmin = await requireAdmin(serviceClient, userId);
  const isRequester = r.requester_id === userId;
  const ageMs = r.in_transit_at ? Date.now() - new Date(r.in_transit_at).getTime() : 0;
  const past48h = ageMs >= 48 * 60 * 60 * 1000;
  const autoRelease = viaCron && past48h && isAdmin;

  if (!isRequester && !isAdmin && !autoRelease) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  if (!['in_transit', 'matched', 'items_purchased'].includes(r.status)) {
    return jsonResponse({ error: 'Not deliverable' }, 400);
  }

  const { data: cfgRow } = await serviceClient.from('platform_config').select('value').eq('key', 'commission_pct').maybeSingle();
  const commissionPct = (cfgRow?.value as number ?? 10) / 100;

  const now = new Date().toISOString();
  const runnerPayout = +(r.runner_fee * (1 - commissionPct)).toFixed(2);
  const platformFee = +(r.runner_fee * commissionPct).toFixed(2);

  const { data: runner } = await serviceClient
    .from('users')
    .select('airtel_msisdn')
    .eq('id', r.runner_id)
    .maybeSingle();

  let payoutRef: string | null = null;
  if (runner?.airtel_msisdn) {
    const result = await disburse({
      serviceClient,
      requestId,
      payeeUserId: r.runner_id,
      msisdn: runner.airtel_msisdn,
      amount: runnerPayout,
      kind: 'payout',
      refPrefix: 'PAYOUT',
    });
    if (result.ok) payoutRef = result.reference;
  }

  await serviceClient.from('requests').update({
    status: 'delivered',
    platform_fee: platformFee,
    delivered_at: now,
    completed_at: now,
    payout_reference: payoutRef,
    milestone_timestamps: { delivered: now },
  }).eq('id', requestId);

  return jsonResponse({ ok: true, runnerPayout, platformFee, autoRelease: !!autoRelease, payoutRef });
});
