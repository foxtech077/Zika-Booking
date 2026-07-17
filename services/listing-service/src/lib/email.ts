import sgMail from "@sendgrid/mail";

const rawEmail = process.env["SENDGRID_FROM_EMAIL"] ?? "noreply@Kainook.com";
const FROM = rawEmail.replace(/^["']|["']$/g, "");
const WEB_BASE = process.env["WEB_BASE_URL"] ?? "http://localhost:3000";

const rawKey = process.env["SENDGRID_API_KEY"] ?? "";
const cleanKey = rawKey.replace(/^["']|["']$/g, "");
sgMail.setApiKey(cleanKey);

const LOGO_URL = (process.env["EMAIL_LOGO_URL"] ?? "https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo.jpeg").trim();

function emailLayout(body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px 16px">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #e5e7eb;text-align:center">
          <img src="${LOGO_URL}" alt="KAINOOK" width="120" height="120" style="display:inline-block; max-width:100%; height:auto; border:0; outline:none; text-decoration:none;" />
        </div>
        <div style="padding:32px">
          ${body}
        </div>
        <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="color:#6b7280;font-size:12px;margin:0">© ${new Date().getFullYear()} Kainook. Travel. Discover. Experience.</p>
          <p style="color:#9ca3af;font-size:11px;margin:6px 0 0">If you did not request this email, you can safely ignore it.</p>
        </div>
      </div>
    </div>`;
}

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
    html: emailLayout(`<h2 style="color:#15803d;margin-top:0">Your listing is live!</h2><p>Your ${label} listing <strong>${listingName}</strong> is now live on Kainook. Guests can find and book it right away.</p><p><a href="${WEB_BASE}/listings" style="color:#16a34a">View your listings</a></p>`),
  });
}

export async function sendListingSubmittedEmail(to: string, listingName: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your listing "${listingName}" is under review`,
    html: emailLayout(`<h2 style="color:#15803d;margin-top:0">Listing under review</h2><p>Thank you for submitting <strong>${listingName}</strong>. Our team will review it within 48 hours and notify you of the outcome.</p>`),
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
    html: emailLayout(`<h2 style="color:#15803d;margin-top:0">Listing approved!</h2><p>Great news! Your listing <strong>${listingName}</strong> has been approved and is now live on Kainook with a verified rating of ${starRating}★.</p>${ratingNote}<p><a href="${WEB_BASE}/listings" style="color:#16a34a">View your listings</a></p>`),
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
    html: emailLayout(`<h2 style="color:#dc2626;margin-top:0">Action required</h2><p>Unfortunately, your listing <strong>${listingName}</strong> could not be approved for the following reason(s):</p><ul>${reasonList}</ul>${noteSection}<p>Please address these issues and resubmit your listing. <a href="${WEB_BASE}/listings" style="color:#16a34a">Go to My Listings</a></p>`),
  });
}

export async function sendListingSuspendedEmail(to: string, listingName: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your listing "${listingName}" has been suspended`,
    html: emailLayout(`<h2 style="color:#dc2626;margin-top:0">Listing suspended</h2><p>Your listing <strong>${listingName}</strong> has been suspended by our team. Please contact <a href="mailto:support@Kainook.com" style="color:#16a34a">support@Kainook.com</a> for more information.</p>`),
  });
}

export async function sendListingReinstatedEmail(to: string, listingName: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Your listing "${listingName}" has been reinstated`,
    html: emailLayout(`<h2 style="color:#15803d;margin-top:0">Listing reinstated</h2><p>Good news! Your listing <strong>${listingName}</strong> has been reinstated and is now live on Kainook again.</p><p><a href="${WEB_BASE}/listings" style="color:#16a34a">View your listings</a></p>`),
  });
}
// 1. Suspension Notice Email for Auto-Suspension
export async function sendListingAutoSuspendedEmail(
  to: string,
  listingName: string,
  reason: string,
): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Alert: Your listing "${listingName}" has been automatically suspended`,
    html: emailLayout(`
      <h2 style="color:#dc2626;margin-top:0">Listing Automatically Suspended</h2>
      <p>Your listing <strong>${listingName}</strong> has been automatically suspended by the system.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Our moderation team is currently reviewing your listing. You will receive an update on the outcome within 48 hours. No action is required from you at this time.</p>
      <p>If you have any questions, please reach out to <a href="mailto:support@Kainook.com" style="color:#16a34a">support@Kainook.com</a>.</p>
    `),
  });
}

// 2. Reactivation with Warning Email
export async function sendListingReinstatedWithWarningEmail(
  to: string,
  listingName: string,
  warningReason?: string,
): Promise<void> {
  const reasonText = warningReason ? `<p><strong>Warning Details:</strong> ${warningReason}</p>` : "";
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Important: Your listing "${listingName}" has been reinstated with a warning`,
    html: emailLayout(`
      <h2 style="color:#f97316;margin-top:0">Listing Reinstated with Warning</h2>
      <p>Your listing <strong>${listingName}</strong> has been reinstated and is now live on Kainook again.</p>
      <p>Please note that a warning has been issued regarding your listing:</p>
      ${reasonText}
      <p>Please review platform guidelines to ensure your listing remains compliant and avoid future suspensions.</p>
      <p><a href="${WEB_BASE}/listings" style="color:#16a34a">View your listings</a></p>
    `),
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
    html: emailLayout(`<h2 style="color:#15803d;margin-top:0">Star rating updated</h2><p>The verified star rating for <strong>${listingName}</strong> has been updated from ${oldRating}★ to ${newRating}★.</p><p><strong>Reason:</strong> ${reason}</p>`),
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
    nightlyRate: number;
    baseAmount: number;
    discount: number;
    serviceFee: number;
    taxAmount: number;
    deliveryFee: number;
    totalAmount: number;
    commissionRate: number;
    currency: string;
  },
): Promise<void> {
  const isCar = opts.listingType === "car";
  const unitLabel = isCar ? "day" : "night";
  const dateLabel = isCar
    ? `Pick-up: ${opts.pickupDatetime ? new Date(opts.pickupDatetime).toLocaleString("en-GB") : "—"}<br>Return: ${opts.returnDatetime ? new Date(opts.returnDatetime).toLocaleString("en-GB") : "—"}`
    : `Check-in: ${opts.checkIn ? new Date(opts.checkIn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}<br>Check-out: ${opts.checkOut ? new Date(opts.checkOut).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}`;
  const commissionPct = Math.round(opts.commissionRate * 100);
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  await sendWithRetry({
    to,
    from: FROM,
    subject: `Booking Confirmed — ${opts.reference}`,
    html: emailLayout(`
        <h2 style="color:#15803d;margin-top:0">Your booking is confirmed!</h2>
        <p>Hi ${guestName},</p>
        <p>Great news — your booking at <strong>${opts.listingName}</strong> is confirmed.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Booking Reference</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold;font-family:monospace">${opts.reference}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Property</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${opts.listingName}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Dates</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${dateLabel}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Duration</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${opts.nightsOrDays} ${unitLabel}${opts.nightsOrDays !== 1 ? "s" : ""}</td></tr>
        </table>

        <h3 style="color:#1e293b;font-size:14px;margin:20px 0 8px">Receipt</h3>
        <table style="width:100%;border-collapse:collapse;margin:8px 0">
          <tr><td style="padding:6px 8px;color:#6b7280">${opts.currency} ${fmt(opts.nightlyRate)} × ${opts.nightsOrDays} ${unitLabel}${opts.nightsOrDays !== 1 ? "s" : ""}</td><td style="padding:6px 8px;text-align:right">${opts.currency} ${fmt(opts.baseAmount)}</td></tr>
          ${opts.discount > 0 ? `<tr><td style="padding:6px 8px;color:#15803d">Discount</td><td style="padding:6px 8px;text-align:right;color:#15803d">−${opts.currency} ${fmt(opts.discount)}</td></tr>` : ''}
          <tr><td style="padding:6px 8px;border-top:1px solid #e5e7eb;color:#6b7280">Subtotal</td><td style="padding:6px 8px;border-top:1px solid #e5e7eb;text-align:right">${opts.currency} ${fmt(opts.baseAmount - opts.discount)}</td></tr>
          <tr><td style="padding:6px 8px;color:#6b7280">Service fee${commissionPct > 0 ? ` (${commissionPct}%)` : ''}</td><td style="padding:6px 8px;text-align:right">${opts.currency} ${fmt(opts.serviceFee)}</td></tr>
          ${opts.taxAmount > 0 ? `<tr><td style="padding:6px 8px;color:#6b7280">Taxes</td><td style="padding:6px 8px;text-align:right">${opts.currency} ${fmt(opts.taxAmount)}</td></tr>` : ''}
          ${opts.deliveryFee > 0 ? `<tr><td style="padding:6px 8px;color:#6b7280">Delivery fee</td><td style="padding:6px 8px;text-align:right">${opts.currency} ${fmt(opts.deliveryFee)}</td></tr>` : ''}
          <tr><td style="padding:8px;border-top:2px solid #1e293b;font-weight:bold;color:#1e293b">Total Paid</td><td style="padding:8px;border-top:2px solid #1e293b;font-weight:bold;text-align:right">${opts.currency} ${fmt(opts.totalAmount)}</td></tr>
        </table>
        <p>You can view your booking details at any time in the Kainook app.</p>
        <p>Enjoy your stay!<br>The Kainook Team</p>`),
  });
}

