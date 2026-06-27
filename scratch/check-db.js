import { PrismaClient as ListingPrisma } from "../services/listing-service/src/generated/index.js";
import { PrismaClient as PaymentPrisma } from "../services/payment-service/src/generated/index.js";

async function run() {
  const listingPrisma = new ListingPrisma();
  const paymentPrisma = new PaymentPrisma();

  const targetBookingId = "5f19c1a1-c75c-4e87-89b9-67f167bc9ce5";

  console.log("=== Querying Payments for booking " + targetBookingId + " ===");
  const payments = await paymentPrisma.payment.findMany({
    where: { bookingId: targetBookingId }
  });
  console.log(JSON.stringify(payments, null, 2));

  await listingPrisma.$disconnect();
  await paymentPrisma.$disconnect();
}

run().catch(console.error);
