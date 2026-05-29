import { PrismaClient } from "../src/generated/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "devadmin@zika.com";
  const plainPassword = "AdminPassword123!";
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  console.log("Seeding dev admin user...");

  await prisma.adminUser.upsert({
    where: { email },
    update: {
      name: "Dev Admin",
      passwordHash,
      role: "super_admin",
      totpEnabled: false,
    },
    create: {
      name: "Dev Admin",
      email,
      passwordHash,
      role: "super_admin",
      totpEnabled: false,
    },
  });

  console.log("Dev admin user seeded successfully.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${plainPassword}`);
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });