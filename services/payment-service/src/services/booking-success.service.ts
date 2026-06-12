import { buildInvoice } from "./invoice.service.js";
import { generateVoucherPDF } from "./pdf.services.js";
import { sendGuestEmail } from "./email.services.js";
import { sendHostEmail } from "./hostemail.service.js";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";

const BOOKING_SERVICE_URL =
  process.env.BOOKING_SERVICE_URL ?? "http://localhost:3003";

async function fetchPayment(paymentIntentId: string) {
  return await prisma.payment.findFirst({
    where: { providerPaymentId: paymentIntentId },
  });
}

async function fetchBookingFromService(bookingId: string) {
  const res = await fetch(
    `${BOOKING_SERVICE_URL}/guests/me/bookings/${bookingId}`
  );

  const json = await res.json();
  return json.data;
}

export async function processBookingSuccess(paymentIntentId: string) {
  // 1. FIND PAYMENT
  const payment = await fetchPayment(paymentIntentId);

  if (!payment) {
    console.log("Payment not found");
    return;
  }

  // 2. GET BOOKING
  const booking = await fetchBookingFromService(payment.bookingId);

  if (!booking) {
    console.log("Booking not found");
    return;
  }

  // 3. BUILD INVOICE
  const invoice = buildInvoice(booking);

  // 4. GENERATE PDF
  const pdfPath = await generateVoucherPDF(booking, invoice);

  // 5. SEND EMAILS
  await sendGuestEmail(booking, invoice, pdfPath);
  await sendHostEmail(booking);

  console.log("Booking success flow completed");
}