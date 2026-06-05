import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env["SENDGRID_API_KEY"] ?? "");

const FROM = {
  email: process.env["SENDGRID_FROM_EMAIL"] ?? "noreply@zikabooking.com",
  name: process.env["SENDGRID_FROM_NAME"] ?? "ZikaBooking",
};

const WEB = process.env["WEB_BASE_URL"] ?? "https://zikabooking.com";

// ── Retry logic (A3 in UC-1.1) ───────────────────────────────────────────────

async function sendWithRetry(
  msg: sgMail.MailDataRequired,
  attempt = 1,
): Promise<void> {
  try {
    await sgMail.send(msg);
  } catch (err) {
    if (attempt < 3) {
      const delay = attempt === 1 ? 5 * 60_000 : 30 * 60_000;
      setTimeout(() => void sendWithRetry(msg, attempt + 1), delay);
    } else {
      console.error("[Email] Failed after 3 attempts:", err);
    }
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  plainToken: string,
): Promise<void> {
  const link = `${WEB}/auth/verify?token=${plainToken}`;
  console.log("VERIFICATION LINK:", link);

  if (process.env["NODE_ENV"] !== "production") {
    console.log("\n" + "=".repeat(60));
    console.log("📧 [Email Sandbox] Verification Email Sent");
    console.log(`To: ${to}`);
    console.log(`Subject: Verify your ZikaBooking email`);
    console.log(`Verification Link: ${link}`);
    console.log("=".repeat(60) + "\n");
  }

  await sendWithRetry({
    to,
    from: FROM,
    subject: "Verify your ZikaBooking email",
    text: `Please verify your email by clicking the link below:\n\n${link}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Welcome to ZikaBooking!</h2>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a href="${link}"
             style="display:inline-block;padding:12px 24px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Verify Email Address
          </a>
        </p>
        <p style="color:#666;font-size:13px">This link expires in 24 hours. If you did not create a ZikaBooking account, please ignore this email.</p>
      </div>`,
  });
}

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: "Welcome to ZikaBooking!",
    text: `Hi ${firstName},\n\nWelcome to ZikaBooking! Your account is ready.\n\nHappy travels!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Welcome to ZikaBooking, ${firstName}!</h2>
        <p>Your account is active and ready to use. Start exploring hotels, apartments, and car rentals worldwide.</p>
      </div>`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  plainToken: string,
): Promise<void> {
  const link = `${WEB}/reset-password?token=${plainToken}`;
  await sendWithRetry({
    to,
    from: FROM,
    subject: "Reset your ZikaBooking password",
    text: `Reset your password by clicking the link below:\n\n${link}\n\nThis link expires in 1 hour. If you did not request a password reset, please ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Reset your password</h2>
        <p>We received a request to reset your ZikaBooking password.</p>
        <p>
          <a href="${link}"
             style="display:inline-block;padding:12px 24px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Set New Password
          </a>
        </p>
        <p style="color:#666;font-size:13px">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
      </div>`,
  });
}

export async function sendAccountSuspendedEmail(to: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: "Your ZikaBooking account has been suspended",
    text: "Your ZikaBooking account has been suspended. Please contact support@zikabooking.com for assistance.",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Account suspended</h2>
        <p>Your ZikaBooking account has been suspended.</p>
        <p>Please contact <a href="mailto:support@zikabooking.com">support@zikabooking.com</a> for assistance.</p>
      </div>`,
  });
}

export async function sendAccountReinstatedEmail(to: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: "Your ZikaBooking account has been reinstated",
    text: "Good news — your ZikaBooking account has been reinstated. You can sign in now.",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Account reinstated</h2>
        <p>Your ZikaBooking account has been reinstated. You can now sign in and continue using the platform.</p>
      </div>`,
  });
}
