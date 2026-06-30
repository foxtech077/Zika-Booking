import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

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
          <p style="color:#6b7280;font-size:12px;margin:0">© ${new Date().getFullYear()} Kainook. Travel. Discover Experience.</p>
          <p style="color:#9ca3af;font-size:11px;margin:6px 0 0">If you did not request this email, you can safely ignore it.</p>
        </div>
      </div>
    </div>`;
}

export async function sendHostEmail(booking: any) {
  const hostEmail = booking.listing?.hostEmail;

  if (!hostEmail) {
    console.warn("[email] Host email missing. Skipping host email.");
    return;
  }

  const msg = {
    to: hostEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: process.env.SENDGRID_FROM_NAME ?? "Kainook",
    },
    subject: `New booking received — ${booking.code}`,
    html: emailLayout(`
      <h2 style="color:#15803d;margin-top:0">New Booking Received</h2>
      <p>You have a new booking on Kainook!</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Guest</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${booking.user.name}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Dates</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${booking.checkIn} – ${booking.checkOut}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280">Net Payout</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:bold">${booking.payoutAmount}</td></tr>
        <tr><td style="padding:8px;color:#6b7280">Payout Timeline</td><td style="padding:8px">T+24h after check-in</td></tr>
      </table>`)
  };

  console.log("[SendGrid] Sending host email with payload:", {
    to: msg.to,
    from: msg.from.email,
    subject: msg.subject
  });

  return sgMail.send(msg);
}