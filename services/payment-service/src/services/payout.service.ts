import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";

export interface SchedulePayoutParams {
  bookingId: string;
  providerId: string;
  amount: number;
  currency: string;
  checkInAt: Date;
}

export async function schedulePayout(params: SchedulePayoutParams): Promise<void> {
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
      console.log(`[payout] Payout already exists for booking ${bookingId} (status: ${existing.status})`);
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
      where: { bookingId }
    });
    console.log("[PAYOUT TRACE] verify payout row =", verify);

    console.log(`[payout] Scheduled payout for booking ${bookingId} at ${scheduledAt.toISOString()} — amount: ${amount} ${currency}`);
  } catch (err) {
    console.error("[PAYOUT TRACE] schedulePayout fatal error", err);
    throw err;
  }
}

export async function cancelPayout(bookingId: string): Promise<void> {
  await prisma.payout.updateMany({
    where: {
      bookingId,
      status: "scheduled",
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
    where: { status: "scheduled", scheduledAt: { lte: now } },
    include: { merchant: true },
  });

  if (eligible.length === 0) return;

  console.log(`[payout-job] ${eligible.length} eligible payout(s) to process`);

  await Promise.allSettled(eligible.map(processSinglePayout));
}

async function processSinglePayout(payout: any): Promise<void> {
  const { merchant } = payout;

  if (!merchant.isActive) {
    console.log(`[payout-job] Payout ${payout.id}: merchant inactive, skipping`);
    return;
  }

  // Optimistic lock — only proceed if we win the race from "scheduled"
  const claimed = await prisma.payout.updateMany({
    where: { id: payout.id, status: "scheduled" },
    data: { status: "processing", updatedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    if (!merchant.isVerified) {
      console.log(`[payout-job] Payout ${payout.id}: merchant not yet verified — reverting to scheduled`);
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "scheduled",
          failureReason: "Merchant is not verified",
          updatedAt: new Date(),
        },
      });
      return;
    }

    // JIT verification of booking status before executing payout transfer
    const bookingServiceUrl = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
    const internalServiceKey = process.env["INTERNAL_SERVICE_KEY"] ?? "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let res;
    try {
      res = await fetch(`${bookingServiceUrl}/bookings/internal/${payout.bookingId}`, {
        headers: { "x-service-key": internalServiceKey },
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      // Network/timeout error is transient: reset status back to scheduled so it is retried automatically
      const isTimeout = fetchErr.name === "AbortError";
      const errMsg = isTimeout ? "Request timed out after 10s" : fetchErr.message;
      console.error(`[payout-job] Transient network error fetching status for payout ${payout.id}:`, errMsg);
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "scheduled",
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
        console.error(`[payout-job] Permanent failure for payout ${payout.id}: Booking ${payout.bookingId} not found (404)`);
        await prisma.payout.update({
          where: { id: payout.id },
          data: { status: "failed", failureReason: `Booking not found (404) during JIT verification`, updatedAt: new Date() },
        });
        return;
      }
      // Server error (e.g. 500, 503) is transient: reset to scheduled for auto-retry
      console.error(`[payout-job] Transient server error from listing-service for payout ${payout.id}: status ${res.status}`);
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "scheduled",
          failureReason: `Transient HTTP status: ${res.status}`,
          updatedAt: new Date(),
        },
      });
      return;
    }

    const json = await res.json() as any;
    const booking = json.data;

    if (!booking) {
      // Booking data empty is permanent
      console.error(`[payout-job] Permanent failure for payout ${payout.id}: Booking ${payout.bookingId} data empty`);
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: "failed", failureReason: `Booking data empty during JIT verification`, updatedAt: new Date() },
      });
      return;
    }

    const cancelledStatuses = ["cancelled_by_guest", "cancelled_by_provider", "cancelled_by_system"];
    if (cancelledStatuses.includes(booking.status)) {
      console.log(`[payout-job] Payout ${payout.id}: booking ${payout.bookingId} is cancelled (${booking.status}) — aborting and cancelling payout`);
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: "cancelled", failureReason: `Booking was cancelled (${booking.status})`, updatedAt: new Date() },
      });
      return;
    }

    let providerPayoutId: string | undefined;

    if (merchant.payoutMethod === "stripe_connect" && merchant.stripeConnectAccountId) {
      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(payout.amount) * 100),
        currency: payout.currency.toLowerCase(),
        destination: merchant.stripeConnectAccountId,
        transfer_group: payout.bookingId,
        metadata: { bookingId: payout.bookingId, payoutId: payout.id },
      }, {
        idempotencyKey: `payout-transfer-${payout.id}`,
      });
      providerPayoutId = transfer.id;

      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: "paid", processedAt: new Date(), providerPayoutId, updatedAt: new Date() },
      });

      console.log(`[payout-job] Payout ${payout.id} paid via Stripe Transfer ${providerPayoutId}`);
    } else if (merchant.payoutMethod === "mobile_money") {
      // Tara disbursement — held in processing for manual/future automation
      console.log(`[payout-job] Payout ${payout.id}: mobile_money queued for manual disbursement`);
    } else {
      // bank_transfer or manual — admin processes offline
      console.log(`[payout-job] Payout ${payout.id}: queued for manual bank transfer`);
    }
  } catch (err: any) {
    console.error(`[payout-job] Payout ${payout.id} failed:`, err.message);
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: "failed", failureReason: err.message, updatedAt: new Date() },
    });
  }
}

export function startPayoutJob(intervalMs = 15 * 60 * 1000): NodeJS.Timeout {
  console.log(`[payout-job] Started — checking every ${intervalMs / 60_000} minute(s)`);

  // Run once immediately on startup, then on the interval
  void processEligiblePayouts().catch((err) =>
    console.error("[payout-job] Initial run failed:", err),
  );

  return setInterval(() => {
    void processEligiblePayouts().catch((err) =>
      console.error("[payout-job] Run failed:", err),
    );
  }, intervalMs);
}