import { prisma } from "../lib/prisma.js";
import { RefundRetryStatus } from "../generated/index.js";
import { stripe, toStripeAmount } from "../lib/stripe.js";
import { initiateTaraReversal } from "../lib/tara.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

const BACKOFF_DELAYS_MINUTES = [1, 5, 15, 30, 60, 360]; // 1m, 5m, 15m, 30m, 1h, 6h

export class RefundLimitExceededError extends Error {
  constructor() {
    super("Refund limit exceeded");
    this.name = "RefundLimitExceededError";
  }
}

export class InvalidPaymentStatusError extends Error {
  constructor(status: string) {
    super(`Only captured or partially refunded payments can be refunded (status: ${status}).`);
    this.name = "InvalidPaymentStatusError";
  }
}

export async function createManualRefund(
  payment: { id: string; bookingId: string; amount: unknown; chargedAmount?: unknown; currency: string; status: string },
  opts: { amount: number; reason?: string | null; idempotencyKey: string },
): Promise<{ id: string; status: string }> {
  if (opts.amount <= 0) throw new Error("Refund amount must be greater than zero.");
  if (!["captured", "partially_refunded"].includes(payment.status)) {
    throw new InvalidPaymentStatusError(payment.status);
  }

  // Each accepted request creates its own ManualRefund row so an operator
  // can process several partial refunds against the same payment over
  // time. Idempotency is per-request via `idempotencyKey`. The refundable
  // balance counts committed refunds plus still-pending manual refunds, so
  // concurrent requests cannot over-commit the charged amount.
  return prisma.$transaction(async (tx) => {
    const existing = await tx.manualRefund.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
    if (existing) return { id: existing.id, status: existing.status };

    await tx.$executeRaw`SELECT 1 FROM payments."Payment" WHERE id = ${payment.id} FOR UPDATE`;
    const [refundSum, pendingManualSum] = await Promise.all([
      tx.refund.aggregate({
        where: { paymentId: payment.id, status: { not: "failed" } },
        _sum: { amount: true },
      }),
      tx.manualRefund.aggregate({
        where: { paymentId: payment.id, status: "pending" },
        _sum: { amount: true },
      }),
    ]);
    const alreadyCommitted = Number(refundSum._sum.amount ?? 0) + Number(pendingManualSum._sum.amount ?? 0);
    if (alreadyCommitted + opts.amount > Number(payment.chargedAmount ?? payment.amount)) {
      throw new RefundLimitExceededError();
    }

    const manual = await tx.manualRefund.create({
      data: {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        amount: opts.amount,
        currency: payment.currency,
        reason: opts.reason ?? null,
        idempotencyKey: opts.idempotencyKey,
      },
    });
    return { id: manual.id, status: manual.status };
  });
}

