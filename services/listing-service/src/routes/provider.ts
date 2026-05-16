import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess } from "../lib/errors.js";
import { requireProviderRole, type ProviderRequest } from "../middleware/auth.js";

export async function providerRoutes(app: FastifyInstance) {
  // ── GET /provider/dashboard ───────────────────────────────────────────
  app.get("/provider/dashboard", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalEarningsResult,
      thisMonthEarningsResult,
      activeListingsCount,
      pendingBookingsCount,
      completedBookingsCount,
      recentBookings,
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
        include: { listing: { select: { name: true } } },
      }),
    ]);

    // Monthly revenue for last 6 months
    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthLabel = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

      const result = await prisma.booking.aggregate({
        where: {
          providerId,
          status: { in: ["confirmed", "completed"] },
          confirmedAt: { gte: start, lte: end },
        },
        _sum: { providerPayout: true },
      });

      monthlyRevenue.push({
        month: monthLabel,
        revenue: Number(result._sum.providerPayout ?? 0),
      });
    }

    return sendSuccess(reply, 200, {
      totalEarnings: Number(totalEarningsResult._sum.providerPayout ?? 0),
      thisMonthEarnings: Number(thisMonthEarningsResult._sum.providerPayout ?? 0),
      activeListingsCount,
      pendingBookingsCount,
      completedBookingsCount,
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        listingTitle: b.listing.name,
        guestName: `${b.guestFirstName} ${b.guestLastName}`,
        checkIn: b.checkIn?.toISOString().slice(0, 10) ?? null,
        checkOut: b.checkOut?.toISOString().slice(0, 10) ?? null,
        pickupDatetime: b.pickupDatetime?.toISOString() ?? null,
        returnDatetime: b.returnDatetime?.toISOString() ?? null,
        totalAmount: Number(b.totalAmount),
        currency: b.currency,
        status: b.status,
      })),
      monthlyRevenue,
    });
  });

  // ── GET /provider/listings/summary — listing performance summary ───────
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
        _count: {
          select: { bookings: true },
        },
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
          id: l.id,
          name: l.name,
          category: l.category,
          status: l.status,
          bookingCount: l._count.bookings,
          totalRevenue,
          currency: l.currency,
          averageRating: avgRating,
          reviewCount: l.reviews.length,
        };
      }),
    });
  });
}
