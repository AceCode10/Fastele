import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type DisburseKind = 'payout' | 'refund' | 'cancel_refund';

export type DisburseArgs = {
  serviceClient: SupabaseClient;
  requestId: string;
  disputeId?: string;
  payeeUserId?: string;
  msisdn: string;
  amount: number;
  kind: DisburseKind;
  /** Short tag baked into the Lipila referenceId. */
  refPrefix?: string;
  narration?: string;
};

export type DisburseResult = {
  ok: boolean;
  reference: string;
  lipilaStatus?: string;
  error?: string;
};

function getLipilaConfig() {
  const mode = (Deno.env.get('LIPILA_MODE') || 'sandbox').toLowerCase();
  const isSandbox = mode !== 'live';
  return {
    mode: isSandbox ? 'sandbox' : 'live',
    baseUrl: isSandbox
      ? (Deno.env.get('LIPILA_SANDBOX_URL') || 'https://api.lipila.dev')
      : (Deno.env.get('LIPILA_LIVE_URL') || 'https://blz.lipila.io'),
    apiKey: isSandbox
      ? (Deno.env.get('LIPILA_SANDBOX_API_KEY') || '')
      : (Deno.env.get('LIPILA_LIVE_API_KEY') || ''),
    callbackUrl: Deno.env.get('LIPILA_CALLBACK_URL') || '',
  };
}

function toAccountNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('260')) return digits;
  if (digits.startsWith('0')) return `260${digits.slice(1)}`;
  return `260${digits}`;
}

/**
 * Disburses funds via Lipila Mobile Money. Writes a `payout_log` row pre-call
 * (status=pending) and updates it post-call with the Lipila response.
 *
 * The final success/failed state may also arrive asynchronously via
 * lipila-callback; the row is updated either way (callback wins if it's
 * later than the synchronous response).
 */
export async function disburseLipila(args: DisburseArgs): Promise<DisburseResult> {
  const { serviceClient, requestId, disputeId, payeeUserId, msisdn, amount, kind, refPrefix, narration } = args;

  const tag = (refPrefix ?? kind.toUpperCase()).slice(0, 8);
  const reference = `${tag}-${requestId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-D`;

  const { data: row, error: insertErr } = await serviceClient
    .from('payout_log')
    .insert({
      request_id: requestId,
      dispute_id: disputeId ?? null,
      payee_user_id: payeeUserId ?? null,
      msisdn,
      amount,
      kind,
      airtel_reference: reference, // legacy column repurposed as primary reference
      lipila_reference: reference,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('payout_log insert failed', insertErr);
    return { ok: false, reference, error: insertErr.message };
  }

  const config = getLipilaConfig();
  if (!config.apiKey) {
    await serviceClient.from('payout_log').update({
      status: 'failed',
      error_message: `Lipila ${config.mode} API key not configured`,
      settled_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: false, reference, error: 'lipila_api_key_missing' };
  }

  const accountNumber = toAccountNumber(msisdn);
  if (accountNumber.length < 12) {
    await serviceClient.from('payout_log').update({
      status: 'failed',
      error_message: `Invalid MSISDN ${msisdn}`,
      settled_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: false, reference, error: 'invalid_msisdn' };
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/api/v1/disbursements/mobile-money`;
  const lipilaBody = {
    referenceId: reference,
    amount,
    accountNumber,
    currency: 'ZMW',
    narration: narration || `Fastele ${kind}`,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        ...(config.callbackUrl ? { callbackUrl: config.callbackUrl } : {}),
      },
      body: JSON.stringify(lipilaBody),
    });

    const rawText = await res.text();
    let data: any = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch { data = { raw: rawText }; }

    if (!res.ok) {
      await serviceClient.from('payout_log').update({
        status: 'failed',
        airtel_response: data,
        error_message: data?.message || `HTTP ${res.status}`,
        settled_at: new Date().toISOString(),
      }).eq('id', row.id);
      return { ok: false, reference, error: data?.message || `http_${res.status}` };
    }

    const lipilaStatus = (data?.status || '').toString();
    const accepted = ['Successful', 'Pending'].includes(lipilaStatus);

    await serviceClient.from('payout_log').update({
      // Accepted = synchronously OK (pending = waiting for callback to flip to success).
      // The callback handler later sets status=success once Lipila confirms.
      status: lipilaStatus === 'Successful' ? 'success' : accepted ? 'pending' : 'failed',
      airtel_response: data,
      error_message: accepted ? null : (data?.message || `status=${lipilaStatus}`),
      settled_at: lipilaStatus === 'Successful' ? new Date().toISOString() : null,
    }).eq('id', row.id);

    return { ok: accepted, reference, lipilaStatus };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await serviceClient.from('payout_log').update({
      status: 'failed',
      error_message: message,
      settled_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: false, reference, error: message };
  }
}
