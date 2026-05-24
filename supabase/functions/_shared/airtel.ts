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
  /** Short tag used to derive the Airtel reference. */
  refPrefix?: string;
};

export type DisburseResult = {
  ok: boolean;
  reference: string;
  airtelStatusCode?: string;
  error?: string;
};

const AIRTEL_BASE = () => Deno.env.get('AIRTEL_API_URL') ?? 'https://openapi.airtel.africa';

export async function getAirtelAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${AIRTEL_BASE()}/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: Deno.env.get('AIRTEL_CLIENT_ID'),
        client_secret: Deno.env.get('AIRTEL_CLIENT_SECRET'),
        grant_type: 'client_credentials',
      }),
    });
    const json = await res.json();
    return json?.access_token ?? null;
  } catch (e) {
    console.error('Airtel token error', e);
    return null;
  }
}

/**
 * Verifies the inbound webhook signature.
 * Stub: when AIRTEL_WEBHOOK_SECRET is unset we log + accept (sandbox mode).
 * When set, we HMAC-SHA256 the raw body and compare against the
 * `x-auth-signature` header (Airtel uses this naming in their callback spec —
 * confirm exact header name + algorithm with Airtel before production rollout).
 *
 * TODO(airtel): replace stub with verified implementation once secret is
 * provisioned and Airtel callback spec is in hand.
 */
export async function verifyAirtelSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('AIRTEL_WEBHOOK_SECRET');
  if (!secret) {
    console.warn('verifyAirtelSignature: AIRTEL_WEBHOOK_SECRET unset — accepting in sandbox mode');
    return true;
  }
  const signature = req.headers.get('x-auth-signature') ?? req.headers.get('x-signature');
  if (!signature) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(expected, signature.toLowerCase());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Encrypts the disbursement PIN per Airtel's spec.
 * Stub: when AIRTEL_PUBLIC_KEY is unset we pass the raw env value through
 * (sandbox). Production must set AIRTEL_PUBLIC_KEY (PEM) and we then
 * RSA-OAEP encrypt the PIN under it.
 *
 * TODO(airtel): implement RSA-OAEP encryption once Airtel public key is in
 * hand. Until then disbursements will only work in sandbox.
 */
export async function encryptAirtelPin(): Promise<string> {
  const rawPin = Deno.env.get('AIRTEL_PIN') ?? Deno.env.get('AIRTEL_ENCRYPTION_KEY') ?? '';
  const publicKeyPem = Deno.env.get('AIRTEL_PUBLIC_KEY');
  if (!publicKeyPem) {
    console.warn('encryptAirtelPin: AIRTEL_PUBLIC_KEY unset — sending plain PIN (sandbox only)');
    return rawPin;
  }
  // TODO: production path. Outline:
  //   const der = pemToDer(publicKeyPem);
  //   const key = await crypto.subtle.importKey('spki', der,
  //     { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  //   const ct = await crypto.subtle.encrypt('RSA-OAEP', key,
  //     new TextEncoder().encode(rawPin));
  //   return btoa(String.fromCharCode(...new Uint8Array(ct)));
  console.warn('encryptAirtelPin: production path not implemented; falling back to raw PIN');
  return rawPin;
}

/**
 * Disburses funds via Airtel Money and writes an audit row to payout_log
 * pre-call (status=pending) and post-call (status=success|failed).
 */
export async function disburse(args: DisburseArgs): Promise<DisburseResult> {
  const { serviceClient, requestId, disputeId, payeeUserId, msisdn, amount, kind, refPrefix } = args;

  const tag = (refPrefix ?? kind.toUpperCase()).slice(0, 8);
  const reference = `${tag}-${requestId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  // Pre-call audit row.
  const { data: row, error: insertErr } = await serviceClient
    .from('payout_log')
    .insert({
      request_id: requestId,
      dispute_id: disputeId ?? null,
      payee_user_id: payeeUserId ?? null,
      msisdn,
      amount,
      kind,
      airtel_reference: reference,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('payout_log insert failed', insertErr);
    return { ok: false, reference, error: insertErr.message };
  }

  const token = await getAirtelAccessToken();
  if (!token) {
    await serviceClient.from('payout_log').update({
      status: 'failed', error_message: 'token_error', settled_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: false, reference, error: 'token_error' };
  }

  const pin = await encryptAirtelPin();

  try {
    const res = await fetch(`${AIRTEL_BASE()}/standard/v1/disbursements/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Country': 'ZM',
        'X-Currency': 'ZMW',
      },
      body: JSON.stringify({
        payee: { msisdn },
        reference,
        pin,
        transaction: { amount, id: reference },
      }),
    });
    const body = await res.json().catch(() => ({}));
    const code: string | undefined = body?.status?.code ?? body?.data?.transaction?.status;
    const success = code === '200' || code === 'TS' || code === 'TIP';

    await serviceClient.from('payout_log').update({
      status: success ? 'success' : 'failed',
      airtel_response: body,
      airtel_reference: body?.data?.transaction?.id ?? reference,
      error_message: success ? null : (body?.status?.message ?? `code=${code ?? 'unknown'}`),
      settled_at: new Date().toISOString(),
    }).eq('id', row.id);

    return { ok: success, reference, airtelStatusCode: code };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await serviceClient.from('payout_log').update({
      status: 'failed', error_message: message, settled_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: false, reference, error: message };
  }
}
