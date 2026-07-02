import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { generateReference, getCommissionRate } from "./bookings.js";
import { getTaxRate } from "../services/getTaxRate.services.js";
import { calculateBilling } from "../services/billing.service.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireAdmin, type AdminRequest } from "../middleware/auth.js";
import { createPresignedDownloadUrl, withSignedPhotos } from "../lib/s3.js";
import { fireNotification } from "../lib/notifications.js";
import { patchListingSchema } from "./listings.js";

import { ReviewTaskStatus, ListingStatus, ListingCategory } from "../generated/index.js";
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
  { label: "business licence", types: ["business_licence"] },
  { label: "hotel operating permit", types: ["operating_permit", "hotel_operating_permit"] },
  { label: "tourism authority certificate", types: ["tourism_certificate", "tourism_authority_certificate"] },
];

const VALID_ADMIN_ROLES = new Set(["super_admin", "admin", "country_manager", "sales", "support", "finance"]);
const MODERATOR_ROLES = new Set(["super_admin", "admin", "country_manager"]);
const BOOKING_REQUEST_ROLES = new Set(["super_admin", "admin", "country_manager", "sales"]);

const VALID_LISTING_STATUSES = new Set(Object.values(ListingStatus));
const VALID_LISTING_CATEGORIES = new Set(Object.values(ListingCategory));

function checkAdminRole(req: FastifyRequest, reply: FastifyReply, requiredRoles?: Set<string>): boolean {
  const admin = req as AdminRequest;
  if (!VALID_ADMIN_ROLES.has(admin.adminRole)) {
    sendError(reply, 403, "FORBIDDEN", "Invalid admin role.");
    return false;
  }
  if (requiredRoles && !requiredRoles.has(admin.adminRole)) {
    sendError(reply, 403, "FORBIDDEN", "You do not have permission to perform this action.");
    return false;
  }
  return true;
}

// ── Shared schema building-blocks ─────────────────────────────────────────────

const ErrorResponse = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
  required: ["success", "error"],
} as const;

const ok = (dataSchema: object) => ({
  type: "object",
  required: ["success", "data"],
  properties: {
    success: { type: "boolean" },
    data: dataSchema,
  },
});

const PhotoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    cdnUrl: { type: "string" },
    position: { type: "integer" },
  },
} as const;

const PageQuery = {
  page: { type: "string", default: "1", description: "1-based page number" },
  limit: { type: "string", default: "20", description: "Items per page (max 100)" },
} as const;

// ── Routes ────────────────────────────────────────────────────────────────────

