import sgMail from "@sendgrid/mail";

const rawEmail = process.env["SENDGRID_FROM_EMAIL"] ?? "noreply@Kainook.com";
const FROM = rawEmail.replace(/^["']|["']$/g, "");
const WEB_BASE = process.env["WEB_BASE_URL"] ?? "http://localhost:3000";

const rawKey = process.env["SENDGRID_API_KEY"] ?? "";
const cleanKey = rawKey.replace(/^["']|["']$/g, "");
sgMail.setApiKey(cleanKey);

async function sendWithRetry(msg: sgMail.MailDataRequired, attempt = 1): Promise<void> {
  try {
    await sgMail.send(msg);
  } catch {
    if (attempt < 3) {
      const delay = attempt === 1 ? 5000 : 1800000;
      await new Promise((r) => setTimeout(r, delay));
      return sendWithRetry(msg, attempt + 1);
    }
  }
}

export async function sendListingActivatedEmail(
  to: string,
  listingName: string,
  category: "apartment" | "car" = "apartment",
): Promise<void> {
  const label = category === "car" ? "car rental" : "apartment";
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your ${label} "${listingName}" is now live on Kainook!`,
    html: `<p>Your ${label} listing <strong>${listingName}</strong> is now live on Kainook. Guests can find and book it right away.</p><p><a href="${WEB_BASE}/listings">View your listings</a></p>`,
  });
}

export async function sendListingSubmittedEmail(to: string, listingName: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your listing "${listingName}" is under review`,
    html: `<p>Thank you for submitting your listing. Our team will review it within 48 hours and notify you of the outcome.</p>`,
  });
}

export async function sendListingApprovedEmail(
  to: string,
  listingName: string,
  starRating: number,
  claimedRating: number | null,
): Promise<void> {
  const ratingNote =
    claimedRating && claimedRating !== starRating
      ? `<p>Note: Your self-assessed rating was ${claimedRating}★. Our admin team has assigned a verified rating of ${starRating}★ based on your submitted documentation.</p>`
      : "";
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your listing "${listingName}" has been approved!`,
    html: `<p>Great news! Your listing <strong>${listingName}</strong> has been approved and is now live on Kainook with a verified rating of ${starRating}★.</p>${ratingNote}<p><a href="${WEB_BASE}/listings">View your listings</a></p>`,
  });
}

export async function sendListingRejectedEmail(
  to: string,
  listingName: string,
  reasons: string[],
  note: string | null,
): Promise<void> {
  const reasonList = reasons.map((r) => `<li>${r}</li>`).join("");
  const noteSection = note ? `<p><strong>Additional notes from reviewer:</strong> ${note}</p>` : "";
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Action required — your listing "${listingName}" was not approved`,
    html: `<p>Unfortunately, your listing <strong>${listingName}</strong> could not be approved for the following reason(s):</p><ul>${reasonList}</ul>${noteSection}<p>Please address these issues and resubmit your listing. <a href="${WEB_BASE}/listings">Go to My Listings</a></p>`,
  });
}

export async function sendListingSuspendedEmail(to: string, listingName: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your listing "${listingName}" has been suspended`,
    html: `<p>Your listing <strong>${listingName}</strong> has been suspended by our team. Please contact support for more information.</p>`,
  });
}

export async function sendListingReinstatedEmail(to: string, listingName: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your listing "${listingName}" has been reinstated`,
    html: `<p>Good news! Your listing <strong>${listingName}</strong> has been reinstated and is now live on Kainook again.</p><p><a href="${WEB_BASE}/listings">View your listings</a></p>`,
  });
}

export async function sendStarRatingUpdatedEmail(
  to: string,
  listingName: string,
  oldRating: number,
  newRating: number,
  reason: string,
): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your listing "${listingName}" star rating has been updated`,
    html: `<p>The verified star rating for <strong>${listingName}</strong> has been updated from ${oldRating}★ to ${newRating}★.</p><p><strong>Reason:</strong> ${reason}</p>`,
  });
}

export async function sendBookingConfirmationEmail(
  to: string,
  guestName: string,
  opts: {
    reference: string;
    listingName: string;
    listingType: string;
    checkIn?: string;
    checkOut?: string;
    pickupDatetime?: string;
    returnDatetime?: string;
    nightsOrDays: number;
    totalAmount: number;
    currency: string;
  },
): Promise<void> {
  const isCar = opts.listingType === "car";
  const dateLabel = isCar
    ? `Pick-up: ${opts.pickupDatetime ? new Date(opts.pickupDatetime).toLocaleString("en-GB") : "—"}<br>Return: ${opts.returnDatetime ? new Date(opts.returnDatetime).toLocaleString("en-GB") : "—"}`
    : `Check-in: ${opts.checkIn ? new Date(opts.checkIn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}<br>Check-out: ${opts.checkOut ? new Date(opts.checkOut).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}<br>${opts.nightsOrDays} night${opts.nightsOrDays !== 1 ? "s" : ""}`;

  await sendWithRetry({
    to,
    from: FROM,
    subject: `Booking Confirmed — ${opts.reference}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a73e8">Your booking is confirmed!</h2>
        <p>Hi ${guestName},</p>
        <p>Great news — your booking at <strong>${opts.listingName}</strong> is confirmed.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Booking Reference</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;font-family:monospace">${opts.reference}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Property</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${opts.listingName}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Dates</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${dateLabel}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Total Paid</td><td style="padding:8px;font-weight:bold">${opts.currency} ${opts.totalAmount.toLocaleString()}</td></tr>
        </table>
        <p>You can view your booking details at any time in the Kainook app.</p>
        <p>Enjoy your stay!<br>The Kainook Team</p>
      </div>
    `,
  });
}

export async function sendBookingCancellationEmail(
  to: string,
  guestName: string,
  opts: {
    reference: string;
    listingName: string;
    refundAmount: number;
    currency: string;
  },
): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Booking Cancelled — ${opts.reference}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#dc2626">Booking Cancelled</h2>
        <p>Hi ${guestName},</p>
        <p>Your booking <strong style="font-family:monospace">${opts.reference}</strong> at <strong>${opts.listingName}</strong> has been cancelled.</p>
        ${opts.refundAmount > 0 ? `<p>A refund of <strong>${opts.currency} ${opts.refundAmount.toLocaleString()}</strong> will be processed within 5–10 business days.</p>` : "<p>No refund applies based on the cancellation policy.</p>"}
        <p>The Kainook Team</p>
      </div>
    `,
  });
}
