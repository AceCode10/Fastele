import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { disburse } from '../_shared/airtel.ts';

// Cron: every 5 minutes.
// Spec §8.1: notify at 30min, auto-expire + full refund at 60min.

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const m30ago = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const m60ago = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  const { data: warn } = await supabase
    .from('requests')
    .select('id, requester_id, users!requester_id(expo_push_token)')
    .eq('status', 'open')
    .lt('posted_at', m30ago)
    .gt('posted_at', m60ago);

  for (const r of warn ?? []) {
    const token = (r as any).users?.expo_push_token;
    if (token) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: [token],
          title: 'Fastele',
          body: 'No Runner yet. Raise your offer to attract more Runners, or cancel for a full refund.',
          data: { requestId: r.id, action: 'raise_offer' },
        }),
      });
    }
  }

  const { data: expire } = await supabase
    .from('requests')
    .select('id, requester_id, escrow_reference, item_budget, runner_fee, users!requester_id(expo_push_token, airtel_msisdn)')
    .eq('status', 'open')
    .lt('posted_at', m60ago);

  for (const r of expire ?? []) {
    const { error } = await supabase
      .from('requests')
      .update({ status: 'expired', completed_at: now.toISOString() })
      .eq('id', r.id)
      .eq('status', 'open');
    if (error) continue;

    const user = (r as any).users;

    if (user?.airtel_msisdn) {
      await disburse({
        serviceClient: supabase,
        requestId: r.id,
        payeeUserId: r.requester_id,
        msisdn: user.airtel_msisdn,
        amount: Number(r.item_budget) + Number(r.runner_fee),
        kind: 'cancel_refund',
        refPrefix: 'EXPIRE',
      });
    }

    if (user?.expo_push_token) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: [user.expo_push_token],
          title: 'Fastele',
          body: 'No Runner accepted in time. Your request expired — full refund on its way.',
        }),
      });
    }
  }

  return new Response(JSON.stringify({ warned: warn?.length ?? 0, expired: expire?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
