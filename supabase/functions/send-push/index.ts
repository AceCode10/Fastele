import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Called internally by DB triggers or other edge functions.
// Sends Expo push notification to one or more tokens, prunes invalid tokens.

serve(async (req) => {
  const { tokens, title, body, data } = await req.json();

  if (!tokens?.length) return new Response('no_tokens', { status: 200 });

  const list = (Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean) as string[];
  const messages = list.map((to) => ({ to, title, body, data: data ?? {}, sound: 'default' }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await res.json();

    // Prune tokens Expo reports as dead (DeviceNotRegistered / InvalidCredentials).
    const tickets: any[] = Array.isArray(result?.data) ? result.data : [];
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket?.status === 'error') {
        const errCode = ticket?.details?.error;
        if (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials') {
          if (list[i]) dead.push(list[i]);
        } else {
          console.error('Expo push error', errCode, ticket?.message);
        }
      }
    });

    if (dead.length) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await supabase.from('users').update({ expo_push_token: null }).in('expo_push_token', dead);
      console.warn(`send-push: pruned ${dead.length} dead token(s)`);
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-push fetch error', e);
    return new Response(JSON.stringify({ error: 'expo_fetch_failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
