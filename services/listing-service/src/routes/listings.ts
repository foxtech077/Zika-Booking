import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireProviderRole, type ProviderRequest } from "../middleware/auth.js";
import {
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  deleteObject,
  photoS3Key,
  documentS3Key,
  cdnUrl,
  isValidPhotoType,
  isValidDocumentType,
  fileExtFromContentType,
} from "../lib/s3.js";
import { geocodePlaceId, geocodeAddress, reverseGeocode } from "../lib/geocoding.js";
import { sendListingSubmittedEmail, sendListingActivatedEmail } from "../lib/email.js";

const MAX_PHOTOS = 30;

// ── Zod schemas ───────────────────────────────────────────────────────────────

const patchListingSchema = z.object({
  name: z.string().max(200).optional(),
  roomType: z.enum(["standard", "superior", "deluxe", "suite", "junior_suite", "studio", "family_room", "presidential_suite"]).optional(),
  unitCount: z.number().int().min(1).optional(),
  claimedStarRating: z.number().int().min(1).max(5).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  pricePerNight: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  minStayNights: z.number().int().min(1).optional(),
  checkinTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  checkoutTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict"]).optional(),
  smokingAllowed: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  address: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  town: z.string().max(100).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
  amenities: z.array(z.string().max(100)).optional(),
  customAmenities: z.array(z.string().max(60)).optional(),
  // apartment-specific
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().int().min(0).optional().nullable(),
  maxGuests: z.number().int().min(1).optional().nullable(),
  longStayEnabled: z.boolean().optional(),
  longStayMinNights: z.number().int().min(1).optional().nullable(),
  longStayDiscountType: z.enum(["percentage", "fixed"]).optional().nullable(),
  longStayDiscountValue: z.number().positive().optional().nullable(),
  // car-specific
  carMake: z.string().max(80).optional().nullable(),
  carModel: z.string().max(80).optional().nullable(),
  carYear: z.number().int().min(1900).max(2100).optional().nullable(),
  transmission: z.enum(["manual", "automatic"]).optional().nullable(),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid"]).optional().nullable(),
  seats: z.number().int().min(1).optional().nullable(),
  doors: z.number().int().min(2).optional().nullable(),
  mileagePolicy: z.enum(["unlimited", "limited"]).optional().nullable(),
  mileageLimitKm: z.number().int().min(1).optional().nullable(),
});

// ── Helper: assert listing belongs to provider ────────────────────────────────

