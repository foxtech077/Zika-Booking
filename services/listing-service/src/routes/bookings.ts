import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, requireProviderRole, type ProviderRequest } from "../middleware/auth.js";
import { getRedis } from "../lib/redis.js";
import { randomUUID } from "crypto";
import { sendBookingConfirmationEmail, sendBookingCancellationEmail } from "../lib/email.js";
import { ipDetect } from "../middleware/ipDetect.js";
import { getPricing } from "../services/pricing.services.js";
import { getPaymentProvider } from "../services/payment.services.js";
import { calculateBilling } from "../services/billing.service.js";
import { getTaxRate } from "../services/getTaxRate.services.js";
import { VoucherDiscountType } from "../generated/index.js";

const LOCK_TTL_MS = 300_000; // 5 minutes
const DEFAULT_COMMISSION_RATE = 0.05;

// ── Sequence bootstrap ────────────────────────────────────────────────────────

async function ensureBookingSequence(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS booking_seq START WITH 1000 INCREMENT BY 1`,
  );
}

// ── Reference generator ───────────────────────────────────────────────────────

async function generateReference(countryCode: string): Promise<string> {
  const result = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('booking_seq') AS nextval`;
  const seq = Number(result[0]!.nextval);
  const padded = String(seq).padStart(6, "0");
  return `ZIKA-${padded}-${(countryCode ?? "XX").toUpperCase()}`;
}

// ── Commission helper ─────────────────────────────────────────────────────────

async function getCommissionRate(country: string | null): Promise<number> {
  if (!country) return DEFAULT_COMMISSION_RATE;
  const rate = await prisma.commissionRate.findUnique({ where: { country } });
  return rate ? Number(rate.rate) : DEFAULT_COMMISSION_RATE;
}

// ── Availability checker ──────────────────────────────────────────────────────
// Counts active overlapping bookings for a listing.
// - Confirmed bookings always count.
// - pending_payment bookings only count if they were created within the lock
//   TTL window (i.e. the lock has not yet expired). Expired pending bookings
//   are ghost-slots that should no longer block availability.
// - Supports unit_count > 1 (e.g. hotel with multiple rooms of same type).

