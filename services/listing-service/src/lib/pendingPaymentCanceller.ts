import { prisma } from "./prisma.js";

const CUTOFF_MS = 4 * 60 * 60 * 1000;

export async function cancelStalePendingPayments(): Promise<void> {
  const cutoff = new Date(Date.now() - CUTOFF_MS);

  try {
    const stale = await prisma.booking.findMany({
      where: {
        status: "pending_payment",
        createdAt: { lt: cutoff },
      },
      select: { id: true, reference: true, guestId: true, redeemPoints: true },
    });

    if (stale.length === 0) return;

    console.log(`[PendingPaymentCanceller] Found ${stale.length} stale pending_payment booking(s) — cancelling…`);

    for (const booking of stale) {
      try {
        await prisma.$transaction(async (tx) => {
          const fresh = await tx.booking.findUnique({
            where: { id: booking.id },
            select: { status: true },
          });
          if (!fresh || fresh.status !== "pending_payment") return;

          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "cancelled_by_system",
              cancellationReason: "Payment not completed within 4 hours.",
              cancelledAt: new Date(),
              cancelledBy: "system",
            },
          });

          await tx.bookingStatusLog.create({
            data: {
              bookingId: booking.id,
              fromStatus: "pending_payment",
              toStatus: "cancelled_by_system",
              actorType: "system",
              reason: "Payment timeout — no payment received within 4 hours.",
            },
          });

          const redeemedPoints = Number(booking.redeemPoints ?? 0);
          if (redeemedPoints > 0) {
            await tx.$executeRawUnsafe(
              `UPDATE auth."User" SET "loyaltyPoints" = "loyaltyPoints" + $1, "updatedAt" = NOW() WHERE id = $2`,
              redeemedPoints,
              booking.guestId,
            );
          }
        });

        console.log(`[PendingPaymentCanceller] Cancelled booking ${booking.id} (Ref: ${booking.reference})`);
      } catch (txErr: any) {
        console.error(`[PendingPaymentCanceller] Transaction failed for booking ${booking.id}:`, txErr.message);
      }
    }
  } catch (err: any) {
    console.error("[PendingPaymentCanceller] Error scanning for stale bookings:", err.message);
  }
}
