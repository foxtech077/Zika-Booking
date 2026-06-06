import "dotenv/config";
import { PrismaClient } from "../src/generated/index.js";
import bcrypt from "bcryptjs";

const p = new PrismaClient();

// The specific user you are trying to log in as
// Change this to whatever email is failing for you
const TARGET_EMAIL = process.env["TARGET_EMAIL"] ?? "susmi.booking.dev01@gmail.com";

// The password you are trying to use in Swagger/Postman
const TEST_PASSWORD = process.env["TEST_PASSWORD"] ?? "Password@123";

async function main() {
  console.log("=".repeat(60));
  console.log("[PW-CHECK] Email:   ", TARGET_EMAIL);
  console.log("[PW-CHECK] Password:", TEST_PASSWORD);
  console.log("=".repeat(60));

  const user = await p.user.findUnique({ where: { email: TARGET_EMAIL } });

  if (!user) {
    console.log("[PW-CHECK] ❌ User NOT found in DB. Check email spelling.");
    return;
  }

  console.log("[PW-CHECK] ✅ User found:", {
    id: user.id,
    status: user.status,
    emailVerified: user.emailVerified,
    oauthProvider: user.oauthProvider,
    hasPasswordHash: user.passwordHash !== null,
  });

  if (!user.passwordHash) {
    console.log("[PW-CHECK] ❌ No passwordHash — this is an OAuth-only account.");
    console.log("[PW-CHECK]    You must log in via Google/Apple, not email+password.");
    return;
  }

  const hashPrefix = user.passwordHash.substring(0, 7);
  console.log("[PW-CHECK] Hash prefix:", hashPrefix);

  const match = await bcrypt.compare(TEST_PASSWORD, user.passwordHash);
  console.log("[PW-CHECK] bcrypt.compare result:", match ? "✅ MATCH — password is correct" : "❌ NO MATCH — wrong password");

  if (!match) {
    console.log("\n[PW-CHECK] The password you typed does not match the stored hash.");
    console.log("[PW-CHECK] Options:");
    console.log("  1. Use the correct password you registered with");
    console.log("  2. Run the reset-password script below to set a known password");
    console.log("\n  To reset, run:");
    console.log(`     TARGET_EMAIL="${TARGET_EMAIL}" NEW_PASSWORD="YourNew@Pass1" pnpm tsx scratch/reset-password.ts`);
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
