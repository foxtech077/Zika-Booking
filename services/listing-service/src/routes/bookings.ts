import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, requireProviderRole, type ProviderRequest } from "../middleware/auth.js";
import { getRedis } from "../lib/redis.js";
import { randomUUID } from "crypto";
import { sendBookingConfirmationEmail, sendBookingCancellationEmail } from "../lib/email.js";
import { fireNotification } from "../lib/notifications.js";
import { ipDetect } from "../middleware/ipDetect.js";
import { getPricing } from "../services/pricing.services.js";
import { getPaymentProvider } from "../services/payment.services.js";
import { calculateBilling } from "../services/billing.service.js";
import { getTaxRate } from "../services/getTaxRate.services.js";
import { VoucherDiscountType } from "../generated/index.js";
import { logLoyaltyTransaction } from "./loyalty.js";
import { convertCurrency } from "../services/fx.services";

const LOCK_TTL_MS = 300_000; // 5 minutes

// ── Sequence bootstrap ────────────────────────────────────────────────────────

async function ensureBookingSequence(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS booking_seq START WITH 1000 INCREMENT BY 1`,
  );
}

// ── Reference generator ───────────────────────────────────────────────────────

export async function generateReference(countryCode: string): Promise<string> {
  const result = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('booking_seq') AS nextval`;
  const seq = Number(result[0]!.nextval);
  const padded = String(seq).padStart(6, "0");
  return `KAINOOK-${padded}-${(countryCode ?? "XX").toUpperCase()}`;
}

import { getEffectiveCommissionRate } from "../services/commission.service.js";

// ── Commission helper ─────────────────────────────────────────────────────────

async function getGlobalCommissionRate(): Promise<number> {
  const settings = await prisma.platformSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
  const now = new Date();
  if (settings.pendingGlobalRate != null && settings.pendingGlobalEffectiveFrom && settings.pendingGlobalEffectiveFrom <= now) {
    return Number(settings.pendingGlobalRate);
  }
  return Number(settings.globalCommissionRate);
}

export async function getCommissionRate(country: string | null): Promise<number> {
  if (!country) return getGlobalCommissionRate();
  const rate = await prisma.commissionRate.findUnique({ where: { country } });
  if (!rate) return getGlobalCommissionRate();
  const now = new Date();
  if (rate.pendingRate != null && rate.pendingEffectiveFrom && rate.pendingEffectiveFrom <= now) {
    return Number(rate.pendingRate);
  }
  return Number(rate.rate);
}

