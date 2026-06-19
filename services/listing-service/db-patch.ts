import { prisma } from "./src/lib/prisma.js";

async function main() {
  console.log("Adding column 'earned_points' to listing.bookings...");
  await prisma.$executeRawUnsafe('ALTER TABLE listing.bookings ADD COLUMN IF NOT EXISTS "earned_points" INTEGER NOT NULL DEFAULT 0;');
  console.log("Column added successfully!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