export async function sendCommissionRateChangeEmail(
  to: string,
  opts: {
    scope: string;
    oldRate: number;
    newRate: number;
    effectiveDate: string;
    reason: string;
  },
): Promise<void> {
  const oldPct = (opts.oldRate * 100).toFixed(2);
  const newPct = (opts.newRate * 100).toFixed(2);
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Important: Kainook commission rate update for ${opts.scope}`,
    html: emailLayout(`
        <h2 style="color:#15803d;margin-top:0">Commission Rate Update</h2>
        <p>We are writing to inform you of an upcoming change to the Kainook platform commission rate.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Market</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${opts.scope}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Current Rate</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${oldPct}%</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#15803d;font-weight:bold">New Rate</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">${newPct}%</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Effective Date</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${opts.effectiveDate}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Reason</td><td style="padding:8px">${opts.reason}</td></tr>
        </table>
        <p><strong>Note:</strong> This change applies to new bookings confirmed on or after ${opts.effectiveDate}. Your existing confirmed bookings are not affected.</p>
        <p><a href="${WEB_BASE}/dashboard/earnings" style="color:#16a34a">View your earnings dashboard</a></p>
        <p>The Kainook Team</p>`),
  });
}

export async function sendNewMessageEmail(
  to: string,
  recipientName: string,
  opts: { senderName: string; preview: string; conversationUrl: string },
): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `New message from ${opts.senderName} on Kainook`,
    html: emailLayout(`
        <h2 style="color:#0f3443;margin-top:0">You have a new message</h2>
        <p>Hi ${recipientName},</p>
        <p><strong>${opts.senderName}</strong> sent you a message:</p>
        <blockquote style="border-left:3px solid #16a34a;margin:0 0 16px;padding:8px 16px;color:#374151;font-style:italic">
          ${opts.preview}
        </blockquote>
        <a href="${opts.conversationUrl}"
           style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
          View Message
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">You are receiving this because you are not currently active in the conversation.</p>`),
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
    reason?: string;
  },
): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: `Booking Cancelled — ${opts.reference}`,
    html: emailLayout(`
        <h2 style="color:#dc2626;margin-top:0">Booking Cancelled</h2>
        <p>Hi ${guestName},</p>
        <p>Your booking <strong style="font-family:monospace">${opts.reference}</strong> at <strong>${opts.listingName}</strong> has been cancelled.</p>
        ${opts.reason ? `<p><strong>Reason:</strong> ${opts.reason}</p>` : ""}
        ${opts.refundAmount > 0 ? `<p>A refund of <strong>${opts.currency} ${opts.refundAmount.toLocaleString()}</strong> will be processed within 5–10 business days.</p>` : "<p>No refund applies based on the cancellation policy.</p>"}
        <p>The Kainook Team</p>`),
  });
}
