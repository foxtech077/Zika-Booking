import "dotenv/config";
import { PrismaClient } from "../src/generated/index.js";
import bcrypt from "bcryptjs";

const p = new PrismaClient();

const TARGET_EMAIL = process.env["TARGET_EMAIL"] ?? "susmi.booking.dev01@gmail.com";
const NEW_PASSWORD = process.env["NEW_PASSWORD"] ?? "ZikaTest123!";

async function main() {
  console.log("[Reset] Setting new password for:", TARGET_EMAIL);

  const user = await p.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!user) {
    console.log("[Reset]  User not found:", TARGET_EMAIL);
    return;
  }

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);
  await p.user.update({
    where: { email: TARGET_EMAIL },
    data: { passwordHash, status: "active", emailVerified: true, emailVerifiedAt: new Date() },
  });

  console.log("[Reset]  Password reset for:", TARGET_EMAIL);
  console.log("[Reset] New password:", NEW_PASSWORD);
  console.log("[Reset] Status set to: active, emailVerified: true");
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
