import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { uploadBuffer, getPublicUrl } from "../lib/s3.js";
import { money } from "./currency-format.js";
import os from "os";

const BOOKING_BASE_URL = process.env["BOOKING_PUBLIC_URL"] ?? "https://kainook.com/bookings";

export async function generateVoucherPDF(booking: any, invoice: any) {
  const fileName = `KAIN-${booking.code}.pdf`;
  const filePath = path.join(os.tmpdir(), fileName);

  const bookingUrl = `${BOOKING_BASE_URL}/${booking.code}`;
  const qrBuffer = await QRCode.toBuffer(bookingUrl, { width: 100, margin: 1 });

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Brand Palette
  const PRIMARY_COLOR = "#0c2614"; // Kainook forest green
  const ACCENT_COLOR = "#15803d";  // Confirmed green
  const TEXT_DARK = "#1e293b";     // Slate 800
  const TEXT_MUTED = "#64748b";    // Slate 500
  const BG_LIGHT = "#f8fafc";      // Slate 50
  const BORDER_COLOR = "#e2e8f0";  // Slate 200

  // ── HEADER ACCENT BAR ──────────────────────────────────────────────────
  doc.rect(0, 0, 595, 12).fill(PRIMARY_COLOR);

  let y = 35;

  // ── BRANDING ───────────────────────────────────────────────────────────
  const logoPath = path.join(process.cwd(), "assets", "kainook-logo.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, y, { width: 65 });
  } else {
    doc.font("Helvetica-Bold").fontSize(22).fillColor(PRIMARY_COLOR).text("Kainook", 40, y);
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("Travel. Discover. Experience.", 40, y + 24);
  }

  // ── DOCUMENT INFO (Right Aligned) ──────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(15).fillColor(TEXT_DARK).text("BOOKING VOUCHER", 320, y, { align: "right", width: 235 });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT_MUTED).text(`Reference: ${booking.code}`, 320, y + 18, { align: "right", width: 235 });
  doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(`Issued: ${new Date().toLocaleDateString("en-GB")}`, 320, y + 30, { align: "right", width: 235 });

  y = 95;
  // Thin Header Divider
  doc.strokeColor(BORDER_COLOR).lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke();
  y += 15;

  // ── OVERVIEW GRID (Two Columns) ─────────────────────────────────────────
  const col1X = 40;
  const col2X = 320;
  const colWidth = 235;

  // Left Column: Guest & Booking Details
  let leftY = y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(PRIMARY_COLOR).text("GUEST DETAILS", col1X, leftY);
  leftY += 16;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_DARK).text(booking.user.name, col1X, leftY);
  leftY += 14;
  doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(booking.user.email, col1X, leftY);
  leftY += 24;

  doc.font("Helvetica-Bold").fontSize(10).fillColor(PRIMARY_COLOR).text("BOOKING DETAILS", col1X, leftY);
  leftY += 16;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_DARK).text(booking.listing.title, col1X, leftY);
  leftY += 14;
  doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(`Check-in: ${booking.checkIn}`, col1X, leftY);
  leftY += 14;
  doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(`Check-out: ${booking.checkOut}`, col1X, leftY);

  // Right Column: Payment & Status info
  let rightY = y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(PRIMARY_COLOR).text("STATUS", col2X, rightY);
  rightY += 16;
  
  // Status Badge
  doc.save();
  doc.roundedRect(col2X, rightY, 78, 18, 3).fill(ACCENT_COLOR);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8).text("CONFIRMED", col2X, rightY + 5, { width: 78, align: "center" });
  doc.restore();
  rightY += 28;

  doc.font("Helvetica-Bold").fontSize(10).fillColor(PRIMARY_COLOR).text("PAYMENT INFORMATION", col2X, rightY);
  rightY += 16;
  doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(`Method: ${booking.paymentMethod ?? "Card"}`, col2X, rightY);
  rightY += 14;
  doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(`Status: Paid`, col2X, rightY);
  rightY += 14;
  doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(`Transaction ID: ${booking.transactionId ?? "N/A"}`, col2X, rightY);

  y = Math.max(leftY, rightY) + 30;

  // ── ITEMIZED RECEIPT TABLE ──────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(10).fillColor(PRIMARY_COLOR).text("ITEMIZED RECEIPT", col1X, y);
  y += 16;

  // Table Header Background
  doc.save();
  doc.rect(col1X, y, 515, 20).fill(BG_LIGHT);
  doc.fillColor(TEXT_DARK).font("Helvetica-Bold").fontSize(9);
  doc.text("Description", col1X + 8, y + 6);
  doc.text("Amount", col2X, y + 6, { width: colWidth, align: "right" });
  doc.restore();
  y += 20;

  const listingCurrency = invoice.listingCurrency ?? (booking.currency ?? "").toUpperCase();
  const platformCurrency = invoice.platform?.currency ?? listingCurrency;
  const platformAmount = invoice.platform?.amount ?? invoice.total;

  const lineItems = [
    { label: "Base Amount", value: invoice.baseAmount, currency: listingCurrency },
    { label: "Discount", value: -invoice.discount, currency: listingCurrency, isDiscount: true },
    { label: "Subtotal", value: invoice.subtotal, currency: listingCurrency },
    { label: "Service Fee", value: invoice.serviceFee, currency: listingCurrency },
    { label: "Tax", value: invoice.tax, currency: listingCurrency },
  ];

  if (invoice.securityDeposit && invoice.securityDeposit > 0) {
    lineItems.push({ label: "Security Deposit", value: invoice.securityDeposit, currency: listingCurrency });
  }

  // Draw Items
  lineItems.forEach((item) => {
    if (item.value === 0 && item.isDiscount) return; // Skip empty discounts

    doc.strokeColor(BORDER_COLOR).lineWidth(0.5).moveTo(col1X, y).lineTo(555, y).stroke();
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_DARK).text(item.label, col1X + 8, y + 6);
    
    // Value formatting
    let valStr = money(Math.abs(item.value), item.currency);
    if (item.isDiscount) valStr = `- ${valStr}`;
    const color = item.isDiscount ? "#dc2626" : TEXT_DARK;
    
    doc.font("Helvetica").fontSize(9).fillColor(color).text(valStr, col2X, y + 6, { width: colWidth, align: "right" });
    y += 20;
  });

  // Table Bottom Double Line
  doc.strokeColor(PRIMARY_COLOR).lineWidth(1.5).moveTo(col1X, y).lineTo(555, y).stroke();
  y += 8;

  // Total Paid Area
  doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT_DARK).text("TOTAL PAID", col1X + 8, y);
  
  const totalPaidStr = money(platformAmount, platformCurrency);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(PRIMARY_COLOR).text(totalPaidStr, col2X, y, { width: colWidth, align: "right" });
  y += 16;

  if (listingCurrency !== platformCurrency) {
    const exchangeStr = `~ ${money(invoice.total, listingCurrency)}`;
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(TEXT_MUTED).text(exchangeStr, col2X, y, { width: colWidth, align: "right" });
    y += 16;
  }

  y += 24;

  // ── CANCELLATION CALLOUT + QR CODE (Side-by-side grid) ───────────────────
  const calloutWidth = 360;
  
  // Draw Callout Box
  doc.save();
  doc.roundedRect(col1X, y, calloutWidth, 48, 4).fill(BG_LIGHT).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
  doc.fillColor(PRIMARY_COLOR).font("Helvetica-Bold").fontSize(8.5).text("CANCELLATION POLICY", col1X + 12, y + 8);
  doc.font("Helvetica").fontSize(8).fillColor(TEXT_MUTED).text("Free cancellation before 24 hours of check-in. Cancellations made within 24 hours are subject to standard host policies.", col1X + 12, y + 20, { width: calloutWidth - 24 });
  doc.restore();

  // Draw QR Code on the Right
  const qrX = 455;
  doc.image(qrBuffer, qrX, y - 8, { width: 75 });
  doc.font("Helvetica").fontSize(7.5).fillColor(TEXT_MUTED).text("Scan to verify booking", qrX - 5, y + 70, { width: 85, align: "center" });

  // ── FOOTER ─────────────────────────────────────────────────────────────
  const footerY = 745;
  doc.strokeColor(BORDER_COLOR).lineWidth(0.5).moveTo(col1X, footerY).lineTo(555, footerY).stroke();
  
  doc.font("Helvetica").fontSize(8.5).fillColor(TEXT_DARK).text("Thank you for booking with Kainook.", 40, footerY + 12, { align: "center", width: 515 });
  doc.font("Helvetica").fontSize(7.5).fillColor(TEXT_MUTED).text("For support, contact the host or email us at support@kainook.com.", 40, footerY + 24, { align: "center", width: 515 });

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
