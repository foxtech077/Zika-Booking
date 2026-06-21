import { PrismaClient as ListingPrisma } from "./services/listing-service/src/generated/index.js";
import { PrismaClient as PaymentPrisma } from "./services/payment-service/src/generated/index.js";

async function run() {
  const listingPrisma = new ListingPrisma();
  const paymentPrisma = new PaymentPrisma();

  console.log("=== Querying Payment ===");
  const payments = await paymentPrisma.payment.findMany({
    where: { bookingId: "4db5d3e6-3af3-4d1b-aca6-cde8df7c0c77" }
  });
  console.log(JSON.stringify(payments, null, 2));

  console.log("\n=== Querying Booking ===");
  const booking = await listingPrisma.booking.findUnique({
    where: { id: "4db5d3e6-3af3-4d1b-aca6-cde8df7c0c77" }
  });
  console.log(JSON.stringify(booking, null, 2));

  console.log("\n=== Querying Booking Status Log ===");
  const statusLog = await listingPrisma.bookingStatusLog.findMany({
    where: { bookingId: "4db5d3e6-3af3-4d1b-aca6-cde8df7c0c77" },
    orderBy: { createdAt: "asc" }
  });
  console.log(JSON.stringify(statusLog, null, 2));

  await listingPrisma.$disconnect();
  await paymentPrisma.$disconnect();
}

run().catch(console.error);
