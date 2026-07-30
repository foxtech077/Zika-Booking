import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { uploadBuffer, getPublicUrl } from "../lib/s3.js";
import os from "os";

const BOOKING_BASE_URL = process.env["BOOKING_PUBLIC_URL"] ?? "https://kainook.com/bookings";

export async function generateVoucherPDF(booking: any, invoice: any) {
  const fileName = `KAIN-${booking.code}.pdf`;
  const filePath = path.join(os.tmpdir(), fileName);

  const bookingUrl = `${BOOKING_BASE_URL}/${booking.code}`;
  const qrBuffer = await QRCode.toBuffer(bookingUrl, { width: 120, margin: 1 });

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const W = 515;
  let y = 40;

  // ── HEADER ──────────────────────────────────────────────────────────────
  const logoPath = path.join(process.cwd(), "assets", "kainook-logo.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, y, { width: 80 });
  } else {
    doc.fontSize(18).fillColor("#16a34a").text("Kainook", 40, y);
  }

  doc.fontSize(20).fillColor("#000000").text("BOOKING VOUCHER", 0, 45, { align: "center" });
  doc.fontSize(12).text(`Reference: ${booking.code}`, 0, 70, { align: "center" });
  y = 95;

  // ── CONFIRMED BADGE ─────────────────────────────────────────────────────
  doc.save();
  doc.roundedRect(40, y, 100, 28, 4).fill("#22c55e");
  doc.fillColor("#ffffff").fontSize(12).text("CONFIRMED", 40, y + 8, { width: 100, align: "center" });
  doc.restore();
  doc.fillColor("#000000");
  y += 40;

  // ── GUEST DETAILS ───────────────────────────────────────────────────────
  doc.fontSize(14).text("GUEST DETAILS", 40, y); y += 18;
  doc.fontSize(12).text(`Name: ${booking.user.name}`, 40, y); y += 15;
  doc.text(`Email: ${booking.user.email}`, 40, y); y += 20;

  // ── BOOKING DETAILS ─────────────────────────────────────────────────────
  doc.fontSize(14).text("BOOKING DETAILS", 40, y); y += 18;
  doc.fontSize(12).text(`Listing: ${booking.listing.title}`, 40, y); y += 15;
  doc.text(`Check-in: ${booking.checkIn}`, 40, y); y += 15;
  doc.text(`Check-out: ${booking.checkOut}`, 40, y); y += 20;

  // ── ITEMIZED RECEIPT ────────────────────────────────────────────────────
  doc.fontSize(14).text("ITEMIZED RECEIPT", 40, y); y += 18;
  doc.fontSize(12).text(`Base Amount: ${invoice.baseAmount}`, 40, y); y += 15;
  doc.text(`Discount: ${invoice.discount}`, 40, y); y += 15;
  doc.text(`Subtotal: ${invoice.subtotal}`, 40, y); y += 15;
  doc.text(`Service Fee: ${invoice.serviceFee}`, 40, y); y += 15;
  doc.text(`Tax: ${invoice.tax}`, 40, y); y += 15;
  if (invoice.securityDeposit && invoice.securityDeposit > 0) {
    doc.text(`Security Deposit: ${invoice.securityDeposit}`, 40, y); y += 18;
  } else {
    y += 3;
  }
  doc.fontSize(14).text(`TOTAL PAID: ${invoice.total}`, 40, y); y += 24;

  // ── PAYMENT INFORMATION ─────────────────────────────────────────────────
  doc.fontSize(14).text("PAYMENT INFORMATION", 40, y); y += 18;
  doc.fontSize(12).text(`Transaction ID: ${booking.transactionId ?? "N/A"}`, 40, y); y += 15;
  doc.text(`Payment Method: ${booking.paymentMethod ?? "Card"}`, 40, y); y += 15;
  doc.text("Status: Paid", 40, y); y += 20;

  // ── CANCELLATION POLICY ─────────────────────────────────────────────────
  doc.fontSize(14).text("CANCELLATION POLICY", 40, y); y += 18;
  doc.fontSize(12).text("Free cancellation before 24 hours of check-in.", 40, y); y += 24;

  // ── QR CODE + FOOTER ────────────────────────────────────────────────────
  doc.image(qrBuffer, 40, y, { width: 100 });
  doc.fontSize(10).text("Scan to view booking", 40, y + 105, { width: 100, align: "center" });

  doc.fontSize(10).text("Thank you for booking with Kainook.", 300, y + 50, { width: 255, align: "center" });

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  const pdfBuffer = fs.readFileSync(filePath);

  const s3Key = `invoice/${booking.id}/KAIN-${booking.code}.pdf`;
  await uploadBuffer(s3Key, pdfBuffer, "application/pdf");
  const pdfUrl = await getPublicUrl(s3Key);

  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("Failed to delete temp file:", err);
  }

  return { fileName, pdfUrl, pdfBuffer };
}
