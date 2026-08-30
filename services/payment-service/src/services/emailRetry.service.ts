import { sendGuestEmail, sendAdminAlert } from "./email.services.js";
import { sendHostEmail } from "./hostemail.service.js";
import { prisma } from "../lib/prisma.js";
import { prepareConfirmation } from "./confirmation.service.js";
import { enqueueEmailJob, type EmailKind } from "../lib/emailQueue.js";

/**
 * Deliver a single confirmation email (guest or host) for a captured payment.
 * Used by the BullMQ worker for durable retries, and is safe to call multiple
 * times (guarded by the per-email flags). Throws on failure so BullMQ applies
 * its exponential backoff and eventually surfaces a permanent failure.
 */
export async function processEmailJob({
  paymentId,
  kind,
}: {
  paymentId: string;
  kind: EmailKind;
}): Promise<void> {
  const dbPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!dbPayment) {
    console.warn(`[email-job] Payment ${paymentId} not found; skipping.`);
    return;
  }

  // Only captured payments warrant confirmation emails.
  if (dbPayment.status !== "captured") {
    console.log(`[email-job] Payment ${paymentId} status=${dbPayment.status}, not captured; skipping.`);
    return;
  }

  if (kind === "guest" && dbPayment.confirmationEmailsSent) return;
  if (kind === "host" && dbPayment.hostEmailSent) return;

  const { booking, invoice, voucher } = await prepareConfirmation(paymentId);

  try {
    if (kind === "guest") {
      await sendGuestEmail(booking, invoice, voucher, booking.manageToken);
      await prisma.payment.update({
        where: { id: paymentId },
        data: { confirmationEmailsSent: true },
      });
      console.log(`[email-job] Guest email sent for booking ${booking.code}`);
    } else {
      if (!booking.listing?.hostEmail) {
        // No provider address is a data problem, not a delivery problem — alert
        // and mark sent so the reconciliation sweep does not loop forever.
        console.warn(
          `[email-job] Host email missing for booking ${booking.code}; alerting admin and marking sent.`,
        );
        await sendAdminAlert(
          `Host email missing for booking ${booking.code}`,
          new Error("hostEmail empty"),
        );
        await prisma.payment.update({
          where: { id: paymentId },
          data: { hostEmailSent: true },
        });
        return;
      }
      await sendHostEmail(booking);
      await prisma.payment.update({
        where: { id: paymentId },
        data: { hostEmailSent: true },
      });
      console.log(`[email-job] Host email sent for booking ${booking.code}`);
    }
  } catch (err: any) {
    console.error(`[email-job] ${kind} email failed for payment ${paymentId}:`, err);
    throw err;
  }
}

/**
 * Backstop for any captured payment that is missing a guest or host
 * confirmation email (e.g. the original webhook run crashed, the in-memory
 * retry was lost on a restart, or the host email was skipped). Enqueues a
 * durable email job for each missing email. The deterministic job id makes
 * re-enqueues idempotent.
 */
export async function reconcileEmailDeliveries(): Promise<void> {
  let processed = 0;
  let cursor: string | undefined;

  do {
    const payments = await prisma.payment.findMany({
      where: {
        status: "captured",
        OR: [{ confirmationEmailsSent: false }, { hostEmailSent: false }],
      },
      select: { id: true, confirmationEmailsSent: true, hostEmailSent: true },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (payments.length === 0) break;
    const last = payments[payments.length - 1]!;
    cursor = last.id;

    for (const p of payments) {
      try {
        if (!p.confirmationEmailsSent) await enqueueEmailJob(p.id, "guest");
        if (!p.hostEmailSent) await enqueueEmailJob(p.id, "host");
      } catch (err) {
        console.error(`[email-reconcile] Failed to enqueue jobs for payment ${p.id}:`, err);
      }
    }

    processed += payments.length;
  } while (true);

  if (processed > 0) {
    console.log(`[email-reconcile] Enqueued email jobs for ${processed} payment(s).`);
  }
}
