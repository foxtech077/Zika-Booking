import { PrismaClient as PaymentPrisma } from "../services/payment-service/src/generated/index.js";

async function run() {
  const paymentPrisma = new PaymentPrisma();

  const targetBookingId = "5f19c1a1-c75c-4e87-89b9-67f167bc9ce5";

  console.log("Updating payments for booking " + targetBookingId + " from 'initiated' to 'failed'...");
  const result = await paymentPrisma.payment.updateMany({
    where: {
      bookingId: targetBookingId,
      status: "initiated"
    },
    data: {
      status: "failed",
      failureCode: "INITIATION_CRASHED",
      failureMessage: "Previous payment initiation crashed."
    }
  });
  console.log("Rows updated:", result.count);

  await paymentPrisma.$disconnect();
}

run().catch(console.error);
