import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAirtelSignature } from '../_shared/airtel.ts';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const rawBody = await req.text();
  const verified = await verifyAirtelSignature(req, rawBody);
  if (!verified) return new Response('invalid_signature', { status: 401 });

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return new Response('bad_json', { status: 400 }); }

  const txId: string | undefined = body?.transaction?.id ?? body?.data?.transaction?.id;
  const txStatus: string | undefined = body?.transaction?.status ?? body?.status?.code;

  if (!txId) return new Response('ignored', { status: 200 });

  if (txStatus !== 'TS' && txStatus !== '200') return new Response('not_success', { status: 200 });

  const { data: req_row } = await supabase
    .from('requests')
    .select('id, status, escrow_funded')
    .eq('escrow_reference', txId)
    .maybeSingle();

  if (!req_row || req_row.status !== 'open') return new Response('no_match', { status: 200 });
  if (req_row.escrow_funded) return new Response('already_funded', { status: 200 });

  await supabase
    .from('requests')
    .update({ escrow_funded: true })
    .eq('id', req_row.id);

  return new Response('ok', { status: 200 });
});
