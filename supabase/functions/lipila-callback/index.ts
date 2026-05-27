import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// Lipila Callback Handler — Edge Function (Fastele)
// Docs: https://docs.lipila.dev/docs/billing/callback.html
// ============================================
// Routes Lipila callbacks to two Fastele tables:
//   - requests       (collect callbacks: flip escrow_funded on Successful)
//   - payout_log     (disburse callbacks: mark payout success/failed)
//
// Both lookups key on the Lipila referenceId stored in `lipila_reference`.
// Unmatched callbacks go to `lipila_callbacks` for manual reconciliation.
// ============================================

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Headers": "content-type, x-callback-secret, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Defense-in-depth: verify the callback status against Lipila's own API
// before mutating money-bearing rows.
async function verifyWithLipila(referenceId: string): Promise<{ verified: boolean; status?: string }> {
  const mode = (Deno.env.get("LIPILA_MODE") || "sandbox").toLowerCase();
  const isSandbox = mode !== "live";
  const baseUrl = isSandbox
    ? (Deno.env.get("LIPILA_SANDBOX_URL") || "https://api.lipila.dev")
    : (Deno.env.get("LIPILA_LIVE_URL") || "https://blz.lipila.io");
  const apiKey = isSandbox
    ? (Deno.env.get("LIPILA_SANDBOX_API_KEY") || "")
    : (Deno.env.get("LIPILA_LIVE_API_KEY") || "");

  if (!apiKey) {
    console.warn("[lipila-callback] No API key configured — cannot verify callback with Lipila");
    return { verified: false };
  }

  for (const path of ["collections", "disbursements"]) {
    try {
      const url = `${baseUrl.replace(/\/$/, "")}/api/v1/${path}/check-status?referenceId=${encodeURIComponent(referenceId)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json", "x-api-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.referenceId === referenceId) {
          return { verified: true, status: data.status };
        }
      }
    } catch {}
  }
  return { verified: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // Optional shared-secret check. Lipila doesn't sign callbacks today,
    // so this is advisory; the real security is the API verification below.
    const callbackSecret = Deno.env.get("LIPILA_CALLBACK_SECRET") || "";
    if (callbackSecret) {
      const providedSecret = req.headers.get("x-callback-secret") || req.headers.get("x-webhook-secret") || "";
      if (providedSecret && providedSecret !== callbackSecret) {
        console.warn("[lipila-callback] Callback secret present but MISMATCHED — rejecting");
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const body = await req.json();
    const {
      referenceId,
      status,
      amount,
      accountNumber,
      paymentType,
      type,
      identifier,
      message,
      externalId,
    } = body as {
      referenceId?: string;
      status?: string;
      amount?: number;
      accountNumber?: string;
      paymentType?: string;
      type?: string;
      identifier?: string;
      message?: string;
      externalId?: string;
    };

    if (!referenceId || !status) {
      return json({ error: "Missing referenceId or status" }, 400);
    }

    const normalizedStatus = status.toLowerCase();
    const isFinancialAction = normalizedStatus === "successful" || normalizedStatus === "failed";
    if (isFinancialAction) {
      const verification = await verifyWithLipila(referenceId);
      if (verification.verified) {
        const verifiedStatus = (verification.status || "").toLowerCase();
        if (verifiedStatus !== normalizedStatus) {
          console.error(`[lipila-callback] STATUS MISMATCH: callback says "${status}" but Lipila API says "${verification.status}" for ${referenceId}`);
          return json({ received: true, referenceId, status: "rejected", reason: "Status mismatch with Lipila API" });
        }
      } else {
        console.warn(`[lipila-callback] Could not verify referenceId=${referenceId} with Lipila API — proceeding with caution`);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not set — cannot process callback");
      return json({ error: "Server misconfiguration" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const isSuccess = normalizedStatus === "successful";
    const isFailed = normalizedStatus === "failed";

    const maskedAccount = accountNumber ? accountNumber.slice(0, 3) + '****' + accountNumber.slice(-2) : '(none)';
    console.log(`[lipila-callback] ref=${referenceId} status=${status} type=${type} paymentType=${paymentType} account=${maskedAccount}`);

    // 1) Try collect: requests.lipila_reference
    const { data: reqRow } = await adminClient
      .from("requests")
      .select("id, status, escrow_funded")
      .eq("lipila_reference", referenceId)
      .maybeSingle();

    if (reqRow) {
      if (isSuccess && !reqRow.escrow_funded) {
        const { error: updErr } = await adminClient
          .from("requests")
          .update({ escrow_funded: true })
          .eq("id", reqRow.id);
        if (updErr) {
          console.error(`[lipila-callback] requests update error: ${updErr.message}`);
        } else {
          console.log(`[lipila-callback] Request ${reqRow.id} escrow_funded=true`);
        }
      } else if (isFailed && reqRow.status === "open") {
        const { error: updErr } = await adminClient
          .from("requests")
          .update({ status: "cancelled" })
          .eq("id", reqRow.id);
        if (updErr) {
          console.error(`[lipila-callback] requests cancel error: ${updErr.message}`);
        } else {
          console.log(`[lipila-callback] Request ${reqRow.id} cancelled (Lipila failed: ${message || status})`);
        }
      }
      return json({ received: true, referenceId, status, kind: "collect" });
    }

    // 2) Try disburse: payout_log.lipila_reference
    const { data: payoutRow } = await adminClient
      .from("payout_log")
      .select("id, status, kind, request_id")
      .eq("lipila_reference", referenceId)
      .maybeSingle();

    if (payoutRow) {
      const newStatus = isSuccess ? "success" : isFailed ? "failed" : payoutRow.status;
      if (newStatus !== payoutRow.status) {
        const { error: updErr } = await adminClient
          .from("payout_log")
          .update({
            status: newStatus,
            airtel_response: body, // reuse existing JSONB column for raw payload
            error_message: isFailed ? (message || `status=${status}`) : null,
            settled_at: new Date().toISOString(),
          })
          .eq("id", payoutRow.id);
        if (updErr) {
          console.error(`[lipila-callback] payout_log update error: ${updErr.message}`);
        } else {
          console.log(`[lipila-callback] payout_log ${payoutRow.id} -> ${newStatus} (${payoutRow.kind})`);
        }
      }
      return json({ received: true, referenceId, status, kind: "disburse" });
    }

    // 3) Unmatched — store for reconciliation.
    console.warn(`[lipila-callback] No request or payout_log found for referenceId=${referenceId}. Storing.`);
    await adminClient.from("lipila_callbacks").insert({
      reference_id: referenceId,
      status,
      amount,
      account_number: accountNumber,
      payment_type: paymentType,
      transaction_type: type,
      identifier,
      message,
      external_id: externalId,
      raw_payload: body,
    }).catch((e: any) => {
      console.warn(`[lipila-callback] Could not insert to lipila_callbacks: ${e?.message}`);
    });

    return json({ received: true, referenceId, status, kind: "unmatched" });
  } catch (err: any) {
    console.error(`[lipila-callback] Error: ${err?.message}`);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
