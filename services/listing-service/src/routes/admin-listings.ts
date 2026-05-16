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
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return sendSuccess(reply, 200, { listings, total, page: parseInt(page, 10), limit: take });
  });
}
