import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authenticate, corsHeaders, jsonResponse, requireAdmin } from '../_shared/auth.ts';
import { disburse } from '../_shared/airtel.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);
  const { userId, serviceClient } = auth;

  if (!(await requireAdmin(serviceClient, userId))) return jsonResponse({ error: 'Admin only' }, 403);

  const { disputeId, ruling, refundAmount } = await req.json();
  if (!disputeId || !ruling) return jsonResponse({ error: 'disputeId + ruling required' }, 400);

  const { data: dispute } = await serviceClient
    .from('disputes')
    .select('id, request_id, raised_by, status')
    .eq('id', disputeId)
    .maybeSingle();

  if (!dispute || dispute.status === 'resolved') {
    return jsonResponse({ error: 'Not found or already resolved' }, 400);
  }

  const { data: r } = await serviceClient
    .from('requests')
    .select('id, requester_id, runner_id, runner_fee, item_budget, dispute_reserve, escrow_reference')
    .eq('id', dispute.request_id)
    .maybeSingle();

  if (!r) return jsonResponse({ error: 'Request not found' }, 404);

  // Bounds: refund cannot exceed total escrow (item_budget + runner_fee).
  const maxRefund = Number(r.item_budget) + Number(r.runner_fee);
  let safeRefund: number | null = null;
  if (ruling !== 'no_refund') {
    if (typeof refundAmount !== 'number' || refundAmount < 0 || refundAmount > maxRefund) {
      return jsonResponse(
        { error: `refundAmount must be a number in [0, ${maxRefund}]` },
        400,
      );
    }
    safeRefund = +refundAmount.toFixed(2);
  }

  const now = new Date().toISOString();

  await serviceClient.from('disputes').update({
    status: 'resolved',
    ruling,
    refund_amount: safeRefund,
    admin_id: userId,
    resolved_at: now,
  }).eq('id', disputeId);

  await serviceClient.from('admin_actions').insert({
    admin_id: userId,
    action: 'dispute_resolved',
    target_table: 'disputes',
    target_id: disputeId,
    meta: { ruling, refundAmount: safeRefund },
  });

  if (ruling === 'no_refund') {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/confirm-delivery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestId: r.id }),
    });
  } else {
    const { data: requester } = await serviceClient.from('users').select('airtel_msisdn').eq('id', r.requester_id).maybeSingle();
    if (requester?.airtel_msisdn && safeRefund && safeRefund > 0) {
      await disburse({
        serviceClient,
        requestId: r.id,
        disputeId,
        payeeUserId: r.requester_id,
        msisdn: requester.airtel_msisdn,
        amount: safeRefund,
        kind: 'refund',
        refPrefix: 'REFUND',
      });
    }
    await serviceClient.from('requests').update({ status: 'cancelled', completed_at: now }).eq('id', r.id);
  }

  const { data: req_user } = await serviceClient.from('users').select('expo_push_token').eq('id', r.requester_id).maybeSingle();
  const { data: run_user } = await serviceClient.from('users').select('expo_push_token').eq('id', r.runner_id).maybeSingle();
  const tokens = [req_user?.expo_push_token, run_user?.expo_push_token].filter(Boolean);
  if (tokens.length) {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, title: 'Fastele', body: 'Your dispute has been reviewed. Tap to see the outcome.' }),
    });
  }

  return jsonResponse({ ok: true, refundAmount: safeRefund });
});
