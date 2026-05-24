import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authenticate, corsHeaders, jsonResponse } from '../_shared/auth.ts';

// Spec §10: requester may raise a dispute while in_transit or within 48h of delivered.
// Body: { requestId, reason, description?, evidenceUrl? }

const ALLOWED_REASONS = ['wrong_items', 'missing_items', 'not_delivered', 'damaged', 'other'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);
  const { userId, serviceClient } = auth;

  const { requestId, reason, description, evidenceUrl } = await req.json();

  if (!requestId || !reason) return jsonResponse({ error: 'requestId + reason required' }, 400);
  if (!ALLOWED_REASONS.includes(reason)) return jsonResponse({ error: 'invalid reason' }, 400);
  if (description && typeof description === 'string' && description.length > 1000) {
    return jsonResponse({ error: 'description too long' }, 400);
  }

  const { data: r } = await serviceClient
    .from('requests')
    .select('id, status, requester_id, runner_id, delivered_at')
    .eq('id', requestId)
    .maybeSingle();

  if (!r) return jsonResponse({ error: 'Request not found' }, 404);
  if (r.requester_id !== userId) return jsonResponse({ error: 'Only requester can raise dispute' }, 403);

  // Window: in_transit OR delivered within 48h.
  const inWindow =
    r.status === 'in_transit' ||
    (r.status === 'delivered' &&
      r.delivered_at &&
      Date.now() - new Date(r.delivered_at).getTime() < 48 * 60 * 60 * 1000);
  if (!inWindow) return jsonResponse({ error: 'Outside dispute window' }, 409);

  // Rate limit: one open dispute per request.
  const { data: existing } = await serviceClient
    .from('disputes')
    .select('id, status')
    .eq('request_id', requestId)
    .neq('status', 'resolved')
    .maybeSingle();
  if (existing) return jsonResponse({ error: 'Dispute already open' }, 409);

  const { data: dispute, error: insErr } = await serviceClient
    .from('disputes')
    .insert({
      request_id: requestId,
      raised_by: userId,
      reason,
      description: description?.trim() || null,
      evidence_url: evidenceUrl ?? null,
    })
    .select('id')
    .single();
  if (insErr) return jsonResponse({ error: insErr.message }, 500);

  await serviceClient.from('requests').update({ status: 'disputed' }).eq('id', requestId);

  // Notify admins.
  const { data: adminRows } = await serviceClient
    .from('admins')
    .select('users:user_id(expo_push_token)');
  const adminTokens = (adminRows ?? [])
    .map((a: any) => a.users?.expo_push_token)
    .filter(Boolean);

  // Notify runner.
  const { data: runner } = r.runner_id
    ? await serviceClient.from('users').select('expo_push_token').eq('id', r.runner_id).maybeSingle()
    : { data: null };
  const allTokens = [...adminTokens, runner?.expo_push_token].filter(Boolean);

  if (allTokens.length) {
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: allTokens,
          title: 'Fastele',
          body: 'New dispute opened — review required.',
          data: { disputeId: dispute.id, requestId },
        }),
      });
    } catch (e) { console.error('Dispute notify error', e); }
  }

  return jsonResponse({ ok: true, disputeId: dispute.id });
});
