import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { withRedisLock } from "../lib/redis.js";
import { RefundStatus, PayoutStatus } from "../generated/index.js";

export interface SchedulePayoutParams {
  bookingId: string;
  providerId: string;
  amount: number;
  currency: string;
  checkInAt: Date;
}

export async function schedulePayout(
  params: SchedulePayoutParams,
): Promise<void> {
  console.log("========== schedulePayout ENTER ==========");
  console.log(params);
  try {
    const { bookingId, providerId, amount, currency, checkInAt } = params;

    if (amount <= 0) return;
    console.log("[PAYOUT TRACE] amount validation passed");

    console.log("[PAYOUT TRACE] checking existing payout");
    const existing = await prisma.payout.findUnique({ where: { bookingId } });
    console.log("[PAYOUT TRACE] existing payout =", existing);
    if (existing) {
      console.log(
        `[payout] Payout already exists for booking ${bookingId} (status: ${existing.status})`,
      );
      return;
    }

    console.log("[PAYOUT TRACE] merchant upsert starting");
    const merchant = await prisma.merchant.upsert({
      where: { userId: providerId },
      create: { userId: providerId },
      update: {},
    });
    console.log("[PAYOUT TRACE] merchant =", merchant);

    // 24 hours after check-in
    const scheduledAt = new Date(checkInAt.getTime() + 24 * 60 * 60 * 1000);
    console.log("[PAYOUT TRACE] scheduledAt =", scheduledAt);

    console.log("[PAYOUT TRACE] creating payout row");
    await prisma.payout.create({
      data: {
        merchantId: merchant.id,
        bookingId,
        providerId,
        amount,
        currency,
        scheduledAt,
      },
    });
    console.log("[PAYOUT TRACE] payout row created successfully");

    console.log("[PAYOUT TRACE] running verify query");
    const verify = await prisma.payout.findUnique({
      where: { bookingId },
    });
    console.log("[PAYOUT TRACE] verify payout row =", verify);

    console.log(
      `[payout] Scheduled payout for booking ${bookingId} at ${scheduledAt.toISOString()} — amount: ${amount} ${currency}`,
    );
  } catch (err) {
    console.error("[PAYOUT TRACE] schedulePayout fatal error", err);
    throw err;
  }
}

export interface CreatePendingPayoutParams {
  bookingId: string;
  providerId: string;
  amount: number;
  currency: string;
}

export async function createPendingPayout(
  params: CreatePendingPayoutParams,
): Promise<void> {
  console.log("========== createPendingPayout ENTER ==========");
  console.log(params);
  try {
    const { bookingId, providerId, amount, currency } = params;

    if (amount <= 0) return;
    console.log("[PAYOUT TRACE] amount validation passed");

    console.log("[PAYOUT TRACE] checking existing payout");
    const existing = await prisma.payout.findUnique({ where: { bookingId } });
    console.log("[PAYOUT TRACE] existing payout =", existing);
    if (existing) {
      console.log(
        `[payout] Payout already exists for booking ${bookingId} (status: ${existing.status})`,
      );
      return;
    }

    console.log("[PAYOUT TRACE] merchant upsert starting");
    const merchant = await prisma.merchant.upsert({
      where: { userId: providerId },
      create: { userId: providerId },
      update: {},
    });
    console.log("[PAYOUT TRACE] merchant =", merchant);

    console.log("[PAYOUT TRACE] creating pending payout row");
    await prisma.payout.create({
      data: {
        merchantId: merchant.id,
        bookingId,
        providerId,
        amount,
        currency,
        status: "pending",
        scheduledAt: null,
        processedAt: null,
        providerPayoutId: null,
        failureReason: null,
      },
    });
    console.log("[PAYOUT TRACE] pending payout row created successfully");
  } catch (err) {
    console.error("[PAYOUT TRACE] createPendingPayout fatal error", err);
    throw err;
  }
}

export async function cancelPayout(bookingId: string): Promise<void> {
  await prisma.payout.updateMany({
    where: {
      bookingId,
      status: { in: ["pending", "scheduled"] },
    },
    data: {
      status: "cancelled",
      updatedAt: new Date(),
    },
  });
  console.log(`[payout] Cancelled payout for booking ${bookingId}`);
}

export async function processEligiblePayouts(): Promise<void> {
  const now = new Date();

  const eligible = await prisma.payout.findMany({
    where: {
      OR: [
        { status: "pending" },
        { status: "scheduled", scheduledAt: { lte: now } },
      ],
    },
    include: { merchant: true },
  });

  if (eligible.length === 0) return;

  console.log(`[payout-job] ${eligible.length} eligible payout(s) to process`);

  await Promise.allSettled(eligible.map(processSinglePayout));
}

