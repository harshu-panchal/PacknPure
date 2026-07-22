/**
 * Masked calling provider registry.
 * Real integrations (Twilio, Exotel, Knowlarity) plug in here without changing callers.
 */

export const MASKED_CALL_PROVIDERS = {
  STUB: "stub",
  TWILIO: "twilio",
  EXOTEL: "exotel",
  KNOWLARITY: "knowlarity",
};

const activeProvider = () =>
  String(process.env.MASKED_CALL_PROVIDER || MASKED_CALL_PROVIDERS.STUB).toLowerCase();

/** Stub — no real PSTN bridge; returns a synthetic session for UI testing. */
async function stubInitiateCall({ orderId, callerRole, calleeRole }) {
  const sessionId = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    provider: MASKED_CALL_PROVIDERS.STUB,
    sessionId,
    status: "initiated",
    message:
      "Masked call session created. Connect a real provider (Twilio / Exotel / Knowlarity) via MASKED_CALL_PROVIDER.",
    maskedNumber: process.env.MASKED_CALL_STUB_NUMBER || "+918000000000",
    orderId,
    callerRole,
    calleeRole,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

/** Future: Twilio Programmable Voice / Proxy */
async function twilioInitiateCall(_ctx) {
  throw new Error(
    "Twilio masked calling is not configured. Set TWILIO_* env vars and implement twilioInitiateCall.",
  );
}

/** Future: Exotel Connect / Applet */
async function exotelInitiateCall(_ctx) {
  throw new Error(
    "Exotel masked calling is not configured. Set EXOTEL_* env vars and implement exotelInitiateCall.",
  );
}

/** Future: Knowlarity SuperReceptionist / Virtual Number */
async function knowlarityInitiateCall(_ctx) {
  throw new Error(
    "Knowlarity masked calling is not configured. Set KNOWLARITY_* env vars and implement knowlarityInitiateCall.",
  );
}

const PROVIDER_HANDLERS = {
  [MASKED_CALL_PROVIDERS.STUB]: stubInitiateCall,
  [MASKED_CALL_PROVIDERS.TWILIO]: twilioInitiateCall,
  [MASKED_CALL_PROVIDERS.EXOTEL]: exotelInitiateCall,
  [MASKED_CALL_PROVIDERS.KNOWLARITY]: knowlarityInitiateCall,
};

export async function initiateWithProvider(ctx) {
  const key = activeProvider();
  const handler = PROVIDER_HANDLERS[key] || PROVIDER_HANDLERS[MASKED_CALL_PROVIDERS.STUB];
  return handler(ctx);
}

export function getActiveMaskedCallProvider() {
  return activeProvider();
}
