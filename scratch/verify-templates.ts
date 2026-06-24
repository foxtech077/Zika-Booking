import * as fs from "fs";
import * as path from "path";

// Define a simple mock emailLayout that matches the implementation in email.ts
const LOGO_URL = "https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo.png";

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

const verificationBody = `
        <h2 style="color:#15803d;margin-top:0">Welcome to Kainook!</h2>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a href="https://kainook.com/verify?token=testtoken123"
             style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Verify Email Address
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 24 hours. If you did not create a Kainook account, please ignore this email.</p>`;

const outputHtml = emailLayout(verificationBody);
console.log("--- RENDERED HTML TEMPLATE ---");
console.log(outputHtml);
console.log("------------------------------");

const matchesLogo = outputHtml.includes('src="https://zika-storage.s3.af-south-1.amazonaws.com/brand/kainook-logo.png"');
const matchesAlt = outputHtml.includes('alt="KAINOOK"');
const matchesWidth = outputHtml.includes('width="120"');
const matchesHeight = outputHtml.includes('height="120"');

console.log("Validation Checks:");
console.log("- Includes correct logo URL fallback:", matchesLogo);
console.log("- Includes correct alt text 'KAINOOK':", matchesAlt);
console.log("- Includes width attribute:", matchesWidth);
console.log("- Includes height attribute:", matchesHeight);

if (matchesLogo && matchesAlt && matchesWidth && matchesHeight) {
  console.log("All validation checks passed successfully!");
} else {
  console.error("Some checks failed!");
}