async function processSinglePayout(payout: any): Promise<void> {
  const { merchant } = payout;

  if (!merchant.isActive) {
    console.log(
      `[payout-job] Payout ${payout.id}: merchant inactive, skipping`,
    );
    return;
  }

  // Optimistic lock — only proceed if we win the race from its original state (pending or scheduled)
  const claimed = await prisma.payout.updateMany({
    where: { id: payout.id, status: payout.status },
    data: { status: "processing", updatedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    // JIT Protection: Check if a successful refund exists for this booking
    const successfulRefund = await prisma.refund.findFirst({
      where: {
        bookingId: payout.bookingId,
        status: RefundStatus.succeeded,
      },
    });

    if (successfulRefund) {
      console.log(
        `[payout-job] Payout ${payout.id}: booking ${payout.bookingId} has a successful refund — aborting and cancelling payout`,
      );
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.cancelled,
          failureReason: `Booking has a successful refund (Refund ID: ${successfulRefund.id})`,
          updatedAt: new Date(),
        },
      });
      return;
    }
    if (!merchant.isVerified) {
      console.log(
        `[payout-job] Payout ${payout.id}: merchant not yet verified — reverting to ${payout.status}`,
      );
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: payout.status,
          failureReason: "Merchant is not verified",
          updatedAt: new Date(),
        },
      });
      return;
    }

    // JIT verification of booking status before executing payout transfer
    const bookingServiceUrl =
      process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
    const internalServiceKey = process.env["INTERNAL_SERVICE_KEY"] ?? "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let res;
    try {
      res = await fetch(
        `${bookingServiceUrl}/bookings/internal/${payout.bookingId}`,
        {
          headers: { "x-service-key": internalServiceKey },
          signal: controller.signal,
        },
      );
    } catch (fetchErr: any) {
      // Network/timeout error is transient: reset status back to payout.status so it is retried automatically
      const isTimeout = fetchErr.name === "AbortError";
      const errMsg = isTimeout
        ? "Request timed out after 10s"
        : fetchErr.message;
      console.error(
        `[payout-job] Transient network error fetching status for payout ${payout.id}:`,
        errMsg,
      );
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: payout.status,
          failureReason: `Transient error: ${errMsg}`,
          updatedAt: new Date(),
        },
      });
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      if (res.status === 404) {
        // Booking not found is a permanent issue
        console.error(
          `[payout-job] Permanent failure for payout ${payout.id}: Booking ${payout.bookingId} not found (404)`,
        );
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: "failed",
            failureReason: `Booking not found (404) during JIT verification`,
            updatedAt: new Date(),
          },
        });
        return;
      }
      // Server error (e.g. 500, 503) is transient: reset to payout.status for auto-retry
      console.error(
        `[payout-job] Transient server error from listing-service for payout ${payout.id}: status ${res.status}`,
      );
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: payout.status,
          failureReason: `Transient HTTP status: ${res.status}`,
          updatedAt: new Date(),
        },
      });
      return;
    }

    const json = (await res.json()) as any;
    const booking = json.data;

    if (!booking) {
      // Booking data empty is permanent
      console.error(
        `[payout-job] Permanent failure for payout ${payout.id}: Booking ${payout.bookingId} data empty`,
      );
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "failed",
          failureReason: `Booking data empty during JIT verification`,
          updatedAt: new Date(),
        },
      });
      return;
    }

    const cancelledStatuses = [
      "cancelled_by_guest",
      "cancelled_by_provider",
      "cancelled_by_system",
    ];
    if (cancelledStatuses.includes(booking.status)) {
      console.log(
        `[payout-job] Payout ${payout.id}: booking ${payout.bookingId} is cancelled (${booking.status}) — aborting and cancelling payout`,
      );
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "cancelled",
          failureReason: `Booking was cancelled (${booking.status})`,
          updatedAt: new Date(),
        },
      });
      return;
    }

    const isLegacy = payout.createdAt < new Date("2026-06-27T12:00:00.000Z");
    const allowedStatuses = isLegacy
      ? ["checked_in", "completed", "confirmed"]
      : ["completed"];

    if (allowedStatuses.includes(booking.status)) {
      if (booking.status === "completed") {
        if (!booking.completedAt) {
          console.warn(
            `[payout-job] Payout ${payout.id}: booking ${payout.bookingId} status is completed but completedAt is missing. Reverting to ${payout.status}`,
          );
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: payout.status,
              failureReason: "completedAt missing",
              updatedAt: new Date(),
            },
          });
          return;
        }

        const completedTime = Date.parse(booking.completedAt);
        if (isNaN(completedTime)) {
          console.warn(
            `[payout-job] Payout ${payout.id}: booking ${payout.bookingId} status is completed but completedAt is an invalid date string. Reverting to ${payout.status}`,
          );
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: payout.status,
              failureReason: "completedAt invalid format",
              updatedAt: new Date(),
            },
          });
          return;
        }

        if (completedTime > Date.now()) {
          console.warn(
            `[payout-job] Payout ${payout.id}: booking ${payout.bookingId} status is completed but completedAt (${booking.completedAt}) is in the future. Reverting to ${payout.status}`,
          );
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: payout.status,
              failureReason: "completedAt in future",
              updatedAt: new Date(),
            },
          });
          return;
        }

        // Verify that 24 hours have elapsed since completedAt (booking completion time)
        const delayMs = 24 * 60 * 60 * 1000;
        if (completedTime + delayMs > Date.now()) {
          console.log(
            `[payout-job] Payout ${payout.id}: booking ${payout.bookingId} is completed, but the 24-hour waiting period has not elapsed yet. Reverting to ${payout.status}`,
          );
          await prisma.payout.update({
            where: { id: payout.id },
            data: { status: payout.status, updatedAt: new Date() },
          });
          return;
        }
      }
      // Proceed to payout
    } else if (["confirmed", "checked_in"].includes(booking.status)) {
      console.log(
        `[payout-job] Payout ${payout.id}: booking ${payout.bookingId} is in status '${booking.status}' (not completed) — leaving ${payout.status}`,
      );
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: payout.status, updatedAt: new Date() },
      });
      return;
    } else {
      console.warn(
        `[payout-job] Unexpected booking status '${booking.status}' for payout ${payout.id} (booking: ${payout.bookingId}). Reverting to ${payout.status}.`,
      );
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: payout.status, updatedAt: new Date() },
      });
      return;
    }

    let providerPayoutId: string | undefined;

    if (
      merchant.payoutMethod === "stripe_connect" &&
      merchant.stripeConnectAccountId
    ) {
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(Number(payout.amount) * 100),
          currency: payout.currency.toLowerCase(),
          destination: merchant.stripeConnectAccountId,
          transfer_group: payout.bookingId,
          source_type: "card",
          metadata: { bookingId: payout.bookingId, payoutId: payout.id },
        },
        {
          idempotencyKey: `payout-transfer-${payout.id}-v${payout.retryCount}`,
        },
      );
      providerPayoutId = transfer.id;

      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "paid",
          processedAt: new Date(),
          providerPayoutId,
          failureReason: null,
          updatedAt: new Date(),
        },
      });

      // Dispatch payout_sent push/in-app notification
      await prisma
        .$executeRawUnsafe(
          `INSERT INTO auth."Notification" (id, "userId", type, title, body, data, "createdAt")
         VALUES (gen_random_uuid()::text, $1, 'payout_sent', $2, $3, $4::jsonb, NOW())`,
          payout.providerId,
          "Payout Disbursed! 💰",
          `Your payout of ${payout.amount} ${payout.currency} for booking ${payout.bookingId} has been successfully processed.`,
          JSON.stringify({
            bookingId: payout.bookingId,
            amount: Number(payout.amount),
            currency: payout.currency,
          }),
        )
        .catch((err: any) =>
          console.error(
            "[payout] Failed to insert payout notification:",
            err.message,
          ),
        );

      console.log(
        `[payout-job] Payout ${payout.id} paid via Stripe Transfer ${providerPayoutId}`,
      );
    } else if (merchant.payoutMethod === "mobile_money") {
      // Tara disbursement — held in processing for manual/future automation
      console.log(
        `[payout-job] Payout ${payout.id}: mobile_money queued for manual disbursement`,
      );
    } else {
      // bank_transfer or manual — admin processes offline
      console.log(
        `[payout-job] Payout ${payout.id}: queued for manual bank transfer`,
      );
    }
  } catch (err: any) {
    console.error(`[payout-job] Payout ${payout.id} failed:`, err.message);
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: "failed",
        failureReason: err.message,
        updatedAt: new Date(),
      },
    });
  }
}

const PAYOUT_LOCK_KEY = "cron:payout:running";
const PAYOUT_LOCK_TTL = 10 * 60; // 10 minutes — generous safety net

export async function runPayoutJob(): Promise<void> {
  await withRedisLock(PAYOUT_LOCK_KEY, PAYOUT_LOCK_TTL, async () => {
    console.log("[payout-job] Running (lock acquired)");
    await processEligiblePayouts();
  });
}
