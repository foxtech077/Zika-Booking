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

  // ── GET /admin/listings/review-queue (UC-2.8) ─────────────────────────────
  app.get("/admin/listings/review-queue", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Listings"],
      summary: "Fetch the listing review queue",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          country:    { type: "string", description: "Filter by country code (ISO 3166-1 alpha-2)" },
          starRating: { type: "string", description: "Filter by claimed star rating (1–5)" },
          slaStatus:  { type: "string", enum: ["breached", "approaching", "ok"], description: "SLA breach status" },
          sortBy:     { type: "string", enum: ["sla_deadline", "submitted_at"], default: "sla_deadline" },
          
        },
      },
      response: {
        200:({
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id:          { type: "string" },
                  status:      { type: "string" },
                  slaDeadline: { type: "string", format: "date-time" },
                  assignedTo:  { type: "string", nullable: true },
                  listing: {
                    type: "object",
                    properties: {
                      id:                { type: "string" },
                      name:              { type: "string", nullable: true },
                      country:           { type: "string", nullable: true },
                      town:              { type: "string", nullable: true },
                      claimedStarRating: { type: "integer", nullable: true },
                      submissionCount:   { type: "integer" },
                      submittedAt:       { type: "string", format: "date-time", nullable: true },
                      providerId:        { type: "string" },
                      category:          { type: "string" },
                      photos:            { type: "array" },
                    },
                  },
                },
              },
            },
            total: { type: "integer" },
            page:  { type: "integer" },
            limit: { type: "integer" },
          },
        }),
      
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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

  // ── GET /admin/listings/:id/review (UC-2.9) ───────────────────────────────
  app.get("/admin/listings/:id/review", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Listings"],
      summary: "Full listing detail for admin review",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Listing ID" },
        },
      },
      response: {
        200:({
          type: "object",
          description: "Full listing object with grouped amenities and document checklist",
          properties: {
            id:                { type: "string" },
            name:              { type: "string", nullable: true },
            status:            { type: "string" },
            category:          { type: "string" },
            country:           { type: "string", nullable: true },
            town:              { type: "string", nullable: true },
            claimedStarRating: { type: "integer", nullable: true },
            starRating:        { type: "integer", nullable: true },
            submissionCount:   { type: "integer" },
            photos:            { type: "array", },
            documents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id:           { type: "string" },
                  documentType: { type: "string" },
                  fileType:     { type: "string" },
                  s3Key:        { type: "string" },
                  createdAt:    { type: "string", format: "date-time" },
                },
              },
            },
            amenities: {
              type: "object",
              description: "Amenities grouped by category",
              properties: {
                Connectivity:   { type: "array", items: { type: "string" } },
                "Food & Drink": { type: "array", items: { type: "string" } },
                Wellness:       { type: "array", items: { type: "string" } },
                Comfort:        { type: "array", items: { type: "string" } },
                Services:       { type: "array", items: { type: "string" } },
              },
            },
            docChecklist: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label:         { type: "string" },
                  satisfied:     { type: "boolean" },
                  uploadedTypes: { type: "array", items: { type: "string" } },
                },
              },
            },
            reviewTasks: { type: "array", items: { type: "object" } },
          },
        }),
       
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    const legacyAmenityCategoryMap: Record<string, string> = {
      wifi: "Connectivity", high_speed_wifi: "Connectivity", ethernet: "Connectivity",
      pool: "Wellness", spa: "Wellness", gym: "Wellness", sauna: "Wellness", massage: "Wellness", hot_tub: "Wellness",
      restaurant: "Food & Drink", bar: "Food & Drink", room_service: "Food & Drink", mini_bar: "Food & Drink", breakfast: "Food & Drink", kitchen: "Food & Drink",
      air_conditioning: "Comfort", heating: "Comfort", fireplace: "Comfort", balcony: "Comfort",
      concierge: "Services", parking: "Services", security: "Services", laundry: "Services",
      dry_cleaning: "Services", housekeeping: "Services", luggage_storage: "Services",
      airport_shuttle: "Services", tv: "Services", workspace: "Services", washing_machine: "Services", garden: "Services",
    };

    // Group amenities!
    const groupedAmenities: Record<string, string[]> = {
      Connectivity: [],
      "Food & Drink": [],
      Wellness: [],
      Comfort: [],
      Services: [],
    };
    for (const item of listing.amenities) {
      const key = item.amenityKey;
      if (key.includes(":")) {
        const [cat = "Services", val = ""] = key.split(":");
        if (groupedAmenities[cat]) {
          groupedAmenities[cat].push(val);
        } else {
          groupedAmenities[cat] = [val];
        }
      } else {
        const cat = legacyAmenityCategoryMap[key] || "Services";
        if (!groupedAmenities[cat]) {
          groupedAmenities[cat] = [];
        }
        groupedAmenities[cat].push(key);
      }
    }

    const formattedListing = {
      ...listing,
      amenities: groupedAmenities,
    };

    return sendSuccess(reply, 200, formattedListing);
  });

  // ── GET /admin/listings/:id/documents/:docId ──────────────────────────────
  app.get("/admin/listings/:id/documents/:docId", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Listings"],
      summary: "Get presigned download URL for a listing document",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id", "docId"],
        properties: {
          id:    { type: "string", description: "Listing ID" },
          docId: { type: "string", description: "Document ID" },
        },
      },
      response: {
        200: ({
          type: "object",
          properties: {
            url:      { type: "string", format: "uri", description: "Presigned S3 URL (valid 15 min)" },
            fileType: { type: "string" },
          },
        }),
        
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, docId } = req.params as { id: string; docId: string };

    const doc = await prisma.listingDocument.findFirst({ where: { id: docId, listingId: id } });
    if (!doc) return sendError(reply, 404, "NOT_FOUND", "Document not found.");

    const url = await createPresignedDownloadUrl(doc.s3Key, 900);
    return sendSuccess(reply, 200, { url, fileType: doc.fileType });
  });

  // ── PATCH /admin/listings/review-tasks/:taskId/assign (UC-2.8 A3) ─────────
  app.patch("/admin/listings/review-tasks/:taskId/assign", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Listings"],
      summary: "Self-assign a review task",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
        },
      },
      response: {
        200: ({ type: "object", properties: { message: { type: "string" } } }),
      
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  app.post("/admin/listings/:id/approve", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
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

  // ── POST /admin/listings/:id/reject (UC-2.10) ─────────────────────────────
  app.post("/admin/listings/:id/reject", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Listings"],
      summary: "Reject a hotel listing with reasons",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Listing ID" },
        },
      },
      body: {
        type: "object",
        required: ["reasons"],
        properties: {
          reasons: {
            type: "array",
            minItems: 1,
            items: {
              type: "string",
              enum: [
                "Insufficient documentation",
                "Operating permit expired",
                "Star rating unverifiable from submitted documents",
                "Document image quality too poor to verify",
                "Business name on documents does not match listing name",
                "Other",
              ],
            },
            description: "One or more rejection reasons. Use 'Other' + providerNote for custom reasons.",
          },
          providerNote: {
            type: "string",
            description: "Message sent to provider — required when 'Other' is selected",
          },
          adminNote: {
            type: "string",
            description: "Internal note (not visible to provider)",
          },
        },
      },
      response: {
        200: ({ type: "object", properties: { message: { type: "string" } } }),
     
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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

  // ── PATCH /admin/listings/:id/star-rating (UC-2.12) ───────────────────────
  app.patch("/admin/listings/:id/star-rating", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Listings"],
      summary: "Update the verified star rating on an approved listing",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Listing ID" },
        },
      },
      body: {
        type: "object",
        required: ["starRating", "reason"],
        properties: {
          starRating: {
            type: "integer",
            minimum: 1,
            maximum: 5,
            description: "New verified star rating (1–5, integers only)",
          },
          reason: {
            type: "string",
            minLength: 1,
            description: "Reason for changing the star rating (stored in audit log)",
          },
        },
      },
      response: {
        200: ({ type: "object", properties: { message: { type: "string" } } }),
      
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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

  // ── POST /admin/listings/:id/suspend (UC-2.14) ────────────────────────────
  app.post("/admin/listings/:id/suspend", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Listings"],
      summary: "Suspend a live listing",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Listing ID" },
        },
      },
      body: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: {
            type: "string",
            minLength: 1,
            description: "Reason for suspension (stored in audit log)",
          },
          notifyProvider: {
            type: "boolean",
            default: true,
            description: "Whether to send a suspension email to the provider",
          },
        },
      },
      response: {
        200: ({ type: "object", properties: { message: { type: "string" } } }),
       
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  app.post("/admin/listings/:id/reinstate", { schema: { tags: ["Admin Listings"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
        status ? { status: status as "draft" } : {},
        category ? { category: category as "hotel" } : {},
        country ? { country } : {},
      ],
    };

    const [total, listings] = await Promise.all([
      prisma.listing.count({ where }),
      prisma.listing.findMany({
        where, skip, take,
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

  // ── GET /admin/bookings ───────────────────────────────────────────────────
  app.get("/admin/bookings", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Bookings"],
      summary: "List all bookings with filters (admin)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q:           { type: "string", default: "", description: "Search by reference, email, or guest name" },
          status:      { type: "string", description: "Filter by booking status" },
          listingType: { type: "string", description: "Filter by listing type (hotel, apartment, car)" },
          country:     { type: "string", description: "Filter by listing country code" },
          
        },
      },
      response: {
        200: ({
          type: "object",
          properties: {
            bookings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id:               { type: "string" },
                  reference:        { type: "string" },
                  listingId:        { type: "string" },
                  guestId:          { type: "string" },
                  providerId:       { type: "string" },
                  listingType:      { type: "string" },
                  status:           { type: "string" },
                  checkIn:          { type: "string", format: "date-time", nullable: true },
                  checkOut:         { type: "string", format: "date-time", nullable: true },
                  pickupDatetime:   { type: "string", format: "date-time", nullable: true },
                  returnDatetime:   { type: "string", format: "date-time", nullable: true },
                  nightsOrDays:     { type: "integer", nullable: true },
                  guestFirstName:   { type: "string" },
                  guestLastName:    { type: "string" },
                  guestEmail:       { type: "string" },
                  totalAmount:      { type: "number" },
                  currency:         { type: "string" },
                  commissionAmount: { type: "number" },
                  providerPayout:   { type: "number" },
                  voucherDiscount:  { type: "number", nullable: true },
                  cancelledAt:      { type: "string", format: "date-time", nullable: true },
                  confirmedAt:      { type: "string", format: "date-time", nullable: true },
                  createdAt:        { type: "string", format: "date-time" },
                  listing: {
                    type: "object",
                    properties: { name: { type: "string", nullable: true } },
                  },
                },
              },
            },
            total: { type: "integer" },
            page:  { type: "integer" },
            limit: { type: "integer" },
          },
        }),
       
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
        where, skip, take,
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

  // ── GET /admin/bookings/:id ───────────────────────────────────────────────
  app.get("/admin/bookings/:id", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Bookings"],
      summary: "Full booking detail with status log (admin)",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Booking ID" },
        },
      },
      response: {
        200: ({ type: "object", description: "Full booking object with statusLog and listing info" }),
       
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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

  // ── POST /admin/bookings/:id/cancel ───────────────────────────────────────
  app.post("/admin/bookings/:id/cancel", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Bookings"],
      summary: "Admin-forced booking cancellation",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Booking ID" },
        },
      },
      body: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: {
            type: "string",
            minLength: 1,
            description: "Reason for admin-forced cancellation",
          },
        },
      },
      response: {
        200: ({ type: "object", properties: { message: { type: "string" } } }),
       
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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

  // ── GET /admin/conversations ───────────────────────────────────────────────
  app.get("/admin/conversations", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Conversations"],
      summary: "List all conversations (admin)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q:      { type: "string", default: "", description: "Search by guestId or bookingId" },
          status: { type: "string", description: "Filter by conversation status" },
        },
      },
      response: {
        200: ({
          type: "object",
          properties: {
            conversations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id:         { type: "string" },
                  listingId:  { type: "string", nullable: true },
                  bookingId:  { type: "string", nullable: true },
                  guestId:    { type: "string" },
                  providerId: { type: "string" },
                  status:     { type: "string" },
                  lastMessage: {
                    nullable: true,
                    type: "object",
                    properties: {
                      body:       { type: "string" },
                      senderId:   { type: "string" },
                      senderType: { type: "string" },
                      isFiltered: { type: "boolean" },
                      createdAt:  { type: "string", format: "date-time" },
                    },
                  },
                  updatedAt: { type: "string", format: "date-time" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            total: { type: "integer" },
            page:  { type: "integer" },
            limit: { type: "integer" },
          },
        }),
     
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
        where, skip, take,
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

  // ── GET /admin/conversations/:id/messages ─────────────────────────────────
  app.get("/admin/conversations/:id/messages", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Conversations"],
      summary: "Admin message viewer for a conversation",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Conversation ID" },
        },
      },
      response: {
        200:({
          type: "object",
          properties: {
            conversation: {
              type: "object",
              properties: {
                id:         { type: "string" },
                listingId:  { type: "string", nullable: true },
                bookingId:  { type: "string", nullable: true },
                guestId:    { type: "string" },
                providerId: { type: "string" },
                status:     { type: "string" },
              },
            },
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id:         { type: "string" },
                  senderId:   { type: "string" },
                  senderType: { type: "string" },
                  body:       { type: "string" },
                  isFiltered: { type: "boolean" },
                  readAt:     { type: "string", format: "date-time", nullable: true },
                  createdAt:  { type: "string", format: "date-time" },
                },
              },
            },
          },
        }),
       
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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

  // ── GET /admin/ical-feeds ─────────────────────────────────────────────────
  app.get("/admin/ical-feeds", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin iCal"],
      summary: "List all iCal feeds across all listings",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          isActive: { type: "string", enum: ["true", "false"], description: "Filter by active status" },
        
        },
      },
      response: {
        200:({
          type: "object",
          properties: {
            feeds: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id:              { type: "string" },
                  listingId:       { type: "string" },
                  listingName:     { type: "string", nullable: true },
                  listingCategory: { type: "string" },
                  listingCountry:  { type: "string", nullable: true },
                  platform:        { type: "string" },
                  feedUrl:         { type: "string", format: "uri" },
                  isActive:        { type: "boolean" },
                  lastSyncedAt:    { type: "string", format: "date-time", nullable: true },
                  lastError:       { type: "string", nullable: true },
                  createdAt:       { type: "string", format: "date-time" },
                  updatedAt:       { type: "string", format: "date-time" },
                },
              },
            },
            total: { type: "integer" },
            page:  { type: "integer" },
            limit: { type: "integer" },
          },
        }),
       
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { page = "1", limit = "20", isActive } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
    };

    const [total, feeds] = await Promise.all([
      prisma.icalFeed.count({ where }),
      prisma.icalFeed.findMany({
        where, skip, take,
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

  // ── POST /admin/ical-feeds/:id/sync ───────────────────────────────────────
  app.post("/admin/ical-feeds/:id/sync", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin iCal"],
      summary: "Manually trigger an iCal feed resync",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "iCal feed ID" },
        },
      },
      response: {
        200:({
          type: "object",
          properties: {
            synced:  { type: "integer" },
            error:   { type: "string", nullable: true },
            message: { type: "string" },
          },
        }),
    
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const feed = await prisma.icalFeed.findUnique({ where: { id } });
    if (!feed) return sendError(reply, 404, "NOT_FOUND", "iCal feed not found.");

    const { syncFeed } = await import("./ical.js");
    const result = await syncFeed(id);

    if (result.error) {
      return sendSuccess(reply, 200, { synced: 0, error: result.error, message: "Sync failed." });
    }
    return sendSuccess(reply, 200, { synced: result.synced, message: `Synced ${result.synced} events.` });
  });

  // ── GET /admin/reviews ────────────────────────────────────────────────────
  app.get("/admin/reviews", {
    preHandler: [requireAdmin],
    schema: {
      tags:    ["Admin Reviews"],
      summary: "List all reviews with filters (admin)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q:         { type: "string", default: "", description: "Search by title, body, or guestId" },
          isHidden:  { type: "string", enum: ["true", "false"], description: "Filter by hidden status" },
          rating:    { type: "string", description: "Filter by rating (1–5)" },
          listingId: { type: "string", description: "Filter by listing ID" },
          
        },
      },
      response: {
        200:({
          type: "object",
          properties: {
            reviews: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id:            { type: "string" },
                  bookingId:     { type: "string" },
                  listingId:     { type: "string" },
                  listingName:   { type: "string", nullable: true },
                  guestId:       { type: "string" },
                  rating:        { type: "integer" },
                  title:         { type: "string", nullable: true },
                  body:          { type: "string", nullable: true },
                  providerReply: { type: "string", nullable: true },
                  isHidden:      { type: "boolean" },
                  hiddenBy:      { type: "string", nullable: true },
                  hiddenAt:      { type: "string", format: "date-time", nullable: true },
                  hiddenReason:  { type: "string", nullable: true },
                  createdAt:     { type: "string", format: "date-time" },
                },
              },
            },
            total: { type: "integer" },
            page:  { type: "integer" },
            limit: { type: "integer" },
          },
        }),
     
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
        where, skip, take,
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