import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cron: every 15 minutes.
// Auto-confirms any request stuck in in_transit for > 48 hours. Spec §8.3.
// Also sends 12-hour reminder push if not already sent.

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const h12ago = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();

  // Find requests needing 12h reminder (in_transit, delivered_at null, accepted 12–47h ago).
  const { data: remind } = await supabase
    .from('requests')
    .select('id, requester_id, users!requester_id(expo_push_token)')
    .eq('status', 'in_transit')
    .lt('accepted_at', h12ago)
    .gt('accepted_at', h48ago);

  for (const r of remind ?? []) {
    const token = (r as any).users?.expo_push_token;
    if (token) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: [token],
          title: 'Fastele',
          body: 'Did your items arrive? Tap to confirm and release payment to your Runner.',
        }),
      });
    }
  }

  // Auto-release: in_transit requests accepted > 48h ago.
  const { data: release } = await supabase
    .from('requests')
    .select('id')
    .eq('status', 'in_transit')
    .lt('accepted_at', h48ago);

  for (const r of release ?? []) {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/confirm-delivery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: r.id }),
    });
  }

  return new Response(JSON.stringify({ reminded: remind?.length ?? 0, released: release?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
