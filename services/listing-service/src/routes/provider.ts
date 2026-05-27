import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProviderRole, type ProviderRequest } from "../middleware/auth.js";

// ── Schemas ───────────────────────────────────────────────────────────────────

const blockDatesSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:    z.string().max(200).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function providerRoutes(app: FastifyInstance) {

  // ── GET /provider/dashboard ───────────────────────────────────────────
  app.get("/provider/dashboard", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalEarningsResult,
      thisMonthEarningsResult,
      activeListingsCount,
      pendingBookingsCount,
      completedBookingsCount,
      recentBookings,
      unreadMessages,
      pendingReviews,
    ] = await Promise.all([
      prisma.booking.aggregate({
        where: { providerId, status: { in: ["confirmed", "completed"] } },
        _sum: { providerPayout: true },
      }),
      prisma.booking.aggregate({
        where: {
          providerId,
          status: { in: ["confirmed", "completed"] },
          confirmedAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { providerPayout: true },
      }),
      prisma.listing.count({
        where: { providerId, status: { in: ["active", "approved"] }, deletedAt: null },
      }),
      prisma.booking.count({
        where: {
          providerId,
          status: "confirmed",
          OR: [
            { checkOut: { gt: now } },
            { returnDatetime: { gt: now } },
          ],
        },
      }),
      prisma.booking.count({ where: { providerId, status: "completed" } }),
      prisma.booking.findMany({
        where: { providerId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { listing: { select: { name: true, category: true } } },
      }),
      prisma.message.count({
        where: {
          readAt: null,
          NOT: { senderId: providerId },
          conversation: { providerId },
        },
      }),
      prisma.listingReview.count({
        where: {
          providerReply: null,
          listing: { providerId },
          isHidden: false,
        },
      }),
    ]);

    // Monthly revenue for last 6 months
    const monthlyRevenue: { month: string; revenue: number; bookings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

      const [result, bCount] = await Promise.all([
        prisma.booking.aggregate({
          where: {
            providerId,
            status: { in: ["confirmed", "completed"] },
            confirmedAt: { gte: start, lte: end },
          },
          _sum: { providerPayout: true },
        }),
        prisma.booking.count({
          where: {
            providerId,
            status: { in: ["confirmed", "completed"] },
            confirmedAt: { gte: start, lte: end },
          },
        }),
      ]);

      monthlyRevenue.push({
        month: monthLabel,
        revenue: Number(result._sum.providerPayout ?? 0),
        bookings: bCount,
      });
    }

    return sendSuccess(reply, 200, {
      totalEarnings:        Number(totalEarningsResult._sum.providerPayout ?? 0),
      thisMonthEarnings:    Number(thisMonthEarningsResult._sum.providerPayout ?? 0),
      activeListingsCount,
      pendingBookingsCount,
      completedBookingsCount,
      unreadMessages,
      pendingReviews,
      recentBookings: recentBookings.map((b) => ({
        id:              b.id,
        reference:       b.reference,
        listingTitle:    b.listing.name,
        listingCategory: b.listing.category,
        guestName:       `${b.guestFirstName} ${b.guestLastName}`,
        guestEmail:      b.guestEmail,
        checkIn:         b.checkIn?.toISOString().slice(0, 10) ?? null,
        checkOut:        b.checkOut?.toISOString().slice(0, 10) ?? null,
        pickupDatetime:  b.pickupDatetime?.toISOString() ?? null,
        returnDatetime:  b.returnDatetime?.toISOString() ?? null,
        totalAmount:     Number(b.totalAmount),
        providerPayout:  Number(b.providerPayout),
        currency:        b.currency,
        status:          b.status,
        createdAt:       b.createdAt.toISOString(),
      })),
      monthlyRevenue,
    });
  });

  // ── GET /provider/listings/summary ────────────────────────────────────
  app.get("/provider/listings/summary", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;

    const listings = await prisma.listing.findMany({
      where: { providerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        bookings: {
          where: { status: { in: ["confirmed", "completed"] } },
          select: { providerPayout: true },
        },
        reviews: {
          where: { isHidden: false },
          select: { rating: true },
        },
        _count: { select: { bookings: true } },
      },
    });

    return sendSuccess(reply, 200, {
      listings: listings.map((l) => {
        const totalRevenue = l.bookings.reduce((sum, b) => sum + Number(b.providerPayout), 0);
        const avgRating =
          l.reviews.length > 0
            ? Number((l.reviews.reduce((sum, r) => sum + r.rating, 0) / l.reviews.length).toFixed(1))
            : null;

        return {
          id:            l.id,
          name:          l.name,
          category:      l.category,
          status:        l.status,
          bookingCount:  l._count.bookings,
          totalRevenue,
          currency:      l.currency,
          averageRating: avgRating,
          reviewCount:   l.reviews.length,
        };
      }),
    });
  });

  // ── GET /provider/bookings — paginated provider bookings ──────────────
  app.get("/provider/bookings", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;
    const q = req.query as Record<string, string>;
    const offset   = Math.max(0, parseInt(q["offset"] ?? "0", 10));
    const limit    = Math.min(50, Math.max(1, parseInt(q["limit"] ?? "20", 10)));
    const status   = q["status"];
    const search   = q["search"];

    const where: Record<string, unknown> = { providerId };
    if (status && status !== "all") where["status"] = status;
    if (search) {
      where["OR"] = [
        { reference:     { contains: search, mode: "insensitive" } },
        { guestFirstName:{ contains: search, mode: "insensitive" } },
        { guestLastName: { contains: search, mode: "insensitive" } },
        { guestEmail:    { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: { listing: { select: { name: true, category: true } } },
      }),
    ]);

    return sendSuccess(reply, 200, {
      total,
      offset,
      limit,
      bookings: bookings.map((b) => ({
        id:              b.id,
        reference:       b.reference,
        listingTitle:    b.listing.name,
        listingCategory: b.listing.category,
        guestFirstName:  b.guestFirstName,
        guestLastName:   b.guestLastName,
        guestEmail:      b.guestEmail,
        guestPhone:      b.guestPhone,
        adults:          b.adults,
        children:        b.children,
        checkIn:         b.checkIn?.toISOString().slice(0, 10) ?? null,
        checkOut:        b.checkOut?.toISOString().slice(0, 10) ?? null,
        pickupDatetime:  b.pickupDatetime?.toISOString() ?? null,
        returnDatetime:  b.returnDatetime?.toISOString() ?? null,
        nightsOrDays:    b.nightsOrDays,
        totalAmount:     Number(b.totalAmount),
        providerPayout:  Number(b.providerPayout),
        commissionAmount:Number(b.commissionAmount),
        currency:        b.currency,
        status:          b.status,
        cancellationPolicy: b.cancellationPolicy,
        specialRequests: b.specialRequests,
        confirmedAt:     b.confirmedAt?.toISOString() ?? null,
        cancelledAt:     b.cancelledAt?.toISOString() ?? null,
        cancellationReason: b.cancellationReason,
        createdAt:       b.createdAt.toISOString(),
      })),
    });
  });

  // ── GET /provider/reviews — paginated provider reviews ────────────────
  app.get("/provider/reviews", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;
    const q = req.query as Record<string, string>;
    const offset   = Math.max(0, parseInt(q["offset"] ?? "0", 10));
    const limit    = Math.min(50, Math.max(1, parseInt(q["limit"] ?? "20", 10)));
    const rating   = q["rating"] ? parseInt(q["rating"], 10) : undefined;
    const replied  = q["replied"]; // "yes" | "no"

    const where: Record<string, unknown> = {
      listing: { providerId },
      isHidden: false,
    };
    if (rating) where["rating"] = rating;
    if (replied === "yes") where["providerReply"] = { not: null };
    if (replied === "no")  where["providerReply"] = null;

    const [total, reviews, aggregate] = await Promise.all([
      prisma.listingReview.count({ where }),
      prisma.listingReview.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          listing: { select: { id: true, name: true, category: true } },
          booking: { select: { reference: true, guestFirstName: true, guestLastName: true } },
        },
      }),
      prisma.listingReview.aggregate({
        where: { listing: { providerId }, isHidden: false },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    // Rating distribution
    const distribution = await prisma.listingReview.groupBy({
      by: ["rating"],
      where: { listing: { providerId }, isHidden: false },
      _count: { rating: true },
    });

    return sendSuccess(reply, 200, {
      total,
      offset,
      limit,
      averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : null,
      totalReviews:  aggregate._count.rating,
      distribution:  distribution.map((d) => ({ rating: d.rating, count: d._count.rating })),
      reviews: reviews.map((r) => ({
        id:               r.id,
        listingId:        r.listing.id,
        listingName:      r.listing.name,
        listingCategory:  r.listing.category,
        bookingReference: r.booking.reference,
        guestName:        `${r.booking.guestFirstName} ${r.booking.guestLastName}`,
        rating:           r.rating,
        title:            r.title,
        body:             r.body,
        providerReply:    r.providerReply,
        providerRepliedAt:r.providerRepliedAt?.toISOString() ?? null,
        createdAt:        r.createdAt.toISOString(),
      })),
    });
  });

  // ── GET /provider/earnings — earnings summary ─────────────────────────
  app.get("/provider/earnings", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;
    const now        = new Date();

    // Last 12 months monthly breakdown
    const monthly: { month: string; revenue: number; commission: number; payout: number; bookings: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

      const [agg, cnt] = await Promise.all([
        prisma.booking.aggregate({
          where: {
            providerId,
            status: { in: ["confirmed", "completed"] },
            confirmedAt: { gte: start, lte: end },
          },
          _sum: { totalAmount: true, commissionAmount: true, providerPayout: true },
        }),
        prisma.booking.count({
          where: {
            providerId,
            status: { in: ["confirmed", "completed"] },
            confirmedAt: { gte: start, lte: end },
          },
        }),
      ]);

      monthly.push({
        month:      label,
        revenue:    Number(agg._sum.totalAmount ?? 0),
        commission: Number(agg._sum.commissionAmount ?? 0),
        payout:     Number(agg._sum.providerPayout ?? 0),
        bookings:   cnt,
      });
    }

    // All-time totals
    const allTime = await prisma.booking.aggregate({
      where: { providerId, status: { in: ["confirmed", "completed"] } },
      _sum: { totalAmount: true, commissionAmount: true, providerPayout: true },
    });

    // Recent completed bookings as "payout records"
    const recentPayouts = await prisma.booking.findMany({
      where: { providerId, status: { in: ["confirmed", "completed"] } },
      orderBy: { confirmedAt: "desc" },
      take: 20,
      include: { listing: { select: { name: true, category: true } } },
    });

    return sendSuccess(reply, 200, {
      allTime: {
        revenue:    Number(allTime._sum.totalAmount ?? 0),
        commission: Number(allTime._sum.commissionAmount ?? 0),
        payout:     Number(allTime._sum.providerPayout ?? 0),
      },
      monthly,
      recentPayouts: recentPayouts.map((b) => ({
        id:            b.id,
        reference:     b.reference,
        listingName:   b.listing.name,
        category:      b.listing.category,
        totalAmount:   Number(b.totalAmount),
        commission:    Number(b.commissionAmount),
        payout:        Number(b.providerPayout),
        currency:      b.currency,
        status:        b.status,
        confirmedAt:   b.confirmedAt?.toISOString() ?? null,
      })),
    });
  });

  // ── GET /provider/availability/:listingId — booked + blocked dates ────
  app.get("/provider/availability/:listingId", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId  = (req as ProviderRequest).providerId;
    const { listingId } = req.params as { listingId: string };
    const { from, to } = req.query as { from?: string; to?: string };

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, providerId, deletedAt: null },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter["gte"] = new Date(from);
    if (to)   dateFilter["lte"] = new Date(to);

    const [confirmedBookings, blockedDates] = await Promise.all([
      prisma.booking.findMany({
        where: {
          listingId,
          status: { in: ["confirmed", "pending_payment"] },
          ...(from || to ? {
            OR: [
              { checkIn:        Object.keys(dateFilter).length ? dateFilter : undefined },
              { pickupDatetime: Object.keys(dateFilter).length ? dateFilter : undefined },
            ].filter(Boolean),
          } : {}),
        },
        select: {
          id: true,
          reference: true,
          checkIn: true,
          checkOut: true,
          pickupDatetime: true,
          returnDatetime: true,
          status: true,
          guestFirstName: true,
          guestLastName: true,
        },
      }),
      prisma.icalBlockedDate.findMany({
        where: {
          listingId,
          ...(from ? { startDate: { gte: new Date(from) } } : {}),
          ...(to   ? { endDate:   { lte: new Date(to) } }   : {}),
        },
        include: { feed: { select: { platform: true } } },
        orderBy: { startDate: "asc" },
      }),
    ]);

    return sendSuccess(reply, 200, {
      listingId,
      bookedRanges: confirmedBookings.map((b) => ({
        id:        b.id,
        reference: b.reference,
        start:     b.checkIn?.toISOString().slice(0, 10) ?? b.pickupDatetime?.toISOString().slice(0, 10) ?? null,
        end:       b.checkOut?.toISOString().slice(0, 10) ?? b.returnDatetime?.toISOString().slice(0, 10) ?? null,
        status:    b.status,
        guestName: `${b.guestFirstName} ${b.guestLastName}`,
        type:      "booking",
      })),
      blockedRanges: blockedDates.map((bd) => ({
        id:       bd.id,
        start:    bd.startDate.toISOString().slice(0, 10),
        end:      bd.endDate.toISOString().slice(0, 10),
        summary:  bd.summary,
        platform: bd.feed.platform,
        type:     "ical_block",
      })),
    });
  });
}
