import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireAdmin, type AdminRequest } from "../middleware/auth.js";
import { createPresignedDownloadUrl } from "../lib/s3.js";
import {
  sendListingApprovedEmail,
  sendListingRejectedEmail,
  sendListingSuspendedEmail,
  sendListingReinstatedEmail,
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

/**
 * Required hotel document groups (§3.1 accreditation requirements).
 * At least one document from each group must be present (not replaced)
 * before an admin can approve a hotel listing.
 */
const HOTEL_REQUIRED_DOC_GROUPS: Array<{ label: string; types: string[] }> = [
  { label: "business licence",              types: ["business_licence"] },
  { label: "hotel operating permit",        types: ["operating_permit", "hotel_operating_permit"] },
  { label: "tourism authority certificate", types: ["tourism_certificate", "tourism_authority_certificate"] },
];

// ── Routes ────────────────────────────────────────────────────────────────────

export async function adminListingRoutes(app: FastifyInstance) {

  // GET /admin/listings/review-queue (UC-2.8)
  app.get("/admin/listings/review-queue", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { country, starRating, slaStatus, page = "1", limit = "20", sortBy = "sla_deadline" } = req.query as Record<string, string>;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const now = new Date();
    const slaFilter =
      slaStatus === "breached"    ? { slaDeadline: { lt: now } } :
      slaStatus === "approaching" ? { slaDeadline: { gte: now, lt: new Date(now.getTime() + 4 * 60 * 60 * 1000) } } :
      slaStatus === "ok"          ? { slaDeadline: { gte: new Date(now.getTime() + 4 * 60 * 60 * 1000) } } :
      {};

    const isCountryManager = admin.adminRole === "country_manager";
    // FIX: use adminCountry (extracted from JWT "country" claim) rather than adminRole
    const countryScope = isCountryManager && admin.adminCountry ? admin.adminCountry : null;

    const tasks = await prisma.listingReviewTask.findMany({
      where: {
        status: { in: ["open", "escalated"] },
        ...slaFilter,
        listing: {
          status: "pending_review",
          ...(countryScope ? { country: countryScope } : {}),
          ...(country      ? { country }               : {}),
          ...(starRating   ? { claimedStarRating: parseInt(starRating, 10) } : {}),
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
              select: { id: true, cdnUrl: true, position: true },
            },
          },
        },
      },
      orderBy: sortBy === "submitted_at" ? { listing: { submittedAt: "asc" } } : { slaDeadline: "asc" },
      skip,
      take,
    });

    const total = await prisma.listingReviewTask.count({
      where: {
        status: { in: ["open", "escalated"] },
        listing: { status: "pending_review" },
      },
    });

    return sendSuccess(reply, 200, { tasks, total, page: parseInt(page, 10), limit: take });
  });

  // GET /admin/listings/:id/review — Full listing detail for review (UC-2.9)
  app.get("/admin/listings/:id/review", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        photos:          { where: { deletedAt: null }, orderBy: { position: "asc" } },
        documents:       { where: { replacedAt: null } },
        amenities:       true,
        customAmenities: true,
        reviewTasks:     { where: { status: { in: ["open", "escalated"] } }, take: 1, orderBy: { createdAt: "desc" } },
      },
    });

    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const legacyAmenityCategoryMap: Record<string, string> = {
      wifi: "Connectivity",
      high_speed_wifi: "Connectivity",
      ethernet: "Connectivity",
      pool: "Wellness",
      spa: "Wellness",
      gym: "Wellness",
      sauna: "Wellness",
      massage: "Wellness",
      hot_tub: "Wellness",
      restaurant: "Food & Drink",
      bar: "Food & Drink",
      room_service: "Food & Drink",
      mini_bar: "Food & Drink",
      breakfast: "Food & Drink",
      kitchen: "Food & Drink",
      air_conditioning: "Comfort",
      heating: "Comfort",
      fireplace: "Comfort",
      balcony: "Comfort",
      concierge: "Services",
      parking: "Services",
      security: "Services",
      laundry: "Services",
      dry_cleaning: "Services",
      housekeeping: "Services",
      luggage_storage: "Services",
      airport_shuttle: "Services",
      tv: "Services",
      workspace: "Services",
      washing_machine: "Services",
      garden: "Services",
    };

    const groupedAmenities: Record<string, string[]> = {
      Connectivity: [], "Food & Drink": [], Wellness: [], Comfort: [], Services: [],
    };
    for (const item of listing.amenities) {
      const key = item.amenityKey;
      if (key.includes(":")) {
        const [cat = "Services", val = ""] = key.split(":");
        (groupedAmenities[cat] ??= []).push(val);
      } else {
        const cat = legacyAmenityCategoryMap[key] || "Services";
        (groupedAmenities[cat] ??= []).push(key);
      }
    }

    // Document checklist: surface which required hotel doc groups are satisfied
    const presentDocTypes = listing.documents.map((d) => d.documentType as string);
    const docChecklist = HOTEL_REQUIRED_DOC_GROUPS.map((group) => ({
      label:         group.label,
      satisfied:     group.types.some((t) => presentDocTypes.includes(t)),
      uploadedTypes: group.types.filter((t) => presentDocTypes.includes(t)),
    }));

    return sendSuccess(reply, 200, {
      ...listing,
      amenities:    groupedAmenities,
      docChecklist,
    });
  });

  // GET /admin/listings/:id/documents/:docId — Presigned download URL for document viewer
  app.get("/admin/listings/:id/documents/:docId", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, docId } = req.params as { id: string; docId: string };

    const doc = await prisma.listingDocument.findFirst({ where: { id: docId, listingId: id } });
    if (!doc) return sendError(reply, 404, "NOT_FOUND", "Document not found.");

    const url = await createPresignedDownloadUrl(doc.s3Key, 900);
    return sendSuccess(reply, 200, { url, fileType: doc.fileType });
  });

  // PATCH /admin/listings/review-tasks/:taskId/assign — Self-assign review task (UC-2.8 A3)
  app.patch("/admin/listings/review-tasks/:taskId/assign", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { taskId } = req.params as { taskId: string };

    const task = await prisma.listingReviewTask.findUnique({ where: { id: taskId } });
    if (!task) return sendError(reply, 404, "NOT_FOUND", "Review task not found.");
    if (!["open", "escalated"].includes(task.status)) {
      return sendError(reply, 409, "TASK_RESOLVED", "Cannot assign a resolved task.");
    }
    if (task.assignedTo && task.assignedTo !== admin.adminId) {
      return sendError(reply, 409, "ALREADY_ASSIGNED", "This listing is already assigned to another reviewer.");
    }

    await prisma.listingReviewTask.update({ where: { id: taskId }, data: { assignedTo: admin.adminId } });
    return sendSuccess(reply, 200, { message: "Assigned to you." });
  });

  // PATCH /admin/listings/review-tasks/:taskId/unassign — Release a claimed task
  app.patch("/admin/listings/review-tasks/:taskId/unassign", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { taskId } = req.params as { taskId: string };

    const task = await prisma.listingReviewTask.findUnique({ where: { id: taskId } });
    if (!task) return sendError(reply, 404, "NOT_FOUND", "Review task not found.");
    if (!["open", "escalated"].includes(task.status)) {
      return sendError(reply, 409, "TASK_RESOLVED", "Cannot unassign a resolved task.");
    }
    // Only the assigned admin or a super_admin can unassign
    if (task.assignedTo && task.assignedTo !== admin.adminId && admin.adminRole !== "super_admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only the assigned reviewer or a super admin can unassign this task.");
    }

    await prisma.listingReviewTask.update({ where: { id: taskId }, data: { assignedTo: null } });
    return sendSuccess(reply, 200, { message: "Task unassigned." });
  });

  // PATCH /admin/listings/review-tasks/:taskId/escalate — Escalate a breached-SLA task
  app.patch("/admin/listings/review-tasks/:taskId/escalate", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { taskId } = req.params as { taskId: string };
    const { reason } = req.body as { reason?: string };

    const task = await prisma.listingReviewTask.findUnique({ where: { id: taskId } });
    if (!task) return sendError(reply, 404, "NOT_FOUND", "Review task not found.");
    if (!["open", "awaiting_provider_response"].includes(task.status)) {
      return sendError(reply, 409, "INVALID_STATUS", "Only open or awaiting-provider-response tasks can be escalated.");
    }

    await prisma.$transaction([
      prisma.listingReviewTask.update({
        where: { id: taskId },
        data:  { status: "escalated" },
      }),
      prisma.listingModerationLog.create({
        data: {
          listingId: task.listingId,
          action:    "escalated",
          actorId:   admin.adminId,
          actorRole: admin.adminRole,
          metadata:  { taskId, reason: reason ?? null, slaDeadline: task.slaDeadline.toISOString() },
        },
      }),
    ]);

    return sendSuccess(reply, 200, { message: "Review task escalated." });
  });

  // POST /admin/listings/:id/approve — Approve listing (UC-2.9)
  app.post("/admin/listings/:id/approve", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { starRating, adminNote } = req.body as { starRating: number; adminNote?: string };

    // Must be a whole-number integer in [1, 5] — spec: star rating assigned by admin only (1–5)
    if (!Number.isInteger(starRating) || starRating < 1 || starRating > 5) {
      return sendError(reply, 422, "VALIDATION_ERROR", "A verified star rating (1–5, integer) is required to approve a hotel listing.");
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        reviewTasks: { where: { status: { in: ["open", "escalated"] } }, take: 1, orderBy: { createdAt: "desc" } },
        documents:   { where: { replacedAt: null } },
      },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "pending_review") return sendError(reply, 409, "INVALID_STATUS", "Listing is not pending review.");

    const task = listing.reviewTasks[0] ?? null;

    // Task-assignment guard: prevent a different admin from actioning an assigned task
    if (task?.assignedTo && task.assignedTo !== admin.adminId) {
      return sendError(reply, 409, "TASK_ASSIGNED_TO_OTHER",
        "This review task is assigned to another admin. Unassign it first or coordinate with the assigned reviewer.");
    }

    // Re-verify all required hotel documents are still present (not replaced/removed since submission).
    // Documents can be swapped on an approved listing triggering a new task; guard against gap.
    const presentDocTypes = listing.documents.map((d) => d.documentType as string);
    const missingDocs = HOTEL_REQUIRED_DOC_GROUPS
      .filter((g) => !g.types.some((t) => presentDocTypes.includes(t)))
      .map((g) => g.label);
    if (missingDocs.length > 0) {
      return sendError(reply, 422, "MISSING_DOCUMENTS",
        `Cannot approve: the following required document(s) are missing: ${missingDocs.join(", ")}.`);
    }

    // Concurrent-safe atomic approval: updateMany WHERE status = pending_review prevents
    // two admins from both approving the same listing simultaneously.
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.listing.updateMany({
        where: { id, status: "pending_review" },
        data: {
          status:     "approved",
          starRating,
          approvedAt: new Date(),
          approvedBy: admin.adminId,
        },
      });

      // count === 0 means another admin already actioned this listing
      if (updated.count === 0) return { actioned: false };

      if (task) {
        await tx.listingReviewTask.update({
          where: { id: task.id },
          data:  { status: "resolved", outcome: "approved", adminNote: adminNote ?? null, resolvedAt: new Date() },
        });
      }

      await tx.listingModerationLog.create({
        data: {
          listingId: id,
          action:    "approved",
          actorId:   admin.adminId,
          actorRole: admin.adminRole,
          metadata: {
            starRating,
            claimedStarRating: listing.claimedStarRating,
            adminNote:         adminNote ?? null,
            taskId:            task?.id ?? null,
            submissionNumber:  task?.submissionNumber ?? listing.submissionCount,
          },
        },
      });

      return { actioned: true };
    });

    if (!result.actioned) {
      return sendError(reply, 409, "INVALID_STATUS",
        "Listing is not pending review — it may have already been actioned by another admin.");
    }

    sendListingApprovedEmail(listing.providerId, listing.name ?? id, starRating, listing.claimedStarRating).catch(() => null);

    return sendSuccess(reply, 200, { message: "Listing approved and published." });
  });

  // POST /admin/listings/:id/reject — Reject listing (UC-2.10)
  app.post("/admin/listings/:id/reject", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
      include: { reviewTasks: { where: { status: { in: ["open", "escalated"] } }, take: 1, orderBy: { createdAt: "desc" } } },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "pending_review") return sendError(reply, 409, "INVALID_STATUS", "Listing is not pending review.");

    const task = listing.reviewTasks[0] ?? null;

    // Task-assignment guard
    if (task?.assignedTo && task.assignedTo !== admin.adminId) {
      return sendError(reply, 409, "TASK_ASSIGNED_TO_OTHER",
        "This review task is assigned to another admin. Unassign it first or coordinate with the assigned reviewer.");
    }

    // Concurrent-safe atomic rejection
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.listing.updateMany({
        where: { id, status: "pending_review" },
        data: {
          status:           "rejected",
          rejectedAt:       new Date(),
          rejectedBy:       admin.adminId,
          rejectionReasons: reasons,
          rejectionNote:    providerNote ?? null,
        },
      });

      if (updated.count === 0) return { actioned: false };

      if (task) {
        await tx.listingReviewTask.update({
          where: { id: task.id },
          data:  { status: "resolved", outcome: "rejected", adminNote: adminNote ?? null, resolvedAt: new Date() },
        });
      }

      await tx.listingModerationLog.create({
        data: {
          listingId: id,
          action:    "rejected",
          actorId:   admin.adminId,
          actorRole: admin.adminRole,
          metadata: {
            reasons,
            providerNote:     providerNote ?? null,
            adminNote:        adminNote ?? null,
            taskId:           task?.id ?? null,
            submissionNumber: task?.submissionNumber ?? listing.submissionCount,
          },
        },
      });

      return { actioned: true };
    });

    if (!result.actioned) {
      return sendError(reply, 409, "INVALID_STATUS",
        "Listing is not pending review — it may have already been actioned by another admin.");
    }

    sendListingRejectedEmail(listing.providerId, listing.name ?? id, reasons, providerNote ?? null).catch(() => null);

    return sendSuccess(reply, 200, { message: "Listing rejected. Provider has been notified." });
  });

  // PATCH /admin/listings/:id/star-rating — Update star rating on approved listing (UC-2.12)
  app.patch("/admin/listings/:id/star-rating", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { starRating, reason } = req.body as { starRating: number; reason: string };

    if (!Number.isInteger(starRating) || starRating < 1 || starRating > 5) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Star rating must be a whole number between 1 and 5.");
    }
    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "A reason for the rating change is required.");

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "approved") return sendError(reply, 409, "INVALID_STATUS", "Star rating can only be updated on approved listings.");

    const oldRating = listing.starRating ?? 0;

    await prisma.$transaction([
      prisma.listing.update({ where: { id }, data: { starRating } }),
      // Persist audit record — previously only sent an email with no DB trace
      prisma.listingModerationLog.create({
        data: {
          listingId: id,
          action:    "star_rating_updated",
          actorId:   admin.adminId,
          actorRole: admin.adminRole,
          metadata:  { oldRating, newRating: starRating, reason },
        },
      }),
    ]);

    sendStarRatingUpdatedEmail(listing.providerId, listing.name ?? id, oldRating, starRating, reason).catch(() => null);

    return sendSuccess(reply, 200, { message: "Star rating updated." });
  });

  // POST /admin/listings/:id/suspend — Suspend approved listing (UC-2.14)
  app.post("/admin/listings/:id/suspend", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { reason, notifyProvider = true } = req.body as { reason: string; notifyProvider?: boolean };

    if (!reason?.trim()) return sendError(reply, 422, "VALIDATION_ERROR", "Suspension reason is required.");

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (!["approved", "active"].includes(listing.status)) {
      return sendError(reply, 409, "INVALID_STATUS", "Only live listings can be suspended.");
    }

    await prisma.$transaction([
      prisma.listing.update({
        where: { id },
        data: {
          status:           "suspended",
          suspendedAt:      new Date(),
          suspendedBy:      admin.adminId,
          suspensionReason: reason,
        },
      }),
      prisma.listingModerationLog.create({
        data: {
          listingId: id,
          action:    "suspended",
          actorId:   admin.adminId,
          actorRole: admin.adminRole,
          metadata:  { reason, previousStatus: listing.status, notifyProvider },
        },
      }),
    ]);

    if (notifyProvider) {
      sendListingSuspendedEmail(listing.providerId, listing.name ?? id).catch(() => null);
    }

    return sendSuccess(reply, 200, { message: "Listing suspended." });
  });

  // POST /admin/listings/:id/reinstate — Reinstate suspended listing (UC-2.14 A1)
  app.post("/admin/listings/:id/reinstate", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "suspended") return sendError(reply, 409, "INVALID_STATUS", "Listing is not suspended.");

    // Restore to category-appropriate live status
    const restoreStatus = (listing.category === "apartment" || listing.category === "car") ? "active" : "approved";

    // IMPORTANT: suspension fields (suspendedAt/By/Reason) are intentionally NOT cleared here.
    // They serve as a historical record of the most recent suspension event.
    // The moderation log is the authoritative audit trail for the reinstatement action.
    await prisma.$transaction([
      prisma.listing.update({ where: { id }, data: { status: restoreStatus } }),
      prisma.listingModerationLog.create({
        data: {
          listingId: id,
          action:    "reinstated",
          actorId:   admin.adminId,
          actorRole: admin.adminRole,
          metadata: {
            restoredStatus:   restoreStatus,
            reason:           reason ?? null,
            // Capture the suspension context for full traceability
            suspendedAt:      listing.suspendedAt?.toISOString() ?? null,
            suspendedBy:      listing.suspendedBy ?? null,
            suspensionReason: listing.suspensionReason ?? null,
          },
        },
      }),
    ]);

    // Notify provider that listing is live again
    sendListingReinstatedEmail(listing.providerId, listing.name ?? id).catch(() => null);

    return sendSuccess(reply, 200, { message: "Listing reinstated and live again." });
  });

  // GET /admin/listings/:id/review-tasks — Full review-task submission history
  app.get("/admin/listings/:id/review-tasks", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, category: true, submissionCount: true },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const tasks = await prisma.listingReviewTask.findMany({
      where:   { listingId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id:               true,
        submissionNumber: true,
        assignedTo:       true,
        status:           true,
        outcome:          true,
        adminNote:        true,
        slaDeadline:      true,
        createdAt:        true,
        resolvedAt:       true,
      },
    });

    return sendSuccess(reply, 200, { listing, tasks, total: tasks.length });
  });

  // GET /admin/listings/:id/moderation-history — Full moderation audit trail
  app.get("/admin/listings/:id/moderation-history", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findUnique({
      where: { id },
      select: {
        id:               true,
        name:             true,
        status:           true,
        category:         true,
        starRating:       true,
        claimedStarRating:true,
        submissionCount:  true,
        approvedAt:       true,
        approvedBy:       true,
        rejectedAt:       true,
        rejectedBy:       true,
        rejectionReasons: true,
        rejectionNote:    true,
        suspendedAt:      true,
        suspendedBy:      true,
        suspensionReason: true,
      },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    const history = await prisma.listingModerationLog.findMany({
      where:   { listingId: id },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(reply, 200, { listing, history, total: history.length });
  });

  // GET /admin/listings — Search all listings (for admin use)
  app.get("/admin/listings", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
        status   ? { status:   status   as "draft" } : {},
        category ? { category: category as "hotel" } : {},
        country  ? { country }                       : {},
      ],
    };

    const [total, listings] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where,
        skip,
        take,
        select: {
          id:              true,
          name:            true,
          category:        true,
          status:          true,
          starRating:      true,
          country:         true,
          town:            true,
          pricePerNight:   true,
          currency:        true,
          submissionCount: true,
          providerId:      true,
          approvedAt:      true,
          photos: {
            where:   { deletedAt: null },
            orderBy: { position: "asc" },
            select:  { id: true, cdnUrl: true, position: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return sendSuccess(reply, 200, { listings, total, page: parseInt(page, 10), limit: take });
  });

  // ── GET /admin/bookings — Admin booking list with filters ─────────────────
  app.get("/admin/bookings", { schema: { tags: ["Admin Bookings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", status, listingType, country, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      AND: [
        q ? {
          OR: [
            { reference:      { contains: q, mode: "insensitive" } },
            { guestEmail:     { contains: q, mode: "insensitive" } },
            { guestFirstName: { contains: q, mode: "insensitive" } },
            { guestLastName:  { contains: q, mode: "insensitive" } },
          ],
        } : {},
        status      ? { status }               : {},
        listingType ? { listingType }          : {},
        country     ? { listing: { country } } : {},
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
          id:               true,
          reference:        true,
          listingId:        true,
          guestId:          true,
          providerId:       true,
          listingType:      true,
          status:           true,
          checkIn:          true,
          checkOut:         true,
          pickupDatetime:   true,
          returnDatetime:   true,
          nightsOrDays:     true,
          guestFirstName:   true,
          guestLastName:    true,
          guestEmail:       true,
          totalAmount:      true,
          currency:         true,
          commissionAmount: true,
          providerPayout:   true,
          voucherDiscount:  true,
          cancelledAt:      true,
          confirmedAt:      true,
          createdAt:        true,
          listing: { select: { name: true } },
        },
      }),
    ]);

    return sendSuccess(reply, 200, { bookings, total, page: parseInt(page, 10), limit: take });
  });

  // ── GET /admin/bookings/:id — Full booking detail with status log ──────────
  app.get("/admin/bookings/:id", { schema: { tags: ["Admin Bookings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        statusLog: { orderBy: { createdAt: "asc" } },
        listing:   { select: { name: true, country: true, category: true } },
      },
    });
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

    return sendSuccess(reply, 200, booking);
  });

  // ── POST /admin/bookings/:id/cancel — Admin-forced cancellation ───────────
  app.post("/admin/bookings/:id/cancel", { schema: { tags: ["Admin Bookings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
        status:             "cancelled_by_system",
        cancelledAt:        new Date(),
        cancelledBy:        admin.adminId,
        cancellationReason: reason,
        refundAmount:       booking.status === "confirmed" ? booking.totalAmount : 0,
      },
    });

    await prisma.bookingStatusLog.create({
      data: {
        bookingId:  id,
        fromStatus: booking.status,
        toStatus:   "cancelled_by_system",
        actorType:  "admin",
        changedBy:  admin.adminId,
        reason,
      },
    });

    return sendSuccess(reply, 200, { message: "Booking cancelled by admin." });
  });

  // ── GET /admin/conversations — All conversations (admin view) ─────────────
  app.get("/admin/conversations", { schema: { tags: ["Admin Conversations"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      AND: [
        status ? { status } : {},
        q ? {
          OR: [
            { guestId:   { contains: q } },
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
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
    ]);

    return sendSuccess(reply, 200, {
      conversations: conversations.map((c) => ({
        id:         c.id,
        listingId:  c.listingId,
        bookingId:  c.bookingId,
        guestId:    c.guestId,
        providerId: c.providerId,
        status:     c.status,
        lastMessage: c.messages[0]
          ? {
              body:       c.messages[0].isFiltered ? "[Message hidden]" : c.messages[0].body,
              senderId:   c.messages[0].senderId,
              senderType: c.messages[0].senderType,
              isFiltered: c.messages[0].isFiltered,
              createdAt:  c.messages[0].createdAt.toISOString(),
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
  app.get("/admin/conversations/:id/messages", { schema: { tags: ["Admin Conversations"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const convo = await prisma.conversation.findUnique({ where: { id } });
    if (!convo) return sendError(reply, 404, "NOT_FOUND", "Conversation not found.");

    const messages = await prisma.message.findMany({
      where:   { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    return sendSuccess(reply, 200, {
      conversation: {
        id:         convo.id,
        listingId:  convo.listingId,
        bookingId:  convo.bookingId,
        guestId:    convo.guestId,
        providerId: convo.providerId,
        status:     convo.status,
      },
      messages: messages.map((m) => ({
        id:         m.id,
        senderId:   m.senderId,
        senderType: m.senderType,
        body:       m.body,
        isFiltered: m.isFiltered,
        readAt:     m.readAt?.toISOString() ?? null,
        createdAt:  m.createdAt.toISOString(),
      })),
    });
  });

  // ── GET /admin/ical-feeds — All iCal feeds across all listings ────────────
  app.get("/admin/ical-feeds", { schema: { tags: ["Admin iCal"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
        include: { listing: { select: { name: true, category: true, country: true } } },
      }),
    ]);

    return sendSuccess(reply, 200, {
      feeds: feeds.map((f) => ({
        id:              f.id,
        listingId:       f.listingId,
        listingName:     f.listing.name,
        listingCategory: f.listing.category,
        listingCountry:  f.listing.country,
        platform:        f.platform,
        feedUrl:         f.feedUrl,
        isActive:        f.isActive,
        lastSyncedAt:    f.lastSyncedAt?.toISOString() ?? null,
        lastError:       f.lastError,
        createdAt:       f.createdAt.toISOString(),
        updatedAt:       f.updatedAt.toISOString(),
      })),
      total,
      page: parseInt(page, 10),
      limit: take,
    });
  });

  // ── POST /admin/ical-feeds/:id/sync — Admin manual iCal resync ───────────
  app.post("/admin/ical-feeds/:id/sync", { schema: { tags: ["Admin iCal"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  app.get("/admin/reviews", { schema: { tags: ["Admin Reviews"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { q = "", isHidden, rating, listingId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      AND: [
        isHidden !== undefined ? { isHidden: isHidden === "true" } : {},
        rating    ? { rating: parseInt(rating, 10) } : {},
        listingId ? { listingId }                    : {},
        q ? {
          OR: [
            { title:   { contains: q, mode: "insensitive" } },
            { body:    { contains: q, mode: "insensitive" } },
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
        id:            r.id,
        bookingId:     r.bookingId,
        listingId:     r.listingId,
        listingName:   r.listing.name,
        guestId:       r.guestId,
        rating:        r.rating,
        title:         r.title,
        body:          r.body,
        providerReply: r.providerReply,
        isHidden:      r.isHidden,
        hiddenBy:      r.hiddenBy,
        hiddenAt:      r.hiddenAt?.toISOString() ?? null,
        hiddenReason:  r.hiddenReason,
        createdAt:     r.createdAt.toISOString(),
      })),
      total,
      page: parseInt(page, 10),
      limit: take,
    });
  });
}
