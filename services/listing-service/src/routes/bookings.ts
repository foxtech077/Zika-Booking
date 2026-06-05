import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, requireProviderRole, type ProviderRequest } from "../middleware/auth.js";
import { getRedis } from "../lib/redis.js";
import { randomUUID } from "crypto";
import { sendBookingConfirmationEmail, sendBookingCancellationEmail } from "../lib/email.js";

const LOCK_TTL_MS = 300_000; // 5 minutes
const DEFAULT_COMMISSION_RATE = 0.05;

async function getCommissionRate(country: string | null): Promise<number> {
  if (!country) return DEFAULT_COMMISSION_RATE;
  const rate = await prisma.commissionRate.findUnique({ where: { country } });
  return rate ? Number(rate.rate) : DEFAULT_COMMISSION_RATE;
}

// ── Reference generator ───────────────────────────────────────────────────────

async function generateReference(countryCode: string): Promise<string> {
  const result = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('booking_seq') AS nextval`;
  const seq = Number(result[0]!.nextval);
  const padded = String(seq).padStart(4, "0");
  return `ZIKA-${padded}-${(countryCode ?? "XX").toUpperCase()}`;
}

// ── Pricing calculators ───────────────────────────────────────────────────────

function calcHotelApartmentPricing(listing: any, checkIn: string, checkOut: string, commissionRate: number = DEFAULT_COMMISSION_RATE) {
  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
  );
  const rate = Number(listing.pricePerNight ?? 0);
  const subtotal = rate * nights;

  let discountAmount = 0;
  if (
    listing.category === "apartment" &&
    listing.longStayEnabled &&
    listing.longStayMinNights &&
    nights >= listing.longStayMinNights
  ) {
    if (listing.longStayDiscountType === "percentage") {
      discountAmount = subtotal * (Number(listing.longStayDiscountValue ?? 0) / 100);
    } else {
      discountAmount = Number(listing.longStayDiscountValue ?? 0) * nights;
    }
  }

  const totalAmount = subtotal - discountAmount;
  const commissionAmount = totalAmount * commissionRate;
  const providerPayout = totalAmount - commissionAmount;

  return { nights, rate, subtotal, discountAmount, totalAmount, commissionAmount, providerPayout };
}

function calcCarPricing(listing: any, pickupDatetime: string, returnDatetime: string, deliveryRequested: boolean, commissionRate: number = DEFAULT_COMMISSION_RATE) {
  const rentalMs = new Date(returnDatetime).getTime() - new Date(pickupDatetime).getTime();
  const days = Math.ceil(rentalMs / 86_400_000);
  const rate = Number(listing.pricePerDay ?? 0);
  const subtotal = rate * days;
  const deliveryFee = deliveryRequested ? Number(listing.deliveryFee ?? 0) : 0;
  const totalAmount = subtotal + deliveryFee;
  const commissionAmount = totalAmount * commissionRate;
  const providerPayout = totalAmount - commissionAmount;

  return { days, rate, subtotal, deliveryFee, totalAmount, commissionAmount, providerPayout };
}

// ── Refund calculator ─────────────────────────────────────────────────────────

function calcRefund(booking: any): number {
  const total = Number(booking.totalAmount);
  const policy = booking.cancellationPolicy;
  const refDate = booking.checkIn ?? booking.pickupDatetime;
  if (!refDate) return 0;

  const hoursUntil = (new Date(refDate).getTime() - Date.now()) / 3_600_000;

  if (policy === "free") return hoursUntil >= 48 ? total : 0;
  if (policy === "moderate") {
    if (hoursUntil >= 168) return total; // 7 days
    if (hoursUntil >= 48) return total * 0.5;
    return 0;
  }
  if (policy === "strict") {
    if (hoursUntil >= 336) return total * 0.5; // 14 days
    return 0;
  }
  return 0; // non_refundable
}

// ── Route plugin ─────────────────────────────────────────────────────────────

export async function bookingRoutes(app: FastifyInstance) {
  const redis = getRedis();

  // ── POST /bookings/initiate — acquire reservation lock ─────────────────
  app.post("/bookings/initiate", { schema: { tags: ["Bookings"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    const listing = await prisma.listing.findUnique({ where: { id: body.listingId, deletedAt: null } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const validStatuses = listing.category === "hotel" ? ["approved"] : ["active"];
    if (!validStatuses.includes(listing.status)) {
      return reply.status(410).send({ success: false, error: { code: "LISTING_INACTIVE", message: "This listing is no longer available." } });
    }

    // Provider cannot book their own listing
    if (listing.providerId === guestId) {
      return sendError(reply, 403, "FORBIDDEN", "You cannot book your own listing.");
    }

    // Check pending booking limit (max 5)
    const pendingCount = await prisma.booking.count({ where: { guestId, status: "pending_payment" } });
    if (pendingCount >= 5) {
      return reply.status(429).send({ success: false, error: { code: "TOO_MANY_PENDING", message: "You have too many pending reservations. Please complete or cancel an existing booking first." } });
    }

    // Build lock key
    const lockKey = listing.category === "car"
      ? `rlk:${listing.id}:${body.pickupDatetime?.slice(0, 10)}:${body.returnDatetime?.slice(0, 10)}`
      : `rlk:${listing.id}:${body.checkIn}:${body.checkOut}`;

    const lockToken = randomUUID();
    const ctxKey = `rlk:ctx:${lockToken}`;

    // Try to acquire lock (SETNX)
    const acquired = await redis.set(lockKey, lockToken, "PX", LOCK_TTL_MS, "NX");
    if (!acquired) {
      // Check if this guest already holds it
      const existing = await redis.get(lockKey);
      if (existing) {
        const ctxRaw = await redis.get(`rlk:ctx:${existing}`);
        if (ctxRaw) {
          const ctx = JSON.parse(ctxRaw);
          if (ctx.guestId === guestId) {
            const ttl = await redis.pttl(lockKey);
            return sendSuccess(reply, 200, {
              lockToken: existing,
              expiresAt: new Date(Date.now() + ttl).toISOString(),
              resumed: true,
            });
          }
        }
      }
      return reply.status(409).send({ success: false, error: { code: "LISTING_UNAVAILABLE", message: "This listing is being reserved by another guest. Please try again in a few minutes." } });
    }

    // Store lock context
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

    // Compute pricing preview
    let pricingPreview: any = {};
    if (listing.category !== "car" && body.checkIn && body.checkOut) {
      const p = calcHotelApartmentPricing(listing, body.checkIn, body.checkOut);
      pricingPreview = { nights: p.nights, nightlyRate: p.rate, subtotal: p.subtotal, discountAmount: p.discountAmount, totalAmount: p.totalAmount, currency: listing.currency };
    } else if (listing.category === "car" && body.pickupDatetime && body.returnDatetime) {
      const p = calcCarPricing(listing, body.pickupDatetime, body.returnDatetime, body.deliveryRequested ?? false);
      pricingPreview = { days: p.days, dailyRate: p.rate, subtotal: p.subtotal, deliveryFee: p.deliveryFee, totalAmount: p.totalAmount, currency: listing.currency };
    }

    return sendSuccess(reply, 200, {
      lockToken,
      expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
      pricingPreview,
    });
  });

  // ── POST /bookings/lock/renew ──────────────────────────────────────────
  app.post("/bookings/lock/renew", { schema: { tags: ["Bookings"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;
    const { lockToken } = req.body as { lockToken: string };

    const ctxRaw = await redis.get(`rlk:ctx:${lockToken}`);
    if (!ctxRaw) return reply.status(409).send({ success: false, error: { code: "LOCK_EXPIRED", message: "Your reservation has expired." } });

    const ctx = JSON.parse(ctxRaw);
    if (ctx.guestId !== guestId) return sendError(reply, 403, "FORBIDDEN", "Lock does not belong to you.");
    if (ctx.renewed) return reply.status(409).send({ success: false, error: { code: "ALREADY_RENEWED", message: "This lock has already been renewed once." } });

    const lockKey = `rlk:${ctx.listingId}:${ctx.checkIn ?? ctx.pickupDatetime?.slice(0, 10)}:${ctx.checkOut ?? ctx.returnDatetime?.slice(0, 10)}`;
    ctx.renewed = true;

    await redis.pexpire(lockKey, LOCK_TTL_MS);
    await redis.set(`rlk:ctx:${lockToken}`, JSON.stringify(ctx), "PX", LOCK_TTL_MS);

    return sendSuccess(reply, 200, { expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString() });
  });

  // ── DELETE /bookings/lock/:lockToken — explicit abandon ───────────────
  app.delete("/bookings/lock/:lockToken", { schema: { tags: ["Bookings"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;
    const { lockToken } = req.params as { lockToken: string };

    const ctxRaw = await redis.get(`rlk:ctx:${lockToken}`);
    if (!ctxRaw) return reply.status(204).send();

    const ctx = JSON.parse(ctxRaw);
    if (ctx.guestId !== guestId) return sendError(reply, 403, "FORBIDDEN", "Lock does not belong to you.");

    const lockKey = `rlk:${ctx.listingId}:${ctx.checkIn ?? ctx.pickupDatetime?.slice(0, 10)}:${ctx.checkOut ?? ctx.returnDatetime?.slice(0, 10)}`;
    await redis.del(lockKey, `rlk:ctx:${lockToken}`);
    reply.status(204).send();
  });

  // ── POST /bookings — create pending_payment booking ───────────────────
  app.post("/bookings", { schema: { tags: ["Bookings"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
    if (!ctxRaw) {
      return reply.status(409).send({ success: false, error: { code: "LOCK_EXPIRED", message: "Your reservation has expired." } });
    }
    const ctx = JSON.parse(ctxRaw);
    if (ctx.guestId !== guestId) return sendError(reply, 403, "FORBIDDEN", "Lock does not belong to you.");

    const listing = await prisma.listing.findUnique({ where: { id: body.listingId, deletedAt: null } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const validStatuses = listing.category === "hotel" ? ["approved"] : ["active"];
    if (!validStatuses.includes(listing.status)) {
      return reply.status(410).send({ success: false, error: { code: "LISTING_INACTIVE", message: "This listing is no longer available." } });
    }

    // Dynamic commission rate
    const commissionRate = await getCommissionRate(listing.country ?? null);

    // Server-side pricing
    let nights = 0, days = 0, rate = 0, subtotal = 0, discountAmount = 0, deliveryFee = 0, totalAmount = 0, commissionAmount = 0, providerPayout = 0;

    if (listing.category !== "car" && body.checkIn && body.checkOut) {
      const p = calcHotelApartmentPricing(listing, body.checkIn, body.checkOut, commissionRate);
      nights = p.nights; rate = p.rate; subtotal = p.subtotal;
      discountAmount = p.discountAmount; totalAmount = p.totalAmount;
      commissionAmount = p.commissionAmount; providerPayout = p.providerPayout;
    } else if (listing.category === "car" && body.pickupDatetime && body.returnDatetime) {
      const p = calcCarPricing(listing, body.pickupDatetime, body.returnDatetime, body.deliveryRequested ?? false, commissionRate);
      days = p.days; rate = p.rate; subtotal = p.subtotal;
      deliveryFee = p.deliveryFee; totalAmount = p.totalAmount;
      commissionAmount = p.commissionAmount; providerPayout = p.providerPayout;
    }

    // Voucher handling
    let appliedVoucher: { id: string; code: string } | null = null;
    let voucherDiscount = 0;

    if (body.voucherCode) {
      const now = new Date();
      const voucher = await prisma.voucher.findUnique({ where: { code: body.voucherCode } });

      if (!voucher) {
        return sendError(reply, 400, "INVALID_VOUCHER", "Voucher code not found.");
      }
      if (!voucher.isActive) {
        return sendError(reply, 400, "INVALID_VOUCHER", "Voucher is not active.");
      }
      if (now < voucher.validFrom || now > voucher.validUntil) {
        return sendError(reply, 400, "INVALID_VOUCHER", "Voucher has expired or is not yet valid.");
      }
      if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
        return sendError(reply, 400, "INVALID_VOUCHER", "Voucher usage limit has been reached.");
      }
      if (voucher.minOrderValue !== null && totalAmount < Number(voucher.minOrderValue)) {
        return sendError(reply, 400, "INVALID_VOUCHER", `Minimum order value of ${Number(voucher.minOrderValue)} required.`);
      }

      if (voucher.discountType === "percentage") {
        voucherDiscount = totalAmount * (Number(voucher.discountValue) / 100);
      } else {
        voucherDiscount = Number(voucher.discountValue);
      }

      if (voucher.maxDiscount !== null && voucherDiscount > Number(voucher.maxDiscount)) {
        voucherDiscount = Number(voucher.maxDiscount);
      }

      voucherDiscount = Math.min(voucherDiscount, totalAmount);
      totalAmount = totalAmount - voucherDiscount;

      // Recalculate commission and payout based on discounted total
      commissionAmount = totalAmount * commissionRate;
      providerPayout = totalAmount - commissionAmount;

      appliedVoucher = { id: voucher.id, code: voucher.code };
    }

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
        pickupDatetime: body.pickupDatetime ? new Date(body.pickupDatetime) : undefined,
        returnDatetime: body.returnDatetime ? new Date(body.returnDatetime) : undefined,
        nightsOrDays: nights || days,
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
        discountAmount,
        deliveryFee,
        totalAmount,
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
      data: { bookingId: booking.id, toStatus: "pending_payment", actorType: "guest", changedBy: guestId },
    });

    // Record voucher redemption
    if (appliedVoucher) {
      await Promise.all([
        prisma.voucher.update({ where: { id: appliedVoucher.id }, data: { usageCount: { increment: 1 } } }),
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
      bookingId: booking.id,
      bookingReference: booking.reference,
      totalAmount: Number(booking.totalAmount),
      currency: booking.currency,
      status: booking.status,
      voucherDiscount: voucherDiscount > 0 ? voucherDiscount : undefined,
    });
  });

  // ── PATCH /bookings/:id/confirm — internal payment callback ───────────
  app.patch("/bookings/:id/confirm", { schema: { tags: ["Bookings"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { paymentId } = req.body as { paymentId?: string };

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (booking.status !== "pending_payment") {
      return reply.status(409).send({ success: false, error: { code: "INVALID_STATUS", message: `Cannot confirm booking in status: ${booking.status}` } });
    }

    await prisma.booking.update({
      where: { id },
      data: { status: "confirmed", confirmedAt: new Date(), paymentId },
    });

    await prisma.bookingStatusLog.create({
      data: { bookingId: id, fromStatus: "pending_payment", toStatus: "confirmed", actorType: "system" },
    });

    // E8: Send confirmation email
    const confirmedListing = await prisma.listing.findUnique({ where: { id: booking.listingId } });
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
    ).catch(() => {});

    // E16: Award loyalty points (1 point per USD equivalent)
    const points = Math.floor(Number(booking.totalAmount));
    if (points > 0) {
      // Update User table in shared DB using raw SQL
      await prisma.$executeRaw`
        UPDATE "User"
        SET
          "loyaltyPoints" = "loyaltyPoints" + ${points},
          "currentTier" = CASE
            WHEN "loyaltyPoints" + ${points} >= 15000 THEN 'diamond'::"LoyaltyTier"
            WHEN "loyaltyPoints" + ${points} >= 5000  THEN 'gold'::"LoyaltyTier"
            WHEN "loyaltyPoints" + ${points} >= 1000  THEN 'silver'::"LoyaltyTier"
            ELSE 'bronze'::"LoyaltyTier"
          END,
          "updatedAt" = NOW()
        WHERE id = ${booking.guestId}
      `;
    }

    // Release Redis lock
    const ctx = booking.checkIn
      ? `${booking.listingId}:${booking.checkIn.toISOString().slice(0, 10)}:${booking.checkOut?.toISOString().slice(0, 10)}`
      : `${booking.listingId}:${booking.pickupDatetime?.toISOString().slice(0, 10)}:${booking.returnDatetime?.toISOString().slice(0, 10)}`;
    await redis.del(`rlk:${ctx}`).catch(() => {});

    return sendSuccess(reply, 200, { message: "Booking confirmed." });
  });

  // ── PATCH /bookings/:id/fail — internal payment failure ───────────────
  app.patch("/bookings/:id/fail", { schema: { tags: ["Bookings"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { failureReason } = req.body as { failureReason?: string };

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

    await prisma.booking.update({
      where: { id },
      data: { status: "cancelled_by_system", cancellationReason: failureReason ?? "Payment failed", cancelledAt: new Date(), cancelledBy: "system" },
    });

    await prisma.bookingStatusLog.create({
      data: { bookingId: id, fromStatus: "pending_payment", toStatus: "cancelled_by_system", actorType: "system", reason: failureReason },
    });

    return sendSuccess(reply, 200, { message: "Booking marked as failed." });
  });

  // ── POST /bookings/:id/cancel — guest cancellation ────────────────────
  app.post("/bookings/:id/cancel", { schema: { tags: ["Bookings"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (booking.guestId !== guestId) return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");
    if (booking.status === "completed") return reply.status(409).send({ success: false, error: { code: "ALREADY_COMPLETED", message: "Completed bookings cannot be cancelled." } });
    if (booking.status !== "confirmed") return reply.status(409).send({ success: false, error: { code: "INVALID_STATUS", message: "Only confirmed bookings can be cancelled." } });

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
      data: { bookingId: id, fromStatus: "confirmed", toStatus: "cancelled_by_guest", actorType: "guest", changedBy: guestId, reason },
    });

    const cancelledListing = await prisma.listing.findUnique({ where: { id: booking.listingId } });
    sendBookingCancellationEmail(
      booking.guestEmail,
      `${booking.guestFirstName} ${booking.guestLastName}`,
      { reference: booking.reference, listingName: cancelledListing?.name ?? "Your booking", refundAmount, currency: booking.currency },
    ).catch(() => {});

    return sendSuccess(reply, 200, { refundAmount, currency: booking.currency, message: "Booking cancelled." });
  });

  // ── POST /provider/bookings/:id/cancel — provider cancellation ────────
  app.post("/provider/bookings/:id/cancel", { schema: { tags: ["Bookings"] }, preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;
    const { id } = req.params as { id: string };
    const { reasonCode, reasonText } = req.body as { reasonCode: string; reasonText?: string };

    const booking = await prisma.booking.findUnique({ where: { id }, include: { listing: true } });
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (booking.listing.providerId !== providerId) return sendError(reply, 403, "FORBIDDEN", "This booking is not for your listing.");
    if (booking.status !== "confirmed") return reply.status(409).send({ success: false, error: { code: "INVALID_STATUS", message: "Only confirmed bookings can be cancelled by the provider." } });

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
      data: { bookingId: id, fromStatus: "confirmed", toStatus: "cancelled_by_provider", actorType: "provider", changedBy: providerId, reason: reasonText ?? reasonCode },
    });

    return sendSuccess(reply, 200, { refundAmount: Number(booking.totalAmount), currency: booking.currency, message: "Booking cancelled. Full refund will be issued." });
  });

  // ── GET /guests/me/bookings — guest booking history ───────────────────
  app.get("/guests/me/bookings", { schema: { tags: ["Bookings"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;
    const q = req.query as Record<string, string>;
    const status = q["status"];
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

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: cursor,
        take: limit + 1,
        include: { listing: { include: { photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 } } } },
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
        createdAt: b.createdAt,
      })),
    });
  });

  // ── GET /guests/me/bookings/:id — booking detail ──────────────────────
  app.get("/guests/me/bookings/:id", { schema: { tags: ["Bookings"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;
    const { id } = req.params as { id: string };

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { listing: { include: { photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 } } } },
    });

    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (booking.guestId !== guestId) return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");

    const canCancel = booking.status === "confirmed" && booking.checkIn && booking.checkIn > new Date();

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
  });

  // Note: GET /provider/bookings has been moved to provider.ts to support pagination, search and status filtering.
}