async function assertOwner(listingId: string, providerId: string, reply: FastifyReply) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, providerId, deletedAt: null },
  });
  if (!listing) {
    sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    return null;
  }
  return listing;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function listingRoutes(app: FastifyInstance) {

  // POST /listings — Create new draft (UC-2.1)
  app.post("/listings", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { category = "hotel" } = req.body as { category?: string };

    if (!["hotel", "apartment", "car"].includes(category)) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid listing category.");
    }

    const listing = await prisma.listing.create({
      data: { providerId, category: category as "hotel" | "apartment" | "car" },
    });

    return sendSuccess(reply, 201, { id: listing.id, category: listing.category, status: listing.status });
  });

  // GET /listings — My listings (UC-2.6 entry point)
  app.get("/listings", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = Math.min(parseInt(limit, 10), 50);

    const where = {
      providerId,
      deletedAt: null,
      ...(status && status !== "all" ? { status: status as "draft" } : {}),
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
          claimedStarRating: true,
          town: true,
          country: true,
          pricePerNight: true,
          currency: true,
          submissionCount: true,
          rejectionReasons: true,
          rejectionNote: true,
          createdAt: true,
          updatedAt: true,
          photos: {
            where: { deletedAt: null, position: 1 },
            select: { cdnUrl: true },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return sendSuccess(reply, 200, { listings, total, page: parseInt(page, 10), limit: take });
  });

  // GET /listings/:id — Get listing detail (UC-2.6)
  app.get("/listings/:id", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findFirst({
      where: { id, providerId, deletedAt: null },
      include: {
        photos: { where: { deletedAt: null }, orderBy: { position: "asc" } },
        documents: { where: { replacedAt: null } },
        amenities: true,
        customAmenities: true,
      },
    });

    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    return sendSuccess(reply, 200, listing);
  });

  // PATCH /listings/:id — Update listing fields (UC-2.2 auto-save)
  app.patch("/listings/:id", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    if (listing.status === "pending_review") {
      return sendError(reply, 409, "CANNOT_EDIT", "Listing is under review and cannot be edited.");
    }
    if (["suspended", "auto_suspended", "permanently_banned"].includes(listing.status)) {
      return sendError(reply, 409, "CANNOT_EDIT", "This listing cannot be edited in its current status.");
    }

    const parsed = patchListingSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid listing data.", fields);
    }

    const { amenities, customAmenities, ...fields } = parsed.data;

    // Reset to draft if was rejected; active apartments stay active
    const newStatus = listing.status === "rejected" ? "draft" : listing.status;

    await prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id },
        data: { ...fields, status: newStatus },
      });

      if (amenities !== undefined) {
        await tx.listingAmenity.deleteMany({ where: { listingId: id } });
        if (amenities.length > 0) {
          await tx.listingAmenity.createMany({
            data: amenities.map((key) => ({ listingId: id, amenityKey: key })),
          });
        }
      }

      if (customAmenities !== undefined) {
        await tx.listingCustomAmenity.deleteMany({ where: { listingId: id } });
        if (customAmenities.length > 0) {
          await tx.listingCustomAmenity.createMany({
            data: customAmenities.map((label) => ({ listingId: id, label })),
          });
        }
      }
    });

    return sendSuccess(reply, 200, { message: "Listing updated." });
  });

  // POST /listings/:id/submit — Submit for review (UC-2.7)
  app.post("/listings/:id/submit", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findFirst({
      where: { id, providerId, deletedAt: null },
      include: {
        photos: { where: { deletedAt: null } },
        documents: { where: { replacedAt: null } },
      },
    });

    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (!["draft", "rejected"].includes(listing.status)) {
      return sendError(reply, 409, "INVALID_STATUS", "Only draft or rejected listings can be submitted.");
    }

    // Pre-submission validation
    const failures: string[] = [];
    if (!listing.name) failures.push("Property name is required.");
    if (!listing.roomType) failures.push("Room type is required.");
    if (!listing.unitCount || listing.unitCount < 1) failures.push("Number of units is required.");
    if (!listing.pricePerNight) failures.push("Price per night is required.");
    if (!listing.currency) failures.push("Currency is required.");
    if (!listing.address || !listing.lat || !listing.lng) failures.push("Address with geocoded location is required.");
    if (!listing.cancellationPolicy) failures.push("Cancellation policy is required.");
    if (listing.photos.length === 0) failures.push("At least one photo is required.");

    const docTypes = listing.documents.map((d) => d.documentType);
    if (!docTypes.includes("business_licence")) failures.push("Business licence document is required.");
    if (!docTypes.includes("operating_permit")) failures.push("Hotel operating permit document is required.");
    if (!docTypes.includes("tourism_certificate")) failures.push("Tourism authority certificate is required.");

    if (failures.length > 0) {
      return sendError(reply, 422, "VALIDATION_ERROR", failures.join(" "));
    }

    const submissionCount = listing.submissionCount + 1;
    const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.listing.update({
        where: { id },
        data: { status: "pending_review", submittedAt: new Date(), submissionCount },
      }),
      prisma.listingReviewTask.create({
        data: {
          listingId: id,
          submissionNumber: submissionCount,
          slaDeadline,
        },
      }),
    ]);

    // Fire-and-forget notification
    if (listing.name) {
      sendListingSubmittedEmail(providerId, listing.name).catch(() => null);
    }

    return sendSuccess(reply, 200, { message: "Listing submitted for review." });
  });

  // POST /listings/:id/activate — Apartment auto-activation (UC-3.5) + Car activation (UC-4.5)
  app.post("/listings/:id/activate", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findFirst({
      where: { id, providerId, deletedAt: null },
      include: { photos: { where: { deletedAt: null } } },
    });

    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (!["apartment", "car"].includes(listing.category)) {
      return sendError(reply, 422, "INVALID_CATEGORY", "Only apartment and car listings can be auto-activated. Hotels require admin review.");
    }
    if (!["draft", "deactivated"].includes(listing.status)) {
      return sendError(reply, 409, "INVALID_STATUS", "Only draft or deactivated listings can be activated.");
    }

    const failures: string[] = [];
    if (!listing.name?.trim()) failures.push("Listing title is required.");
    if (!listing.lat || !listing.lng) failures.push("Address with geocoded location is required.");
    if (!listing.pricePerNight || Number(listing.pricePerNight) <= 0) failures.push("Price per night must be greater than 0.");
    if (!listing.cancellationPolicy) failures.push("Cancellation policy is required.");

    if (listing.category === "apartment") {
      if (!listing.maxGuests || listing.maxGuests < 1) failures.push("Maximum guests must be at least 1.");
    }

    if (listing.category === "car") {
      if (!listing.carMake?.trim()) failures.push("Vehicle make is required.");
      if (!listing.carModel?.trim()) failures.push("Vehicle model is required.");
      if (!listing.carYear) failures.push("Vehicle year is required.");
      if (!listing.transmission) failures.push("Transmission type is required.");
      if (!listing.seats || listing.seats < 1) failures.push("Number of seats is required.");
    }

    if (listing.photos.length < 3) {
      failures.push(`At least 3 photos are required. You have ${listing.photos.length}.`);
    }

    if (failures.length > 0) {
      return sendError(reply, 422, "VALIDATION_ERROR", failures.join(" "), { failures });
    }

    await prisma.listing.update({
      where: { id },
      data: { status: "active", activatedAt: listing.activatedAt ?? new Date() },
    });

    sendListingActivatedEmail(providerId, listing.name!, listing.category as "apartment" | "car").catch(() => null);

    const msg = listing.category === "car" ? "Your car rental is now live!" : "Your apartment is now live!";
    return sendSuccess(reply, 200, { message: msg, status: "active" });
  });

  // POST /listings/:id/deactivate — UC-2.13 / UC-3.7
  app.post("/listings/:id/deactivate", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    const liveStatuses = ["apartment", "car"].includes(listing.category) ? ["active"] : ["approved"];
    if (!liveStatuses.includes(listing.status)) {
      return sendError(reply, 409, "INVALID_STATUS", "Only live listings can be deactivated.");
    }

    await prisma.listing.update({ where: { id }, data: { status: "deactivated" } });
    return sendSuccess(reply, 200, { message: "Listing deactivated." });
  });

  // POST /listings/:id/reactivate — UC-2.13 A1 / UC-3.7
  app.post("/listings/:id/reactivate", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findFirst({
      where: { id, providerId, deletedAt: null },
      include: { photos: { where: { deletedAt: null } } },
    });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
    if (listing.status !== "deactivated") return sendError(reply, 409, "INVALID_STATUS", "Listing is not deactivated.");

    if (listing.category === "apartment" || listing.category === "car") {
      // Re-run activation validation
      const failures: string[] = [];
      if (!listing.name?.trim()) failures.push("Listing title is required.");
      if (!listing.lat || !listing.lng) failures.push("Geocoded address is required.");
      if (!listing.pricePerNight || Number(listing.pricePerNight) <= 0) failures.push("Price per night must be greater than 0.");
      if (!listing.cancellationPolicy) failures.push("Cancellation policy is required.");
      if (listing.category === "apartment") {
        if (!listing.maxGuests || listing.maxGuests < 1) failures.push("Maximum guests must be at least 1.");
      }
      if (listing.category === "car") {
        if (!listing.carMake?.trim()) failures.push("Vehicle make is required.");
        if (!listing.carModel?.trim()) failures.push("Vehicle model is required.");
        if (!listing.carYear) failures.push("Vehicle year is required.");
        if (!listing.transmission) failures.push("Transmission type is required.");
        if (!listing.seats || listing.seats < 1) failures.push("Number of seats is required.");
      }
      if (listing.photos.length < 3) failures.push(`At least 3 photos required (you have ${listing.photos.length}).`);
      if (failures.length > 0) return sendError(reply, 422, "VALIDATION_ERROR", failures.join(" "), { failures });

      await prisma.listing.update({ where: { id }, data: { status: "active" } });
      return sendSuccess(reply, 200, { message: "Listing is live again." });
    }

    await prisma.listing.update({ where: { id }, data: { status: "approved" } });
    return sendSuccess(reply, 200, { message: "Listing reactivated." });
  });

  // DELETE /listings/:id — Soft-delete draft (UC-2.13 A2)
  app.delete("/listings/:id", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    if (listing.status !== "draft") {
      return sendError(reply, 409, "CANNOT_DELETE", "Only draft listings can be deleted. Deactivate approved listings instead.");
    }

    await prisma.listing.update({ where: { id }, data: { deletedAt: new Date() } });
    return sendSuccess(reply, 200, { message: "Draft listing deleted." });
  });

  // ── Photo endpoints ────────────────────────────────────────────────────────

  // POST /listings/:id/photos/presign — Request presigned S3 upload URL
  app.post("/listings/:id/photos/presign", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };
    const { contentType, filename } = req.body as { contentType: string; filename: string };

    if (!isValidPhotoType(contentType)) {
      return sendError(reply, 422, "INVALID_TYPE", "Only JPEG, PNG, and WEBP photos are accepted.");
    }

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    const currentCount = await prisma.listingPhoto.count({ where: { listingId: id, deletedAt: null } });
    if (currentCount >= MAX_PHOTOS) {
      return sendError(reply, 422, "PHOTO_LIMIT", `Maximum ${MAX_PHOTOS} photos allowed.`);
    }

    const s3Key = photoS3Key(id, `${Date.now()}.${fileExtFromContentType(contentType)}`);
    const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);

    return sendSuccess(reply, 200, { uploadUrl, s3Key });
  });

  // POST /listings/:id/photos/confirm — Register photo after S3 upload
  app.post("/listings/:id/photos/confirm", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };
    const { s3Key } = req.body as { s3Key: string };

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    const currentCount = await prisma.listingPhoto.count({ where: { listingId: id, deletedAt: null } });
    if (currentCount >= MAX_PHOTOS) {
      return sendError(reply, 422, "PHOTO_LIMIT", `Maximum ${MAX_PHOTOS} photos allowed.`);
    }

    const photo = await prisma.listingPhoto.create({
      data: {
        listingId: id,
        s3Key,
        cdnUrl: cdnUrl(s3Key),
        position: currentCount + 1,
      },
    });

    return sendSuccess(reply, 201, { id: photo.id, cdnUrl: photo.cdnUrl, position: photo.position });
  });

  // PATCH /listings/:id/photos/reorder — Update photo positions (UC-2.5 A1, A2)
  app.patch("/listings/:id/photos/reorder", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };
    const { order } = req.body as { order: string[] }; // array of photo IDs in new order

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    await prisma.$transaction(
      order.map((photoId, index) =>
        prisma.listingPhoto.updateMany({
          where: { id: photoId, listingId: id, deletedAt: null },
          data: { position: index + 1 },
        })
      )
    );

    return sendSuccess(reply, 200, { message: "Photo order updated." });
  });

  // DELETE /listings/:id/photos/:photoId — Remove photo (UC-2.5 A3)
  app.delete("/listings/:id/photos/:photoId", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id, photoId } = req.params as { id: string; photoId: string };

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    const photo = await prisma.listingPhoto.findFirst({
      where: { id: photoId, listingId: id, deletedAt: null },
    });
    if (!photo) return sendError(reply, 404, "NOT_FOUND", "Photo not found.");

    await prisma.listingPhoto.update({ where: { id: photoId }, data: { deletedAt: new Date() } });

    // Compact positions after deletion
    const remaining = await prisma.listingPhoto.findMany({
      where: { listingId: id, deletedAt: null },
      orderBy: { position: "asc" },
    });
    await prisma.$transaction(
      remaining.map((p, index) =>
        prisma.listingPhoto.update({ where: { id: p.id }, data: { position: index + 1 } })
      )
    );

    return sendSuccess(reply, 200, { message: "Photo removed." });
  });

  // ── Document endpoints ─────────────────────────────────────────────────────

  // POST /listings/:id/documents/presign — Request presigned S3 URL for document
  app.post("/listings/:id/documents/presign", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };
    const { contentType, documentType } = req.body as { contentType: string; documentType: string };

    if (!isValidDocumentType(contentType)) {
      return sendError(reply, 422, "INVALID_TYPE", "Only PDF, JPEG, PNG, and WEBP files are accepted.");
    }
    if (!["business_licence", "operating_permit", "tourism_certificate"].includes(documentType)) {
      return sendError(reply, 422, "INVALID_DOC_TYPE", "Invalid document type.");
    }

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    const s3Key = documentS3Key(id, documentType, fileExtFromContentType(contentType));
    const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);

    return sendSuccess(reply, 200, { uploadUrl, s3Key });
  });

  // POST /listings/:id/documents/confirm — Register document after S3 upload
  app.post("/listings/:id/documents/confirm", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id } = req.params as { id: string };
    const { s3Key, documentType, contentType } = req.body as { s3Key: string; documentType: string; contentType: string };

    if (!["business_licence", "operating_permit", "tourism_certificate"].includes(documentType)) {
      return sendError(reply, 422, "INVALID_DOC_TYPE", "Invalid document type.");
    }

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    // Mark any existing doc of this type as replaced
    await prisma.listingDocument.updateMany({
      where: { listingId: id, documentType: documentType as "business_licence" | "operating_permit" | "tourism_certificate", replacedAt: null },
      data: { replacedAt: new Date() },
    });

    // If listing was approved and document is replaced, trigger re-review
    if (listing.status === "approved") {
      const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await prisma.$transaction([
        prisma.listingDocument.create({
          data: {
            listingId: id,
            documentType: documentType as "business_licence" | "operating_permit" | "tourism_certificate",
            s3Key,
            fileType: fileExtFromContentType(contentType),
          },
        }),
        prisma.listingReviewTask.create({
          data: {
            listingId: id,
            submissionNumber: listing.submissionCount + 1,
            slaDeadline,
          },
        }),
      ]);
      return sendSuccess(reply, 201, { message: "Document uploaded. A re-review has been triggered.", reReview: true });
    }

    const doc = await prisma.listingDocument.create({
      data: {
        listingId: id,
        documentType: documentType as "business_licence" | "operating_permit" | "tourism_certificate",
        s3Key,
        fileType: fileExtFromContentType(contentType),
      },
    });

    return sendSuccess(reply, 201, { id: doc.id, documentType: doc.documentType });
  });

  // DELETE /listings/:id/documents/:docId — Remove document before submission
  app.delete("/listings/:id/documents/:docId", { preHandler: [requireProviderRole] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = req as ProviderRequest;
    const { id, docId } = req.params as { id: string; docId: string };

    const listing = await assertOwner(id, providerId, reply);
    if (!listing) return;

    const doc = await prisma.listingDocument.findFirst({
      where: { id: docId, listingId: id, replacedAt: null },
    });
    if (!doc) return sendError(reply, 404, "NOT_FOUND", "Document not found.");
    if (!["draft", "rejected"].includes(listing.status)) {
      return sendError(reply, 409, "CANNOT_DELETE", "Documents can only be removed from draft listings.");
    }

    await prisma.listingDocument.update({ where: { id: docId }, data: { replacedAt: new Date() } });
    return sendSuccess(reply, 200, { message: "Document removed." });
  });

  // GET /geocode — Geocoding proxy; accepts placeId, address, or lat+lng (UC-2.3)
  app.get("/geocode", { preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { placeId, address, lat, lng } = req.query as { placeId?: string; address?: string; lat?: string; lng?: string };

    if (address) {
      const result = await geocodeAddress(address);
      if (!result) return sendError(reply, 404, "NOT_FOUND", "No geocoding results found for this location.");
      return sendSuccess(reply, 200, result);
    }

    if (placeId) {
      const result = await geocodePlaceId(placeId);
      if (!result) return sendError(reply, 404, "NOT_FOUND", "No geocoding results found for this location.");
      return sendSuccess(reply, 200, result);
    }

    if (lat && lng) {
      const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));
      return sendSuccess(reply, 200, result);
    }

    return sendError(reply, 422, "MISSING_PARAMS", "Provide either address, placeId, or lat+lng.");
  });
}

// re-export requireProvider for use in geocode route
import { requireProvider } from "../middleware/auth.js";
