import sgMail from "@sendgrid/mail";

const rawKey = process.env["SENDGRID_API_KEY"] ?? "";
const cleanKey = rawKey.replace(/^["']|["']$/g, "");
sgMail.setApiKey(cleanKey);

const rawEmail = process.env["SENDGRID_FROM_EMAIL"] ?? "noreply@Kainook.com";
const cleanEmail = rawEmail.replace(/^["']|["']$/g, "");

const rawName = process.env["SENDGRID_FROM_NAME"] ?? "Kainook";
const cleanName = rawName.replace(/^["']|["']$/g, "");

const FROM = {
  email: cleanEmail,
  name: cleanName,
};

const WEB = (process.env["WEB_BASE_URL"] ?? "https://Kainook.com").trim().replace(/\/$/, "");
const LOGO_URL = (process.env["EMAIL_LOGO_URL"] ?? "https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo.png").trim();

function emailLayout(body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px 16px">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #e5e7eb;text-align:center">
          <img src="${LOGO_URL}" alt="Kainook" style="height:64px;width:auto" />
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

// ── Send logic ─────────────────────────────────────────────────────────────
async function sendEmail(msg: sgMail.MailDataRequired): Promise<void> {
  try {
    const response = await sgMail.send(msg);

    console.log("[SendGrid] Success");
    console.log("[SendGrid] Response:", response);

  } catch (err: any) {
    console.error("[Email] SendGrid send failed:", err);

    if (err.response) {
      console.log(
        "[SendGrid Error Body]",
        JSON.stringify(err.response.body, null, 2)
      );
    }

    throw err;
  }
}

async function sendWithRetry(msg: sgMail.MailDataRequired, attempt = 1): Promise<void> {
  const isProd = process.env["NODE_ENV"] === "production";

  if (isProd) {
    if (!cleanKey) {
      throw new Error("[Email] SENDGRID_API_KEY is not configured in the production environment.");
    }
  } else {
    // Sandbox mode for non-production environments
    console.log("\n" + "=".repeat(60));
    console.log("📧 [Email Sandbox] Email request prepared");
    console.log(`To: ${Array.isArray(msg.to) ? msg.to.join(", ") : msg.to}`);
    console.log(`Subject: ${msg.subject}`);
    console.log("=".repeat(60) + "\n");
    return;
  }

  try {
    await sendEmail(msg);
  } catch (err) {
    if (attempt < 3) {
      const delayMs = attempt === 1 ? 5 * 60_000 : 30 * 60_000;
      console.warn(`[Email] Send attempt ${attempt} failed. Retrying in ${delayMs / 60000} minute(s)...`, err);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await sendWithRetry(msg, attempt + 1);
      return;
    }

    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[Email] Failed after 3 attempts:", error);
    throw error;
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  plainToken: string,
): Promise<void> {
  const link = `${WEB}/verify?token=${plainToken}`;
  console.log("VERIFICATION LINK:", link);

  await sendWithRetry({
    to,
    from: FROM,
    subject: "Verify your Kainook email",
    text: `Please verify your email by clicking the link below:\n\n${link}\n\nThis link expires in 24 hours.`,
    html: emailLayout(`
        <h2 style="color:#15803d;margin-top:0">Welcome to Kainook!</h2>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a href="${link}"
             style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Verify Email Address
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 24 hours. If you did not create a Kainook account, please ignore this email.</p>`),
  });
}

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: "Welcome to Kainook!",
    text: `Hi ${firstName},\n\nWelcome to Kainook! Your account is ready.\n\nHappy travels!`,
    html: emailLayout(`
        <h2 style="color:#15803d;margin-top:0">Welcome to Kainook, ${firstName}!</h2>
        <p>Your account is active and ready to use. Start exploring hotels, apartments, and car rentals worldwide.</p>`),
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
    subject: "Reset your Kainook password",
    text: `Reset your password by clicking the link below:\n\n${link}\n\nThis link expires in 1 hour. If you did not request a password reset, please ignore this email.`,
    html: emailLayout(`
        <h2 style="color:#15803d;margin-top:0">Reset your password</h2>
        <p>We received a request to reset your Kainook password.</p>
        <p>
          <a href="${link}"
             style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Set New Password
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>`),
  });
}

export async function sendAccountSuspendedEmail(to: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: "Your Kainook account has been suspended",
    text: "Your Kainook account has been suspended. Please contact support@Kainook.com for assistance.",
    html: emailLayout(`
        <h2 style="color:#dc2626;margin-top:0">Account suspended</h2>
        <p>Your Kainook account has been suspended.</p>
        <p>Please contact <a href="mailto:support@Kainook.com" style="color:#16a34a">support@Kainook.com</a> for assistance.</p>`),
  });
}

export async function sendAccountReinstatedEmail(to: string): Promise<void> {
  await sendWithRetry({
    to,
    from: FROM,
    subject: "Your Kainook account has been reinstated",
    text: "Good news — your Kainook account has been reinstated. You can sign in now.",
    html: emailLayout(`
        <h2 style="color:#15803d;margin-top:0">Account reinstated</h2>
        <p>Your Kainook account has been reinstated. You can now sign in and continue using the platform.</p>`),
  });
}