export interface IssueRefundOptions {
  amount: number;
  reason?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Issue a refund against an already-captured (or partially-refunded) payment.
 * Idempotent via `idempotencyKey`. Row-locks the payment to prevent
 * double-spending / over-refunding, then delegates to the provider
 * (Stripe refund / Tara reversal).
 *
 * Returns the created (or already-existing) refund record.
 */
export async function issueRefund(
  payment: {
    id: string;
    bookingId: string;
    paymentProvider: string;
    providerPaymentId: string | null;
    amount: unknown;
    currency: string;
    status: string;
    chargedAmount?: unknown;
    chargedCurrency?: string | null;
  },
  opts: IssueRefundOptions,
): Promise<{ id: string; status: string }> {
  const { amount, reason, idempotencyKey } = opts;

  if (amount <= 0) {
    throw new Error("Refund amount must be greater than zero.");
  }

  if (!["captured", "partially_refunded"].includes(payment.status)) {
    throw new InvalidPaymentStatusError(payment.status);
  }

  // Provider refunds are always in the platform charge currency (EUR for
  // Stripe, XAF for Tara), never the listing currency. Fall back to the raw
  // amount/currency only for payments without a recorded charge.
  const chargeCurrency = (payment.chargedCurrency ?? payment.currency).toUpperCase();
  const chargeAmount = Number(payment.chargedAmount ?? payment.amount);

  let refund: { id: string; status: string } | undefined;
  if (idempotencyKey) {
    const existingRefund = await prisma.refund.findUnique({ where: { idempotencyKey } });
    if (existingRefund) {
      if (existingRefund.status !== "failed") {
        return { id: existingRefund.id, status: existingRefund.status };
      }

      // A failed submission is retryable. Reuse the same refund row and the
      // same provider idempotency key so an ambiguous retry remains safe.
      refund = await prisma.refund.update({
        where: { id: existingRefund.id },
        data: { status: "pending", failureReason: null },
        select: { id: true, status: true },
      });
    }
  }

  // Atomically lock the payment row, check balance and create the refund record.
  try {
    if (!refund) {
      refund = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM payments."Payment" WHERE id = ${payment.id} FOR UPDATE`;

      const refundSum = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: { not: "failed" } },
        _sum: { amount: true },
      });
      const alreadyRefunded = Number(refundSum._sum.amount ?? 0);

      if (alreadyRefunded + amount > chargeAmount) {
        throw new RefundLimitExceededError();
      }

      return await tx.refund.create({
        data: {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          amount,
          currency: chargeCurrency,
          reason: reason ?? null,
          status: "pending",
          idempotencyKey: idempotencyKey ?? null,
        },
        });
      });
    }
  } catch (err) {
    if (err instanceof RefundLimitExceededError) {
      throw new RefundLimitExceededError();
    }
    throw err;
  }

  if (!refund) {
    throw new Error("Refund record was not created.");
  }

  // Provider-specific refund logic.
  switch (payment.paymentProvider) {
    case "stripe": {
      try {
        const re = await stripe.refunds.create(
          {
            payment_intent: payment.providerPaymentId ?? undefined,
            amount: toStripeAmount(amount, chargeCurrency),
            reason: "requested_by_customer",
          },
          { idempotencyKey: `stripe-refund-${refund.id}` }
        );

        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: "submitted", providerRefundId: re.id },
        });

        return { id: refund.id, status: "submitted" };
      } catch (stripeErr) {
        const message = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: "failed", failureReason: message },
        });
        throw new Error(`Failed to submit refund to Stripe: ${message}`);
      }
    }
    case "tara": {
      try {
        const reversal = await initiateTaraReversal({
          taraReference: payment.providerPaymentId ?? "",
          amount,
          reason: reason ?? "requested_by_customer",
        });

        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: "submitted", providerRefundId: reversal.reversalId },
        });

        return { id: refund.id, status: "submitted" };
      } catch (taraErr) {
        const message = taraErr instanceof Error ? taraErr.message : String(taraErr);
        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: "failed", failureReason: message },
        });
        throw new Error(`Failed to submit Tara reversal: ${message}`);
      }
    }
    default: {
      throw new Error(`Unsupported payment provider: ${payment.paymentProvider}`);
    }
  }
}

export interface BookingRefundPayload {
  refundId: string;
  refundAmount: number;
  provider: string;
  refundedAt: Date;
}

export async function notifyBookingServiceOfRefund(
  bookingId: string,
  payload: BookingRefundPayload
): Promise<void> {
  const url = `${BOOKING_SERVICE_URL}/bookings/internal/${bookingId}/refund`;
  console.log(`[refund-service] Sending notification to ${url} with refund amount ${payload.refundAmount}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-service-key": INTERNAL_SERVICE_KEY,
    },
    body: JSON.stringify({
      refundId: payload.refundId,
      refundAmount: payload.refundAmount,
      provider: payload.provider,
      refundedAt: payload.refundedAt.toISOString(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to notify booking service of refund: status ${response.status}. Response: ${errorText}`
    );
  }

  console.log(`[refund-service] Booking service notified successfully for booking ${bookingId}`);
}

export async function calculateAlreadyRefunded(paymentId: string): Promise<number> {
  const refundSum = await prisma.refund.aggregate({
    where: { paymentId, status: { not: "failed" } },
    _sum: { amount: true },
  });
  return Number(refundSum._sum.amount ?? 0);
}

export async function queueFailedRefundNotification(
  bookingId: string,
  refundId: string,
  amount: number,
  provider: string,
  refundedAt: Date
): Promise<void> {
  try {
    await prisma.refundNotificationRetry.upsert({
      where: { refundId },
      create: {
        refundId,
        bookingId,
        amount,
        provider,
        refundedAt,
        status: RefundRetryStatus.pending,
      },
      update: {
        status: RefundRetryStatus.pending,
        attempts: 0,
        nextAttempt: new Date(),
        failedAt: null,
      },
    });
    console.log(`[refund-retry] Queued failed refund notification for refund ${refundId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[refund-retry] Failed to queue refund notification retry for refund ${refundId}:`,
      message
    );
  }
}

export async function processFailedRefundNotifications(): Promise<void> {
  try {
    const now = new Date();
    // Fetch pending notifications due for attempt
    const retries = await prisma.refundNotificationRetry.findMany({
      where: {
        status: RefundRetryStatus.pending,
        OR: [
          { nextAttempt: null },
          { nextAttempt: { lte: now } },
        ],
      },
      take: 20, // process in small batches
    });

    if (retries.length === 0) return;

    for (const record of retries) {
      // Mark as processing
      await prisma.refundNotificationRetry.update({
        where: { id: record.id },
        data: { status: RefundRetryStatus.processing },
      });

      console.log(
        `[refund-retry-job] Retrying notification for refund ${record.refundId} (booking ${record.bookingId}), attempt ${record.attempts + 1}`
      );

      try {
        await notifyBookingServiceOfRefund(record.bookingId, {
          refundId: record.refundId,
          refundAmount: Number(record.amount),
          provider: record.provider,
          refundedAt: record.refundedAt,
        });

        // Mark completed on success
        await prisma.refundNotificationRetry.update({
          where: { id: record.id },
          data: {
            status: RefundRetryStatus.completed,
            attempts: record.attempts + 1,
            lastAttempt: new Date(),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const nextAttemptsCount = record.attempts + 1;
        if (nextAttemptsCount >= BACKOFF_DELAYS_MINUTES.length) {
          // Exceeded retry limit
          console.error(
            `[refund-retry-job] Refund ${record.refundId} notification failed permanently after ${nextAttemptsCount} attempts: ${message}`
          );
          await prisma.refundNotificationRetry.update({
            where: { id: record.id },
            data: {
              status: RefundRetryStatus.failed,
              attempts: nextAttemptsCount,
              lastAttempt: new Date(),
              failedAt: new Date(),
            },
          });
        } else {
          const delayMinutes = BACKOFF_DELAYS_MINUTES[record.attempts] || 360;
          const nextAttemptDate = new Date(Date.now() + delayMinutes * 60 * 1000);
          console.warn(
            `[refund-retry-job] Refund ${record.refundId} notification failed. Scheduling next attempt in ${delayMinutes} mins at ${nextAttemptDate.toISOString()}: ${message}`
          );
          await prisma.refundNotificationRetry.update({
            where: { id: record.id },
            data: {
              status: RefundRetryStatus.pending,
              attempts: nextAttemptsCount,
              lastAttempt: new Date(),
              nextAttempt: nextAttemptDate,
            },
          });
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[refund-retry-job] Error processing failed notifications:", message);
  }
}

// NOTE: runRefundNotificationRetryJob wrapper was removed — BullMQ handles
// deduplication. See jobs.ts for the worker that calls
// processFailedRefundNotifications directly.

/**
 * Classify a booking-confirmation failure as definitive (booking can never be
 * confirmed → the captured money must be refunded) vs transient (a provider
 * retry may still succeed). 4xx statuses and the tagged "unexpected status"
 * error are definitive; 5xx / network errors are transient.
 */
export function isDefinitiveConfirmError(err: any): boolean {
  if (err?.definitive === true) return true;
  const status = err?.statusCode ?? err?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

export interface ConfirmFailurePayment {
  id: string;
  bookingId: string;
  paymentProvider: string;
  providerPaymentId: string | null;
  amount: unknown;
  currency: string;
  status: string;
  chargedAmount?: unknown;
  chargedCurrency?: string | null;
}

/**
 * Handle a booking-confirmation failure after the payment was already captured.
 *
 * For definitive failures (booking cancelled / dates taken / grace expired /
 * unexpected status), issue a full refund of the captured amount, notify the
 * booking service and return true — the caller should stop provider retries.
 *
 * For transient failures (5xx / network), return false so the caller can
 * rethrow and let the provider retry the webhook.
 */
export async function handleConfirmFailure(
  payment: ConfirmFailurePayment,
  err: any,
  log?: { error: (obj: unknown, msg?: string) => void },
): Promise<boolean> {
  if (!isDefinitiveConfirmError(err)) {
    if (log) log.error({ err }, "[confirm-failure] Transient failure — provider will retry");
    return false;
  }

  const code = err?.code ?? err?.statusCode ?? "UNKNOWN";

  // A 409 INVALID_STATUS is ambiguous: the booking may have been confirmed by a
  // concurrent webhook (no refund needed) OR cancelled by the stale-payment
  // canceller (money captured with no confirmed booking → must refund).
  // Re-check the live booking status to decide before refunding.
  if (code === "INVALID_STATUS") {
    try {
      const bookingRes = await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/${payment.bookingId}`, {
        headers: { "Content-Type": "application/json", "x-service-key": INTERNAL_SERVICE_KEY },
      });
      if (bookingRes.ok) {
        const json = (await bookingRes.json()) as { data?: { status?: string } };
        const status = json?.data?.status;
        if (status && ["confirmed", "checked_in", "completed"].includes(status)) {
          if (log) log.error({ err }, "[confirm-failure] Booking already confirmed — no refund");
          return true;
        }
      }
    } catch {
      // fall through to refund on booking-service lookup failure
    }
  }

  // Refund the amount actually charged (platform currency — EUR for Stripe,
  // XAF for Tara). The booking service is notified with the listing-currency
  // total (payment.amount), since booking refundAmount is tracked in the
  // booking's own currency.
  const chargeAmount = Number(payment.chargedAmount ?? payment.amount);
  const listingAmount = Number(payment.amount);
  try {
    const refund = await issueRefund(payment, {
      amount: chargeAmount,
      reason: `Payment captured but booking could not be confirmed (${code})`,
      idempotencyKey: `refund:${payment.id}:confirm-failure`,
    });

    // Notify booking service with the proportional listing-currency amount.
    // For a full refund this equals payment.amount; for partial refunds,
    // scale proportionally by the ratio of charged to original amount.
    const ratio = chargeAmount > 0 && listingAmount > 0
      ? listingAmount / chargeAmount
      : 1;
    const refundListingAmount = Math.round(chargeAmount * ratio * 100) / 100;
    await notifyBookingServiceOfRefund(payment.bookingId, {
      refundId: refund.id,
      refundAmount: refundListingAmount,
      provider: payment.paymentProvider,
      refundedAt: new Date(),
    });
  } catch (refundErr: any) {
    if (log) {
      log.error(
        { err: refundErr },
        `[confirm-failure] Auto-refund failed for payment ${payment.id}: ${refundErr?.message ?? "unknown error"}`,
      );
    }
    // Best-effort: leave a trace so the payment is not silently stuck "captured".
    try {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { failureCode: `CONFIRM_FAILED_REFUND_ERROR_${code}` },
      });
    } catch {
      // non-fatal
    }
    // Keep the webhook retryable until the provider refund and booking-service
    // notification both succeed.
    return false;
  }

  return true;
}
