import sgMail from "@sendgrid/mail";
import * as fs from "fs";
import * as path from "path";

// Manually parse root .env file
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf-8");
  envText.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  });
}

const rawKey = process.env["SENDGRID_API_KEY"] ?? "";
const cleanKey = rawKey.replace(/^["']|["']$/g, "");
sgMail.setApiKey(cleanKey);

const FROM = {
  email: process.env["SENDGRID_FROM_EMAIL"]?.replace(/^["']|["']$/g, "") ?? "noreply@kainook.com",
  name: process.env["SENDGRID_FROM_NAME"]?.replace(/^["']|["']$/g, "") ?? "Kainook",
};

const WEB = (process.env["WEB_BASE_URL"] ?? "https://kainook.com").trim().replace(/\/$/, "");
const LOGO_URL = (process.env["EMAIL_LOGO_URL"] ?? "https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo-v2.jpeg").trim();

const TEST_EMAIL = "susmimartina@gmail.com";
const FAKE_TOKEN = "test-logo-verification-token-123";
const link = `${WEB}/verify?token=${FAKE_TOKEN}`;

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

const htmlBody = emailLayout(`
        <h2 style="color:#15803d;margin-top:0">Welcome to Kainook!</h2>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a href="${link}"
             style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Verify Email Address
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 24 hours. If you did not create a Kainook account, please ignore this email.</p>`);

console.log("\n====== GENERATED HTML SNIPPET (logo img tag) ======");
const imgMatch = htmlBody.match(/<img[^>]+KAINOOK[^>]+>/);
console.log(imgMatch ? imgMatch[0] : "Logo img tag not found!");
console.log("\n====== LOGO URL ======");
console.log(LOGO_URL);
console.log("\n====== FROM ======");
console.log(JSON.stringify(FROM));
console.log("\n====== TO ======");
console.log(TEST_EMAIL);
console.log("====================================\n");

async function main() {
  try {
    console.log("Sending test verification email via SendGrid...");
    const [response] = await sgMail.send({
      to: TEST_EMAIL,
      from: FROM,
      subject: "[TEST] Verify your Kainook email — Logo Check",
      text: `Please verify your email by clicking the link below:\n\n${link}\n\nThis is a test email to verify logo rendering. Link is not real.`,
      html: htmlBody,
    });

    console.log(`✅ Email sent successfully!`);
    console.log(`   Status Code: ${response.statusCode}`);
    console.log(`   Message-ID: ${response.headers?.["x-message-id"] ?? "N/A"}`);
  } catch (err: any) {
    console.error("❌ SendGrid send failed:", err.message);
    if (err.response?.body) {
      console.error("SendGrid Error Body:", JSON.stringify(err.response.body, null, 2));
    }
    process.exit(1);
  }
}

main();
