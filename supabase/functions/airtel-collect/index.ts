import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { authenticate, corsHeaders, jsonResponse } from '../_shared/auth.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authenticate(req);
  if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status);
  const { userId, serviceClient } = auth;

  const { requestId, msisdn, amount } = await req.json();
  if (!requestId || !msisdn || !amount) return jsonResponse({ error: 'requestId, msisdn, amount required' }, 400);

  // Verify caller is the requester on this request.
  const { data: r } = await serviceClient
    .from('requests')
    .select('id, requester_id, status, escrow_reference')
    .eq('id', requestId)
    .maybeSingle();

  if (!r) return jsonResponse({ error: 'Request not found' }, 404);
  if (r.requester_id !== userId) return jsonResponse({ error: 'Not your request' }, 403);
  if (r.status !== 'open') return jsonResponse({ error: 'Request not in open state' }, 409);
  if (r.escrow_reference) return jsonResponse({ error: 'Already funded' }, 409);

  // Airtel Money Zambia API — STK push.
  const airtelBaseUrl = Deno.env.get('AIRTEL_API_URL') ?? 'https://openapi.airtel.africa';
  const airtelClientId = Deno.env.get('AIRTEL_CLIENT_ID') ?? '';
  const airtelClientSecret = Deno.env.get('AIRTEL_CLIENT_SECRET') ?? '';

  const tokenRes = await fetch(`${airtelBaseUrl}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: airtelClientId,
      client_secret: airtelClientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!tokenRes.ok) return jsonResponse({ error: 'Airtel auth failed' }, 502);
  const { access_token } = await tokenRes.json();

  const ref = `FASTELE-${requestId.slice(0, 8).toUpperCase()}`;
  const collectRes = await fetch(`${airtelBaseUrl}/merchant/v1/payments/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'X-Country': 'ZM',
      'X-Currency': 'ZMW',
    },
    body: JSON.stringify({
      reference: ref,
      subscriber: { country: 'ZM', currency: 'ZMW', msisdn },
      transaction: { amount, country: 'ZM', currency: 'ZMW', id: ref },
    }),
  });

  const collectBody = await collectRes.json();
  if (!collectRes.ok || collectBody.status?.code !== '200') {
    console.error('Airtel collect error', collectBody);
    return jsonResponse({ error: collectBody.status?.message ?? 'Payment failed' }, 502);
  }

  await serviceClient
    .from('requests')
    .update({ escrow_reference: collectBody.data?.transaction?.id ?? ref })
    .eq('id', requestId);

  return jsonResponse({ ok: true, reference: ref });
});
