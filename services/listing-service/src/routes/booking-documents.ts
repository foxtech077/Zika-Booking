import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, type ProviderRequest } from "../middleware/auth.js";
import { getRedis } from "../lib/redis.js";
import { uploadBuffer, createPresignedDownloadUrl } from "../lib/s3.js";

const CACHE_TTL_SECONDS = 30 * 24 * 3600; // 30 days
const PRESIGNED_URL_TTL = 3600;            // 1 hour

// ── PDF builder ───────────────────────────────────────────────────────────────

function buildVoucherPdf(booking: any, listingName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const isCar = booking.listingType === "car";
    const W = 495; // usable width

    // ── Header ────────────────────────────────────────────────────────────────
    doc.fontSize(22).font("Helvetica-Bold").fillColor("#1a73e8").text("Kainook", 50, 50);
    doc.fontSize(11).font("Helvetica").fillColor("#666666").text("Booking Voucher", 50, 78);
    doc.moveTo(50, 95).lineTo(545, 95).lineWidth(0.5).stroke("#cccccc");

    // ── Reference banner ──────────────────────────────────────────────────────
    doc.rect(50, 108, W, 44).fillColor("#f0f7ff").fill();
    doc.rect(50, 108, W, 44).lineWidth(1).strokeColor("#1a73e8").stroke();
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#1a73e8")
       .text(booking.reference, 62, 120);
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#16a34a")
       .text("CONFIRMED", 470, 124);

    // ── Guest details ─────────────────────────────────────────────────────────
    let y = 172;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#888888").text("GUEST", 50, y);
    y += 14;
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#111111")
       .text(`${booking.guestFirstName} ${booking.guestLastName}`, 50, y);
    y += 18;
    doc.fontSize(10).font("Helvetica").fillColor("#555555").text(booking.guestEmail, 50, y);
    if (booking.guestPhone) {
      y += 15;
      doc.text(booking.guestPhone, 50, y);
    }

    // ── Listing details ───────────────────────────────────────────────────────
    y += 28;
    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke("#eeeeee");
    y += 12;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#888888").text("PROPERTY", 50, y);
    y += 14;
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#111111").text(listingName, 50, y);
    y += 18;
    const typeLabel = isCar ? "Car Rental"
      : booking.listingType === "hotel" ? "Hotel"
      : "Apartment";
    doc.fontSize(10).font("Helvetica").fillColor("#555555").text(typeLabel, 50, y);

    // ── Dates ─────────────────────────────────────────────────────────────────
    y += 28;
    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke("#eeeeee");
    y += 12;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#888888").text("DATES", 50, y);
    y += 14;
    doc.fontSize(11).font("Helvetica").fillColor("#111111");

    const fmtDate = (d: string | Date) =>
      new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const fmtDateTime = (d: string | Date) =>
      new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    if (isCar) {
      doc.text(`Pick-up:   ${fmtDateTime(booking.pickupDatetime)}`, 50, y); y += 18;
      doc.text(`Return:    ${fmtDateTime(booking.returnDatetime)}`, 50, y); y += 18;
    } else {
      doc.text(`Check-in:  ${fmtDate(booking.checkIn)}`, 50, y); y += 18;
      doc.text(`Check-out: ${fmtDate(booking.checkOut)}`, 50, y); y += 18;
    }
    doc.fontSize(10).fillColor("#777777")
       .text(`Duration: ${booking.nightsOrDays} ${isCar ? "day" : "night"}${booking.nightsOrDays !== 1 ? "s" : ""}`, 50, y);

    // ── Pricing ───────────────────────────────────────────────────────────────
    y += 28;
    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke("#eeeeee");
    y += 12;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#888888").text("PRICING SUMMARY", 50, y);
    y += 16;

    const printLine = (label: string, amount: number, bold = false) => {
      const isNeg = amount < 0;
      const amtStr = `${booking.currency} ${Math.abs(amount).toFixed(2)}`;
      doc.fontSize(11)
         .font(bold ? "Helvetica-Bold" : "Helvetica")
         .fillColor(isNeg ? "#16a34a" : "#111111")
         .text(label, 50, y)
         .text(isNeg ? `-${amtStr}` : amtStr, 380, y, { width: 165, align: "right" });
      y += 19;
    };

    if (isCar) {
      printLine(`Daily rate × ${booking.nightsOrDays} days`, Number(booking.subtotal));
      if (Number(booking.deliveryFee) > 0) printLine("Delivery fee", Number(booking.deliveryFee));
    } else {
      printLine(`Nightly rate × ${booking.nightsOrDays} nights`, Number(booking.subtotal));
      if (Number(booking.discountAmount) > 0) printLine("Long-stay discount", -Number(booking.discountAmount));
    }
    if (Number(booking.voucherDiscount) > 0) {
      printLine(`Voucher (${booking.voucherCode ?? ""})`, -Number(booking.voucherDiscount));
    }

    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke("#bbbbbb");
    y += 8;
    printLine("TOTAL", Number(booking.totalAmount), true);

    // ── Footer ────────────────────────────────────────────────────────────────
    y += 20;
    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke("#eeeeee");
    y += 12;
    const confirmedStr = booking.confirmedAt
      ? fmtDateTime(booking.confirmedAt)
      : "—";
    doc.fontSize(9).font("Helvetica").fillColor("#999999")
       .text(`Confirmed: ${confirmedStr}`, 50, y);
    y += 14;
    doc.text("Thank you for booking with Kainook!", 50, y);

    doc.end();
  });
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function bookingDocumentRoutes(app: FastifyInstance) {
  const redis = getRedis();

  const errSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      error: {
        type: "object",
        properties: { code: { type: "string" }, message: { type: "string" } },
        required: ["code", "message"],
      },
    },
    required: ["success", "error"],
  };

  // ── GET /guests/me/bookings/:id/receipt ───────────────────────────────────
  app.get(
    "/guests/me/bookings/:id/receipt",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Get structured receipt data for a confirmed booking",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  receiptNumber:    { type: "string" },
                  bookingReference: { type: "string" },
                  bookingId:        { type: "string" },
                  issuedAt:         { type: "string" },
                  status:           { type: "string" },
                  guest: {
                    type: "object",
                    properties: {
                      name:  { type: "string" },
                      email: { type: "string" },
                      phone: { type: "string", nullable: true },
                    },
                    required: ["name", "email"],
                  },
                  listing: {
                    type: "object",
                    properties: {
                      id:      { type: "string" },
                      title:   { type: "string", nullable: true },
                      type:    { type: "string" },
                      address: { type: "string", nullable: true },
                      town:    { type: "string", nullable: true },
                      neighborhood: { type: "string", nullable: true },
                      country: { type: "string", nullable: true },
                    },
                    required: ["id", "type"],
                  },
                  period: {
                    type: "object",
                    properties: {
                      checkIn:        { type: "string", nullable: true },
                      checkOut:       { type: "string", nullable: true },
                      pickupDatetime: { type: "string", nullable: true },
                      returnDatetime: { type: "string", nullable: true },
                      nightsOrDays:   { type: "integer" },
                    },
                    required: ["nightsOrDays"],
                  },
                  lineItems: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label:  { type: "string" },
                        amount: { type: "number" },
                        type:   { type: "string" },
                      },
                      required: ["label", "amount", "type"],
                    },
                  },
                  totals: {
                    type: "object",
                    properties: {
                      subtotal:        { type: "number" },
                      discountAmount:  { type: "number" },
                      deliveryFee:     { type: "number" },
                      voucherDiscount: { type: "number" },
                      total:           { type: "number" },
                      currency:        { type: "string" },
                    },
                    required: ["subtotal", "discountAmount", "deliveryFee", "voucherDiscount", "total", "currency"],
                  },
                  payment: {
                    type: "object",
                    properties: {
                      paymentId:   { type: "string", nullable: true },
                      confirmedAt: { type: "string", nullable: true },
                    },
                  },
                },
                required: ["receiptNumber", "bookingReference", "bookingId", "issuedAt", "status", "guest", "listing", "period", "lineItems", "totals", "payment"],
              },
            },
          },
          403: errSchema,
          404: errSchema,
          409: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
      const { id } = req.params as { id: string };

      try {
        const booking = await prisma.booking.findUnique({
          where: { id },
          include: {
            listing: {
              select: { id: true, name: true, address: true, town: true, neighborhood: true, country: true },
            },
          },
        });

        if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
        if (booking.guestId !== guestId)
          return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");
        if (booking.status !== "confirmed")
          return sendError(reply, 409, "NOT_CONFIRMED", "Receipt is only available for confirmed bookings.");

        const isCar = booking.listingType === "car";
        const snapshot = (booking as any).priceBreakdownJson;
        const snap = snapshot?.breakdown;
        // Prefer the stored price snapshot (matches the moment of booking); fall
        // back to live columns for older bookings that predate the snapshot.
        const fromSnap = (key: string, fallback: unknown) =>
          snap && snap[key] != null ? Number(snap[key]) : Number(fallback ?? 0);

        const lineItems: { label: string; amount: number; type: string }[] = [];

        if (isCar) {
          lineItems.push({ label: `Daily rate × ${booking.nightsOrDays} days`, amount: fromSnap("subtotal", booking.subtotal), type: "subtotal" });
          if (fromSnap("deliveryFee", booking.deliveryFee) > 0)
            lineItems.push({ label: "Delivery fee", amount: fromSnap("deliveryFee", booking.deliveryFee), type: "fee" });
          if (fromSnap("securityDeposit", booking.securityDeposit ?? 0) > 0)
            lineItems.push({ label: "Security deposit", amount: fromSnap("securityDeposit", booking.securityDeposit ?? 0), type: "deposit" });
        } else {
          lineItems.push({ label: `Nightly rate × ${booking.nightsOrDays} nights`, amount: fromSnap("subtotal", booking.subtotal), type: "subtotal" });
          if (fromSnap("discountAmount", booking.discountAmount) > 0)
            lineItems.push({ label: "Long-stay discount", amount: -fromSnap("discountAmount", booking.discountAmount), type: "discount" });
        }
        if (fromSnap("voucherDiscount", booking.voucherDiscount) > 0) {
          lineItems.push({
            label: `Voucher (${booking.voucherCode ?? ""})`,
            amount: -fromSnap("voucherDiscount", booking.voucherDiscount),
            type: "voucher",
          });
        }

        return sendSuccess(reply, 200, {
          receiptNumber:    `RCP-${booking.reference}`,
          bookingReference: booking.reference,
          bookingId:        booking.id,
          issuedAt:         (booking.confirmedAt ?? booking.createdAt).toISOString(),
          status:           booking.status,
          guest: {
            name:  `${booking.guestFirstName} ${booking.guestLastName}`,
            email: booking.guestEmail,
            phone: booking.guestPhone ?? null,
          },
          listing: {
            id:      booking.listing.id,
            title:   booking.listing.name ?? null,
            type:    booking.listingType,
            address: booking.listing.address ?? null,
            town:    booking.listing.town ?? null,
            neighborhood: booking.listing.neighborhood ?? null,
            country: booking.listing.country ?? null,
          },
          period: {
            checkIn:        booking.checkIn?.toISOString().slice(0, 10) ?? null,
            checkOut:       booking.checkOut?.toISOString().slice(0, 10) ?? null,
            pickupDatetime: booking.pickupDatetime?.toISOString() ?? null,
            returnDatetime: booking.returnDatetime?.toISOString() ?? null,
            nightsOrDays:   booking.nightsOrDays,
          },
          lineItems,
          totals: {
            subtotal:        fromSnap("subtotal", booking.subtotal),
            discountAmount:  fromSnap("discountAmount", booking.discountAmount),
            deliveryFee:     fromSnap("deliveryFee", booking.deliveryFee),
            voucherDiscount: fromSnap("voucherDiscount", booking.voucherDiscount),
            securityDeposit: fromSnap("securityDeposit", booking.securityDeposit ?? 0),
            total:           fromSnap("totalAmount", booking.totalAmount),
            currency:        booking.currency,
            ...(snap
              ? {
                  localizedCurrency: snapshot.localizedCurrency ?? null,
                  localized: Object.fromEntries(
                    Object.entries(snapshot ?? {}).filter(([k]) => k.startsWith("localized"))
                  ),
                  eur: snapshot.eur ?? null,
                }
              : {}),
          },
          payment: {
            paymentId:   booking.paymentId ?? null,
            confirmedAt: booking.confirmedAt?.toISOString() ?? null,
          },
        });
      } catch (err) {
        req.log.error({ err }, "Failed to generate receipt for booking");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while generating the receipt.");
      }
    },
  );

  // ── GET /guests/me/bookings/:id/voucher-pdf ───────────────────────────────
  app.get(
    "/guests/me/bookings/:id/voucher-pdf",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Generate or retrieve a presigned download URL for the booking voucher PDF",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  voucherPdfUrl: { type: "string", description: "Presigned S3 URL, valid for 1 hour" },
                  expiresAt:     { type: "string" },
                },
                required: ["voucherPdfUrl", "expiresAt"],
              },
            },
          },
          403: errSchema,
          404: errSchema,
          409: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
      const { id } = req.params as { id: string };

      try {
        const booking = await prisma.booking.findUnique({
          where: { id },
          include: { listing: { select: { name: true } } },
        });

        if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
        if (booking.guestId !== guestId)
          return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");
        if (booking.status !== "confirmed")
          return sendError(reply, 409, "NOT_CONFIRMED", "Voucher PDF is only available for confirmed bookings.");

        const s3Key    = `bookings/${id}/voucher.pdf`;
        const cacheKey = `bkdoc:pdf:${id}`;

        // Generate and upload only once; presign freshly every request
        let cached: string | null = null;
        try {
          cached = await redis.get(cacheKey);
        } catch (redisErr) {
          req.log.warn({ err: redisErr }, "Redis cache read failed for booking voucher PDF");
        }

        if (!cached) {
          const pdfBuffer = await buildVoucherPdf(booking, booking.listing.name ?? "Your Listing");
          await uploadBuffer(s3Key, pdfBuffer, "application/pdf");
          try {
            await redis.set(cacheKey, "1", "EX", CACHE_TTL_SECONDS);
          } catch (redisErr) {
            req.log.warn({ err: redisErr }, "Redis cache write failed for booking voucher PDF");
          }
        }

        const voucherPdfUrl = await createPresignedDownloadUrl(s3Key, PRESIGNED_URL_TTL);
        const expiresAt     = new Date(Date.now() + PRESIGNED_URL_TTL * 1000).toISOString();

        return sendSuccess(reply, 200, { voucherPdfUrl, expiresAt });
      } catch (err) {
        req.log.error({ err }, "Failed to generate or retrieve voucher PDF for booking");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while generating or retrieving the booking voucher PDF.");
      }
    },
  );

  // ── GET /guests/me/bookings/:id/qr-code ──────────────────────────────────
  app.get(
    "/guests/me/bookings/:id/qr-code",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Generate or retrieve the booking QR code (presigned PNG URL)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  qrCodeUrl:        { type: "string", description: "Presigned S3 URL to the QR code PNG, valid for 1 hour" },
                  bookingReference: { type: "string" },
                  expiresAt:        { type: "string" },
                },
                required: ["qrCodeUrl", "bookingReference", "expiresAt"],
              },
            },
          },
          403: errSchema,
          404: errSchema,
          409: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
      const { id } = req.params as { id: string };

      try {
        const booking = await prisma.booking.findUnique({
          where: { id },
          select: { id: true, guestId: true, reference: true, status: true },
        });

        if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
        if (booking.guestId !== guestId)
          return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");
        if (booking.status !== "confirmed")
          return sendError(reply, 409, "NOT_CONFIRMED", "QR code is only available for confirmed bookings.");

        const s3Key    = `bookings/${id}/qr.png`;
        const cacheKey = `bkdoc:qr:${id}`;

        let cached: string | null = null;
        try {
          cached = await redis.get(cacheKey);
        } catch (redisErr) {
          req.log.warn({ err: redisErr }, "Redis cache read failed for booking QR code");
        }

        if (!cached) {
          const qrBuffer = await QRCode.toBuffer(booking.reference, {
            type: "png",
            width: 400,
            margin: 2,
            color: { dark: "#000000ff", light: "#ffffffff" },
          });
          await uploadBuffer(s3Key, qrBuffer, "image/png");
          try {
            await redis.set(cacheKey, "1", "EX", CACHE_TTL_SECONDS);
          } catch (redisErr) {
            req.log.warn({ err: redisErr }, "Redis cache write failed for booking QR code");
          }
        }

        const qrCodeUrl = await createPresignedDownloadUrl(s3Key, PRESIGNED_URL_TTL);
        const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL * 1000).toISOString();

        return sendSuccess(reply, 200, {
          qrCodeUrl,
          bookingReference: booking.reference,
          expiresAt,
        });
      } catch (err) {
        req.log.error({ err }, "Failed to generate or retrieve QR code for booking");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while generating or retrieving the booking QR code.");
      }
    },
  );
}
