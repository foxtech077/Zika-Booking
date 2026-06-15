import { createHmac } from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const TARA_BASE_URL    = process.env["TARA_BASE_URL"]    ?? "https://api.taramoney.com";
const TARA_API_KEY     = process.env["TARA_API_KEY"]     ?? "";
const TARA_BUSINESS_ID = process.env["TARA_BUSINESS_ID"] ?? "";
const TARA_WEBHOOK_URL = process.env["TARA_WEBHOOK_URL"] ?? "";

const STK_TIMEOUT_MS = 60_000; // 60-second STK push window per spec
const REQUEST_TIMEOUT_MS = 30_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaraPaymentResult {
  taraReference: string;
  status: "pending" | "successful" | "failed";
}

interface TaraApiResponse {
  success?: boolean;
  status?: string;
  data?: {
    reference?: string;
    transactionId?: string;
    id?: string;
    status?: string;
  };
  reference?: string;
  transactionId?: string;
  message?: string;
  error?: string;
}

// ── Shared fetch with timeout ─────────────────────────────────────────────────

async function taraFetch(
  path: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${TARA_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${TARA_API_KEY}`,
  };
}

function extractReference(json: TaraApiResponse, fallback: string): string {
  return (
    json.data?.reference ??
    json.data?.transactionId ??
    json.data?.id ??
    json.reference ??
    json.transactionId ??
    fallback
  );
}

function normaliseStatus(raw?: string): TaraPaymentResult["status"] {
  const s = (raw ?? "").toLowerCase();
  if (["successful", "success", "completed", "paid"].includes(s)) return "successful";
  if (["failed", "rejected", "cancelled", "error"].includes(s)) return "failed";
  return "pending";
}

// ── Initiate STK push — exponential backoff on network error ──────────────────
// Idempotency key format per spec: bookingReference + attemptNumber

export async function initiateTaraPayment(opts: {
  amount: number;
  currency: string;
  mobileNumber: string;
  reference: string;   // booking reference, e.g. ZIKA-001234-KE
  description: string;
  attemptNumber?: number;
}): Promise<TaraPaymentResult> {
  const idempotencyKey = `${opts.reference}-${opts.attemptNumber ?? 1}`;

  const payload = JSON.stringify({
    businessId:  TARA_BUSINESS_ID,
    amount:      opts.amount,
    currency:    opts.currency,
    phoneNumber: opts.mobileNumber,
    reference:   idempotencyKey,
    description: opts.description,
    callbackUrl: TARA_WEBHOOK_URL,
  });

  let lastError: unknown;

  // Retry up to 3 times with exponential backoff: 2 s → 4 s
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await taraFetch(
        "/v1/collections",
        { method: "POST", headers: authHeaders(), body: payload },
        STK_TIMEOUT_MS,
      );

      const json = (await res.json()) as TaraApiResponse;

      if (!res.ok) {
        throw new Error(
          `Tara API ${res.status}: ${json.message ?? json.error ?? "unknown error"}`,
        );
      }

      return {
        taraReference: extractReference(json, idempotencyKey),
        status: normaliseStatus(json.data?.status ?? json.status),
      };
    } catch (err: unknown) {
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      // Don't retry on timeout (STK already sent)
      if (isAbort || attempt === 3) break;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1_000));
    }
  }

  throw lastError;
}

// ── Poll payment status ───────────────────────────────────────────────────────

export async function getTaraPaymentStatus(
  taraReference: string,
): Promise<TaraPaymentResult["status"]> {
  const res = await taraFetch(
    `/v1/collections/${encodeURIComponent(taraReference)}`,
    { method: "GET", headers: authHeaders() },
  );

  const json = (await res.json()) as TaraApiResponse;
  if (!res.ok) {
    throw new Error(
      `Tara status check failed (${res.status}): ${json.message ?? "unknown"}`,
    );
  }

  return normaliseStatus(json.data?.status ?? json.status);
}

// ── Refund / reversal ─────────────────────────────────────────────────────────

export async function initiateTaraReversal(opts: {
  taraReference: string;
  amount: number;
  reason: string;
}): Promise<{ reversalId: string }> {
  const res = await taraFetch("/v1/refunds", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      businessId: TARA_BUSINESS_ID,
      reference:  opts.taraReference,
      amount:     opts.amount,
      reason:     opts.reason,
    }),
  });

  const json = (await res.json()) as TaraApiResponse;
  if (!res.ok) {
    throw new Error(
      `Tara reversal failed (${res.status}): ${json.message ?? "unknown"}`,
    );
  }

  return { reversalId: extractReference(json, `TREV-${Date.now()}`) };
}

// ── Webhook signature verification ───────────────────────────────────────────
// Exported so the webhook route can reuse without duplicating logic.

export function verifyTaraWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  // Constant-time compare to prevent timing attacks
  return expected.length === signature.length &&
    createHmac("sha256", secret).update(rawBody).digest("hex") === signature;
}
