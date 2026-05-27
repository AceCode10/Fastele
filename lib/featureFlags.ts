// ============================================================================
// Fastele feature flags — DEV TEST MODE
// ============================================================================
// Flip these to `false` to restore real OTP + Airtel payment flows.
// The original code paths are PRESERVED behind these guards (not deleted),
// so toggling these booleans is a one-line revert.
//
// See: plans/fastele-test-mode-and-fixes-0829e7.md
// ============================================================================

/**
 * When true: hide phone/OTP screens. Welcome screen shows
 * "Sign in as Requester" / "Sign in as Runner" dev buttons that
 * authenticate via fixed test accounts (see lib/devAuth.ts).
 *
 * When false: standard Twilio SMS-OTP flow via Supabase auth.
 */
export const DEV_SKIP_OTP = true;

/**
 * When true: hide the "Pay from Mobile Money number" field on new-request,
 * skip the MoMo prompt, and auto-fund the request via the
 * `dev-fund-request` edge function so Runners can see it.
 *
 * When false: real Lipila Mobile Money collection via the `lipila-payments`
 * edge function (action=collect); request becomes visible to Runners only
 * after `lipila-callback` flips `escrow_funded` on Successful status.
 */
export const DEV_SKIP_PAYMENTS = true;
