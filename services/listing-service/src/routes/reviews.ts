import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, requireProviderRole, type ProviderRequest } from "../middleware/auth.js";

export async function reviewRoutes(app: FastifyInstance) {
  // ── POST /reviews — guest submits a review ────────────────────────────
  app.post("/reviews", { schema: { tags: ["Reviews"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;
    const body = req.body as {
      bookingId: string;
      rating: number;
      title?: string;
      body?: string;
    };

    if (!body.bookingId || body.rating === undefined) {
      return sendError(reply, 400, "VALIDATION_ERROR", "bookingId and rating are required.");
    }
    if (body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Rating must be an integer between 1 and 5.");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId },
      include: { review: true },
    });

    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (booking.guestId !== guestId) return sendError(reply, 403, "FORBIDDEN", "This booking does not belong to you.");
    if (booking.status !== "completed") return sendError(reply, 409, "INVALID_STATUS", "Reviews can only be submitted for completed bookings.");
    if (booking.review) return sendError(reply, 409, "ALREADY_REVIEWED", "You have already reviewed this booking.");

    const review = await prisma.listingReview.create({
      data: {
        bookingId: body.bookingId,
        listingId: booking.listingId,
        guestId,
        rating: body.rating,
        title: body.title,
        body: body.body,
      },
    });

    // Auto-suspension logic (non-hotel listings only)
    const listing = await prisma.listing.findUnique({ where: { id: booking.listingId } });

    if (listing && listing.category !== "hotel") {
      if (body.rating >= 4) {
        // Reset consecutiveNegative on positive review
        await prisma.listing.update({
          where: { id: listing.id },
          data: { consecutiveNegative: 0 },
        });
      } else if (body.rating <= 2) {
        // Check last 2 reviews for this listing
        const lastTwoReviews = await prisma.listingReview.findMany({
          where: { listingId: listing.id, isHidden: false },
          orderBy: { createdAt: "desc" },
          take: 2,
        });

        const allNegative = lastTwoReviews.length === 2 && lastTwoReviews.every((r) => r.rating <= 2);
        if (allNegative) {
          await prisma.listing.update({
            where: { id: listing.id },
            data: {
              status: "auto_suspended",
              consecutiveNegative: { increment: 1 },
              suspendedAt: new Date(),
            },
          });
        } else {
          await prisma.listing.update({
            where: { id: listing.id },
            data: { consecutiveNegative: { increment: 1 } },
          });
        }
      }
    }

    return sendSuccess(reply, 201, { reviewId: review.id, message: "Review submitted successfully." });
  });

  // ── GET /listings/:id/reviews — public paginated reviews ─────────────
  app.get("/listings/:id/reviews", { schema: { tags: ["Reviews"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const q = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(q["page"] ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(q["limit"] ?? "10", 10)));
    const skip = (page - 1) * limit;

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const [reviews, total] = await Promise.all([
      prisma.listingReview.findMany({
        where: { listingId: id, isHidden: false },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.listingReview.count({ where: { listingId: id, isHidden: false } }),
    ]);

    const avgResult = await prisma.listingReview.aggregate({
      where: { listingId: id, isHidden: false },
      _avg: { rating: true },
    });
    const averageRating = avgResult._avg.rating ? Number(avgResult._avg.rating.toFixed(1)) : null;

    return sendSuccess(reply, 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      averageRating,
      reviews: reviews.map((r) => ({
        id: r.id,
        guestId: r.guestId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        providerReply: r.providerReply,
        providerRepliedAt: r.providerRepliedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  });

  // ── POST /reviews/:id/reply — provider replies to a review ────────────
  app.post("/reviews/:id/reply", { schema: { tags: ["Reviews"] }, preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const providerId = (req as ProviderRequest).providerId;
    const { id } = req.params as { id: string };
    const body = req.body as { reply: string };

    if (!body.reply?.trim()) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Reply text is required.");
    }

    const review = await prisma.listingReview.findUnique({
      where: { id },
      include: { booking: { include: { listing: true } } },
    });

    if (!review) return sendError(reply, 404, "NOT_FOUND", "Review not found.");
    if (review.booking.listing.providerId !== providerId) {
      return sendError(reply, 403, "FORBIDDEN", "This review is not for your listing.");
    }

    await prisma.listingReview.update({
      where: { id },
      data: {
        providerReply: body.reply.trim(),
        providerRepliedAt: new Date(),
      },
    });

    return sendSuccess(reply, 200, { message: "Reply submitted." });
  });

  // ── GET /reviews/me — guest's own reviews ────────────────────────────
  app.get("/reviews/me", { schema: { tags: ["Reviews"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as ProviderRequest).providerId;

    const reviews = await prisma.listingReview.findMany({
      where: { guestId },
      orderBy: { createdAt: "desc" },
      include: { listing: { select: { name: true } } },
    });

    return sendSuccess(reply, 200, {
      reviews: reviews.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        listingName: r.listing.name,
        bookingId: r.bookingId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        providerReply: r.providerReply,
        providerRepliedAt: r.providerRepliedAt?.toISOString() ?? null,
        isHidden: r.isHidden,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  });

  // ── PATCH /reviews/:id/hide — admin hide/unhide a review ─────────────
  app.patch("/reviews/:id/hide", { schema: { tags: ["Admin Reviews"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminKey = req.headers["x-admin-key"];
    const expectedKey = process.env["ADMIN_JWT_SECRET"];
    if (!adminKey || adminKey !== expectedKey) {
      return sendError(reply, 401, "UNAUTHORIZED", "Invalid admin key.");
    }

    const { id } = req.params as { id: string };
    const body = req.body as { hidden: boolean; reason?: string };

    if (body.hidden === undefined) {
      return sendError(reply, 400, "VALIDATION_ERROR", "hidden field is required.");
    }

    const review = await prisma.listingReview.findUnique({ where: { id } });
    if (!review) return sendError(reply, 404, "NOT_FOUND", "Review not found.");

    await prisma.listingReview.update({
      where: { id },
      data: {
        isHidden: body.hidden,
        hiddenBy: body.hidden ? "admin" : null,
        hiddenAt: body.hidden ? new Date() : null,
        hiddenReason: body.hidden ? (body.reason ?? null) : null,
      },
    });

    return sendSuccess(reply, 200, { message: `Review ${body.hidden ? "hidden" : "unhidden"} successfully.` });
  });
}
