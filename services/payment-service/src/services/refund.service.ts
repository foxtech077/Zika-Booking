import { prisma } from "../lib/prisma.js";
import { RefundRetryStatus } from "../generated/index.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

const BACKOFF_DELAYS_MINUTES = [1, 5, 15, 30, 60, 360]; // 1m, 5m, 15m, 30m, 1h, 6h

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
