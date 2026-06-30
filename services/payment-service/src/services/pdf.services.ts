import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { uploadBuffer, cdnUrl } from "../lib/s3.js";
import os from "os";

const BOOKING_BASE_URL = process.env["BOOKING_PUBLIC_URL"] ?? "https://kainook.com/bookings";

export async function generateVoucherPDF(booking: any, invoice: any) {
  const fileName = `KAINOOK-${booking.code}.pdf`;
  const filePath = path.join(os.tmpdir(), fileName);

  // Generate QR code first so PDF writing can be fully synchronous
  const bookingUrl = `${BOOKING_BASE_URL}/${booking.code}`;
  const qrBuffer = await QRCode.toBuffer(bookingUrl, { width: 120, margin: 1 });

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // ── HEADER (Logo + Reference) ────────────────────────────────────────
  const logoPath = path.join(process.cwd(), "assets", "kainook-logo.png");

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 40, { width: 80 });
  } else {
    // fallback if logo file not present
    doc.fontSize(18).fillColor("#16a34a").text("Kainook", 40, 45);
  }

  doc.fontSize(20).fillColor("#000000").text("BOOKING VOUCHER", 0, 45, { align: "center" });
  doc.fontSize(12).text(`Reference: ${booking.code}`, 0, 70, { align: "center" });

  doc.moveDown(3);

  // ── CONFIRMED BADGE ───────────────────────────────────────────────────
  const badgeY = doc.y;
  doc.save();
  doc.roundedRect(40, badgeY, 100, 28, 4).fill("#22c55e");
  doc.fillColor("#ffffff").fontSize(12).text("CONFIRMED", 40, badgeY + 8, {
    width: 100,
    align: "center",
  });
  doc.restore();
  doc.fillColor("#000000");

  doc.y = badgeY + 28;
  doc.moveDown(2);

  // ── GUEST DETAILS ─────────────────────────────────────────────────────
  doc.fontSize(14).text("GUEST DETAILS");
  doc.moveDown();
  doc.fontSize(12).text(`Name: ${booking.user.name}`);
  doc.text(`Email: ${booking.user.email}`);
  doc.moveDown(2);

  // ── BOOKING DETAILS ───────────────────────────────────────────────────
  doc.fontSize(14).text("BOOKING DETAILS");
  doc.moveDown();
  doc.fontSize(12).text(`Listing: ${booking.listing.title}`);
  doc.text(`Check-in: ${booking.checkIn}`);
  doc.text(`Check-out: ${booking.checkOut}`);
  doc.moveDown(2);

  // ── ITEMIZED RECEIPT ──────────────────────────────────────────────────
  doc.fontSize(14).text("ITEMIZED RECEIPT");
  doc.moveDown();
  doc.fontSize(12).text(`Base Amount: ${invoice.baseAmount}`);
  doc.text(`Discount: ${invoice.discount}`);
  doc.text(`Subtotal: ${invoice.subtotal}`);
  doc.text(`Service Fee: ${invoice.serviceFee}`);
  doc.text(`Tax: ${invoice.tax}`);
  doc.moveDown();
  doc.fontSize(14).text(`TOTAL PAID: ${invoice.total}`);
  doc.moveDown(2);

  // ── PAYMENT INFORMATION ───────────────────────────────────────────────
  doc.fontSize(14).text("PAYMENT INFORMATION");
  doc.moveDown();
  doc.fontSize(12).text(`Transaction ID: ${booking.transactionId ?? "N/A"}`);
  doc.text(`Payment Method: ${booking.paymentMethod ?? "Card"}`);
  doc.text(`Status: Paid`);
  doc.moveDown(2);

  // ── CANCELLATION POLICY ───────────────────────────────────────────────
  doc.fontSize(14).text("CANCELLATION POLICY");
  doc.moveDown();
  doc.fontSize(12).text("Free cancellation before 24 hours of check-in.");
  doc.moveDown(2);

  // ── QR CODE ───────────────────────────────────────────────────────────
  const qrY = doc.y;
  doc.image(qrBuffer, 40, qrY, { width: 100 });
  doc.fontSize(10).text("Scan to view booking", 40, qrY + 105, { width: 100, align: "center" });

  doc.y = qrY + 130;
  doc.moveDown(2);

  // ── FOOTER ────────────────────────────────────────────────────────────
  doc.fontSize(10).text("Thank you for booking with Kainook.", { align: "center" });

  doc.end();

  // ── WAIT FOR PDF TO FINISH ────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  // ── READ BUFFER BEFORE DELETING ───────────────────────────────────────
  const pdfBuffer = fs.readFileSync(filePath);

  // ── UPLOAD TO S3 ──────────────────────────────────────────────────────
  const s3Key = `vouchers/${booking.code}.pdf`;
  await uploadBuffer(s3Key, pdfBuffer, "application/pdf");
  const pdfUrl = cdnUrl(s3Key);

  // ── CLEAN TEMP FILE ───────────────────────────────────────────────────
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("Failed to delete temp file:", err);
  }

  return { fileName, pdfUrl, pdfBuffer };
}