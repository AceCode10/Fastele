import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authenticate, corsHeaders, jsonResponse } from '../_shared/auth.ts';
import { disburse } from '../_shared/airtel.ts';

// Handles cancellation per spec §8.2 (Runner cancels) and §8.6 (Requester cancels).
// Body: { requestId, reason?: 'emergency'|'wrong_location'|'item_unavailable'|'other' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);
  const { userId, serviceClient } = auth;

  const { requestId, reason } = await req.json();

  const { data: r } = await serviceClient
    .from('requests')
    .select('id, status, requester_id, runner_id, runner_fee, item_budget, escrow_reference')
    .eq('id', requestId)
    .maybeSingle();

  if (!r) return jsonResponse({ error: 'Request not found' }, 404);

  const isRequester = r.requester_id === userId;
  const isRunner = r.runner_id === userId;
  if (!isRequester && !isRunner) return jsonResponse({ error: 'Forbidden' }, 403);

  const now = new Date().toISOString();

  async function refundRequester(amount: number) {
    if (amount <= 0) return;
    const { data: u } = await serviceClient.from('users').select('airtel_msisdn').eq('id', r.requester_id).maybeSingle();
    if (!u?.airtel_msisdn) return;
    await disburse({
      serviceClient,
      requestId,
      payeeUserId: r.requester_id,
      msisdn: u.airtel_msisdn,
      amount,
      kind: 'cancel_refund',
      refPrefix: 'CANCEL',
    });
  }

  // ───────────────────── REQUESTER CANCELS ─────────────────────
  if (isRequester) {
    if (r.status === 'open') {
      await serviceClient.from('requests').update({ status: 'cancelled', completed_at: now }).eq('id', requestId);
      await refundRequester(r.item_budget + r.runner_fee);
      return jsonResponse({ ok: true, refunded: r.item_budget + r.runner_fee });
    }
    if (r.status === 'matched' || r.status === 'items_purchased') {
      const partialFee = +(r.runner_fee * 0.5).toFixed(2);
      const refund = r.item_budget + r.runner_fee - partialFee;
      await serviceClient.from('requests').update({ status: 'cancelled', completed_at: now }).eq('id', requestId);
      await refundRequester(refund);
      return jsonResponse({ ok: true, refunded: refund, runnerPartial: partialFee });
    }
    return jsonResponse({ error: 'Cannot cancel at current status' }, 409);
  }

  // ───────────────────── RUNNER CANCELS ─────────────────────
  if (isRunner) {
    if (r.status !== 'matched' && r.status !== 'items_purchased') {
      return jsonResponse({ error: 'Runner can only cancel before delivery handoff' }, 409);
    }

    await serviceClient.from('requests').update({
      status: 'open',
      runner_id: null,
      accepted_at: null,
      photo_items_url: null,
      milestone_timestamps: {},
    }).eq('id', requestId);

    const { data: rn } = await serviceClient.from('users').select('runner_rating_avg').eq('id', userId).maybeSingle();
    const newAvg = Math.max(0, +(((rn?.runner_rating_avg ?? 5) - 0.1).toFixed(2)));
    await serviceClient.from('users').update({ runner_rating_avg: newAvg }).eq('id', userId);

    await serviceClient.from('admin_actions').insert({
      admin_id: userId,
      action: 'runner_cancelled',
      target_table: 'requests',
      target_id: requestId,
      meta: { reason },
    });

    const { data: reqUser } = await serviceClient.from('users').select('expo_push_token').eq('id', r.requester_id).maybeSingle();
    if (reqUser?.expo_push_token) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: [reqUser.expo_push_token], title: 'Fastele', body: "Your Runner cancelled. We're finding a new one." }),
      });
    }

    return jsonResponse({ ok: true, newAvg });
  }

  return jsonResponse({ error: 'Unhandled' }, 500);
});