// ── Availability checker ──────────────────────────────────────────────────────
async function checkAvailability(
  listingId: string,
  unitCount: number,
  startDate: Date,
  endDate: Date,
): Promise<{ available: boolean; reason?: string }> {
  const pendingExpiry = new Date(Date.now() - LOCK_TTL_MS);

  // 1. Check active database bookings (confirmed or active pending locks)
  const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*) AS count
    FROM bookings
    WHERE listing_id = $1
      AND (
        status = 'confirmed'
        OR status = 'checked_in'
        OR (status = 'pending_payment' AND created_at > $2)
      )
      AND (
        (check_in IS NOT NULL     AND check_in     < $4 AND check_out      > $3)
        OR (pickup_datetime IS NOT NULL AND pickup_datetime < $4 AND return_datetime > $3)
      )
  `, listingId, pendingExpiry, startDate, endDate);

  const bookingCount = Number(result[0]?.count ?? 0);

  // 2. Check manually-blocked and iCal-synced dates
  const icalBlockedCount = await prisma.icalBlockedDate.count({
    where: {
      listingId,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
    },
  });

  // 3. Reject if total matches exceed the available unit counts
  if (bookingCount + icalBlockedCount >= unitCount) {
    return { 
      available: false, 
      reason: "Some of the selected dates within your stay are already booked or unavailable." 
    };
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

  // ── Internal service auth ──────────────────────────────────────────────────
  const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

  function validateServiceToken(req: FastifyRequest, reply: FastifyReply): boolean {
    if (!INTERNAL_SERVICE_KEY) {
      sendError(reply, 503, "SERVICE_UNAVAILABLE", "Internal service key not configured.");
      return false;
    }
    console.log("Expected =", process.env.INTERNAL_SERVICE_KEY);
    console.log("Received =", req.headers["x-service-key"]);
    const token = req.headers["x-service-key"];
    if (!token || token !== INTERNAL_SERVICE_KEY) {
      sendError(reply, 401, "UNAUTHORIZED", "Invalid or missing service token.");
      return false;
    }
    return true;
  }

  const PAYMENT_SERVICE_URL = process.env["PAYMENT_SERVICE_URL"] ?? "http://localhost:3004";

  async function notifyPayoutCancellation(bookingId: string) {
    if (!PAYMENT_SERVICE_URL) return;
    try {
      const res = await fetch(`${PAYMENT_SERVICE_URL}/payments/internal/bookings/${bookingId}/cancel-payout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-key": INTERNAL_SERVICE_KEY,
        },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        app.log.error(`[payout-cancel] Failed to cancel payout for booking ${bookingId}: status ${res.status}. Response: ${txt}`);
      } else {
        app.log.info(`[payout-cancel] Payout cancelled successfully via API for booking ${bookingId}`);
      }
    } catch (err: any) {
      app.log.error(`[payout-cancel] Network error calling payout cancellation for booking ${bookingId}: ${err.message}`);
    }
  }

  app.get("/booking/quote", {
    preHandler: [ipDetect], schema: {
      tags: ["Booking"],
      summary: "Get pricing with IP-based currency + payment routing",
      querystring: {
        type: "object",
        required: ["listingId"],
        properties: {
          listingId: { type: "string" },
          currency: { type: "string" }
        }
      },
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
      const query = req.query as { listingId: string; currency?: string };

      try {
        const listing = await prisma.listing.findUnique({
          where: { id: query.listingId }
        });

        if (!listing) {
          return sendError(reply, 404, "NOT_FOUND", "Listing not found");
        }

        const basePrice = Number(listing.pricePerNight ?? listing.pricePerDay ?? 0);
        const baseCurrency = listing.currency ?? "USD";
        const country = req.location?.country || "IN";

        let targetCurrency = query.currency;
        if (!targetCurrency) {
          if (country === "IN") targetCurrency = "INR";
          else if (country === "NG") targetCurrency = "NGN";
          else if (country === "KE") targetCurrency = "KES";
          else if (country === "ZA") targetCurrency = "ZAR";
          else targetCurrency = "USD";
        }

        const pricing = await getPricing(basePrice, baseCurrency, targetCurrency);
        const paymentProvider = getPaymentProvider(country);

        return reply.send({
          success: true,
          data: {
            ...pricing,
            country,
            paymentProvider,
          },
        });
      } catch (err) {
        req.log.error({ err }, "Failed to get booking quote");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching the booking quote.");
      }
    }
  );


  // ── GET /bookings/internal/:id ─────────────────────────────────────────────
  app.get("/bookings/internal/:id", {
    schema: {
      tags: ["Bookings"],
      summary: "Internal: fetch booking details (service-to-service only)",
      params: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!validateServiceToken(req, reply)) return;

    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          currency: true,
          reference: true,
          guestEmail: true,
          guestFirstName: true,
          guestPhone: true,
        },
      });

      if (!booking) {
        return sendError(reply, 404, "NOT_FOUND", "Booking not found");
      }

      return sendSuccess(reply, 200, booking);
    } catch (err) {
      req.log.error({ err }, "Failed to fetch internal booking details");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching booking details.");
    }
  });

  // ── PATCH /bookings/internal/:id/status ────────────────────────────────────
  app.patch("/bookings/internal/:id/status", {
    schema: {
      tags: ["Bookings"],
      summary: "Internal: update booking status (service-to-service only)",
      params: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      body: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string" } },
      },
    },
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!validateServiceToken(req, reply)) return;

    const { id } = req.params;
    const { status } = req.body as { status: string };

    try {
      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

      // Only allow draft → pending_payment transition via this endpoint
      if (booking.status !== "draft" || status !== "pending_payment") {
        return sendError(reply, 409, "INVALID_TRANSITION", `Cannot transition from ${booking.status} to ${status}.`);
      }

      await prisma.booking.update({ where: { id }, data: { status: "pending_payment" } });
      await prisma.bookingStatusLog.create({
        data: { bookingId: id, fromStatus: "draft", toStatus: "pending_payment", actorType: "system" },
      });

      return sendSuccess(reply, 200, { message: "Status updated to pending_payment." });
    } catch (err) {
      req.log.error({ err }, "Failed to update internal booking status");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while updating the booking status.");
    }
  });

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

      try {
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

        // Pending booking limit (max 5) — only count non-expired locks (mirrors checkAvailability logic)
        const pendingExpiry = new Date(Date.now() - LOCK_TTL_MS);
        const pendingCount = await prisma.booking.count({
          where: { guestId, status: "pending_payment", createdAt: { gt: pendingExpiry } },
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

        // Schedule reservation timer warning alert (4 minutes after initiation, 1 minute before lock expiry)
        setTimeout(async () => {
          try {
            const activeLock = await redis.get(ctxKey);
            if (activeLock) {
              const parsedCtx = JSON.parse(activeLock);
              fireNotification(parsedCtx.guestId, {
                type: "reservation_timer",
                title: "Reservation Expiring Soon! ⏳",
                body: "Your booking reservation lock will expire in 1 minute. Complete checkout now to secure your dates!",
                data: { lockToken },
              });
            }
          } catch (err: any) {
            req.log.error({ err }, "Failed to send reservation timer alert");
          }
        }, 240_000);

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
      } catch (err) {
        req.log.error({ err }, "Failed to initiate booking");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while initiating the booking.");
      }
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

      try {
        const ctxRaw = await redis.get(`rlk:ctx:${lockToken}`);
        if (!ctxRaw)
          return reply.status(409).send({
            success: false,
            error: { code: "LOCK_EXPIRED", message: "Your reservation has expired." },
          });

        let ctx: any;
        try {
          ctx = JSON.parse(ctxRaw);
        } catch {
          return reply.status(409).send({
            success: false,
            error: { code: "LOCK_EXPIRED", message: "Your reservation has expired." },
          });
        }

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
      } catch (err) {
        req.log.error({ err }, "Failed to renew reservation lock");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while renewing the reservation lock.");
      }
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

      try {
        const ctxRaw = await redis.get(`rlk:ctx:${lockToken}`);
        if (!ctxRaw) return reply.status(204).send();

        let ctx: any;
        try {
          ctx = JSON.parse(ctxRaw);
        } catch {
          return reply.status(204).send();
        }

        if (ctx.guestId !== guestId)
          return sendError(reply, 403, "FORBIDDEN", "Lock does not belong to you.");

        const lockKey = `rlk:${ctx.listingId}:${ctx.checkIn ?? ctx.pickupDatetime?.slice(0, 10)}:${ctx.checkOut ?? ctx.returnDatetime?.slice(0, 10)}`;
        await redis.del(lockKey, `rlk:ctx:${lockToken}`);
        reply.status(204).send();
      } catch (err) {
        req.log.error({ err }, "Failed to release reservation lock");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while releasing the reservation lock.");
      }
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
            lockToken: { type: "string" },
            listingId: { type: "string" },
            checkIn: { type: "string", format: "date" },
            checkOut: { type: "string", format: "date" },
            pickupDatetime: { type: "string", format: "date-time" },
            returnDatetime: { type: "string", format: "date-time" },
            deliveryRequested: { type: "boolean", default: false },
            deliveryAddress: { type: "string" },
            guestFirstName: { type: "string", maxLength: 100 },
            guestLastName: { type: "string", maxLength: 100 },
            guestEmail: { type: "string", format: "email" },
            guestPhone: { type: "string", maxLength: 30 },
            adults: { type: "integer", minimum: 1 },
            children: { type: "integer", minimum: 0, default: 0 },
            specialRequests: { type: "string" },
            driverFirstName: { type: "string", maxLength: 100 },
            driverLastName: { type: "string", maxLength: 100 },
            driverAge: { type: "integer", minimum: 18 },
            voucherCode: { type: "string", maxLength: 30 },
            redeemPoints: { type: "integer", minimum: 0, description: "Amount of loyalty points to redeem" },
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
                  bookingId: { type: "string" },
                  bookingReference: { type: "string" },
                  totalAmount: { type: "number" },
                  currency: { type: "string" },
                  status: { type: "string" },
                  voucherDiscount: { type: "number" },
                  pointsDiscount: { type: "number" },
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
        redeemPoints?: number;
      };

      try {
        // Validate lock
        const ctxRaw = await redis.get(`rlk:ctx:${body.lockToken}`);
        if (!ctxRaw)
          return reply.status(409).send({
            success: false,
            error: { code: "LOCK_EXPIRED", message: "Your reservation has expired." },
          });

        let ctx: any;
        try {
          ctx = JSON.parse(ctxRaw);
        } catch {
          return reply.status(409).send({
            success: false,
            error: { code: "LOCK_EXPIRED", message: "Your reservation has expired." },
          });
        }

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

        // 2b. POINTS LOGIC
        const redeemPoints = body.redeemPoints ?? 0;
        let pointsDiscount = 0;
        if (redeemPoints > 0) {
          const settings = await prisma.platformSettings.findUnique({ where: { id: "global" } });
          const minRedemption = (settings as any)?.minPointsRedemption ?? 500;
          
          if (redeemPoints < minRedemption) {
            return sendError(reply, 400, "MINIMUM_REDEMPTION_NOT_MET", `You must redeem at least ${minRedemption} points.`);
          }
          
          const userRes = await prisma.$queryRawUnsafe<{ loyaltyPoints: number }[]>(
            `SELECT "loyaltyPoints" FROM auth."User" WHERE id = $1`,
            guestId
          );
          
          if (!userRes[0] || userRes[0].loyaltyPoints < redeemPoints) {
            return sendError(reply, 400, "INSUFFICIENT_POINTS", "You do not have enough loyalty points to redeem.");
          }

          const ratio = (settings as any)?.pointsToCurrencyRatio ?? 100;
          pointsDiscount = redeemPoints / ratio;
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
          voucherAmount: voucherDiscount + pointsDiscount, // apply points as additional discount
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

        const booking = await (prisma.booking.create as any)({
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

            redeemPoints,
            pointsDiscount,
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

        // Immediately deduct redeemed points from the user's balance to prevent double-spending
        if (redeemPoints > 0) {
          const balRows = await prisma.$queryRawUnsafe<{ loyaltyPoints: number }[]>(
            `SELECT "loyaltyPoints" FROM auth."User" WHERE id = $1`, guestId,
          );
          const prevBalance = balRows[0]?.loyaltyPoints ?? 0;
          await prisma.$executeRawUnsafe(`
            UPDATE auth."User"
            SET "loyaltyPoints" = GREATEST(0, "loyaltyPoints" - $1), "updatedAt" = NOW()
            WHERE id = $2
          `, redeemPoints, guestId);
          const balanceAfter = Math.max(0, prevBalance - redeemPoints);
          await logLoyaltyTransaction({
            userId:      guestId,
            type:        "redeemed",
            points:      -redeemPoints,
            balanceAfter,
            bookingId:   booking.id,
            description: `Redeemed ${redeemPoints} pts at checkout for booking ${booking.reference}`,
          }).catch(() => {});
        }

        return sendSuccess(reply, 201, {
          bookingId: booking.id,
          bookingReference: booking.reference,
          totalAmount: Number(booking.totalAmount),
          currency: booking.currency,
          status: booking.status,
          voucherDiscount: voucherDiscount > 0 ? voucherDiscount : undefined,
        });
      } catch (err) {
        req.log.error({ err }, "Failed to create booking");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while creating the booking.");
      }
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

      try {
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

        // Confirm inside a transaction with a listing-level row lock so concurrent
        // payment webhooks cannot both confirm overlapping bookings simultaneously.
        const confirmedAt = new Date();
        try {
          await prisma.$transaction(async (tx) => {
            // Lock the listing row — serialises all confirmations for this listing.
            await tx.$queryRawUnsafe(
              `SELECT id FROM listing.listings WHERE id = $1 FOR UPDATE`,
              booking.listingId,
            );

            // Re-read booking status inside the TX to catch any concurrent confirm.
            const fresh = await tx.$queryRawUnsafe<{ status: string }[]>(
              `SELECT status FROM listing.bookings WHERE id = $1 FOR UPDATE`,
              id,
            );
            if (!fresh[0] || fresh[0].status !== "pending_payment") {
              throw Object.assign(new Error("Already processed"), { code: "ALREADY_PROCESSED" });
            }

            // Re-validate that no other confirmed booking occupies these dates.
            const startDate = booking.checkIn ?? booking.pickupDatetime;
            const endDate   = booking.checkOut ?? booking.returnDatetime;
            if (startDate && endDate) {
              const listing  = await tx.listing.findUnique({ where: { id: booking.listingId } });
              const unitCount = listing?.unitCount ?? 1;

              const conflicts = await tx.$queryRawUnsafe<{ id: string }[]>(`
                SELECT id FROM listing.bookings
                WHERE listing_id = $1
                  AND status = 'confirmed'
                  AND id != $2
                  AND (
                    (check_in IS NOT NULL AND check_in < $4 AND check_out > $3)
                    OR (pickup_datetime IS NOT NULL AND pickup_datetime < $4 AND return_datetime > $3)
                  )
              `, booking.listingId, id, startDate, endDate);

              if (conflicts.length >= unitCount) {
                throw Object.assign(new Error("Dates taken"), { code: "DATES_TAKEN" });
              }
            }

            await tx.booking.update({
              where: { id },
              data: { status: "confirmed", confirmedAt, paymentId },
            });

            await tx.bookingStatusLog.create({
              data: {
                bookingId: id,
                fromStatus: "pending_payment",
                toStatus: "confirmed",
                actorType: "system",
              },
            });
          });
        } catch (txErr: any) {
          if (txErr.code === "ALREADY_PROCESSED") {
            return reply.status(409).send({
              success: false,
              error: { code: "INVALID_STATUS", message: "Booking was already processed." },
            });
          }

          if (txErr.code === "DATES_TAKEN") {
            // Another booking confirmed these dates first — auto-cancel and refund points.
            await prisma.booking.update({
              where: { id },
              data: {
                status: "cancelled_by_system",
                cancellationReason: "Booking dates became unavailable before payment could be confirmed.",
                cancelledAt: new Date(),
                cancelledBy: "system",
              },
            }).catch(() => {});
            await prisma.bookingStatusLog.create({
              data: {
                bookingId: id,
                fromStatus: "pending_payment",
                toStatus: "cancelled_by_system",
                actorType: "system",
                reason: "Dates taken by a concurrent booking.",
              },
            }).catch(() => {});
            const redeemedPoints = Number((booking as any).redeemPoints ?? 0);
            if (redeemedPoints > 0) {
              await prisma.$executeRawUnsafe(`
                UPDATE auth."User"
                SET "loyaltyPoints" = "loyaltyPoints" + $1, "updatedAt" = NOW()
                WHERE id = $2
              `, redeemedPoints, booking.guestId).catch(() => {});
            }
            return reply.status(409).send({
              success: false,
              error: {
                code: "DATES_UNAVAILABLE",
                message: "These dates are no longer available. Your payment will be refunded.",
              },
            });
          }

          throw txErr;
        }

        // Send confirmation email (non-blocking)
        const confirmedListing = await prisma.listing.findUnique({
          where: { id: booking.listingId },
        });
        sendBookingConfirmationEmail(
          booking.guestEmail,
          `${booking.guestFirstName} ${booking.guestLastName}`,
          {
            reference: booking.reference,
            listingName: confirmedListing?.name ?? "Your listing",
            listingType: booking.listingType,
            checkIn: booking.checkIn?.toISOString(),
            checkOut: booking.checkOut?.toISOString(),
            pickupDatetime: booking.pickupDatetime?.toISOString(),
            returnDatetime: booking.returnDatetime?.toISOString(),
            nightsOrDays: booking.nightsOrDays,
            totalAmount: Number(booking.totalAmount),
            currency: booking.currency,
          },
        ).catch(() => { });

        fireNotification(booking.guestId, {
          type:  "booking_confirmed",
          title: "Booking Confirmed!",
          body:  `Your booking at ${confirmedListing?.name ?? "your listing"} (Ref: ${booking.reference}) is confirmed.`,
          data:  { bookingId: id, reference: booking.reference },
        });

        // Award loyalty points — cross-schema update to auth."User"
        // Earning rate: 1 point per $1 of totalAmount paid, multiplied by tier bonus (converted to USD)
        const amountInUSD = await convertCurrency(Number(booking.totalAmount), booking.currency, "USD");
        const basePoints = Math.floor(amountInUSD);
        if (basePoints > 0) {
          // Fetch current user tier and points AFTER points were already deducted at checkout
          const userRes = await prisma.$queryRawUnsafe<{ loyaltyPoints: number, currentTier: string, country: string }[]>(`
            SELECT "loyaltyPoints", "currentTier", "country" FROM auth."User" WHERE id = $1
          `, booking.guestId);

          const user = userRes[0];
          if (user) {
            // Tier multipliers per specification
            const tierMultipliers: Record<string, number> = {
              bronze: 1.0,
              silver: 1.15,
              gold: 1.25,
              diamond: 1.40,
            };
            const multiplier = tierMultipliers[user.currentTier.toLowerCase()] ?? 1.0;
            const earnedPoints = Math.floor(basePoints * multiplier);
            const newPoints = user.loyaltyPoints + earnedPoints;

            // Tier thresholds per specification
            let newTier = 'bronze';
            if (newPoints >= 5000) newTier = 'diamond';
            else if (newPoints >= 2000) newTier = 'gold';
            else if (newPoints >= 500) newTier = 'silver';

            // Tier-upgrade rules: only upgrade, never downgrade
            const tierRank: Record<string, number> = { bronze: 0, silver: 1, gold: 2, diamond: 3 };
            const currentRank = tierRank[user.currentTier.toLowerCase()] ?? 0;
            const newRank = tierRank[newTier] ?? 0;
            const finalTier = newRank > currentRank ? newTier : user.currentTier.toLowerCase();

            // Update user's points and tier, also record earnedPoints on the booking
            await Promise.all([
              prisma.$executeRawUnsafe(`
                UPDATE auth."User"
                SET
                  "loyaltyPoints" = $1,
                  "currentTier"   = $2::auth."LoyaltyTier",
                  "updatedAt" = NOW()
                WHERE id = $3
              `, newPoints, finalTier, booking.guestId),
              (prisma.booking.update as any)({
                where: { id },
                data: { earnedPoints },
              }),
            ]);

            // Log earned points transaction
            await logLoyaltyTransaction({
              userId:      booking.guestId,
              type:        "earned",
              points:      earnedPoints,
              balanceAfter: newPoints,
              bookingId:   id,
              description: `Earned from booking ${booking.reference} (${finalTier} tier × ${multiplier})`,
            }).catch(() => {});

            // Tier upgrade: send push notification + auto-assign vouchers
            if (finalTier !== user.currentTier.toLowerCase()) {
              const tierName = finalTier.charAt(0).toUpperCase() + finalTier.slice(1);

              // Find all vouchers with auto_assign=true filtered by the new tier
              const autoVouchers = await prisma.voucher.findMany({
                where: {
                  isActive: true,
                  autoAssign: true,
                  validUntil: { gte: new Date() },
                },
              });

              const tierVouchers = autoVouchers.filter((v) => {
                const tiers: string[] = ((v as any).applicableTiers || []).map((t: string) => t.toLowerCase());
                const tierMatches = tiers.length === 0 || tiers.includes(finalTier);
                
                const vCountry = (v as any).countryScope;
                const countryMatches = !vCountry || vCountry === user.country;

                return tierMatches && countryMatches;
              });

              // Actually assign the vouchers — create VoucherRedemption placeholder records
              // so the guest's wallet reflects the auto-assigned vouchers
              for (const v of tierVouchers) {
                await prisma.voucherRedemption.upsert({
                  where: { bookingId: `wallet-${booking.guestId}-${v.id}` },
                  create: {
                    voucherId: v.id,
                    bookingId: `wallet-${booking.guestId}-${v.id}`,
                    guestId:   booking.guestId,
                    discount:  0,
                  },
                  update: {},
                }).catch(() => {});
              }

              const vouchersAssigned = tierVouchers.length > 0;
              const notificationBody = vouchersAssigned
                ? `You've reached ${tierName}! Your exclusive voucher has been added.`
                : `Congratulations! You've reached ${tierName} status and unlocked new benefits.`;

              fireNotification(booking.guestId, {
                type:  "tier_upgrade",
                title: `You've reached ${tierName}! 🎉`,
                body:  notificationBody,
                data:  { tier: finalTier, voucherCodes: tierVouchers.map((v) => v.code) },
              });

              if (vouchersAssigned) {
                fireNotification(booking.guestId, {
                  type:  "voucher_assigned",
                  title: "New Voucher Added!",
                  body:  `A ${tierName} exclusive voucher has been added to your wallet.`,
                  data:  { voucherCodes: tierVouchers.map((v) => v.code) },
                });
              }
            }
          }
        }

        // Release Redis lock
        const lockSuffix = booking.checkIn
          ? `${booking.listingId}:${booking.checkIn.toISOString().slice(0, 10)}:${booking.checkOut?.toISOString().slice(0, 10)}`
          : `${booking.listingId}:${booking.pickupDatetime?.toISOString().slice(0, 10)}:${booking.returnDatetime?.toISOString().slice(0, 10)}`;
        await redis.del(`rlk:${lockSuffix}`).catch(() => { });

        return sendSuccess(reply, 200, { message: "Booking confirmed." });
      } catch (err) {
        req.log.error({ err }, "Failed to confirm booking");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while confirming the booking.");
      }
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

      try {
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

        // Refund any redeemed loyalty points back to the guest since payment failed
        const redeemedPoints = Number((booking as any).redeemPoints ?? 0);
        if (redeemedPoints > 0) {
          await prisma.$executeRawUnsafe(`
            UPDATE auth."User"
            SET "loyaltyPoints" = "loyaltyPoints" + $1, "updatedAt" = NOW()
            WHERE id = $2
          `, redeemedPoints, booking.guestId).catch(() => {});
        }

        return sendSuccess(reply, 200, { message: "Booking marked as failed." });
      } catch (err) {
        req.log.error({ err }, "Failed to mark booking as failed");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while marking the booking as failed.");
      }
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
                  currency: { type: "string" },
                  message: { type: "string" },
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

      try {
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

        // Trigger payout cancellation on payment-service
        notifyPayoutCancellation(id).catch((err) => {
          app.log.error({ err }, "Background payout cancellation notification failed");
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

        // Loyalty points adjustments on cancellation:
        // 1. Refund redeemed points (guest paid with points that are now voided)
        // 2. Reverse earned points if they were awarded at confirmation
        const redeemedPoints = Number((booking as any).redeemPoints ?? 0);
        const earnedPointsToReverse = Number((booking as any).earnedPoints ?? 0);
        const pointsDelta = redeemedPoints - earnedPointsToReverse;
        if (pointsDelta !== 0) {
          const balRows = await prisma.$queryRawUnsafe<{ loyaltyPoints: number }[]>(
            `SELECT "loyaltyPoints" FROM auth."User" WHERE id = $1`, guestId,
          ).catch(() => [] as { loyaltyPoints: number }[]);
          const prevBal = balRows[0]?.loyaltyPoints ?? 0;
          await prisma.$executeRawUnsafe(`
            UPDATE auth."User"
            SET "loyaltyPoints" = GREATEST(0, "loyaltyPoints" + $1), "updatedAt" = NOW()
            WHERE id = $2
          `, pointsDelta, guestId).catch(() => {});
          const newBal = Math.max(0, prevBal + pointsDelta);
          if (redeemedPoints > 0) {
            await logLoyaltyTransaction({
              userId: guestId, type: "refunded_redeemed",
              points: redeemedPoints, balanceAfter: newBal,
              bookingId: id, description: `Redeemed points refunded — booking ${booking.reference} cancelled by guest`,
            }).catch(() => {});
          }
          if (earnedPointsToReverse > 0) {
            await logLoyaltyTransaction({
              userId: guestId, type: "reversed_earned",
              points: -earnedPointsToReverse, balanceAfter: newBal,
              bookingId: id, description: `Earned points reversed — booking ${booking.reference} cancelled by guest`,
            }).catch(() => {});
          }
        }

        const cancelledListing = await prisma.listing.findUnique({
          where: { id: booking.listingId },
        });
        sendBookingCancellationEmail(
          booking.guestEmail,
          `${booking.guestFirstName} ${booking.guestLastName}`,
          {
            reference: booking.reference,
            listingName: cancelledListing?.name ?? "Your booking",
            refundAmount,
            currency: booking.currency,
          },
        ).catch(() => { });

        return sendSuccess(reply, 200, {
          refundAmount,
          currency: booking.currency,
          message: "Booking cancelled.",
          pointsRefunded: redeemedPoints > 0 ? redeemedPoints : undefined,
          pointsReversed: earnedPointsToReverse > 0 ? earnedPointsToReverse : undefined,
        });
      } catch (err) {
        req.log.error({ err }, "Failed to cancel booking by guest");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while cancelling the booking.");
      }
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
                  currency: { type: "string" },
                  message: { type: "string" },
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

      try {
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

        // Trigger payout cancellation on payment-service
        notifyPayoutCancellation(id).catch((err) => {
          app.log.error({ err }, "Background payout cancellation notification failed");
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

        // Loyalty points adjustments on provider cancellation:
        // Refund redeemed points + reverse earned points (full refund scenario)
        const redeemedPoints = Number((booking as any).redeemPoints ?? 0);
        const earnedPointsToReverse = Number((booking as any).earnedPoints ?? 0);
        const pointsDelta = redeemedPoints - earnedPointsToReverse;
        if (pointsDelta !== 0) {
          const balRows = await prisma.$queryRawUnsafe<{ loyaltyPoints: number }[]>(
            `SELECT "loyaltyPoints" FROM auth."User" WHERE id = $1`, booking.guestId,
          ).catch(() => [] as { loyaltyPoints: number }[]);
          const prevBal = balRows[0]?.loyaltyPoints ?? 0;
          await prisma.$executeRawUnsafe(`
            UPDATE auth."User"
            SET "loyaltyPoints" = GREATEST(0, "loyaltyPoints" + $1), "updatedAt" = NOW()
            WHERE id = $2
          `, pointsDelta, booking.guestId).catch(() => {});
          const newBal = Math.max(0, prevBal + pointsDelta);
          if (redeemedPoints > 0) {
            await logLoyaltyTransaction({
              userId: booking.guestId, type: "refunded_redeemed",
              points: redeemedPoints, balanceAfter: newBal,
              bookingId: id, description: `Redeemed points refunded — booking ${booking.reference} cancelled by provider`,
            }).catch(() => {});
          }
          if (earnedPointsToReverse > 0) {
            await logLoyaltyTransaction({
              userId: booking.guestId, type: "reversed_earned",
              points: -earnedPointsToReverse, balanceAfter: newBal,
              bookingId: id, description: `Earned points reversed — booking ${booking.reference} cancelled by provider`,
            }).catch(() => {});
          }
        }

        return sendSuccess(reply, 200, {
          refundAmount: Number(booking.totalAmount),
          currency: booking.currency,
          message: "Booking cancelled. Full refund will be issued.",
          pointsRefunded: redeemedPoints > 0 ? redeemedPoints : undefined,
          pointsReversed: earnedPointsToReverse > 0 ? earnedPointsToReverse : undefined,
        });
      } catch (err) {
        req.log.error({ err }, "Failed to cancel booking by provider");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while cancelling the booking.");
      }
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
            q: { type: "string", description: "Partial booking reference search" },
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
                  total: { type: "integer" },
                  nextCursor: { type: "string", nullable: true },
                  bookings: { type: "array", items: { type: "object", additionalProperties: true } },
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
      const status = q["status"];
      const searchRef = q["q"];
      const cursor = q["cursor"] ? parseInt(q["cursor"], 10) : 0;
      const limit = 20;

      const where: any = { guestId };

      if (status && status !== "all") {
        const statusMap: Record<string, string[]> = {
          upcoming: ["confirmed"],
          completed: ["completed"],
          cancelled: ["cancelled_by_guest", "cancelled_by_provider", "cancelled_by_system"],
        };
        if (statusMap[status]) where.status = { in: statusMap[status] };
      }

      if (searchRef) {
        where.reference = { contains: searchRef.toUpperCase() };
      }

      try {
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
        const page = hasMore ? bookings.slice(0, limit) : bookings;

        return sendSuccess(reply, 200, {
          total,
          nextCursor: hasMore ? String(cursor + limit) : null,
          bookings: page.map((b) => ({
            id: b.id,
            reference: b.reference,
            status: b.status,
            listingType: b.listingType,
            listingTitle: b.listing.name,
            listingPrimaryPhotoUrl: b.listing.photos[0]?.cdnUrl ?? null,
            checkIn: b.checkIn?.toISOString().slice(0, 10) ?? null,
            checkOut: b.checkOut?.toISOString().slice(0, 10) ?? null,
            pickupDatetime: b.pickupDatetime?.toISOString() ?? null,
            returnDatetime: b.returnDatetime?.toISOString() ?? null,
            nightsOrDays: b.nightsOrDays,
            totalAmount: Number(b.totalAmount),
            currency: b.currency,
            voucherDiscount: Number(b.voucherDiscount),
            pointsDiscount: (b as any).pointsDiscount ? Number((b as any).pointsDiscount) : undefined,
            earnedPoints: (b as any).earnedPoints ? Number((b as any).earnedPoints) : undefined,
            redeemPoints: (b as any).redeemPoints ? Number((b as any).redeemPoints) : undefined,
            createdAt: b.createdAt,
          })),
        });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch guest booking history");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching your bookings.");
      }
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

      try {
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
          id: booking.id,
          reference: booking.reference,
          status: booking.status,
          listingType: booking.listingType,
          listing: {
            id: booking.listing.id,
            title: booking.listing.name,
            address: booking.listing.address,
            town: booking.listing.town,
            country: booking.listing.country,
            primaryPhotoUrl: booking.listing.photos[0]?.cdnUrl ?? null,
          },
          checkIn: booking.checkIn?.toISOString().slice(0, 10) ?? null,
          checkOut: booking.checkOut?.toISOString().slice(0, 10) ?? null,
          pickupDatetime: booking.pickupDatetime?.toISOString() ?? null,
          returnDatetime: booking.returnDatetime?.toISOString() ?? null,
          nightsOrDays: booking.nightsOrDays,
          adults: booking.adults,
          children: booking.children,
          specialRequests: booking.specialRequests,
          guestFirstName: booking.guestFirstName,
          guestLastName: booking.guestLastName,
          guestEmail: booking.guestEmail,
          subtotal: Number(booking.subtotal),
          discountAmount: Number(booking.discountAmount),
          deliveryFee: Number(booking.deliveryFee),
          voucherCode: booking.voucherCode ?? null,
          voucherDiscount: Number(booking.voucherDiscount),
          totalAmount: Number(booking.totalAmount),
          currency: booking.currency,
          cancellationPolicy: booking.cancellationPolicy,
          refundAmount: booking.refundAmount ? Number(booking.refundAmount) : null,
          cancelledAt: booking.cancelledAt?.toISOString() ?? null,
          confirmedAt: booking.confirmedAt?.toISOString() ?? null,
          completedAt: booking.completedAt?.toISOString() ?? null,
          createdAt: booking.createdAt,
          canCancel,
        });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch booking detail");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching booking details.");
      }
    },
  );

  // ── PATCH /guests/me/bookings/:id/bind-commission — bind commission at payment step ───────────
  app.patch(
    "/guests/me/bookings/:id/bind-commission",
    {
      schema: {
        tags: ["Bookings"],
        summary: "Bind active commission rate to booking (Payment Step)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
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
          include: { listing: true },
        });

        if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
        if (booking.guestId !== guestId) {
          return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");
        }

        if (booking.status !== "pending_payment") {
          // Already bound/paid
          return sendSuccess(reply, 200, {
            id: booking.id,
            totalAmount: Number(booking.totalAmount),
            currency: booking.currency,
            commissionRate: Number(booking.commissionRate),
          });
        }

        // 1. Resolve current active commission rate
        const rate = await getEffectiveCommissionRate(booking.listing.country);

        // 2. Recalculate billing
        const billing = calculateBilling({
          listingCategory: booking.listingType,
          checkIn: booking.checkIn?.toISOString().slice(0, 10),
          checkOut: booking.checkOut?.toISOString().slice(0, 10),
          pickupDatetime: booking.pickupDatetime?.toISOString(),
          returnDatetime: booking.returnDatetime?.toISOString(),
          rate: booking.nightlyRate ? Number(booking.nightlyRate) : (booking.dailyRate ? Number(booking.dailyRate) : 0),
          deliveryFee: Number(booking.deliveryFee),
          promotionDiscount: Number(booking.discountAmount) - Number(booking.voucherDiscount),
          voucherAmount: Number(booking.voucherDiscount),
          taxRate: getTaxRate(booking.listing.country),
          commissionRate: rate,
        });

        // 3. Update the booking record
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            commissionRate: rate,
            commissionAmount: billing.commissionAmount,
            providerPayout: billing.providerPayout,
            totalAmount: billing.totalAmount,
            subtotal: billing.subtotal,
          },
        });

        return sendSuccess(reply, 200, {
          id: updated.id,
          totalAmount: Number(updated.totalAmount),
          currency: updated.currency,
          commissionRate: Number(updated.commissionRate),
        });
      } catch (err) {
        req.log.error({ err }, "Failed to bind commission rate to booking");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while binding the commission rate.");
      }
    }
  );

  // Note: GET /provider/bookings is in provider.ts (full pagination + status filter)
}