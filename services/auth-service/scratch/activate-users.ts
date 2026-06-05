import "dotenv/config";
import { PrismaClient } from "../src/generated/index.js";

const p = new PrismaClient();

// Add the emails you want to activate here
const EMAILS_TO_ACTIVATE = [
  "susmi.booking.dev01@gmail.com",
  "john.doe@example.com",
  "johnn.doe@gmail.com",
  "hema.provider@example.com",
];

async function main() {
  console.log("[Activate] Activating", EMAILS_TO_ACTIVATE.length, "users...\n");

  for (const email of EMAILS_TO_ACTIVATE) {
    const user = await p.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`  ⚠️  NOT FOUND: ${email}`);
      continue;
    }

    if (user.status === "active" && user.emailVerified) {
      console.log(`  ✅ Already active: ${email}`);
      continue;
    }

    await p.user.update({
      where: { email },
      data: {
        status: "active",
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    console.log(`  ✅ Activated: ${email} (was: ${user.status})`);
  }

  console.log("\n[Activate] Done.");
}

main()
  .catch((e) => {
    console.error("[Activate] FATAL:", e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
