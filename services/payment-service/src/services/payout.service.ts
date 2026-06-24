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
  const { bookingId, providerId, amount, currency, checkInAt } = params;

  if (amount <= 0) return;

  const existing = await prisma.payout.findUnique({ where: { bookingId } });
  if (existing) {
    console.log(`[payout] Payout already exists for booking ${bookingId} (status: ${existing.status})`);
    return;
  }

  const merchant = await prisma.merchant.upsert({
    where: { userId: providerId },
    create: { userId: providerId },
    update: {},
  });

  // 24 hours after check-in
  const scheduledAt = new Date(checkInAt.getTime() + 24 * 60 * 60 * 1000);

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

  console.log(`[payout] Scheduled payout for booking ${bookingId} at ${scheduledAt.toISOString()} — amount: ${amount} ${currency}`);
}

export async function cancelPayout(bookingId: string): Promise<void> {
  await prisma.payout.updateMany({
    where: { bookingId, status: { in: ["scheduled", "processing"] } },
    data: { status: "cancelled", updatedAt: new Date() },
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
      // Leave in processing state for admin to handle after merchant verifies
      console.log(`[payout-job] Payout ${payout.id}: merchant not yet verified — held in processing`);
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