async function verifyListingScope(
  admin: AdminRequest,
  listingId: string,
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      country: true,
    },
  });

  if (!listing) {
    throw new Error("LISTING_NOT_FOUND");
  }

  if (admin.adminRole === "country_manager") {
    if (!listing.country || !admin.countryScope.includes(listing.country)) {
      throw new Error("OUT_OF_SCOPE");
    }
  }

  return listing;
}
export async function adminListingRoutes(app: FastifyInstance) {

  // ── GET /admin/listings/review-queue (UC-2.8) ─────────────────────────────
  app.get("/admin/listings/review-queue", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Fetch the listing review queue",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          country: { type: "string", description: "Filter by country code (ISO 3166-1 alpha-2)" },
          taskStatus: { type: "string", enum: ["open", "escalated"] },
          starRating: { type: "string", description: "Filter by claimed star rating (1–5)" },
          slaStatus: { type: "string", enum: ["breached", "approaching", "ok"], description: "SLA breach status" },
          sortBy: { type: "string", enum: ["sla_deadline", "submitted_at"], default: "sla_deadline" },
          ...PageQuery,
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  status: { type: "string" },
                  slaDeadline: { type: "string", format: "date-time" },
                  assignedTo: { type: "string", nullable: true },
                  listing: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string", nullable: true },
                      country: { type: "string", nullable: true },
                      town: { type: "string", nullable: true },
                      claimedStarRating: { type: "integer", nullable: true },
                      submissionCount: { type: "integer" },
                      submittedAt: { type: "string", format: "date-time", nullable: true },
                      providerId: { type: "string" },
                      category: { type: "string" },
                      photos: { type: "array", items: PhotoSchema },
                    },
                  },
                },
              },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        }),
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const admin = req as AdminRequest;

    const { country, starRating, taskStatus, slaStatus, page = "1", limit = "20", sortBy = "sla_deadline" } = req.query as Record<string, string>;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const now = new Date();

    const slaFilter =
      slaStatus === "breached"
        ? { slaDeadline: { lt: now } }
        : slaStatus === "approaching"
          ? {
            slaDeadline: {
              gte: now,
              lt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
            },
          }
          : slaStatus === "ok"
            ? {
              slaDeadline: {
                gte: new Date(now.getTime() + 4 * 60 * 60 * 1000),
              },
            }
            : {};
    const isCountryManager = admin.adminRole === "country_manager";

    const listingFilter: any = {
      status: { in: ["pending_review", "auto_suspended"]
    },
  };
    if (isCountryManager) {
      if (country) {
        if (admin.countryScope.includes(country)) {
          listingFilter.country = country;
        } else {
          listingFilter.country = { in: [] };
        }
      } else {
        listingFilter.country = { in: admin.countryScope };
      }
    } else if (country) {
      listingFilter.country = country;
    }

    if (starRating) {
      const parsedRating = parseInt(starRating, 10);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return sendError(reply, 400, "BAD_REQUEST", `Invalid star rating: ${starRating}`);
      }
      listingFilter.claimedStarRating = parsedRating;
    }

    try {
      const tasks = await prisma.listingReviewTask.findMany({
        where: {
          status: taskStatus
            ? (taskStatus as ReviewTaskStatus)
            : { in: ["open", "escalated"] },
          AND: [
            slaFilter,
            {
              listing: {
                is: listingFilter,
              },
            },
          ],
        },
        skip,
        take,
        orderBy: sortBy === "submitted_at"
          ? { listing: { submittedAt: "desc" } }
          : { slaDeadline: "asc" },
        include: {
          listing: {
            include: {
              photos: {
                where: { deletedAt: null },
                orderBy: { position: "asc" },
              },
            },
          },
        },
      });

      const total = await prisma.listingReviewTask.count({
        where: {
          status: taskStatus
            ? (taskStatus as ReviewTaskStatus)
            : { in: ["open", "escalated"] },
          AND: [
            slaFilter,
            {
              listing: {
                is: listingFilter,
              },
            },
          ],
        },
      });

      const signedTasks = await Promise.all(
        tasks.map(async (t) => ({
          ...t,
          listing: {
            ...t.listing,
            photos: await withSignedPhotos(t.listing.photos),
          },
        })),
      );

      return sendSuccess(reply, 200, {
        tasks: signedTasks,
        total,
        page: parseInt(page, 10),
        limit: take,
      });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch review queue.");
    }
  });


  // ── GET /admin/listings/:id/review (UC-2.9) ───────────────────────────────
  app.get("/admin/listings/:id/review", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
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
        200: ok({
          type: "object",
          description: "Full listing object with grouped amenities and document checklist",
          properties: {
            id: { type: "string" },
            name: { type: "string", nullable: true },
            status: { type: "string" },
            category: { type: "string" },
            country: { type: "string", nullable: true },
            town: { type: "string", nullable: true },
            claimedStarRating: { type: "integer", nullable: true },
            starRating: { type: "integer", nullable: true },
            submissionCount: { type: "integer" },
            photos: { type: "array", items: PhotoSchema },
            documents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  documentType: { type: "string" },
                  fileType: { type: "string" },
                  s3Key: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            amenities: {
              type: "object",
              description: "Amenities grouped by category",
              properties: {
                Connectivity: { type: "array", items: { type: "string" } },
                "Food & Drink": { type: "array", items: { type: "string" } },
                Wellness: { type: "array", items: { type: "string" } },
                Comfort: { type: "array", items: { type: "string" } },
                Services: { type: "array", items: { type: "string" } },
              },
            },
            docChecklist: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  satisfied: { type: "boolean" },
                  uploadedTypes: { type: "array", items: { type: "string" } },
                },
              },
                        },
            reviewTasks: { type: "array", items: { type: "object" } },
            
            // ── ADD THESE NEW SCHEMA PROPERTIES HERE: ──
            description: { type: "string", nullable: true },
            currency: { type: "string", nullable: true },
            pricePerNight: { type: "number", nullable: true },
            cancellationPolicy: { type: "string", nullable: true },
            smokingAllowed: { type: "boolean", nullable: true },
            petsAllowed: { type: "boolean", nullable: true },
            // Hotel Specific
            roomType: { type: "string", nullable: true },
            unitCount: { type: "integer", nullable: true },
            // Apartment Specific
            bedrooms: { type: "integer", nullable: true },
            bathrooms: { type: "integer", nullable: true },
            maxGuests: { type: "integer", nullable: true },
            longStayEnabled: { type: "boolean", nullable: true },
            longStayDiscountValue: { type: "number", nullable: true },
            longStayDiscountType: { type: "string", nullable: true },
            longStayMinNights: { type: "integer", nullable: true },
            // Car Specific
            carMake: { type: "string", nullable: true },
            carModel: { type: "string", nullable: true },
            carYear: { type: "integer", nullable: true },
            transmission: { type: "string", nullable: true },
            fuelType: { type: "string", nullable: true },
            seats: { type: "integer", nullable: true },
            mileagePolicy: { type: "string", nullable: true },
            mileageLimitKm: { type: "integer", nullable: true },
            // ───────────────────────────────────────────
          }, 
        }),
        404: ErrorResponse,

        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }
      const listing = await prisma.listing.findUnique({
        where: { id },
        include: {
          photos: { where: { deletedAt: null }, orderBy: { position: "asc" } },
          documents: { where: { replacedAt: null } },
          amenities: true,
          customAmenities: true,
          reviewTasks: { where: { status: { in: ["open", "escalated"] } }, take: 1, orderBy: { createdAt: "desc" } },
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

      const presentDocTypes = listing.documents.map((d) => d.documentType as string);
      const docChecklist = HOTEL_REQUIRED_DOC_GROUPS.map((group) => ({
        label: group.label,
        satisfied: group.types.some((t) => presentDocTypes.includes(t)),
        uploadedTypes: group.types.filter((t) => presentDocTypes.includes(t)),
      }));

      return sendSuccess(reply, 200, {
        ...listing,
        pricePerNight: listing.category === "car" 
          ? (listing.pricePerDay ? Number(listing.pricePerDay) : null)
          : (listing.pricePerNight ? Number(listing.pricePerNight) : null),
        cancellationPolicy: listing.cancellationPolicy,
        description: listing.description,
        currency: listing.currency,
        // Hotel-only fields (omitted for cars and apartments)
        roomType: listing.category === "hotel" ? listing.roomType : undefined,
        unitCount: listing.category === "hotel" ? listing.unitCount : undefined,
        smokingAllowed: listing.category !== "car" ? listing.smokingAllowed : undefined,
        petsAllowed: listing.category !== "car" ? listing.petsAllowed : undefined,
        
        // Apartment-only fields (omitted for hotels and cars)
        bedrooms: listing.category === "apartment" ? listing.bedrooms : undefined,
        bathrooms: listing.category === "apartment" ? listing.bathrooms : undefined,
        maxGuests: listing.category === "apartment" ? listing.maxGuests : undefined,
        longStayEnabled: listing.category === "apartment" ? listing.longStayEnabled : undefined,
        longStayDiscountValue: listing.category === "apartment" ? (listing.longStayDiscountValue ? Number(listing.longStayDiscountValue) : null) : undefined,
        longStayDiscountType: listing.category === "apartment" ? listing.longStayDiscountType : undefined,
        longStayMinNights: listing.category === "apartment" ? listing.longStayMinNights : undefined,
        
        // Car-only fields (omitted for hotels and apartments)
        carMake: listing.category === "car" ? listing.carMake : undefined,
        carModel: listing.category === "car" ? listing.carModel : undefined,
        carYear: listing.category === "car" ? listing.carYear : undefined,
        transmission: listing.category === "car" ? listing.transmission : undefined,
        fuelType: listing.category === "car" ? listing.fuelType : undefined,
        seats: listing.category === "car" ? listing.seats : undefined,
        mileagePolicy: listing.category === "car" ? listing.mileagePolicy : undefined,
        mileageLimitKm: listing.category === "car" ? listing.mileageLimitKm : undefined,

        amenities: groupedAmenities,
        photos: await withSignedPhotos(listing.photos),
        docChecklist,
      });
    } catch (err: any) {
      return sendError(reply, 400, "GET_REVIEW_FAILED", "Failed to retrieve listing for review. Please try again.");
    }
  });

  // ── GET /admin/listings/:id/documents/:docId ──────────────────────────────
  app.get("/admin/listings/:id/documents/:docId", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Get presigned download URL for a listing document",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id", "docId"],
        properties: {
          id: { type: "string", description: "Listing ID" },
          docId: { type: "string", description: "Document ID" },
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            url: { type: "string", format: "uri", description: "Presigned S3 URL (valid 15 min)" },
            fileType: { type: "string" },
          },
        }),
        404: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const admin = req as AdminRequest;
    const { id, docId } = req.params as { id: string; docId: string };
    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(
              reply,
              404,
              "NOT_FOUND",
              "Listing not found."
            );
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }

      const doc = await prisma.listingDocument.findFirst({ where: { id: docId, listingId: id } });
      if (!doc) return sendError(reply, 404, "NOT_FOUND", "Document not found.");

      const url = await createPresignedDownloadUrl(doc.s3Key, 900);
      return sendSuccess(reply, 200, { url, fileType: doc.fileType });
    } catch (err: any) {
      return sendError(reply, 400, "GET_DOCUMENT_FAILED", "Failed to retrieve listing document. Please try again.");
    }
  });

  // ── PATCH /admin/listings/review-tasks/:taskId/assign (UC-2.8 A3) ─────────
  app.patch("/admin/listings/review-tasks/:taskId/assign", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
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
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        404: ErrorResponse,
        409: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, MODERATOR_ROLES)) return;
    const admin = req as AdminRequest;
    const { taskId } = req.params as { taskId: string };

    try {
      const task = await prisma.listingReviewTask.findUnique({
        where: { id: taskId }, include: {
          listing: {
            select: {
              id: true,
            },
          },
        },
      });
      if (!task) return sendError(reply, 404, "NOT_FOUND", "Review task not found.");
      try {
        await verifyListingScope(admin, task.listing.id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(
              reply,
              404,
              "NOT_FOUND",
              "Listing not found."
            );
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This review task is outside your country scope."
            );
          }
        }

        throw error;
      }
      if (!["open", "escalated"].includes(task.status)) {
        return sendError(reply, 409, "TASK_RESOLVED", "Cannot assign a resolved task.");
      }
      if (task.assignedTo && task.assignedTo !== admin.adminId) {
        return sendError(reply, 409, "ALREADY_ASSIGNED", "This listing is already assigned to another reviewer.");
      }

      await prisma.listingReviewTask.update({ where: { id: taskId }, data: { assignedTo: admin.adminId } });
      return sendSuccess(reply, 200, { message: "Assigned to you." });
    } catch (err: any) {
      return sendError(reply, 400, "ASSIGN_TASK_FAILED", "Failed to assign review task. Please try again.");
    }
  });

  // ── PATCH /admin/listings/review-tasks/:taskId/unassign ───────────────────
  app.patch("/admin/listings/review-tasks/:taskId/unassign", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Release a claimed review task",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
        },
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        404: ErrorResponse,
        409: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, MODERATOR_ROLES)) return;
    const admin = req as AdminRequest;
    const { taskId } = req.params as { taskId: string };

    try {
      const task = await prisma.listingReviewTask.findUnique({
        where: { id: taskId }, include: {
          listing: {
            select: {
              id: true,
            },
          },
        }
      });
      if (!task) return sendError(reply, 404, "NOT_FOUND", "Review task not found.");
      try {
        await verifyListingScope(admin, task.listing.id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(
              reply,
              404,
              "NOT_FOUND",
              "Listing not found."
            );
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This review task is outside your country scope."
            );
          }
        }

        throw error;
      }
      if (!["open", "escalated"].includes(task.status)) {
        return sendError(reply, 409, "TASK_RESOLVED", "Cannot unassign a resolved task.");
      }
      if (task.assignedTo && task.assignedTo !== admin.adminId && admin.adminRole !== "super_admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only the assigned reviewer or a super admin can unassign this task.");
      }

      await prisma.listingReviewTask.update({ where: { id: taskId }, data: { assignedTo: null } });
      return sendSuccess(reply, 200, { message: "Task unassigned." });
    } catch (err: any) {
      return sendError(reply, 400, "UNASSIGN_TASK_FAILED", "Failed to unassign review task. Please try again.");
    }
  });

  // ── PATCH /admin/listings/review-tasks/:taskId/escalate ───────────────────
  app.patch("/admin/listings/review-tasks/:taskId/escalate", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Escalate a review task (breached SLA)",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
        },
      },
      body: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Optional escalation note" },
        },
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        404: ErrorResponse,
        409: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, MODERATOR_ROLES)) return;
    const admin = req as AdminRequest;
    const { taskId } = req.params as { taskId: string };
    const { reason } = req.body as { reason?: string };

    try {
      const task = await prisma.listingReviewTask.findUnique({
        where: { id: taskId }, include: {
          listing: {
            select: {
              id: true,
            },
          },
        },
      });
      if (!task) return sendError(reply, 404, "NOT_FOUND", "Review task not found.");
      try {
        await verifyListingScope(admin, task.listing.id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(
              reply,
              404,
              "NOT_FOUND",
              "Listing not found."
            );
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This review task is outside your country scope."
            );
          }
        }

        throw error;
      }
      if (!["open", "awaiting_provider_response"].includes(task.status)) {
        return sendError(reply, 409, "INVALID_STATUS", "Only open or awaiting-provider-response tasks can be escalated.");
      }

      await prisma.$transaction([
        prisma.listingReviewTask.update({ where: { id: taskId }, data: { status: "escalated" } }),
        prisma.listingModerationLog.create({
          data: {
            listingId: task.listingId,
            action: "escalated",
            actorId: admin.adminId,
            actorRole: admin.adminRole,
            metadata: { taskId, reason: reason ?? null, slaDeadline: task.slaDeadline.toISOString(), ipAddress: req.ip },
          },
        }),
      ]);

      return sendSuccess(reply, 200, { message: "Review task escalated." });
    } catch (err: any) {
      return sendError(reply, 400, "ESCALATE_TASK_FAILED", "Failed to escalate review task. Please try again.");
    }
  });

  // ── POST /admin/listings/review-tasks/:taskId/resolve (Agent Unblock Process) ──
  app.post("/admin/listings/review-tasks/:taskId/resolve", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Resolve a listing review task (Agent unblock process)",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["taskId"],
        properties: { taskId: { type: "string" } },
      },
      body: {
        type: "object",
        required: ["decision"],
        properties: {
          decision: {
            type: "string",
            enum: ["unblock_warning", "unblock_no_warning", "keep_suspended", "ban"]
          },
          adminNote: { type: "string", minLength: 1 },
        },
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, MODERATOR_ROLES)) return;
    const admin = req as AdminRequest;
    const { taskId } = req.params as { taskId: string };
    const { decision, adminNote } = req.body as { decision: string; adminNote?: string };

    try {
      const task = await prisma.listingReviewTask.findUnique({
        where: { id: taskId },
        include: { listing: true },
      });

      if (!task) return sendError(reply, 404, "NOT_FOUND", "Review task not found.");
      if (!["open", "escalated"].includes(task.status)) {
        return sendError(reply, 409, "TASK_RESOLVED", "This task is already resolved or in a different state.");
      }

      if (task.assignedTo && task.assignedTo !== admin.adminId) {
        return sendError(reply, 403, "FORBIDDEN", "This task is assigned to someone else.");
      }

      if (decision === "unblock_no_warning" && !adminNote) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Internal note is mandatory when unblocking without a warning.");
      }

      if (decision === "ban" && !["admin", "super_admin"].includes(admin.adminRole)) {
        return sendError(reply, 403, "FORBIDDEN", "Only Admin or Super Admin can permanently ban a listing.");
      }

      await prisma.$transaction(async (tx) => {
        let nextStatus = "resolved";
        let listingStatusUpdate: string | undefined = undefined;
        let resetConsecutiveNegative = false;

        switch (decision) {
          case "unblock_warning":
            // TODO: Send formal warning email to provider
            listingStatusUpdate = "active";
            resetConsecutiveNegative = true;
            break;
          case "unblock_no_warning":
            listingStatusUpdate = "active";
            resetConsecutiveNegative = true;
            break;
          case "keep_suspended":
            nextStatus = "awaiting_provider_response";
            // TODO: Send message to provider
            break;
          case "ban":
            listingStatusUpdate = "permanently_banned";
            // TODO: Notify provider of ban
            break;
        }

        if (listingStatusUpdate) {
          await tx.listing.update({
            where: { id: task.listingId },
            data: {
              status: listingStatusUpdate as any,
              ...(resetConsecutiveNegative ? { consecutiveNegative: 0 } : {}),
            },
          });
        }

        await tx.listingReviewTask.update({
          where: { id: taskId },
          data: {
            status: nextStatus as any,
            outcome: decision,
            adminNote: adminNote ?? null,
            ...(nextStatus === "resolved" ? { resolvedAt: new Date() } : {}),
          },
        });

        await tx.listingModerationLog.create({
          data: {
            listingId: task.listingId,
            action: "review_task_resolved",
            actorId: admin.adminId,
            actorRole: admin.adminRole,
            metadata: { taskId, decision, adminNote: adminNote ?? null },
          },
        });

        await tx.auditLog.create({
          data: {
            adminId: admin.adminId,
            role: admin.adminRole,
            action: "review_task_resolved",
            targetType: "listing",
            targetId: task.listingId,
            oldValue: task.status,
            newValue: JSON.stringify({ decision, outcome: nextStatus }),
            ipAddress: req.ip,
          },
        });
      });

      return sendSuccess(reply, 200, { message: `Task resolved with decision: ${decision}.` });
    } catch (err: any) {
      return sendError(reply, 400, "RESOLVE_TASK_FAILED", "Failed to resolve review task. Please try again.");
    }
  });

  // POST /admin/listings/:id/approve — Approve listing (UC-2.9)
  app.post("/admin/listings/:id/approve", {
    schema: {
      tags: ["Admin Listings"],
      body: {
        type: "object",
        required: ["starRating"],
        properties: {
          starRating: { type: "integer", minimum: 1, maximum: 5, description: "Verified star rating assigned by admin (1–5)" },
          adminNote: { type: "string", description: "Optional internal note for the review log" },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {

    const admin = req as AdminRequest;
    if (!MODERATOR_ROLES.has(admin.adminRole)) {
      return sendError(
        reply,
        403,
        "FORBIDDEN",
        "You do not have permission to approve listings or assign star ratings."
      );
    }
    const { id } = req.params as { id: string };
    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }
      const { starRating, adminNote } = (req.body ?? {}) as { starRating: number; adminNote?: string };

      if (!Number.isInteger(starRating) || starRating < 1 || starRating > 5) {
        return sendError(reply, 422, "VALIDATION_ERROR", "A verified star rating (1–5, integer) is required to approve a hotel listing.");
      }

      const listing = await prisma.listing.findUnique({
        where: { id },
        include: {
          reviewTasks: { where: { status: { in: ["open", "escalated"] } }, take: 1, orderBy: { createdAt: "desc" } },
          documents: { where: { replacedAt: null } },
        },
      });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
      if (listing.status !== "pending_review") return sendError(reply, 409, "INVALID_STATUS", "Listing is not pending review.");

      const task = listing.reviewTasks[0] ?? null;

      if (task?.assignedTo && task.assignedTo !== admin.adminId) {
        return sendError(reply, 409, "TASK_ASSIGNED_TO_OTHER",
          "This review task is assigned to another admin. Unassign it first or coordinate with the assigned reviewer.");
      }

      const presentDocTypes = listing.documents.map((d) => d.documentType as string);
      const missingDocs = HOTEL_REQUIRED_DOC_GROUPS
        .filter((g) => !g.types.some((t) => presentDocTypes.includes(t)))
        .map((g) => g.label);
      if (missingDocs.length > 0) {
        return sendError(reply, 422, "MISSING_DOCUMENTS",
          `Cannot approve: the following required document(s) are missing: ${missingDocs.join(", ")}.`);
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.listing.updateMany({
          where: { id, status: "pending_review" },
          data: { status: "approved", starRating, approvedAt: new Date(), approvedBy: admin.adminId },
        });

        if (updated.count === 0) return { actioned: false };

        if (task) {
          await tx.listingReviewTask.update({
            where: { id: task.id },
            data: { status: "resolved", outcome: "approved", adminNote: adminNote ?? null, resolvedAt: new Date() },
          });
        }

        await tx.listingModerationLog.create({
          data: {
            listingId: id,
            action: "approved",
            actorId: admin.adminId,
            actorRole: admin.adminRole,
            metadata: {
              starRating,
              claimedStarRating: listing.claimedStarRating,
              adminNote: adminNote ?? null,
              taskId: task?.id ?? null,
              submissionNumber: task?.submissionNumber ?? listing.submissionCount,
              ipAddress: req.ip,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            adminId: admin.adminId,
            role: admin.adminRole,
            action: "listing_approved",
            targetType: "listing",
            targetId: id,
            oldValue: JSON.stringify({
              status: listing.status,
              claimedStarRating: listing.claimedStarRating,
            }),
            newValue: JSON.stringify({
              status: "approved",
              starRating,
            }),
            ipAddress: req.ip,
          },
        });

        return { actioned: true };
      });

      if (!result.actioned) {
        return sendError(reply, 409, "INVALID_STATUS",
          "Listing is not pending review — it may have already been actioned by another admin.");
      }

      sendListingApprovedEmail(listing.providerId, listing.name ?? id, starRating, listing.claimedStarRating).catch(() => null);
      fireNotification(listing.providerId, {
        type: "listing_approved",
        title: "Listing Approved! 🎉",
        body: `Your listing "${listing.name ?? id}" has been approved and is now live.`,
        data: { listingId: id },
      });
      return sendSuccess(reply, 200, { message: "Listing approved and published." });
    } catch (err: any) {
      return sendError(reply, 400, "APPROVE_LISTING_FAILED", "Failed to approve listing. Please try again.");
    }
  });

  // ── POST /admin/listings/:id/reject (UC-2.10) ─────────────────────────────
  app.post("/admin/listings/:id/reject", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
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
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        404: ErrorResponse,
        409: ErrorResponse,
        422: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, MODERATOR_ROLES)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }
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

      if (task?.assignedTo && task.assignedTo !== admin.adminId) {
        return sendError(reply, 409, "TASK_ASSIGNED_TO_OTHER",
          "This review task is assigned to another admin. Unassign it first or coordinate with the assigned reviewer.");
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.listing.updateMany({
          where: { id, status: "pending_review" },
          data: {
            status: "rejected",
            rejectedAt: new Date(),
            rejectedBy: admin.adminId,
            rejectionReasons: reasons,
            rejectionNote: providerNote ?? null,
          },
        });

        if (updated.count === 0) return { actioned: false };

        if (task) {
          await tx.listingReviewTask.update({
            where: { id: task.id },
            data: { status: "resolved", outcome: "rejected", adminNote: adminNote ?? null, resolvedAt: new Date() },
          });
        }

        await tx.listingModerationLog.create({
          data: {
            listingId: id,
            action: "rejected",
            actorId: admin.adminId,
            actorRole: admin.adminRole,
            metadata: {
              reasons,
              providerNote: providerNote ?? null,
              adminNote: adminNote ?? null,
              taskId: task?.id ?? null,
              submissionNumber: task?.submissionNumber ?? listing.submissionCount,
              ipAddress: req.ip,
            },
          },
        });
        await tx.auditLog.create({
          data: {
            adminId: admin.adminId,
            role: admin.adminRole,
            action: "listing_rejected",
            targetType: "listing",
            targetId: id,
            oldValue: JSON.stringify({
              status: listing.status,
            }),
            newValue: JSON.stringify({
              status: "rejected",
              reasons,
            }),
            ipAddress: req.ip,
          },
        });
        return { actioned: true };
      });

      if (!result.actioned) {
        return sendError(reply, 409, "INVALID_STATUS",
          "Listing is not pending review — it may have already been actioned by another admin.");
      }

      sendListingRejectedEmail(listing.providerId, listing.name ?? id, reasons, providerNote ?? null).catch(() => null);
      fireNotification(listing.providerId, {
        type: "listing_rejected",
        title: "Listing Needs Changes",
        body: `Your listing "${listing.name ?? id}" was not approved. Please review the feedback and resubmit.`,
        data: { listingId: id, reasons },
      });
      return sendSuccess(reply, 200, { message: "Listing rejected. Provider has been notified." });
    } catch (err: any) {
      return sendError(reply, 400, "REJECT_LISTING_FAILED", "Failed to reject listing. Please try again.");
    }
  });

  // ── PATCH /admin/listings/:id/star-rating (UC-2.12) ───────────────────────
  app.patch("/admin/listings/:id/star-rating", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
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
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        404: ErrorResponse,
        409: ErrorResponse,
        422: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, MODERATOR_ROLES)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }
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
        prisma.listing.update({
          where: { id },
          data: { starRating },
        }),

        prisma.listingModerationLog.create({
          data: {
            listingId: id,
            action: "star_rating_updated",
            actorId: admin.adminId,
            actorRole: admin.adminRole,
            metadata: {
              oldRating,
              newRating: starRating,
              reason,
              ipAddress: req.ip,
            },
          },
        }),

        prisma.auditLog.create({
          data: {
            adminId: admin.adminId,
            role: admin.adminRole,
            action: "star_rating_updated",
            targetType: "listing",
            targetId: id,
            oldValue: String(oldRating),
            newValue: String(starRating),
            ipAddress: req.ip,
          },
        }),
      ]);

      sendStarRatingUpdatedEmail(listing.providerId, listing.name ?? id, oldRating, starRating, reason).catch(() => null);
      return sendSuccess(reply, 200, { message: "Star rating updated." });
    } catch (err: any) {
      return sendError(reply, 400, "UPDATE_RATING_FAILED", "Failed to update star rating. Please try again.");
    }
  });

  // PATCH /admin/listings/:id — Update listing fields (Admin)
  app.patch("/admin/listings/:id", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Update listing fields (admin)",
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
        properties: {
          listingTitle: { type: "string", maxLength: 200 },
          roomType: {
            type: "string",
            enum: ["standard", "superior", "deluxe", "suite", "junior_suite", "studio", "family_room", "presidential_suite"]
          },
          unitCount: { type: "integer", minimum: 1 },
          claimedStarRating: { type: "integer", minimum: 1, maximum: 5 },
          description: { type: "string", maxLength: 1000 },
          pricePerNight: { type: "number", minimum: 0 },
          pricePerDay: { type: "number", minimum: 0 },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          minStayNights: { type: "integer", minimum: 1 },
          checkinTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
          checkoutTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
          cancellationPolicy: { type: "string", enum: ["flexible", "moderate", "strict"] },
          smokingAllowed: { type: "boolean" },
          petsAllowed: { type: "boolean" },
          address: { type: "string" },
          town: { type: "string", maxLength: 100 },
          country: { type: "string", minLength: 2, maxLength: 2 },
          amenities: {
            type: "object",
            properties: {
              Connectivity: { type: "array", items: { type: "string" } },
              "Food & Drink": { type: "array", items: { type: "string" } },
              Wellness: { type: "array", items: { type: "string" } },
              Comfort: { type: "array", items: { type: "string" } },
              Services: { type: "array", items: { type: "string" } }
            },
            additionalProperties: true
          },
          customAmenities: { type: "array", items: { type: "string", maxLength: 60 } },
          instantBooking: { type: "boolean" },
          selfCheckin: { type: "boolean" },
          selfCheckinDetails: { type: "string", maxLength: 500 },
          apartmentType: { type: "string", enum: ["entire_place", "private_room", "shared_room", "studio", "loft", "villa", "townhouse"] },
          cleaningFee: { type: "number", minimum: 0 },
          extraGuestFee: { type: "number", minimum: 0 },
          extraGuestAfter: { type: "integer", minimum: 1 },
          weeklyDiscount: { type: "number", minimum: 0 },
          monthlyDiscount: { type: "number", minimum: 0 },
          floorNumber: { type: "integer" },
          propertySizeM2: { type: "number", minimum: 0 },
          securityDepositDue: { type: "string", maxLength: 30 },
          // car-specific fields
          carMake: { type: "string", maxLength: 80 },
          make: { type: "string", maxLength: 80 },
          carModel: { type: "string", maxLength: 80 },
          model: { type: "string", maxLength: 80 },
          carYear: { type: "integer", minimum: 1990, maximum: new Date().getFullYear() },
          year: { type: "integer", minimum: 1990, maximum: new Date().getFullYear() },
          transmission: { type: "string", enum: ["manual", "automatic", "semi_auto"] },
          fuelType: { type: "string", enum: ["petrol", "diesel", "electric", "hybrid", "lpg"] },
          seats: { type: "integer", minimum: 1 },
          doors: { type: "integer", minimum: 2 },
          mileagePolicy: { type: "string", enum: ["unlimited", "limited"] },
          mileageLimitKm: { type: "integer", minimum: 1 },
          carCategory: { type: "string", enum: ["Economy", "Compact", "SUV", "Minivan", "Pickup", "Luxury", "Electric", "Convertible"] },
          category: { type: "string", enum: ["Economy", "Compact", "SUV", "Minivan", "Pickup", "Luxury", "Electric", "Convertible"] },
          driveType: { type: "string", enum: ["2WD", "4WD", "AWD"] },
          airConditioning: { type: "boolean" },
          roadsideAssistance: { type: "boolean" },
          crossBorderAllowed: { type: "boolean" },
          airportPickup: { type: "boolean" },
          deliveryEnabled: { type: "boolean" },
          returnSameLocation: { type: "boolean" },
          allowPreBooking: { type: "boolean" }
        },
        additionalProperties: true
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" }, data: { type: "object" } } }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      if (!checkAdminRole(req, reply)) return;
      const admin = req as AdminRequest;
      const { id } = req.params as { id: string };

      const parsed = patchListingSchema.safeParse(req.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
        return sendError(reply, 422, "VALIDATION_ERROR", "Invalid listing data.", fields);
      }

      const {
        amenities,
        customAmenities,
        listingTitle,
        make,
        model,
        year,
        category,
        pricePerDay,
        ...fields
      } = parsed.data;

      const dbFields: any = { ...fields };
      if (listingTitle !== undefined) dbFields.name = listingTitle;
      if (make !== undefined) dbFields.carMake = make;
      if (model !== undefined) dbFields.carModel = model;
      if (year !== undefined) dbFields.carYear = year;
      if (pricePerDay !== undefined) dbFields.pricePerDay = pricePerDay;
      if (category !== undefined) dbFields.carCategory = category;

      await prisma.$transaction(async (tx) => {
        await tx.listing.update({ where: { id }, data: dbFields });

        if (amenities !== undefined) {
          await tx.listingAmenity.deleteMany({ where: { listingId: id } });
          const flat: string[] = [];
          for (const [cat, keys] of Object.entries(amenities)) {
            if (Array.isArray(keys)) {
              for (const k of keys) flat.push(`${cat}:${k}`);
            }
          }
          if (flat.length > 0) {
            await tx.listingAmenity.createMany({ data: flat.map((key) => ({ listingId: id, amenityKey: key })) });
          }
        }

        if (customAmenities !== undefined) {
          await tx.listingCustomAmenity.deleteMany({ where: { listingId: id } });
          if (customAmenities.length > 0) {
            await tx.listingCustomAmenity.createMany({ data: customAmenities.map((label) => ({ listingId: id, label })) });
          }
        }
      });

      const updated = await prisma.listing.findUnique({
        where: { id },
        include: {
          photos: { where: { deletedAt: null }, orderBy: { position: "asc" } },
          documents: { where: { replacedAt: null } },
          amenities: true,
          customAmenities: true,
        },
      });
      if (!updated) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
      const formatted = { ...updated, photos: await withSignedPhotos(updated.photos) };
      return sendSuccess(reply, 200, { message: "Listing updated.", data: formatted });
    },
  });
  // ── POST /admin/listings/:id/suspend (UC-2.14) ────────────────────────────
  app.post("/admin/listings/:id/suspend", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
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
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        404: ErrorResponse,
        409: ErrorResponse,
        422: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, MODERATOR_ROLES)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }
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
            status: "suspended",
            suspendedAt: new Date(),
            suspendedBy: admin.adminId,
            suspensionReason: reason,
          },
        }),

        prisma.listingModerationLog.create({
          data: {
            listingId: id,
            action: "suspended",
            actorId: admin.adminId,
            actorRole: admin.adminRole,
            metadata: {
              reason,
              previousStatus: listing.status,
              notifyProvider,
              ipAddress: req.ip,
            },
          },
        }),

        prisma.auditLog.create({
          data: {
            adminId: admin.adminId,
            role: admin.adminRole,
            action: "listing_suspended",
            targetType: "listing",
            targetId: id,
            oldValue: listing.status,
            newValue: "suspended",
            ipAddress: req.ip,
          },
        }),
      ]);

      if (notifyProvider) {
        sendListingSuspendedEmail(listing.providerId, listing.name ?? id).catch(() => null);
      }

      return sendSuccess(reply, 200, { message: "Listing suspended." });
    } catch (err: any) {
      return sendError(reply, 400, "SUSPEND_LISTING_FAILED", "Failed to suspend listing. Please try again.");
    }
  });

  // ── POST /admin/listings/:id/reinstate (UC-2.14 A1) ───────────────────────
  app.post("/admin/listings/:id/reinstate", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Reinstate a suspended listing",
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
        properties: {
          reason: {
            type: "string",
            description: "Optional note explaining the reinstatement",
          },
        },
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        404: ErrorResponse,
        409: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, MODERATOR_ROLES)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }
      const { reason } = req.body as { reason?: string };

      const listing = await prisma.listing.findUnique({ where: { id } });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
      if (listing.status !== "suspended") return sendError(reply, 409, "INVALID_STATUS", "Listing is not suspended.");

      const restoreStatus = (listing.category === "apartment" || listing.category === "car") ? "active" : "approved";

      await prisma.$transaction([
        prisma.listing.update({ where: { id }, data: { status: restoreStatus } }),
        prisma.listingModerationLog.create({
          data: {
            listingId: id,
            action: "reinstated",
            actorId: admin.adminId,
            actorRole: admin.adminRole,
            metadata: {
              restoredStatus: restoreStatus,
              reason: reason ?? null,
              suspendedAt: listing.suspendedAt?.toISOString() ?? null,
              suspendedBy: listing.suspendedBy ?? null,
              suspensionReason: listing.suspensionReason ?? null,
              ipAddress: req.ip,
            },
          },
        }),
        prisma.auditLog.create({
          data: {
            adminId: admin.adminId,
            role: admin.adminRole,
            action: "listing_reinstated",
            targetType: "listing",
            targetId: id,
            oldValue: listing.status,
            newValue: restoreStatus,
            ipAddress: req.ip,
          },
        }),
      ]);

      sendListingReinstatedEmail(listing.providerId, listing.name ?? id).catch(() => null);
      return sendSuccess(reply, 200, { message: "Listing reinstated and live again." });
    } catch (err: any) {
      return sendError(reply, 400, "REINSTATE_LISTING_FAILED", "Failed to reinstate listing. Please try again.");
    }
  });

  // ── GET /admin/listings/:id/review-tasks ──────────────────────────────────
  app.get("/admin/listings/:id/review-tasks", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Full review-task submission history for a listing",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Listing ID" },
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            listing: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string", nullable: true },
                status: { type: "string" },
                category: { type: "string" },
                submissionCount: { type: "integer" },
              },
            },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  submissionNumber: { type: "integer" },
                  assignedTo: { type: "string", nullable: true },
                  status: { type: "string" },
                  outcome: { type: "string", nullable: true },
                  adminNote: { type: "string", nullable: true },
                  slaDeadline: { type: "string", format: "date-time" },
                  createdAt: { type: "string", format: "date-time" },
                  resolvedAt: { type: "string", format: "date-time", nullable: true },
                },
              },
            },
            total: { type: "integer" },
          },
        }),
        404: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }

      const listing = await prisma.listing.findUnique({
        where: { id },
        select: { id: true, name: true, status: true, category: true, submissionCount: true },
      });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      const tasks = await prisma.listingReviewTask.findMany({
        where: { listingId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          submissionNumber: true,
          assignedTo: true,
          status: true,
          outcome: true,
          adminNote: true,
          slaDeadline: true,
          createdAt: true,
          resolvedAt: true,
        },
      });

      return sendSuccess(reply, 200, { listing, tasks, total: tasks.length });
    } catch (err: any) {
      return sendError(reply, 400, "GET_TASKS_FAILED", "Failed to fetch review tasks history. Please try again.");
    }
  });

  // ── GET /admin/listings/:id/moderation-history ────────────────────────────
  app.get("/admin/listings/:id/moderation-history", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Full moderation audit trail for a listing",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Listing ID" },
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            listing: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string", nullable: true },
                status: { type: "string" },
                category: { type: "string" },
                starRating: { type: "integer", nullable: true },
                claimedStarRating: { type: "integer", nullable: true },
                submissionCount: { type: "integer" },
                approvedAt: { type: "string", format: "date-time", nullable: true },
                approvedBy: { type: "string", nullable: true },
                rejectedAt: { type: "string", format: "date-time", nullable: true },
                rejectedBy: { type: "string", nullable: true },
                rejectionReasons: { type: "array", items: { type: "string" }, nullable: true },
                rejectionNote: { type: "string", nullable: true },
                suspendedAt: { type: "string", format: "date-time", nullable: true },
                suspendedBy: { type: "string", nullable: true },
                suspensionReason: { type: "string", nullable: true },
              },
            },
            history: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  action: { type: "string" },
                  actorRole: { type: "string" },
                  metadata: { type: "object" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            total: { type: "integer" },
          },
        }),
        404: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      try {
        await verifyListingScope(admin, id);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "LISTING_NOT_FOUND") {
            return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
          }

          if (error.message === "OUT_OF_SCOPE") {
            return sendError(
              reply,
              403,
              "FORBIDDEN",
              "This listing is outside your country scope."
            );
          }
        }

        throw error;
      }

      const listing = await prisma.listing.findUnique({
        where: { id },
        select: {
          id: true, name: true, status: true, category: true,
          starRating: true, claimedStarRating: true, submissionCount: true,
          approvedAt: true, approvedBy: true,
          rejectedAt: true, rejectedBy: true, rejectionReasons: true, rejectionNote: true,
          suspendedAt: true, suspendedBy: true, suspensionReason: true,
        },
      });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      const history = await prisma.listingModerationLog.findMany({
        where: { listingId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          actorRole: true,
          metadata: true,
          createdAt: true,
        },
      });

      return sendSuccess(reply, 200, { listing, history, total: history.length });
    } catch (err: any) {
      return sendError(reply, 400, "GET_MODERATION_HISTORY_FAILED", "Failed to fetch moderation history. Please try again.");
    }
  });

  // ── GET /admin/listings ───────────────────────────────────────────────────
  app.get("/admin/listings", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Listings"],
      summary: "Search all listings (admin)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", default: "", description: "Search by name or town" },
          status: { type: "string", description: "Filter by listing status" },
          category: { type: "string", description: "Filter by category (hotel, apartment, car)" },
          country: { type: "string", description: "Filter by country code" },
          ...PageQuery,
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            listings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string", nullable: true },
                  category: { type: "string" },
                  status: { type: "string" },
                  starRating: { type: "integer", nullable: true },
                  country: { type: "string", nullable: true },
                  town: { type: "string", nullable: true },
                  pricePerNight: { type: "number", nullable: true },
                  currency: { type: "string", nullable: true },
                  submissionCount: { type: "integer" },
                  providerId: { type: "string" },
                  approvedAt: { type: "string", format: "date-time", nullable: true },
                  photos: { type: "array", items: PhotoSchema },
                },
              },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        }),
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const { q = "", status, category, country, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);
    const admin = req as AdminRequest;

    if (status && !VALID_LISTING_STATUSES.has(status as any)) {
      return sendError(reply, 400, "BAD_REQUEST", `Invalid status filter: ${status}`);
    }
    if (category && !VALID_LISTING_CATEGORIES.has(category as any)) {
      return sendError(reply, 400, "BAD_REQUEST", `Invalid category filter: ${category}`);
    }

    const isCountryManager = admin.adminRole === "country_manager";

    const where = {
      deletedAt: null,
      NOT: {
        category: "hotel" as const,
        status: "draft" as const,
      },
      AND: [
        q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { town: { contains: q, mode: "insensitive" as const } }] } : {},
        status ? { status: status as any } : {},
        category ? { category: category as any } : {},
        isCountryManager
          ? (country
            ? (admin.countryScope.includes(country)
              ? { country }
              : { country: { in: [] } })
            : { country: { in: admin.countryScope } })
          : (country ? { country } : {}),
      ],
    };

    try {
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
             pricePerDay: true,
            currency: true,
            submissionCount: true,
            providerId: true,
            approvedAt: true,
            photos: {
              where: { deletedAt: null },
              orderBy: { position: "asc" },
              select: { id: true, s3Key: true, cdnUrl: true, position: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

      const signedListings = await Promise.all(
        listings.map(async (l) => {
          const pricePerNight = l.category === "car"
            ? (l.pricePerDay ? Number(l.pricePerDay) : null)
            : (l.pricePerNight ? Number(l.pricePerNight) : null);
          
          return {
            ...l,
            pricePerNight,
            photos: await withSignedPhotos(l.photos),
          };
        }),
      );
      return sendSuccess(reply, 200, { listings: signedListings, total, page: parseInt(page, 10), limit: take });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch listings.");
    }
  });

  // ── POST /admin/bookings/draft ───────────────────────────────────────────────
  app.post("/admin/bookings/draft", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
      summary: "Create a draft booking manually (admin)",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["listingId", "guestFirstName", "guestLastName", "guestEmail", "guestPhone", "checkIn", "checkOut"],
        properties: {
          listingId: { type: "string" },
          guestFirstName: { type: "string" },
          guestLastName: { type: "string" },
          guestEmail: { type: "string", format: "email" },
          guestPhone: { type: "string" },
          checkIn: { type: "string", format: "date-time" },
          checkOut: { type: "string", format: "date-time" },
          nightsOrDays: { type: "integer", minimum: 1 },
          nightlyRate: { type: "number" },
          guestId: { type: "string" },
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
                status: { type: "string" },
                totalAmount: { type: "number" },
                currency: { type: "string" },
              },
            },
          },
        },
        404: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;

    const body = req.body as any;

    if (!body.checkIn || !body.checkOut) {
      return sendError(reply, 400, "BAD_REQUEST", "checkIn and checkOut are required.");
    }
    if (new Date(body.checkIn) >= new Date(body.checkOut)) {
      return sendError(reply, 400, "BAD_REQUEST", "checkOut must be after checkIn.");
    }

    try {
      const listing = await prisma.listing.findUnique({ where: { id: body.listingId } });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      const rate = body.nightlyRate ?? Number(listing.pricePerNight ?? listing.pricePerDay ?? 0);
      const commissionRate = await getCommissionRate(listing.country ?? null);

      const billing = calculateBilling({
        listingCategory: listing.category,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        rate,
        deliveryFee: 0,
        promotionDiscount: 0,
        voucherAmount: 0,
        taxRate: getTaxRate(listing.country),
        commissionRate,
      });

      const reference = await generateReference(listing.country ?? "XX");

      const booking = await prisma.booking.create({
        data: {
          reference,
          listingId: listing.id,
          guestId: body.guestId ?? "manual-guest",
          providerId: listing.providerId,
          listingType: listing.category,
          status: "draft",

          checkIn: new Date(body.checkIn),
          checkOut: new Date(body.checkOut),
          nightsOrDays: billing.units || body.nightsOrDays || 1,

          guestFirstName: body.guestFirstName,
          guestLastName: body.guestLastName,
          guestEmail: body.guestEmail,
          guestPhone: body.guestPhone,

          nightlyRate: listing.category !== "car" ? rate : undefined,
          dailyRate: listing.category === "car" ? rate : undefined,

          subtotal: billing.subtotal,
          totalAmount: billing.totalAmount,
          discountAmount: 0,
          deliveryFee: 0,

          currency: listing.currency ?? "USD",

          commissionRate,
          commissionAmount: billing.commissionAmount,
          providerPayout: billing.providerPayout,

          cancellationPolicy: listing.cancellationPolicy ?? "moderate",
        },
      });

      // Log status transition to "draft"
      await prisma.bookingStatusLog.create({
        data: {
          bookingId: booking.id,
          fromStatus: null,
          toStatus: "draft",
          actorType: "admin",
          changedBy: (req as AdminRequest).adminId,
          reason: "Manual draft booking creation by admin",
        },
      });

      // Log audit entry for manually created booking
      await prisma.auditLog.create({
        data: {
          adminId: (req as AdminRequest).adminId,
          role: (req as AdminRequest).adminRole,
          action: "booking_created_manually",
          targetType: "booking",
          targetId: booking.id,
          oldValue: null,
          newValue: "draft",
          ipAddress: req.ip,
        },
      });

      return sendSuccess(reply, 201, {
        bookingId: booking.id,
        bookingReference: booking.reference,
        status: booking.status,
        totalAmount: Number(booking.totalAmount),
        currency: booking.currency,
      });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to create draft booking.");
    }
  });

  // ── GET /admin/bookings ───────────────────────────────────────────────────
  app.get("/admin/bookings", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
      summary: "List all bookings with filters (admin)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", default: "", description: "Search by reference, email, or guest name" },
          status: { type: "string", description: "Filter by booking status" },
          listingType: { type: "string", description: "Filter by listing type (hotel, apartment, car)" },
          country: { type: "string", description: "Filter by listing country code" },
          ...PageQuery,
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            bookings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  reference: { type: "string" },
                  listingId: { type: "string" },
                  guestId: { type: "string" },
                  providerId: { type: "string" },
                  listingType: { type: "string" },
                  status: { type: "string" },
                  checkIn: { type: "string", format: "date-time", nullable: true },
                  checkOut: { type: "string", format: "date-time", nullable: true },
                  pickupDatetime: { type: "string", format: "date-time", nullable: true },
                  returnDatetime: { type: "string", format: "date-time", nullable: true },
                  nightsOrDays: { type: "integer", nullable: true },
                  guestFirstName: { type: "string" },
                  guestLastName: { type: "string" },
                  guestEmail: { type: "string" },
                  totalAmount: { type: "number" },
                  currency: { type: "string" },
                  commissionAmount: { type: "number" },
                  providerPayout: { type: "number" },
                  voucherDiscount: { type: "number", nullable: true },
                  cancelledAt: { type: "string", format: "date-time", nullable: true },
                  confirmedAt: { type: "string", format: "date-time", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                  listing: {
                    type: "object",
                    properties: { name: { type: "string", nullable: true } },
                  },
                },
              },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        }),
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const admin = req as AdminRequest;
    const { q = "", status, listingType, country, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    //const isCountryManager = admin.adminRole === "country_manager";
    const isCountryManager = admin.adminRole === "country_manager" || admin.adminRole === "sales";

    // Country managers are scoped to their assigned countries
    const countryFilter: any = isCountryManager
      ? (country
        ? (admin.countryScope.includes(country)
          ? { listing: { country } }
          : { listing: { country: { in: [] } } }) // out-of-scope country → empty result
        : { listing: { country: { in: admin.countryScope } } })
      : (country ? { listing: { country } } : {});

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
        countryFilter,
      ],
    };

    try {
      const [total, bookings] = await Promise.all([
        prisma.booking.count({ where }),
        prisma.booking.findMany({
          where, skip, take,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, reference: true, listingId: true, guestId: true, providerId: true,
            listingType: true, status: true, checkIn: true, checkOut: true,
            pickupDatetime: true, returnDatetime: true, nightsOrDays: true,
            guestFirstName: true, guestLastName: true, guestEmail: true,
            totalAmount: true, currency: true, commissionAmount: true,
            providerPayout: true, voucherDiscount: true,
            cancelledAt: true, confirmedAt: true, createdAt: true,
            listing: { select: { name: true } },
          },
        }),
      ]);

      return sendSuccess(reply, 200, { bookings, total, page: parseInt(page, 10), limit: take });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch bookings.");
    }
  });

  // ── GET /admin/bookings/availability ─────────────────────────────────────
  // MUST be registered BEFORE /admin/bookings/:id to prevent Fastify from
  // matching the static segment "availability" as the :id parameter.
  app.get("/admin/bookings/availability", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
      summary: "Check listing availability before creating a manual booking",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        required: ["listingId", "checkIn", "checkOut"],
        properties: {
          listingId: { type: "string", description: "Listing ID to check" },
          listingType: { type: "string", description: "Listing type hint (hotel, apartment, car)" },
          listingName: { type: "string", description: "Listing name hint (ignored; resolved from DB)" },
          checkIn: { type: "string", format: "date", description: "Check-in date (YYYY-MM-DD)" },
          checkOut: { type: "string", format: "date", description: "Check-out date (YYYY-MM-DD)" },
          guests: { type: "string", description: "Number of guests (informational only)" },
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            available: { type: "boolean" },
            reason: { type: "string", nullable: true },
            listingId: { type: "string", nullable: true },
            listingName: { type: "string", nullable: true },
            listingType: { type: "string", nullable: true },
            checkIn: { type: "string", nullable: true },
            checkOut: { type: "string", nullable: true },
            nights: { type: "number", nullable: true },
            pricePerNight: { type: "number", nullable: true },
            subtotal: { type: "number", nullable: true },
            commissionRate: { type: "number", nullable: true },
            commissionAmount: { type: "number", nullable: true },
            totalAmount: { type: "number", nullable: true },
            currency: { type: "string", nullable: true },
          },
        }),
        400: ErrorResponse,
        404: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;

    const { listingId, checkIn, checkOut } = req.query as Record<string, string>;

    if (!listingId || !checkIn || !checkOut) {
      return sendError(reply, 400, "BAD_REQUEST", "listingId, checkIn, and checkOut are required.");
    }

    try {
      const listing = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      // Reuse the same availability logic as the guest booking flow:
      // - confirmed bookings always block the slot
      // - pending_payment bookings only block within their 5-minute lock window
      const LOCK_TTL_MS = 300_000;
      const pendingExpiry = new Date(Date.now() - LOCK_TTL_MS);
      const startDate = new Date(checkIn);
      const endDate = new Date(checkOut);

      const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT COUNT(*) AS count
        FROM listing.bookings
        WHERE listing_id = $1
          AND (
            status = 'confirmed'
            OR status = 'checked_in'
            OR (status = 'pending_payment' AND created_at > $2)
          )
          AND check_in < $4
          AND check_out > $3
      `, listingId, pendingExpiry, startDate, endDate);

      const bookingCount = Number(result[0]?.count ?? 0);

      // Check manual and iCal blocked dates
      const icalBlockedCount = await prisma.icalBlockedDate.count({
        where: {
          listingId,
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
      });

      const count = bookingCount + icalBlockedCount;
      const unitCount = listing.unitCount ?? 1;

      if (count >= unitCount) {
        return sendSuccess(reply, 200, {
          available: false,
          reason: "Some of the selected dates within your stay are already booked or unavailable.",
        });
      }


      // Build pricing preview for the admin
      const nights = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
      const pricePerNight = Number(listing.pricePerNight ?? listing.pricePerDay ?? 0);
      const subtotal = pricePerNight * nights;
      const commissionRate = await getCommissionRate(listing.country ?? null);
      const commissionAmount = Math.round(subtotal * commissionRate * 100) / 100;
      const totalAmount = Math.round((subtotal + commissionAmount) * 100) / 100;

      return sendSuccess(reply, 200, {
        available: true,
        listingId: listing.id,
        listingName: listing.name,
        listingType: listing.category,
        checkIn,
        checkOut,
        nights,
        pricePerNight,
        subtotal,
        commissionRate,
        commissionAmount,
        totalAmount,
        currency: listing.currency ?? "USD",
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to check booking availability");
      return sendError(reply, 500, "INTERNAL_ERROR", err?.message ?? "Failed to check availability.");
    }
  });

  // ── GET /admin/bookings/:id ───────────────────────────────────────────────
  app.get("/admin/bookings/:id", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
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
        200: ok({
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string" },
            checkIn: { type: "string", nullable: true },
            checkOut: { type: "string", nullable: true },
            totalAmount: { type: "number" },
            reference: { type: "string" },
            listingType: { type: "string" },
            nightsOrDays: { type: "integer" },
            adults: { type: "integer", nullable: true },
            children: { type: "integer", nullable: true },
            subtotal: { type: "number" },
            voucherDiscount: { type: "number" },
            deliveryFee: { type: "number" },
            commissionAmount: { type: "number" },
            providerPayout: { type: "number" },

            listing: {
              type: "object",
              properties: {
                name: { type: "string", nullable: true },
                country: { type: "string", nullable: true },
                category: { type: "string" }
              }
            },

            statusLog: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  fromStatus: { type: "string", nullable: true },
                  toStatus: { type: "string" },
                  changedBy: { type: "string", nullable: true },
                  actorType: { type: "string", nullable: true },
                  reason: { type: "string", nullable: true },
                  createdAt: { type: "string", format: "date-time" }
                }
              }
            }
          }
        }),
        404: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const { id } = req.params as { id: string };

    try {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          statusLog: { orderBy: { createdAt: "asc" } },
          listing: { select: { name: true, country: true, category: true } },
        },
      });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

      return sendSuccess(reply, 200, booking);
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch booking.");
    }
  });

  // ── POST /admin/bookings/:id/cancel ───────────────────────────────────────
  app.post("/admin/bookings/:id/cancel", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
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
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        404: ErrorResponse,
        409: ErrorResponse,
        422: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };

    if (!reason?.trim()) return sendError(reply, 400, "BAD_REQUEST", "Cancellation reason is required.");

    try {
      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
      if (!["pending_payment", "confirmed"].includes(booking.status)) {
        return sendError(reply, 409, "INVALID_STATUS", `Cannot cancel a booking with status: ${booking.status}. Only pending_payment or confirmed bookings can be cancelled.`);
      }

      await prisma.booking.update({
        where: { id },
        data: {
          status: "cancelled_by_system",
          cancelledAt: new Date(),
          cancelledBy: "admin",
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

      await prisma.auditLog.create({
        data: {
          adminId: admin.adminId,
          role: admin.adminRole,
          action: "booking_cancelled",
          targetType: "booking",
          targetId: id,
          oldValue: booking.status,
          newValue: "cancelled_by_system",
          ipAddress: req.ip,
        },
      });

      return sendSuccess(reply, 200, { message: "Booking cancelled by admin." });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to cancel booking.");
    }
  });

  // ── GET /admin/conversations ───────────────────────────────────────────────
  app.get("/admin/conversations", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Conversations"],
      summary: "List all conversations (admin)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", default: "", description: "Search by guestId or bookingId" },
          status: { type: "string", description: "Filter by conversation status" },
          ...PageQuery,
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            conversations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  listingId: { type: "string", nullable: true },
                  bookingId: { type: "string", nullable: true },
                  guestId: { type: "string" },
                  providerId: { type: "string" },
                  status: { type: "string" },
                  lastMessage: {
                    nullable: true,
                    type: "object",
                    properties: {
                      body: { type: "string" },
                      senderId: { type: "string" },
                      senderType: { type: "string" },
                      isFiltered: { type: "boolean" },
                      createdAt: { type: "string", format: "date-time" },
                    },
                  },
                  updatedAt: { type: "string", format: "date-time" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        }),
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const { q = "", status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      AND: [
        status ? { status } : {},
        q ? { OR: [{ guestId: { contains: q } }, { bookingId: { contains: q } }] } : {},
      ],
    };

    try {
      const [total, conversations] = await Promise.all([
        prisma.conversation.count({ where }),
        prisma.conversation.findMany({
          where, skip, take,
          orderBy: { updatedAt: "desc" },
          include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
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
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch conversations.");
    }
  });

  // ── GET /admin/conversations/:id/messages ─────────────────────────────────
  app.get("/admin/conversations/:id/messages", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Conversations"],
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
        200: ok({
          type: "object",
          properties: {
            conversation: {
              type: "object",
              properties: {
                id: { type: "string" },
                listingId: { type: "string", nullable: true },
                bookingId: { type: "string", nullable: true },
                guestId: { type: "string" },
                providerId: { type: "string" },
                status: { type: "string" },
              },
            },
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  senderId: { type: "string" },
                  senderType: { type: "string" },
                  body: { type: "string" },
                  isFiltered: { type: "boolean" },
                  readAt: { type: "string", format: "date-time", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        }),
        404: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const { id } = req.params as { id: string };

    try {
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
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch conversation messages.");
    }
  });

  // ── POST /admin/conversations/:id/messages — support agent reply ──────────
  app.post("/admin/conversations/:id/messages", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Conversations"],
      summary: "Send a support message in a conversation",
      description: "Allows support, admin, and super_admin roles to post a message into any conversation as a support agent. senderType is always set to support_agent.",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Conversation ID" },
        },
      },
      body: {
        type: "object",
        required: ["body"],
        properties: {
          body: { type: "string", minLength: 1, maxLength: 2000, description: "Message text" },
        },
      },
      response: {
        201: ok({
          type: "object",
          properties: {
            id:          { type: "string" },
            senderId:    { type: "string" },
            senderType:  { type: "string" },
            body:        { type: "string" },
            isFiltered:  { type: "boolean" },
            createdAt:   { type: "string", format: "date-time" },
          },
        }),
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const SUPPORT_ROLES = new Set(["super_admin", "admin", "support"]);
    if (!checkAdminRole(req, reply, SUPPORT_ROLES)) return;

    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { body: text } = req.body as { body: string };

    const trimmed = text.trim();
    if (!trimmed) return sendError(reply, 400, "VALIDATION_ERROR", "Message body cannot be empty.");

    try {
      const convo = await prisma.conversation.findUnique({ where: { id } });
      if (!convo) return sendError(reply, 404, "NOT_FOUND", "Conversation not found.");
      if (convo.status === "closed") return sendError(reply, 400, "CONVERSATION_CLOSED", "This conversation is closed.");

      const message = await prisma.message.create({
        data: {
          conversationId: id,
          senderId:   admin.adminId,
          senderType: "support_agent",
          body:       trimmed,
          isFiltered: false,
        },
      });

      await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });

      // Notify both parties (fire-and-forget)
      for (const recipientId of [convo.guestId, convo.providerId]) {
        fireNotification(recipientId, {
          type:  "new_message",
          title: "Support Message",
          body:  trimmed.slice(0, 100),
          data:  { conversationId: id },
        });
      }

      return sendSuccess(reply, 201, {
        id:         message.id,
        senderId:   message.senderId,
        senderType: message.senderType,
        body:       message.body,
        isFiltered: message.isFiltered,
        createdAt:  message.createdAt.toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to send support message");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while sending support message.");
    }
  });

  // ── GET /admin/ical-feeds ─────────────────────────────────────────────────
  app.get("/admin/ical-feeds", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin iCal"],
      summary: "List all iCal feeds across all listings",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          isActive: { type: "string", enum: ["true", "false"], description: "Filter by active status" },
          ...PageQuery,
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            feeds: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  listingId: { type: "string" },
                  listingName: { type: "string", nullable: true },
                  listingCategory: { type: "string" },
                  listingCountry: { type: "string", nullable: true },
                  platform: { type: "string" },
                  feedUrl: { type: "string", format: "uri" },
                  isActive: { type: "boolean" },
                  lastSyncedAt: { type: "string", format: "date-time", nullable: true },
                  lastError: { type: "string", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
              },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        }),
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const { page = "1", limit = "20", isActive } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
    };

    try {
      const [total, feeds] = await Promise.all([
        prisma.icalFeed.count({ where }),
        prisma.icalFeed.findMany({
          where, skip, take,
          orderBy: { updatedAt: "desc" },
          include: { listing: { select: { name: true, category: true, country: true } } },
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
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch iCal feeds.");
    }
  });

  // ── POST /admin/ical-feeds/:id/sync ───────────────────────────────────────
  app.post("/admin/ical-feeds/:id/sync", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin iCal"],
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
        200: ok({
          type: "object",
          properties: {
            synced: { type: "integer" },
            error: { type: "string", nullable: true },
            message: { type: "string" },
          },
        }),
        404: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const { id } = req.params as { id: string };

    try {
      const feed = await prisma.icalFeed.findUnique({ where: { id } });
      if (!feed) return sendError(reply, 404, "NOT_FOUND", "iCal feed not found.");

      const { syncFeed } = await import("./ical.js");
      const result = await syncFeed(id);

      if (result.error) {
        return sendSuccess(reply, 200, { synced: 0, error: result.error, message: "Sync failed." });
      }
      return sendSuccess(reply, 200, { synced: result.synced, message: `Synced ${result.synced} events.` });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to sync iCal feed.");
    }
  });

  // ── GET /admin/reviews ────────────────────────────────────────────────────
  app.get("/admin/reviews", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Reviews"],
      summary: "List all reviews with filters (admin)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", default: "", description: "Search by title, body, or guestId" },
          isHidden: { type: "string", enum: ["true", "false"], description: "Filter by hidden status" },
          rating: { type: "string", description: "Filter by rating (1–5)" },
          listingId: { type: "string", description: "Filter by listing ID" },
          ...PageQuery,
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            reviews: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  bookingId: { type: "string" },
                  listingId: { type: "string" },
                  listingName: { type: "string", nullable: true },
                  guestId: { type: "string" },
                  rating: { type: "integer" },
                  title: { type: "string", nullable: true },
                  body: { type: "string", nullable: true },
                  providerReply: { type: "string", nullable: true },
                  isHidden: { type: "boolean" },
                  hiddenBy: { type: "string", nullable: true },
                  hiddenAt: { type: "string", format: "date-time", nullable: true },
                  hiddenReason: { type: "string", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          },
        }),
        401: ErrorResponse,
        403: ErrorResponse,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply)) return;
    const { q = "", isHidden, rating, listingId, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    if (rating) {
      const parsedRating = parseInt(rating, 10);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return sendError(reply, 400, "BAD_REQUEST", `Invalid rating filter: ${rating}. Must be between 1 and 5.`);
      }
    }

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

    try {
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
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch reviews.");
    }
  });

  // ── GET /admin/booking-requests/pending ──────────────────────────────────
  app.get("/admin/booking-requests/pending", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
      summary: "List pending booking requests waiting for manual approval",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          ...PageQuery,
        },
      },
      response: {
        200: ok({
          type: "object",
          properties: {
            requests: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  reference: { type: "string" },
                  guestFirstName: { type: "string" },
                  guestLastName: { type: "string" },
                  totalAmount: { type: "number" },
                  currency: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                  listing: {
                    type: "object",
                    properties: { name: { type: "string", nullable: true }, country: { type: "string", nullable: true } }
                  }
                }
              }
            },
            total: { type: "integer" },
            page: { type: "integer" },
            limit: { type: "integer" },
          }
        }),
        401: ErrorResponse,
        403: ErrorResponse,
      }
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, BOOKING_REQUEST_ROLES)) return;
    const admin = req as AdminRequest;
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 100);

    const isCountryManager = admin.adminRole === "country_manager" || admin.adminRole === "sales";
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const where: any = {
      status: "pending_payment",
      createdAt: { lt: twoHoursAgo },
      listing: {
        instantBooking: false,
        ...(isCountryManager ? { country: { in: admin.countryScope } } : {}),
      },
    };

    try {
      const [total, requests] = await Promise.all([
        prisma.booking.count({ where }),
        prisma.booking.findMany({
          where, skip, take,
          orderBy: { createdAt: "asc" },
          select: {
            id: true, reference: true, guestFirstName: true, guestLastName: true,
            totalAmount: true, currency: true, createdAt: true,
            listing: { select: { name: true, country: true } }
          }
        }),
      ]);

      return sendSuccess(reply, 200, { requests, total, page: parseInt(page, 10), limit: take });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to fetch pending booking requests.");
    }
  });

  // ── POST /admin/booking-requests/:id/approve ─────────────────────────────
  app.post("/admin/booking-requests/:id/approve", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
      summary: "Approve a pending booking request",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      }
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, BOOKING_REQUEST_ROLES)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { listing: true },
      });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
      if (booking.status !== "pending_payment") {
        return sendError(reply, 409, "INVALID_STATUS", `Cannot approve booking with status: ${booking.status}. Only pending_payment bookings can be approved.`);
      }

      if (["country_manager", "sales"].includes(admin.adminRole)) {
        if (!admin.countryScope.includes(booking.listing.country ?? "")) {
          return sendError(reply, 403, "FORBIDDEN", "Booking is outside your country scope.");
        }
      }

      if (admin.adminRole === "sales" && booking.listing.instantBooking) {
        return sendError(reply, 403, "FORBIDDEN", "Sales Agents cannot approve instant-confirm bookings.");
      }

      await prisma.booking.update({
        where: { id },
        data: { status: "confirmed", confirmedAt: new Date() },
      });

      await prisma.bookingStatusLog.create({
        data: { bookingId: id, fromStatus: "pending_payment", toStatus: "confirmed", actorType: "admin", changedBy: admin.adminId },
      });

      await prisma.auditLog.create({
        data: {
          adminId: admin.adminId, role: admin.adminRole, action: "booking_request_approved",
          targetType: "booking", targetId: id,
          oldValue: "pending_payment", newValue: "confirmed", ipAddress: req.ip,
        },
      });

      const { sendBookingConfirmationEmail } = await import("../lib/email.js");
      sendBookingConfirmationEmail(
        booking.guestEmail, `${booking.guestFirstName} ${booking.guestLastName}`,
        {
          reference: booking.reference, listingName: booking.listing.name ?? "Your listing",
          listingType: booking.listingType, checkIn: booking.checkIn?.toISOString(),
          checkOut: booking.checkOut?.toISOString(), pickupDatetime: booking.pickupDatetime?.toISOString(),
          returnDatetime: booking.returnDatetime?.toISOString(), nightsOrDays: booking.nightsOrDays,
          totalAmount: Number(booking.totalAmount), currency: booking.currency,
        }
      ).catch(() => { });

      const { getRedis } = await import("../lib/redis.js");
      const lockSuffix = booking.checkIn
        ? `${booking.listingId}:${booking.checkIn.toISOString().slice(0, 10)}:${booking.checkOut?.toISOString().slice(0, 10)}`
        : `${booking.listingId}:${booking.pickupDatetime?.toISOString().slice(0, 10)}:${booking.returnDatetime?.toISOString().slice(0, 10)}`;
      await getRedis().del(`rlk:${lockSuffix}`).catch(() => { });

      return sendSuccess(reply, 200, { message: "Booking request approved." });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to approve booking request.");
    }
  });

  // ── POST /admin/booking-requests/:id/decline ─────────────────────────────
  app.post("/admin/booking-requests/:id/decline", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
      summary: "Decline a pending booking request",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      body: {
        type: "object",
        required: ["reason"],
        properties: { reason: { type: "string" } },
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      }
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, BOOKING_REQUEST_ROLES)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };

    if (!reason?.trim()) {
      return sendError(reply, 400, "BAD_REQUEST", "Decline reason is required.");
    }

    try {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { listing: true },
      });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
      if (booking.status !== "pending_payment") {
        return sendError(reply, 409, "INVALID_STATUS", `Cannot decline booking with status: ${booking.status}. Only pending_payment bookings can be declined.`);
      }

      if (["country_manager", "sales"].includes(admin.adminRole)) {
        if (!admin.countryScope.includes(booking.listing.country ?? "")) {
          return sendError(reply, 403, "FORBIDDEN", "Booking is outside your country scope.");
        }
      }

      if (admin.adminRole === "sales" && booking.listing.instantBooking) {
        return sendError(reply, 403, "FORBIDDEN", "Sales Agents cannot decline instant-confirm bookings.");
      }

      await prisma.booking.update({
        where: { id },
        data: { status: "cancelled_by_system", cancelledAt: new Date(), cancelledBy: "admin", cancellationReason: reason },
      });

      await prisma.bookingStatusLog.create({
        data: { bookingId: id, fromStatus: "pending_payment", toStatus: "cancelled_by_system", actorType: "admin", changedBy: admin.adminId, reason },
      });

      await prisma.auditLog.create({
        data: {
          adminId: admin.adminId, role: admin.adminRole, action: "booking_request_declined",
          targetType: "booking", targetId: id,
          oldValue: "pending_payment", newValue: "cancelled_by_system", ipAddress: req.ip,
        },
      });

      const { sendBookingCancellationEmail } = await import("../lib/email.js");
      sendBookingCancellationEmail(
        booking.guestEmail, `${booking.guestFirstName} ${booking.guestLastName}`,
        {
          reference: booking.reference,
          reason,
          listingName: booking.listing.name ?? "Your listing",
          refundAmount: 0,
          currency: booking.currency
        }
      ).catch(() => { });

      const { getRedis } = await import("../lib/redis.js");
      const lockSuffix = booking.checkIn
        ? `${booking.listingId}:${booking.checkIn.toISOString().slice(0, 10)}:${booking.checkOut?.toISOString().slice(0, 10)}`
        : `${booking.listingId}:${booking.pickupDatetime?.toISOString().slice(0, 10)}:${booking.returnDatetime?.toISOString().slice(0, 10)}`;
      await getRedis().del(`rlk:${lockSuffix}`).catch(() => { });

      return sendSuccess(reply, 200, { message: "Booking request declined." });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to decline booking request.");
    }
  });

  // ── POST /admin/booking-requests/:id/request-info ────────────────────────
  app.post("/admin/booking-requests/:id/request-info", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
      summary: "Request more info from guest",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      body: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string" } },
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        403: ErrorResponse,
        404: ErrorResponse,
      }
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, BOOKING_REQUEST_ROLES)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };
    const { message } = req.body as { message: string };

    if (!message?.trim()) {
      return sendError(reply, 400, "BAD_REQUEST", "Message body is required.");
    }

    try {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { listing: true },
      });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

      if (["country_manager", "sales"].includes(admin.adminRole)) {
        if (!admin.countryScope.includes(booking.listing.country ?? "")) {
          return sendError(reply, 403, "FORBIDDEN", "Booking is outside your country scope.");
        }
      }

      if (admin.adminRole === "sales" && booking.listing.instantBooking) {
        return sendError(reply, 403, "FORBIDDEN", "Sales Agents cannot request information on instant-confirm bookings.");
      }

      let conversation = await prisma.conversation.findUnique({
        where: { bookingId: id },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            bookingId: id,
            listingId: booking.listingId,
            guestId: booking.guestId,
            providerId: booking.providerId,
          },
        });
      }

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: admin.adminId,
          senderType: "admin",
          body: message,
        },
      });

      await prisma.auditLog.create({
        data: {
          adminId: admin.adminId, role: admin.adminRole, action: "booking_request_info_asked",
          targetType: "booking", targetId: id, ipAddress: req.ip,
        },
      });

      return sendSuccess(reply, 200, { message: "Message sent to guest." });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to send message to guest.");
    }
  });

  // ── POST /admin/booking-requests/:id/escalate ────────────────────────────
  app.post("/admin/booking-requests/:id/escalate", {
    preHandler: [requireAdmin],
    schema: {
      tags: ["Admin Bookings"],
      summary: "Escalate booking request to host",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      response: {
        200: ok({ type: "object", properties: { message: { type: "string" } } }),
        403: ErrorResponse,
        404: ErrorResponse,
      }
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (!checkAdminRole(req, reply, BOOKING_REQUEST_ROLES)) return;
    const admin = req as AdminRequest;
    const { id } = req.params as { id: string };

    try {
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: { listing: true },
      });
      if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

      if (["country_manager", "sales"].includes(admin.adminRole)) {
        if (!admin.countryScope.includes(booking.listing.country ?? "")) {
          return sendError(reply, 403, "FORBIDDEN", "Booking is outside your country scope.");
        }
      }

      if (admin.adminRole === "sales" && booking.listing.instantBooking) {
        return sendError(reply, 403, "FORBIDDEN", "Sales Agents cannot escalate instant-confirm bookings.");
      }

      await prisma.auditLog.create({
        data: {
          adminId: admin.adminId, role: admin.adminRole, action: "booking_request_escalated",
          targetType: "booking", targetId: id, ipAddress: req.ip,
        },
      });

      // Dispatch sales_escalation push/in-app notification
      fireNotification(booking.providerId, {
        type: "sales_escalation",
        title: "Escalated Booking Request ",
        body: `A booking request (Ref: ${booking.reference}) for "${booking.listing.name ?? booking.listingId}" has been escalated to you by a Sales Agent. Please respond immediately.`,
        data: { bookingId: id, reference: booking.reference },
      });

      return sendSuccess(reply, 200, { message: "Request escalated to host." });
    } catch (err: any) {
      return sendError(reply, 400, "BAD_REQUEST", err?.message ?? "Failed to escalate booking request.");
    }
  });
}