async function checkAvailability(
  listingId: string,
  unitCount: number,
  startDate: Date,
  endDate: Date,
): Promise<{ available: boolean; reason?: string }> {
  const pendingExpiry = new Date(Date.now() - LOCK_TTL_MS);

  const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) AS count
    FROM bookings
    WHERE listing_id = $1
      AND (
        status = 'confirmed'
        OR (status = 'pending_payment' AND created_at > $2)
      )
      AND (
        (check_in IS NOT NULL     AND check_in     < $4 AND check_out      > $3)
        OR (pickup_datetime IS NOT NULL AND pickup_datetime < $4 AND return_datetime > $3)
      )
  `, listingId, pendingExpiry, startDate, endDate);

  const count = Number(result[0]?.count ?? 0);
  if (count >= unitCount) {
    return { available: false, reason: "No units available for the selected dates." };
  }
  return { available: true };
}

// ── Pricing calculators ───────────────────────────────────────────────────────

// function calcHotelApartmentPricing(
//   listing: any,
//   checkIn: string,
//   checkOut: string,
//   commissionRate = DEFAULT_COMMISSION_RATE,
// ) {
//   const nights = Math.round(
//     (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
//   );
//   const rate = Number(listing.pricePerNight ?? 0);
//   const subtotal = rate * nights;

//   let discountAmount = 0;
//   if (
//     listing.category === "apartment" &&
//     listing.longStayEnabled &&
//     listing.longStayMinNights &&
//     nights >= listing.longStayMinNights
//   ) {
//     if (listing.longStayDiscountType === "percentage") {
//       discountAmount = subtotal * (Number(listing.longStayDiscountValue ?? 0) / 100);
//     } else {
//       discountAmount = Number(listing.longStayDiscountValue ?? 0) * nights;
//     }
//   }

//   const totalAmount = subtotal - discountAmount;
//   const commissionAmount = totalAmount * commissionRate;
//   const providerPayout = totalAmount - commissionAmount;

//   return { nights, rate, subtotal, discountAmount, totalAmount, commissionAmount, providerPayout };
// }

// function calcCarPricing(
//   listing: any,
//   pickupDatetime: string,
//   returnDatetime: string,
//   deliveryRequested: boolean,
//   commissionRate = DEFAULT_COMMISSION_RATE,
// ) {
//   const rentalMs = new Date(returnDatetime).getTime() - new Date(pickupDatetime).getTime();
//   const days = Math.ceil(rentalMs / 86_400_000);
//   const rate = Number(listing.pricePerDay ?? 0);
//   const subtotal = rate * days;
//   const deliveryFee = deliveryRequested ? Number(listing.deliveryFee ?? 0) : 0;
//   const totalAmount = subtotal + deliveryFee;
//   const commissionAmount = totalAmount * commissionRate;
//   const providerPayout = totalAmount - commissionAmount;

//   return { days, rate, subtotal, deliveryFee, totalAmount, commissionAmount, providerPayout };
// }

// ── Refund calculator ─────────────────────────────────────────────────────────

function calcRefund(booking: any): number {
  const total = Number(booking.totalAmount);
  const policy = booking.cancellationPolicy;
  const refDate = booking.checkIn ?? booking.pickupDatetime;
  if (!refDate) return 0;

  const hoursUntil = (new Date(refDate).getTime() - Date.now()) / 3_600_000;

  if (policy === "flexible") return hoursUntil >= 48 ? total : 0;
  if (policy === "moderate") {
    if (hoursUntil >= 168) return total;
    if (hoursUntil >= 48) return total * 0.5;
    return 0;
  }
  if (policy === "strict") {
    if (hoursUntil >= 336) return total * 0.5;
    return 0;
  }
  return 0; // non_refundable
}

// ── Reusable error schema fragment ────────────────────────────────────────────

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

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function bookingRoutes(app: FastifyInstance) {
  const redis = getRedis();

  // Ensure the DB sequence exists at startup (non-blocking; logs on error)
  ensureBookingSequence().catch((err) =>
    app.log.error({ err }, "Failed to ensure booking_seq"),
  );

 
    app.get("/booking/quote",{ preHandler: [ipDetect], schema: {
      tags: ["Booking"],
      summary: "Get pricing with IP-based currency + payment routing",

      headers: {
        type: "object",
        properties: {
          "cf-ipcountry": {
            type: "string",
            description: "Country code from Cloudflare (for testing override)",
          }
        }
      }
    }
      },
      async (req, reply) => {
        const pricing = await getPricing(req, 100);
  
        const paymentProvider = getPaymentProvider(pricing.country);
  
        return reply.send({
          success: true,
          data: {
            ...pricing,
            paymentProvider,
          },
        });
      }
    );
  

  // ── POST /bookings/initiate — acquire reservation lock ──────────────────────
  app.post(
    "/bookings/initiate",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Acquire a reservation lock before checkout",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["listingId"],
          properties: {
            listingId: { type: "string" },
            checkIn: { type: "string", format: "date" },
            checkOut: { type: "string", format: "date" },
            pickupDatetime: { type: "string", format: "date-time" },
            returnDatetime: { type: "string", format: "date-time" },
            deliveryRequested: { type: "boolean", default: false },
            guests: { type: "integer", minimum: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  lockToken: { type: "string" },
                  expiresAt: { type: "string" },
                  resumed: { type: "boolean" },
                  pricingPreview: { type: "object", additionalProperties: true },
                },
                required: ["lockToken", "expiresAt"],
              },
            },
          },
          409: errSchema,
          429: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
  
      const body = req.body as {
        listingId: string;
        checkIn?: string;
        checkOut?: string;
        pickupDatetime?: string;
        returnDatetime?: string;
        deliveryRequested?: boolean;
        guests?: number;
      };
  
      // ── 1. LISTING ─────────────────────────────
      const listing = await prisma.listing.findUnique({
        where: { id: body.listingId, deletedAt: null },
      });
      if (!listing) {
        return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
      }
      // STEP 1: base rate
const baseRate = Number(
  listing.pricePerNight ?? listing.pricePerDay ?? 0
);

// STEP 2: promotion logic (HERE, NOT in billing service)
const promotionRate = 0;

// STEP 3: compute base amount
const units = 1; // optional preview logic (or skip here)
const baseAmount = baseRate * units;

const promotionDiscount = baseAmount * promotionRate;
  
     
  
      // ── 2. STATUS CHECK ─────────────────────────
      const validStatuses =
        listing.category === "hotel" ? ["approved"] : ["active"];
  
      if (!validStatuses.includes(listing.status)) {
        return reply.status(410).send({
          success: false,
          error: {
            code: "LISTING_INACTIVE",
            message: "This listing is no longer available.",
          },
        });
      }
  
      // ── 3. SELF BOOKING CHECK ───────────────────
      if (listing.providerId === guestId) {
        return sendError(reply, 403, "FORBIDDEN", "You cannot book your own listing.");
      }
  
      // ── 4. GUEST LIMIT ──────────────────────────
      if (body.guests && listing.maxGuests && body.guests > listing.maxGuests) {
        return sendError(
          reply,
          400,
          "EXCEEDS_CAPACITY",
          `Max guests allowed: ${listing.maxGuests}`
        );
      }
  
      // ── 5. PENDING LIMIT ────────────────────────
      const pendingCount = await prisma.booking.count({
        where: { guestId, status: "pending_payment" },
      });
  
      if (pendingCount >= 5) {
        return reply.status(429).send({
          success: false,
          error: {
            code: "TOO_MANY_PENDING",
            message: "Complete or cancel existing bookings first.",
          },
        });
      }
  
      // ── 6. AVAILABILITY CHECK ───────────────────
      if (listing.category !== "car" && body.checkIn && body.checkOut) {
        const avail = await checkAvailability(
          listing.id,
          listing.unitCount ?? 1,
          new Date(body.checkIn),
          new Date(body.checkOut)
        );
  
        if (!avail.available) {
          return reply.status(409).send({
            success: false,
            error: {
              code: "LISTING_UNAVAILABLE",
              message: avail.reason ?? "Not available.",
            },
          });
        }
      }
  
      if (listing.category === "car" && body.pickupDatetime && body.returnDatetime) {
        const avail = await checkAvailability(
          listing.id,
          listing.unitCount ?? 1,
          new Date(body.pickupDatetime),
          new Date(body.returnDatetime)
        );
  
        if (!avail.available) {
          return reply.status(409).send({
            success: false,
            error: {
              code: "LISTING_UNAVAILABLE",
              message: avail.reason ?? "Not available.",
            },
          });
        }
      }
  
      // ── 7. LOCK KEY ─────────────────────────────
      const lockKey =
        listing.category === "car"
          ? `rlk:${listing.id}:${body.pickupDatetime?.slice(0, 10)}:${body.returnDatetime?.slice(0, 10)}`
          : `rlk:${listing.id}:${body.checkIn}:${body.checkOut}`;
  
      const lockToken = randomUUID();
      const ctxKey = `rlk:ctx:${lockToken}`;
  
      const acquired = await redis.set(lockKey, lockToken, "PX", LOCK_TTL_MS, "NX");
  
      if (!acquired) {
        return reply.status(409).send({
          success: false,
          error: {
            code: "LISTING_UNAVAILABLE",
            message: "Already locked by another user.",
          },
        });
      }
  
      // ── 8. STORE CONTEXT ─────────────────────────
      const ctx = {
        guestId,
        listingId: listing.id,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        pickupDatetime: body.pickupDatetime,
        returnDatetime: body.returnDatetime,
        deliveryRequested: body.deliveryRequested ?? false,
        renewed: false,
      };
  
      await redis.set(ctxKey, JSON.stringify(ctx), "PX", LOCK_TTL_MS);
  
      // ── 9. BILLING (FIXED TYPES) ─────────────────
      const commissionRate = await getCommissionRate(listing.country ?? null);
  
      const billing = calculateBilling({
        listingCategory: listing.category,
      
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        pickupDatetime: body.pickupDatetime,
        returnDatetime: body.returnDatetime,
      
        rate: baseRate,
      
        deliveryFee: Number(listing.deliveryFee ?? 0),
      
        promotionDiscount, 
        voucherAmount: 0,
      
        taxRate: getTaxRate(listing.country),
      
        commissionRate,
      });
  
      // ── 10. FIXED RESPONSE ───────────────────────
      const pricingPreview = {
        units: billing.units,
        baseAmount: billing.baseAmount,
        promotionDiscount: billing.promotionDiscount,
        voucherDiscount: billing.voucherDiscount,
         serviceFee: billing.serviceFee,
        taxAmount: billing.taxAmount,
        deliveryFee: billing.deliveryFee,
        totalAmount: billing.totalAmount,
        currency: listing.currency,
      };
  
      return sendSuccess(reply, 200, {
        lockToken,
        expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
        resumed: false,
        pricingPreview,
      });
    }
  );

  // ── POST /bookings/lock/renew — one-time lock extension ────────────────────
  app.post(
    "/bookings/lock/renew",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Renew a reservation lock once (5-minute extension)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["lockToken"],
          properties: { lockToken: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: { expiresAt: { type: "string" } },
                required: ["expiresAt"],
              },
            },
          },
          409: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
      const { lockToken } = req.body as { lockToken: string };

      const ctxRaw = await redis.get(`rlk:ctx:${lockToken}`);
      if (!ctxRaw)
        return reply.status(409).send({
          success: false,
          error: { code: "LOCK_EXPIRED", message: "Your reservation has expired." },
        });

      const ctx = JSON.parse(ctxRaw);
      if (ctx.guestId !== guestId)
        return sendError(reply, 403, "FORBIDDEN", "Lock does not belong to you.");
      if (ctx.renewed)
        return reply.status(409).send({
          success: false,
          error: { code: "ALREADY_RENEWED", message: "This lock has already been renewed once." },
        });

      const lockKey = `rlk:${ctx.listingId}:${ctx.checkIn ?? ctx.pickupDatetime?.slice(0, 10)}:${ctx.checkOut ?? ctx.returnDatetime?.slice(0, 10)}`;
      ctx.renewed = true;

      await redis.pexpire(lockKey, LOCK_TTL_MS);
      await redis.set(`rlk:ctx:${lockToken}`, JSON.stringify(ctx), "PX", LOCK_TTL_MS);

      return sendSuccess(reply, 200, {
        expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
      });
    },
  );

  // ── DELETE /bookings/lock/:lockToken — explicit abandon ────────────────────
  app.delete(
    "/bookings/lock/:lockToken",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Explicitly release a reservation lock",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { lockToken: { type: "string" } },
          required: ["lockToken"],
        },
        response: {
          204: { type: "null" },
          403: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
      const { lockToken } = req.params as { lockToken: string };

      const ctxRaw = await redis.get(`rlk:ctx:${lockToken}`);
      if (!ctxRaw) return reply.status(204).send();

      const ctx = JSON.parse(ctxRaw);
      if (ctx.guestId !== guestId)
        return sendError(reply, 403, "FORBIDDEN", "Lock does not belong to you.");

      const lockKey = `rlk:${ctx.listingId}:${ctx.checkIn ?? ctx.pickupDatetime?.slice(0, 10)}:${ctx.checkOut ?? ctx.returnDatetime?.slice(0, 10)}`;
      await redis.del(lockKey, `rlk:ctx:${lockToken}`);
      reply.status(204).send();
    },
  );

  // ── POST /bookings — create pending_payment booking ────────────────────────
  app.post(
    "/bookings",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Create a booking using a valid reservation lock token",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["lockToken", "listingId", "guestFirstName", "guestLastName", "guestEmail"],
          properties: {
            lockToken:         { type: "string" },
            listingId:         { type: "string" },
            checkIn:           { type: "string", format: "date" },
            checkOut:          { type: "string", format: "date" },
            pickupDatetime:    { type: "string", format: "date-time" },
            returnDatetime:    { type: "string", format: "date-time" },
            deliveryRequested: { type: "boolean", default: false },
            deliveryAddress:   { type: "string" },
            guestFirstName:    { type: "string", maxLength: 100 },
            guestLastName:     { type: "string", maxLength: 100 },
            guestEmail:        { type: "string", format: "email" },
            guestPhone:        { type: "string", maxLength: 30 },
            adults:            { type: "integer", minimum: 1 },
            children:          { type: "integer", minimum: 0, default: 0 },
            specialRequests:   { type: "string" },
            driverFirstName:   { type: "string", maxLength: 100 },
            driverLastName:    { type: "string", maxLength: 100 },
            driverAge:         { type: "integer", minimum: 18 },
            voucherCode:       { type: "string", maxLength: 30 },
          },
        },
        response: { 
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  bookingId:        { type: "string" },
                  bookingReference: { type: "string" },
                  totalAmount:      { type: "number" },
                  currency:         { type: "string" },
                  status:           { type: "string" },
                  voucherDiscount:  { type: "number" },
                },
                required: ["bookingId", "bookingReference", "totalAmount", "currency", "status"],
              },
            },
          },
          400: errSchema,
          403: errSchema,
          404: errSchema,
          409: errSchema,
          410: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
      const body = req.body as {
        lockToken: string;
        listingId: string;
        checkIn?: string;
        checkOut?: string;
        pickupDatetime?: string;
        returnDatetime?: string;
        deliveryRequested?: boolean;
        deliveryAddress?: string;
        guestFirstName: string;
        guestLastName: string;
        guestEmail: string;
        guestPhone?: string;
        adults?: number;
        children?: number;
        specialRequests?: string;
        driverFirstName?: string;
        driverLastName?: string;
        driverAge?: number;
        voucherCode?: string;
      };

      // Validate lock
      const ctxRaw = await redis.get(`rlk:ctx:${body.lockToken}`);
      if (!ctxRaw)
        return reply.status(409).send({
          success: false,
          error: { code: "LOCK_EXPIRED", message: "Your reservation has expired." },
        });

      const ctx = JSON.parse(ctxRaw);
      if (ctx.guestId !== guestId)
        return sendError(reply, 403, "FORBIDDEN", "Lock does not belong to you.");

      // Cross-validate listing matches lock context
      if (ctx.listingId !== body.listingId)
        return sendError(reply, 400, "LOCK_MISMATCH", "Listing does not match your reservation lock.");

      const listing = await prisma.listing.findUnique({
        where: { id: body.listingId, deletedAt: null },
      });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      const validStatuses = listing.category === "hotel" ? ["approved"] : ["active"];
      if (!validStatuses.includes(listing.status)) {
        return reply.status(410).send({
          success: false,
          error: { code: "LISTING_INACTIVE", message: "This listing is no longer available." },
        });
      }

      // Car: require driver details & enforce minimum age
      if (listing.category === "car") {
        if (!body.driverFirstName || !body.driverLastName)
          return sendError(reply, 400, "VALIDATION_ERROR", "Driver first and last name are required for car rentals.");
        if (listing.minimumDriverAge && body.driverAge && body.driverAge < listing.minimumDriverAge)
          return sendError(
            reply, 400, "DRIVER_AGE_RESTRICTION",
            `Driver must be at least ${listing.minimumDriverAge} years old.`,
          );
      }
      const commissionRate = await getCommissionRate(listing.country ?? null);

      const rate =
        listing.category === "car"
          ? Number(listing.pricePerDay ?? 0)
          : Number(listing.pricePerNight ?? 0);
    
      // 1. BASE BILLING (NO VOUCHER)

      const baseBilling = calculateBilling({
        listingCategory: listing.category,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        pickupDatetime: body.pickupDatetime,
        returnDatetime: body.returnDatetime,
        rate,
        deliveryFee: Number(listing.deliveryFee ?? 0),
        promotionDiscount: 0,
        voucherAmount: 0,
        taxRate: getTaxRate(listing.country),
        commissionRate,
      });
      
      let voucherDiscount = 0;
      let appliedVoucher: { id: string; code: string } | null = null;
      
 
      // 2. VOUCHER LOGIC
      
      if (body.voucherCode) {
        const voucher = await prisma.voucher.findUnique({
          where: { code: body.voucherCode },
        });
      
        if (!voucher) {
          return sendError(reply, 400, "INVALID_VOUCHER", "Voucher not found");
        }
      
        if (!voucher.isActive) {
          return sendError(reply, 400, "INVALID_VOUCHER", "Voucher is not active.");
        }
      
        const now = new Date();
      
        if (now < voucher.validFrom || now > voucher.validUntil) {
          return sendError(
            reply,
            400,
            "INVALID_VOUCHER",
            "Voucher is expired or not valid yet."
          );
        }
      
        //  your requested logic kept exactly here
        if (voucher.discountType === "percentage") {
          voucherDiscount =
            baseBilling.subtotal *
            (Number(voucher.discountValue) / 100);
        } else {
          voucherDiscount = Number(voucher.discountValue);
        }
      
        appliedVoucher = {
          id: voucher.id,
          code: voucher.code,
        };
      }
      

      // 3. FINAL RECALCULATION
      
      const finalBilling = calculateBilling({
        listingCategory: listing.category,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        pickupDatetime: body.pickupDatetime,
        returnDatetime: body.returnDatetime,
        rate,
        deliveryFee: Number(listing.deliveryFee ?? 0),
        promotionDiscount: 0,
        voucherAmount: voucherDiscount,
        taxRate: getTaxRate(listing.country),
        commissionRate,
      });
      
    
      // 4. FINAL VALUES (USE THIS ONLY)
      
      const subtotal = finalBilling.subtotal;
      const totalAmount = finalBilling.totalAmount;
      const commissionAmount = finalBilling.commissionAmount;
      const providerPayout = finalBilling.providerPayout;
      const deliveryFee = finalBilling.deliveryFee;
      const discountAmount = finalBilling.promotionDiscount + voucherDiscount;
      
   
      // 5. BOOKING
    
      const reference = await generateReference(listing.country ?? "XX");
      
      const booking = await prisma.booking.create({
        data: {
          reference,
          listingId: listing.id,
          guestId,
          providerId: listing.providerId,
          listingType: listing.category,
          status: "pending_payment",
      
          checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
          checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
          pickupDatetime: body.pickupDatetime
            ? new Date(body.pickupDatetime)
            : undefined,
          returnDatetime: body.returnDatetime
            ? new Date(body.returnDatetime)
            : undefined,
      
          nightsOrDays: finalBilling.units,
      
          guestFirstName: body.guestFirstName,
          guestLastName: body.guestLastName,
          guestEmail: body.guestEmail,
          guestPhone: body.guestPhone,
      
          adults: body.adults,
          children: body.children ?? 0,
          specialRequests: body.specialRequests,
      
          driverFirstName: body.driverFirstName,
          driverLastName: body.driverLastName,
          driverAge: body.driverAge,
      
          deliveryRequested: body.deliveryRequested ?? false,
          deliveryAddress: body.deliveryAddress,
      
          nightlyRate: listing.category !== "car" ? rate : undefined,
          dailyRate: listing.category === "car" ? rate : undefined,
      
          subtotal,
          totalAmount,
          discountAmount,
          deliveryFee,
      
          currency: listing.currency ?? "USD",
      
          commissionRate,
          commissionAmount,
          providerPayout,
      
          cancellationPolicy: listing.cancellationPolicy ?? "moderate",
      
          voucherCode: appliedVoucher?.code,
          voucherDiscount,
        },
      });

      await prisma.bookingStatusLog.create({
        data: {
          bookingId: booking.id,
          toStatus: "pending_payment",
          actorType: "guest",
          changedBy: guestId,
        },
      });

      if (appliedVoucher) {
        await Promise.all([
          prisma.voucher.update({
            where: { id: appliedVoucher.id },
            data: { usageCount: { increment: 1 } },
          }),
          prisma.voucherRedemption.create({
            data: {
              voucherId: appliedVoucher.id,
              bookingId: booking.id,
              guestId,
              discount: voucherDiscount,
            },
          }),
        ]);
      }

      return sendSuccess(reply, 201, {
        bookingId:        booking.id,
        bookingReference: booking.reference,
        totalAmount:      Number(booking.totalAmount),
        currency:         booking.currency,
        status:           booking.status,
        voucherDiscount:  voucherDiscount > 0 ? voucherDiscount : undefined,
      });
    },
  );

  // ── PATCH /bookings/:id/confirm — internal payment callback ────────────────
  app.patch(
    "/bookings/:id/confirm",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Internal: confirm booking after successful payment",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: { paymentId: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: { message: { type: "string" } },
              },
            },
          },
          404: errSchema,
          409: errSchema,
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const { paymentId } = req.body as { paymentId?: string };

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
      if (booking.status !== "pending_payment") {
        return reply.status(409).send({
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: `Cannot confirm booking in status: ${booking.status}`,
          },
        });
      }

      await prisma.booking.update({
        where: { id },
        data: { status: "confirmed", confirmedAt: new Date(), paymentId },
      });

      await prisma.bookingStatusLog.create({
        data: {
          bookingId: id,
          fromStatus: "pending_payment",
          toStatus: "confirmed",
          actorType: "system",
        },
      });

      // Send confirmation email (non-blocking)
      const confirmedListing = await prisma.listing.findUnique({
        where: { id: booking.listingId },
      });
      sendBookingConfirmationEmail(
        booking.guestEmail,
        `${booking.guestFirstName} ${booking.guestLastName}`,
        {
          reference:     booking.reference,
          listingName:   confirmedListing?.name ?? "Your listing",
          listingType:   booking.listingType,
          checkIn:       booking.checkIn?.toISOString(),
          checkOut:      booking.checkOut?.toISOString(),
          pickupDatetime: booking.pickupDatetime?.toISOString(),
          returnDatetime: booking.returnDatetime?.toISOString(),
          nightsOrDays:  booking.nightsOrDays,
          totalAmount:   Number(booking.totalAmount),
          currency:      booking.currency,
        },
      ).catch(() => {});

      // Award loyalty points — cross-schema update to auth."User"
      // The listing service Prisma connection uses search_path=listing, so we
      // must use the fully-qualified auth schema name in raw SQL.
      const points = Math.floor(Number(booking.totalAmount));
      if (points > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE auth."User"
          SET
            "loyaltyPoints" = "loyaltyPoints" + $1,
            "currentTier"   = (CASE
              WHEN "loyaltyPoints" + $1 >= 15000 THEN 'diamond'
              WHEN "loyaltyPoints" + $1 >= 5000  THEN 'gold'
              WHEN "loyaltyPoints" + $1 >= 1000  THEN 'silver'
              ELSE 'bronze'
            END)::text::auth."LoyaltyTier",
            "updatedAt" = NOW()
          WHERE id = $2
        `, points, booking.guestId);
      }

      // Release Redis lock
      const lockSuffix = booking.checkIn
        ? `${booking.listingId}:${booking.checkIn.toISOString().slice(0, 10)}:${booking.checkOut?.toISOString().slice(0, 10)}`
        : `${booking.listingId}:${booking.pickupDatetime?.toISOString().slice(0, 10)}:${booking.returnDatetime?.toISOString().slice(0, 10)}`;
      await redis.del(`rlk:${lockSuffix}`).catch(() => {});

      return sendSuccess(reply, 200, { message: "Booking confirmed." });
    },
  );

  // ── PATCH /bookings/:id/fail — internal payment failure ────────────────────
  app.patch(
    "/bookings/:id/fail",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Internal: mark booking as failed after payment failure",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: { failureReason: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object", properties: { message: { type: "string" } } },
            },
          },
          404: errSchema,
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const { failureReason } = req.body as { failureReason?: string };

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

      await prisma.booking.update({
        where: { id },
        data: {
          status: "cancelled_by_system",
          cancellationReason: failureReason ?? "Payment failed",
          cancelledAt: new Date(),
          cancelledBy: "system",
        },
      });

      await prisma.bookingStatusLog.create({
        data: {
          bookingId: id,
          fromStatus: "pending_payment",
          toStatus: "cancelled_by_system",
          actorType: "system",
          reason: failureReason,
        },
      });

      return sendSuccess(reply, 200, { message: "Booking marked as failed." });
    },
  );

  // ── POST /bookings/:id/cancel — guest cancellation ─────────────────────────
  app.post(
    "/bookings/:id/cancel",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Guest cancels a confirmed booking",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: { reason: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  refundAmount: { type: "number" },
                  currency:     { type: "string" },
                  message:      { type: "string" },
                },
                required: ["refundAmount", "currency", "message"],
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
      const { reason } = req.body as { reason?: string };

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
      if (booking.guestId !== guestId)
        return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");
      if (booking.status === "completed")
        return reply.status(409).send({
          success: false,
          error: { code: "ALREADY_COMPLETED", message: "Completed bookings cannot be cancelled." },
        });
      if (booking.status !== "confirmed")
        return reply.status(409).send({
          success: false,
          error: { code: "INVALID_STATUS", message: "Only confirmed bookings can be cancelled." },
        });

      const refundAmount = calcRefund(booking);

      await prisma.booking.update({
        where: { id },
        data: {
          status: "cancelled_by_guest",
          cancelledAt: new Date(),
          cancelledBy: "guest",
          cancellationReason: reason,
          refundAmount,
        },
      });

      await prisma.bookingStatusLog.create({
        data: {
          bookingId: id,
          fromStatus: "confirmed",
          toStatus: "cancelled_by_guest",
          actorType: "guest",
          changedBy: guestId,
          reason,
        },
      });

      const cancelledListing = await prisma.listing.findUnique({
        where: { id: booking.listingId },
      });
      sendBookingCancellationEmail(
        booking.guestEmail,
        `${booking.guestFirstName} ${booking.guestLastName}`,
        {
          reference:   booking.reference,
          listingName: cancelledListing?.name ?? "Your booking",
          refundAmount,
          currency:    booking.currency,
        },
      ).catch(() => {});

      return sendSuccess(reply, 200, {
        refundAmount,
        currency: booking.currency,
        message: "Booking cancelled.",
      });
    },
  );

  // ── POST /provider/bookings/:id/cancel — provider cancellation ─────────────
  app.post(
    "/provider/bookings/:id/cancel",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Provider cancels a confirmed booking (always full refund)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["reasonCode"],
          properties: {
            reasonCode: { type: "string" },
            reasonText: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  refundAmount: { type: "number" },
                  currency:     { type: "string" },
                  message:      { type: "string" },
                },
                required: ["refundAmount", "currency", "message"],
              },
            },
          },
          403: errSchema,
          404: errSchema,
          409: errSchema,
        },
      },
      preHandler: [requireProviderRole],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const providerId = (req as ProviderRequest).providerId;
      const { id } = req.params as { id: string };
      const { reasonCode, reasonText } = req.body as {
        reasonCode: string;
        reasonText?: string;
      };

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { listing: true },
      });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
      if (booking.listing.providerId !== providerId)
        return sendError(reply, 403, "FORBIDDEN", "This booking is not for your listing.");
      if (booking.status !== "confirmed")
        return reply.status(409).send({
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: "Only confirmed bookings can be cancelled by the provider.",
          },
        });

      await prisma.booking.update({
        where: { id },
        data: {
          status: "cancelled_by_provider",
          cancelledAt: new Date(),
          cancelledBy: "provider",
          cancellationReason: reasonText ?? reasonCode,
          refundAmount: booking.totalAmount, // always full refund
        },
      });

      await prisma.bookingStatusLog.create({
        data: {
          bookingId: id,
          fromStatus: "confirmed",
          toStatus: "cancelled_by_provider",
          actorType: "provider",
          changedBy: providerId,
          reason: reasonText ?? reasonCode,
        },
      });

      return sendSuccess(reply, 200, {
        refundAmount: Number(booking.totalAmount),
        currency: booking.currency,
        message: "Booking cancelled. Full refund will be issued.",
      });
    },
  );

  // ── GET /guests/me/bookings — guest booking history ────────────────────────
  app.get(
    "/guests/me/bookings",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Get the authenticated guest's booking history",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["all", "upcoming", "completed", "cancelled"],
              default: "all",
            },
            cursor: { type: "string", description: "Offset cursor for pagination" },
            q:      { type: "string", description: "Partial booking reference search" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  total:      { type: "integer" },
                  nextCursor: { type: "string", nullable: true },
                  bookings:   { type: "array", items: { type: "object", additionalProperties: true } },
                },
                required: ["total", "nextCursor", "bookings"],
              },
            },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
      const q = req.query as Record<string, string>;
      const status    = q["status"];
      const searchRef = q["q"];
      const cursor    = q["cursor"] ? parseInt(q["cursor"], 10) : 0;
      const limit     = 20;

      const where: any = { guestId };

      if (status && status !== "all") {
        const statusMap: Record<string, string[]> = {
          upcoming:  ["confirmed"],
          completed: ["completed"],
          cancelled: ["cancelled_by_guest", "cancelled_by_provider", "cancelled_by_system"],
        };
        if (statusMap[status]) where.status = { in: statusMap[status] };
      }

      if (searchRef) {
        where.reference = { contains: searchRef.toUpperCase() };
      }

      const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: cursor,
          take: limit + 1,
          include: {
            listing: {
              include: {
                photos: {
                  where: { deletedAt: null },
                  orderBy: { position: "asc" },
                  take: 1,
                },
              },
            },
          },
        }),
        prisma.booking.count({ where }),
      ]);

      const hasMore = bookings.length > limit;
      const page    = hasMore ? bookings.slice(0, limit) : bookings;

      return sendSuccess(reply, 200, {
        total,
        nextCursor: hasMore ? String(cursor + limit) : null,
        bookings: page.map((b) => ({
          id:                    b.id,
          reference:             b.reference,
          status:                b.status,
          listingType:           b.listingType,
          listingTitle:          b.listing.name,
          listingPrimaryPhotoUrl: b.listing.photos[0]?.cdnUrl ?? null,
          checkIn:               b.checkIn?.toISOString().slice(0, 10) ?? null,
          checkOut:              b.checkOut?.toISOString().slice(0, 10) ?? null,
          pickupDatetime:        b.pickupDatetime?.toISOString() ?? null,
          returnDatetime:        b.returnDatetime?.toISOString() ?? null,
          nightsOrDays:          b.nightsOrDays,
          totalAmount:           Number(b.totalAmount),
          currency:              b.currency,
          voucherDiscount:       Number(b.voucherDiscount),
          createdAt:             b.createdAt,
        })),
      });
    },
  );

  // ── GET /guests/me/bookings/:id — booking detail ───────────────────────────
  app.get(
    "/guests/me/bookings/:id",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Get a specific booking's full detail",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object", additionalProperties: true },
            },
          },
          403: errSchema,
          404: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const guestId = (req as ProviderRequest).providerId;
      const { id } = req.params as { id: string };

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          listing: {
            include: {
              photos: {
                where: { deletedAt: null },
                orderBy: { position: "asc" },
                take: 1,
              },
            },
          },
        },
      });

      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
      if (booking.guestId !== guestId)
        return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");

      const canCancel =
        booking.status === "confirmed" &&
        booking.checkIn != null &&
        booking.checkIn > new Date();

      return sendSuccess(reply, 200, {
        id:                  booking.id,
        reference:           booking.reference,
        status:              booking.status,
        listingType:         booking.listingType,
        listing: {
          id:              booking.listing.id,
          title:           booking.listing.name,
          address:         booking.listing.address,
          town:            booking.listing.town,
          country:         booking.listing.country,
          primaryPhotoUrl: booking.listing.photos[0]?.cdnUrl ?? null,
        },
        checkIn:             booking.checkIn?.toISOString().slice(0, 10) ?? null,
        checkOut:            booking.checkOut?.toISOString().slice(0, 10) ?? null,
        pickupDatetime:      booking.pickupDatetime?.toISOString() ?? null,
        returnDatetime:      booking.returnDatetime?.toISOString() ?? null,
        nightsOrDays:        booking.nightsOrDays,
        adults:              booking.adults,
        children:            booking.children,
        specialRequests:     booking.specialRequests,
        guestFirstName:      booking.guestFirstName,
        guestLastName:       booking.guestLastName,
        guestEmail:          booking.guestEmail,
        subtotal:            Number(booking.subtotal),
        discountAmount:      Number(booking.discountAmount),
        deliveryFee:         Number(booking.deliveryFee),
        voucherCode:         booking.voucherCode ?? null,
        voucherDiscount:     Number(booking.voucherDiscount),
        totalAmount:         Number(booking.totalAmount),
        currency:            booking.currency,
        cancellationPolicy:  booking.cancellationPolicy,
        refundAmount:        booking.refundAmount ? Number(booking.refundAmount) : null,
        cancelledAt:         booking.cancelledAt?.toISOString() ?? null,
        confirmedAt:         booking.confirmedAt?.toISOString() ?? null,
        completedAt:         booking.completedAt?.toISOString() ?? null,
        createdAt:           booking.createdAt,
        canCancel,
      });
    },
  );

  // Note: GET /provider/bookings is in provider.ts (full pagination + status filter)
}