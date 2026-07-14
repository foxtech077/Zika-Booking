import { prisma } from "./prisma.js";

function getScheduledCheckoutTime(booking: any): Date | null {
  if (booking.listingType === "car") {
    return booking.returnDatetime ? new Date(booking.returnDatetime) : null;
  }

  if (!booking.checkOut) return null;
  const baseDate = new Date(booking.checkOut);
  const checkoutTimeStr = booking.listing?.checkoutTime ?? "11:00";
  const [hours, minutes] = checkoutTimeStr.split(":").map(Number);

  // Combine checkOut date and checkoutTime time in UTC
  const checkoutTime = new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hours || 0,
    minutes || 0,
    0,
    0
  ));
  return checkoutTime;
}

export async function completeEligibleBookings(): Promise<void> {
  const now = new Date();

  try {
    // Query all confirmed bookings including their associated listings
    const confirmedBookings = await prisma.booking.findMany({
      where: { status: "confirmed" },
      include: { listing: true },
    });

    for (const booking of confirmedBookings) {
      const scheduledCheckout = getScheduledCheckoutTime(booking);
      if (!scheduledCheckout || now < scheduledCheckout) continue;

      console.log(`[Booking Completion Scheduler] Booking ${booking.id} (Ref: ${booking.reference}) has reached its scheduled checkout time (${scheduledCheckout.toISOString()}). Automatically completing booking.`);

      try {
        await prisma.$transaction(async (tx) => {
          // Re-verify status under transaction lock
          const freshBooking = await tx.booking.findUnique({
            where: { id: booking.id },
          });

          if (!freshBooking || freshBooking.status !== "confirmed") {
            return;
          }

          // Update status and completedAt to the computed scheduled checkout time
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "completed",
              completedAt: scheduledCheckout,
            },
          });

          // Log the status change
          await tx.bookingStatusLog.create({
            data: {
              bookingId: booking.id,
              fromStatus: "confirmed",
              toStatus: "completed",
              actorType: "system",
              changedBy: "system_scheduler",
              reason: `Automatic checkout completed. Scheduled checkout time was ${scheduledCheckout.toISOString()}`,
            },
          });
        });
        console.log(`[Booking Completion Scheduler] Successfully completed booking ${booking.id}.`);
      } catch (txnErr: any) {
        console.error(`[Booking Completion Scheduler] Transaction failed for booking ${booking.id}:`, txnErr.message);
      }
    }
  } catch (err: any) {
    console.error("[Booking Completion Scheduler] Error running completion job:", err.message);
  }
}


