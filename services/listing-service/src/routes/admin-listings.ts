import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireAdmin, type AdminRequest } from "../middleware/auth.js";
import { createPresignedDownloadUrl } from "../lib/s3.js";
import {
  sendListingApprovedEmail,
  sendListingRejectedEmail,
  sendListingSuspendedEmail,
  sendStarRatingUpdatedEmail,
} from "../lib/email.js";

const REJECTION_REASONS = new Set([
  "Insufficient documentation",
  "Operating permit expired",
  "Star rating unverifiable from submitted documents",
  "Document image quality too poor to verify",
  "Business name on documents does not match listing name",
  "Other",
]);

// ── Routes ────────────────────────────────────────────────────────────────────

export async function adminListingRoutes(app: FastifyInstance) {

  // GET /admin/listings/review-queue (UC-2.8)
  app.get("/admin/listings/review-queue", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { country, starRating, slaStatus, page = "1", limit = "20", sortBy = "sla_deadline" } = req.query as Record<string, string>;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const now = new Date();
    const slaFilter =
      slaStatus === "breached" ? { slaDeadline: { lt: now } } :
      slaStatus === "approaching" ? { slaDeadline: { gte: now, lt: new Date(now.getTime() + 4 * 60 * 60 * 1000) } } :
      slaStatus === "ok" ? { slaDeadline: { gte: new Date(now.getTime() + 4 * 60 * 60 * 1000) } } :
      {};

    const isCountryManager = admin.adminRole === "country_manager";

    const tasks = await prisma.listingReviewTask.findMany({
      where: {
        status: "open",
        ...slaFilter,
        listing: {
          status: "pending_review",
          ...(isCountryManager ? { country: admin.adminRole } : {}),
          ...(country ? { country } : {}),
          ...(starRating ? { claimedStarRating: parseInt(starRating, 10) } : {}),
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            name: true,
            country: true,
            town: true,
            claimedStarRating: true,
            submissionCount: true,
            submittedAt: true,
            providerId: true,
            category: true,
            photos: {
              where: { deletedAt: null },
              orderBy: { position: "asc" },
              select: {
                id: true,
                cdnUrl: true,
                position: true,
              },
            },
          },
        },
      },
      orderBy: sortBy === "submitted_at" ? { listing: { submittedAt: "asc" } } : { slaDeadline: "asc" },
      skip,
      take,
    });

    const total = await prisma.listingReviewTask.count({
      where: { status: "open", listing: { status: "pending_review" } },
    });

    return sendSuccess(reply, 200, { tasks, total, page: parseInt(page, 10), limit: take });
  });

  // GET /admin/listings/:id/review — Full listing detail for review (UC-2.9)
  app.get("/admin/listings/:id/review", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        photos: { where: { deletedAt: null }, orderBy: { position: "asc" } },
        documents: { where: { replacedAt: null } },
        amenities: true,
        customAmenities: true,
        reviewTasks: { where: { status: "open" }, take: 1, orderBy: { createdAt: "desc" } },
      },
    });

    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    return sendSuccess(reply, 200, listing);
  });

  // GET /admin/listings/:id/documents/:docId — Presigned download URL for document viewer
  app.get("/admin/listings/:id/documents/:docId", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, docId } = req.params as { id: string; docId: string };

    const doc = await prisma.listingDocument.findFirst({ where: { id: docId, listingId: id } });
    if (!doc) return sendError(reply, 404, "NOT_FOUND", "Document not found.");

    const url = await createPresignedDownloadUrl(doc.s3Key, 900);
    return sendSuccess(reply, 200, { url, fileType: doc.fileType });
  });

  // PATCH /admin/listings/review-tasks/:taskId/assign — Self-assign review task (UC-2.8 A3)
  app.patch("/admin/listings/review-tasks/:taskId/assign", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { taskId } = req.params as { taskId: string };

    const task = await prisma.listingReviewTask.findUnique({ where: { id: taskId } });
    if (!task) return sendError(reply, 404, "NOT_FOUND", "Review task not found.");
    if (task.assignedTo && task.assignedTo !== admin.adminId) {
      return sendError(reply, 409, "ALREADY_ASSIGNED", "This listing is already assigned to another reviewer.");
    }

    await prisma.listingReviewTask.update({ where: { id: taskId }, data: { assignedTo: admin.adminId } });
    return sendSuccess(reply, 200, { message: "Assigned to you." });
  });

  // POST /admin/listings/:id/approve — Approve listing (UC-2.9)
  app.post("/admin/listings/:id/approve", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { starRating, adminNote } = req.body as { starRating: number; adminNote?: string };

    if (!starRating || starRating < 1 || starRating > 5) {
      return sendError(reply, 422, "VALIDATION_ERROR", "A verified star rating (1–5) is required to approve a hotel listing.");
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { reviewTasks: { where: { status: "open" }, take: 1 } },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "pending_review") return sendError(reply, 409, "INVALID_STATUS", "Listing is not pending review.");

    const task = listing.reviewTasks[0];

    await prisma.$transaction([
      prisma.listing.update({
        where: { id },
        data: {
          status: "approved",
          starRating,
          approvedAt: new Date(),
          approvedBy: admin.adminId,
        },
      }),
      ...(task ? [
        prisma.listingReviewTask.update({
          where: { id: task.id },
          data: { status: "resolved", outcome: "approved", adminNote, resolvedAt: new Date() },
        }),
      ] : []),
    ]);

    sendListingApprovedEmail(listing.providerId, listing.name ?? id, starRating, listing.claimedStarRating).catch(() => null);

    return sendSuccess(reply, 200, { message: "Listing approved and published." });
  });

  // POST /admin/listings/:id/reject — Reject listing (UC-2.10)
  app.post("/admin/listings/:id/reject", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { reasons, providerNote, adminNote } = req.body as {
      reasons: string[];
      providerNote?: string;
      adminNote?: string;
    };

    if (!reasons?.length) return sendError(reply, 422, "VALIDATION_ERROR", "At least one rejection reason is required.");
    for (const r of reasons) {
      if (!REJECTION_REASONS.has(r)) return sendError(reply, 422, "INVALID_REASON", `Invalid rejection reason: ${r}`);
    }
    if (reasons.includes("Other") && !providerNote?.trim()) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Please describe the reason when selecting 'Other'.");
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { reviewTasks: { where: { status: "open" }, take: 1 } },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "pending_review") return sendError(reply, 409, "INVALID_STATUS", "Listing is not pending review.");

    const task = listing.reviewTasks[0];

    await prisma.$transaction([
      prisma.listing.update({
        where: { id },
        data: {
          status: "rejected",
          rejectedAt: new Date(),
          rejectedBy: admin.adminId,
          rejectionReasons: reasons,
          rejectionNote: providerNote ?? null,
        },
      }),
      ...(task ? [
        prisma.listingReviewTask.update({
          where: { id: task.id },
          data: { status: "resolved", outcome: "rejected", adminNote, resolvedAt: new Date() },
        }),
      ] : []),
    ]);

    sendListingRejectedEmail(listing.providerId, listing.name ?? id, reasons, providerNote ?? null).catch(() => null);

    return sendSuccess(reply, 200, { message: "Listing rejected. Provider has been notified." });
  });

  // PATCH /admin/listings/:id/star-rating — Update star rating on approved listing (UC-2.12)
  app.patch("/admin/listings/:id/star-rating", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { starRating, reason } = req.body as { starRating: number; reason: string };

    if (!starRating || starRating < 1 || starRating > 5) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Star rating must be between 1 and 5.");
    }
    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "A reason for the rating change is required.");

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "approved") return sendError(reply, 409, "INVALID_STATUS", "Star rating can only be updated on approved listings.");

    const oldRating = listing.starRating ?? 0;
    await prisma.listing.update({ where: { id }, data: { starRating } });

    sendStarRatingUpdatedEmail(listing.providerId, listing.name ?? id, oldRating, starRating, reason).catch(() => null);

    return sendSuccess(reply, 200, { message: "Star rating updated." });
  });

  // POST /admin/listings/:id/suspend — Suspend approved listing (UC-2.14)
  app.post("/admin/listings/:id/suspend", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { reason, notifyProvider = true } = req.body as { reason: string; notifyProvider?: boolean };

    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Suspension reason is required.");

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    const suspendableStatuses = ["approved", "active"];
    if (!suspendableStatuses.includes(listing.status)) {
      return sendError(reply, 409, "INVALID_STATUS", "Only live listings can be suspended.");
    }

    await prisma.listing.update({
      where: { id },
      data: {
        status: "suspended",
        suspendedAt: new Date(),
        suspendedBy: admin.adminId,
        suspensionReason: reason,
      },
    });

    if (notifyProvider) {
      sendListingSuspendedEmail(listing.providerId, listing.name ?? id).catch(() => null);
    }

    return sendSuccess(reply, 200, { message: "Listing suspended." });
  });

  // POST /admin/listings/:id/reinstate — Reinstate suspended listing (UC-2.14 A1)
  app.post("/admin/listings/:id/reinstate", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "suspended") return sendError(reply, 409, "INVALID_STATUS", "Listing is not suspended.");

    // Restore to category-appropriate live status
    const restoreStatus = listing.category === "apartment" ? "active" : "approved";
    await prisma.listing.update({
      where: { id },
      data: { status: restoreStatus, suspendedAt: null, suspendedBy: null, suspensionReason: null },
    });

    return sendSuccess(reply, 200, { message: "Listing reinstated and live again." });
  });

  // GET /admin/listings — Search all listings (for admin use)
  app.get("/admin/listings", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", status, category, country, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where = {
      deletedAt: null,
      AND: [
        q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { town: { contains: q, mode: "insensitive" as const } },
          ],
        } : {},
        status ? { status: status as "draft" } : {},
        category ? { category: category as "hotel" } : {},
        country ? { country } : {},
      ],
    };

    const [total, listings] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          name: true,
          category: true,
          status: true,
          starRating: true,
          country: true,
          town: true,
          pricePerNight: true,
          currency: true,
          submissionCount: true,
          providerId: true,
          approvedAt: true,
          photos: {
            where: { deletedAt: null },
            orderBy: { position: "asc" },
            select: {
              id: true,
              cdnUrl: true,
              position: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return sendSuccess(reply, 200, { listings, total, page: parseInt(page, 10), limit: take });
  });

  // ── GET /admin/bookings — Admin booking list with filters ─────────────────
  app.get("/admin/bookings", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", status, listingType, country, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      AND: [
        q ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { guestEmail: { contains: q, mode: "insensitive" } },
            { guestFirstName: { contains: q, mode: "insensitive" } },
            { guestLastName: { contains: q, mode: "insensitive" } },
          ],
        } : {},
        status ? { status } : {},
        listingType ? { listingType } : {},
        country ? { listing: { country } } : {},
      ],
    };

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          listingId: true,
          guestId: true,
          providerId: true,
          listingType: true,
          status: true,
          checkIn: true,
          checkOut: true,
          pickupDatetime: true,
          returnDatetime: true,
          nightsOrDays: true,
          guestFirstName: true,
          guestLastName: true,
          guestEmail: true,
          totalAmount: true,
          currency: true,
          commissionAmount: true,
          providerPayout: true,
          voucherDiscount: true,
          cancelledAt: true,
          confirmedAt: true,
          createdAt: true,
          listing: { select: { name: true } },
        },
      }),
    ]);

    return sendSuccess(reply, 200, { bookings, total, page: parseInt(page, 10), limit: take });
  });

  // ── GET /admin/bookings/:id — Full booking detail with status log ──────────
  app.get("/admin/bookings/:id", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        statusLog: { orderBy: { createdAt: "asc" } },
        listing: { select: { name: true, country: true, category: true } },
      },
    });
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

    return sendSuccess(reply, 200, booking);
  });

  // ── POST /admin/bookings/:id/cancel — Admin-forced cancellation ───────────
  app.post("/admin/bookings/:id/cancel", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };

    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Cancellation reason is required.");

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (!["pending_payment", "confirmed"].includes(booking.status)) {
      return sendError(reply, 409, "INVALID_STATUS", `Cannot cancel booking in status: ${booking.status}`);
    }

    await prisma.booking.update({
      where: { id },
      data: {
        status: "cancelled_by_system",
        cancelledAt: new Date(),
        cancelledBy: admin.adminId,
        cancellationReason: reason,
        refundAmount: booking.status === "confirmed" ? booking.totalAmount : 0,
      },
    });

    await prisma.bookingStatusLog.create({
      data: {
        bookingId: id,
        fromStatus: booking.status,
        toStatus: "cancelled_by_system",
        actorType: "admin",
        changedBy: admin.adminId,
        reason,
      },
    });

    return sendSuccess(reply, 200, { message: "Booking cancelled by admin." });
  });

  // ── GET /admin/conversations — All conversations (admin view) ─────────────
  app.get("/admin/conversations", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      AND: [
        status ? { status } : {},
        q ? {
          OR: [
            { guestId: { contains: q } },
            { bookingId: { contains: q } },
          ],
        } : {},
      ],
    };

    const [total, conversations] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
    ]);

    return sendSuccess(reply, 200, {
      conversations: conversations.map((c) => ({
        id: c.id,
        listingId: c.listingId,
        bookingId: c.bookingId,
        guestId: c.guestId,
        providerId: c.providerId,
        status: c.status,
        lastMessage: c.messages[0]
          ? {
              body: c.messages[0].isFiltered ? "[Message hidden]" : c.messages[0].body,
              senderId: c.messages[0].senderId,
              senderType: c.messages[0].senderType,
              isFiltered: c.messages[0].isFiltered,
              createdAt: c.messages[0].createdAt.toISOString(),
            }
          : null,
        updatedAt: c.updatedAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page: parseInt(page, 10),
      limit: take,
    });
  });

  // ── GET /admin/conversations/:id/messages — Admin message viewer ──────────
  app.get("/admin/conversations/:id/messages", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const convo = await prisma.conversation.findUnique({ where: { id } });
    if (!convo) return sendError(reply, 404, "NOT_FOUND", "Conversation not found.");

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    return sendSuccess(reply, 200, {
      conversation: {
        id: convo.id,
        listingId: convo.listingId,
        bookingId: convo.bookingId,
        guestId: convo.guestId,
        providerId: convo.providerId,
        status: convo.status,
      },
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderType: m.senderType,
        body: m.body,
        isFiltered: m.isFiltered,
        readAt: m.readAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  });

  // ── GET /admin/ical-feeds — All iCal feeds across all listings ────────────
  app.get("/admin/ical-feeds", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { page = "1", limit = "20", isActive } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
    };

    const [total, feeds] = await Promise.all([
      prisma.icalFeed.count({ where }),
      prisma.icalFeed.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        include: {
          listing: { select: { name: true, category: true, country: true } },
        },
      }),
    ]);

    return sendSuccess(reply, 200, {
      feeds: feeds.map((f) => ({
        id: f.id,
        listingId: f.listingId,
        listingName: f.listing.name,
        listingCategory: f.listing.category,
        listingCountry: f.listing.country,
        platform: f.platform,
        feedUrl: f.feedUrl,
        isActive: f.isActive,
        lastSyncedAt: f.lastSyncedAt?.toISOString() ?? null,
        lastError: f.lastError,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
      total,
      page: parseInt(page, 10),
      limit: take,
    });
  });

  // ── POST /admin/ical-feeds/:id/sync — Admin manual iCal resync ───────────
  app.post("/admin/ical-feeds/:id/sync", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const feed = await prisma.icalFeed.findUnique({ where: { id } });
    if (!feed) return sendError(reply, 404, "NOT_FOUND", "iCal feed not found.");

    // Import syncFeed dynamically to avoid circular import
    const { syncFeed } = await import("./ical.js");
    const result = await syncFeed(id);

    if (result.error) {
      return sendSuccess(reply, 200, { synced: 0, error: result.error, message: "Sync failed." });
    }
    return sendSuccess(reply, 200, { synced: result.synced, message: `Synced ${result.synced} events.` });
  });

  // ── GET /admin/reviews — Admin review list with filters ───────────────────
  app.get("/admin/reviews", { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", isHidden, rating, listingId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      AND: [
        isHidden !== undefined ? { isHidden: isHidden === "true" } : {},
        rating ? { rating: parseInt(rating, 10) } : {},
        listingId ? { listingId } : {},
        q ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
            { guestId: { contains: q } },
          ],
        } : {},
      ],
    };

    const [total, reviews] = await Promise.all([
      prisma.listingReview.count({ where }),
      prisma.listingReview.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { listing: { select: { name: true } } },
      }),
    ]);

    return sendSuccess(reply, 200, {
      reviews: reviews.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        listingId: r.listingId,
        listingName: r.listing.name,
        guestId: r.guestId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        providerReply: r.providerReply,
        isHidden: r.isHidden,
        hiddenBy: r.hiddenBy,
        hiddenAt: r.hiddenAt?.toISOString() ?? null,
        hiddenReason: r.hiddenReason,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: parseInt(page, 10),
      limit: take,
    });
  });
}
