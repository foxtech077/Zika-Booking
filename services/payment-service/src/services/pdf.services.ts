import PDFDocument from "pdfkit";
import fs from "fs";
import { uploadBuffer, cdnUrl } from "../lib/s3.js";

export async function generateVoucherPDF(booking: any, invoice: any) {
  const fileName = `ZikaBooking-${booking.code}.pdf`;
  const filePath = `/tmp/${fileName}`;

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // ── HEADER ────────────────────────────────────────────────────────────
  doc.fontSize(20).text("ZIKA BOOKING CONFIRMED", { align: "center" });
  doc.moveDown(2);

  // ── BOOKING DETAILS ───────────────────────────────────────────────────
  doc.fontSize(14).text("BOOKING DETAILS");
  doc.moveDown();
  doc.fontSize(12).text(`Booking Reference: ${booking.code}`);
  doc.text(`Guest: ${booking.user.name}`);
  doc.text(`Email: ${booking.user.email}`);
  doc.text(`Listing: ${booking.listing.title}`);
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

  // ── CANCELLATION POLICY ───────────────────────────────────────────────
  doc.fontSize(14).text("CANCELLATION POLICY");
  doc.moveDown();
  doc.fontSize(12).text("Free cancellation before 24 hours of check-in.");
  doc.moveDown(2);

  // ── FOOTER ────────────────────────────────────────────────────────────
  doc.fontSize(10).text("Thank you for booking with Zika.", { align: "center" });
  doc.end();

  // ── WAIT FOR PDF TO FINISH ────────────────────────────────────────────
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  // ── READ BUFFER BEFORE DELETING ───────────────────────────────────────
  const pdfBuffer = fs.readFileSync(filePath); //  read first

  // ── UPLOAD TO S3 ──────────────────────────────────────────────────────
  const s3Key = `vouchers/${booking.code}.pdf`; //  was missing!
  await uploadBuffer(s3Key, pdfBuffer, "application/pdf");
  const pdfUrl = cdnUrl(s3Key);

  // ── CLEAN TEMP FILE ───────────────────────────────────────────────────
  fs.unlinkSync(filePath); //  delete AFTER reading

  return { fileName, pdfUrl, pdfBuffer }; //  return buffer for email
}