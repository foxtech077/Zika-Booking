import { buildInvoice } from "../services/invoice.service";
import { generateVoucherPDF } from "../services/pdf.services";
import { sendGuestEmail } from "../services/email.services";
import { sendHostEmail } from "../services/hostemail.service";


const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";

async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string) {
  try {
    await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, paymentProvider }),
    });
  } catch (err) {
    console.error("[webhook] Failed to confirm booking", bookingId, err);
  }
}

export async function bookingConfirmedHandler(payment: any) {
    const bookingId = payment?.metadata?.bookingId;
  
    if (!bookingId) {
      throw new Error("Missing bookingId in payment metadata");
    }
  
    // 1. GET BOOKING
    const res = await fetch(
      `${BOOKING_SERVICE_URL}/bookings/${bookingId}`
    );
  
    if (!res.ok) {
      throw new Error(`Booking service failed: ${res.status}`);
    }
  
    const json = await res.json();
    const booking = json.data;
  
    if (!booking) {
      throw new Error("Booking not found");
    }
  
    // 2. INVOICE
    const invoice = buildInvoice(booking);
  
    // 3. PDF
    const voucher = await generateVoucherPDF(booking, invoice);
  
    // 4. EMAILS
    await sendGuestEmail(
      booking,
      invoice,
      voucher
    );
  
    await sendHostEmail(booking);
  
    // 5. CONFIRM BOOKING LAST (SAFE)
    await confirmBooking(bookingId, payment.id, "stripe");
  }