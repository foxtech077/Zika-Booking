import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireUser, type AuthRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
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
import { ceilingForCurrency, getConvertedAmounts, getLocalizedContext } from "../services/exchangeRate.services.js";

const MAX_PHOTOS = 30;

// All valid DocumentType enum values (mirrors schema.prisma DocumentType enum).
// Used by both document presign and document confirm endpoints to reject unknown types.
const ALLOWED_DOC_TYPES = new Set([
  "business_licence",
  "operating_permit",
  "tourism_certificate",
  "insurance_certificate",
  "roadworthiness_certificate",
  "hotel_operating_permit",
  "tourism_authority_certificate",
  "vehicle_registration",
]);

// ── legacy amenity mapping for backward compatibility ───────────────────────
const legacyAmenityCategoryMap: Record<string, string> = {
  wifi: "Connectivity",
  high_speed_wifi: "Connectivity",
  ethernet: "Connectivity",
  smart_tv: "Connectivity",
  work_desk: "Connectivity",
  printer: "Connectivity",
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
  coffee_machine: "Food & Drink",
  air_conditioning: "Comfort",
  heating: "Comfort",
  fireplace: "Comfort",
  balcony: "Comfort",
  laundry: "Comfort",
  parking: "Comfort",
  elevator: "Comfort",
  accessible: "Comfort",
  concierge: "Services",
  reception_24h: "Services",
  security: "Services",
  security_24h: "Services",
  housekeeping: "Services",
  dry_cleaning: "Services",
  luggage_storage: "Services",
  airport_shuttle: "Services",
  shop_on_site: "Services",
  pet_friendly: "Services",
  tv: "Services",
  workspace: "Services",
  washing_machine: "Services",
  garden: "Services",
};

// ── Zod schemas ───────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

const amenitiesGroupedSchema = z.object({
  Connectivity: z.array(z.string().max(100)).optional(),
  "Food & Drink": z.array(z.string().max(100)).optional(),
  Wellness: z.array(z.string().max(100)).optional(),
  Comfort: z.array(z.string().max(100)).optional(),
  Services: z.array(z.string().max(100)).optional(),
});

export const patchListingSchema = z.object({
  name: z.string().max(200).optional(),
  listingTitle: z.string().max(200).optional(),
  // These fields are used for apartments/cars only; hotel room types are managed via /listings/:id/room-types
  roomType: z.preprocess((val) => {
    if (typeof val !== "string") return val;
    return val.toLowerCase().replace(/\s+/g, "_");
  }, z.enum(["standard", "superior", "deluxe", "suite", "junior_suite", "studio", "family_room", "presidential_suite"])).optional(),
  unitCount: z.number().int().min(1).optional(),
  claimedStarRating: z.number().int().min(1).max(5).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  pricePerNight: z.number().positive().optional(),
  pricePerDay: z.number().positive().optional(),
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
  neighborhood: z.string().max(100).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
  amenities: amenitiesGroupedSchema.optional(),
  customAmenities: z.array(z.string().max(60)).optional(),
  // apartment-specific
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().int().min(0).optional().nullable(),
  maxGuests: z.number().int().min(1).optional().nullable(),
  longStayEnabled: z.boolean().optional(),
  longStayMinNights: z.number().int().min(1).optional().nullable(),
  longStayDiscountType: z.enum(["percentage", "fixed"]).optional().nullable(),
  longStayDiscountValue: z.number().positive().optional().nullable(),
  instantBooking: z.boolean().optional(),
  selfCheckin: z.boolean().optional(),
  selfCheckinDetails: z.string().max(500).optional().nullable(),
  apartmentType: z.enum(["entire_place", "private_room", "shared_room", "studio", "loft", "villa", "townhouse"]).optional().nullable(),
  cleaningFee: z.number().nonnegative().optional().nullable(),
  extraGuestFee: z.number().nonnegative().optional().nullable(),
  extraGuestAfter: z.number().int().min(1).optional().nullable(),
  weeklyDiscount: z.number().nonnegative().optional().nullable(),
  monthlyDiscount: z.number().nonnegative().optional().nullable(),
  floorNumber: z.number().int().optional().nullable(),
  propertySizeM2: z.number().positive().optional().nullable(),
  securityDepositDue: z.string().max(30).optional().nullable(),
  // car-specific
  carMake: z.string().max(80).optional().nullable(),
  make: z.string().max(80).optional().nullable(),
  carModel: z.string().max(80).optional().nullable(),
  model: z.string().max(80).optional().nullable(),
  carYear: z.number().int().min(1990).max(currentYear).optional().nullable(),
  year: z.number().int().min(1990).max(currentYear).optional().nullable(),
  transmission: z.preprocess((val) => {
    if (val === "semi-auto") return "semi_auto";
    return val;
  }, z.enum(["manual", "automatic", "semi_auto"])).optional().nullable(),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "lpg"]).optional().nullable(),
  seats: z.number().int().min(1).optional().nullable(),
  doors: z.number().int().min(2).optional().nullable(),
  mileagePolicy: z.enum(["unlimited", "limited"]).optional().nullable(),
  mileageLimitKm: z.number().int().min(1).optional().nullable(),
  carCategory: z.enum(["Economy", "Compact", "SUV", "Minivan", "Pickup", "Luxury", "Electric", "Convertible"]).optional().nullable(),
  category: z.enum(["Economy", "Compact", "SUV", "Minivan", "Pickup", "Luxury", "Electric", "Convertible"]).optional(),
  driveType: z.enum(["2WD", "4WD", "AWD"]).optional().nullable(),
  airConditioning: z.boolean().optional().nullable(),
  odometerReading: z.number().int().nonnegative().optional().nullable(),
  licencePlate: z.string().max(20).optional().nullable(),
  engineSize: z.string().max(20).optional().nullable(),
  colour: z.string().max(30).optional().nullable(),
  securityDeposit: z.number().nonnegative().optional().nullable(),
  minimumDriverAge: z.number().int().min(16).max(100).optional().nullable(),
  driverProvided: z.boolean().optional().nullable(),
  minimumRentalDays: z.number().int().min(1).optional().nullable(),
  fuelPolicy: z.preprocess((val) => {
    if (typeof val !== "string") return val;
    return val.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  }, z.enum(["full_to_full", "same_to_same", "free_tank", "full_to_empty", "pre_purchase"])).optional().nullable(),
  extraKmRate: z.number().nonnegative().optional().nullable(),
  roadsideAssistance: z.boolean().optional().nullable(),
  crossBorderAllowed: z.boolean().optional().nullable(),
  airportPickup: z.boolean().optional().nullable(),
  deliveryEnabled: z.boolean().optional().nullable(),
  deliveryRadiusKm: z.number().int().nonnegative().optional().nullable(),
  deliveryFee: z.number().nonnegative().optional().nullable(),
  pickupHoursFrom: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  pickupHoursTo: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  returnSameLocation: z.boolean().optional().nullable(),
  allowPreBooking: z.boolean().optional(),
  insuranceType: z.preprocess((val) => {
    if (typeof val !== "string") return val;
    return val.toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_")
      .replace("3rd", "third");
  }, z.enum(["basic", "standard", "premium", "comprehensive", "basic_third_party", "premium_zero_excess"])).optional().nullable(),
}).refine((data) => {
  if (data.longStayEnabled) {
    return (
      data.longStayMinNights !== undefined && data.longStayMinNights !== null && data.longStayMinNights >= 1 &&
      data.longStayDiscountType !== undefined && data.longStayDiscountType !== null &&
      data.longStayDiscountValue !== undefined && data.longStayDiscountValue !== null && data.longStayDiscountValue > 0 &&
      (data.longStayDiscountType !== "percentage" || data.longStayDiscountValue <= 100)
    );
  }
  return true;
}, {
  message: "If long-stay discount is enabled, min nights must be >= 1, discount type is required, and discount value must be positive (and <= 100 for percentage).",
  path: ["longStayEnabled"],
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
  app.post("/listings", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      body: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["hotel", "apartment", "car"], default: "hotel" }
        }
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                category: { type: "string" },
                status: { type: "string" }
              },
              required: ["id", "category", "status"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { category = "hotel" } = req.body as { category?: string };

      if (!["hotel", "apartment", "car"].includes(category)) {
        return sendError(reply, 422, "VALIDATION_ERROR", "Invalid listing category.");
      }

      const listing = await prisma.listing.create({
        data: { providerId, category: category as "hotel" | "apartment" | "car" },
      });

      return sendSuccess(reply, 201, { id: listing.id, category: listing.category, status: listing.status });
    } catch (err) {
      req.log.error({ err }, "Failed to create listing");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while creating listing.");
    }
  });

  // GET /listings — My listings (UC-2.6 entry point)
  app.get("/listings", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      querystring: {
        type: "object",
        properties: {
          status: { type: "string" },
          geoPending: { type: "string", enum: ["true", "false"], description: "Filter by geo verification pending status" },
          page: { type: "string", pattern: "^[0-9]+$" },
          limit: { type: "string", pattern: "^[0-9]+$" },
          currency: { type: "string", description: "ISO 4217 currency code for localized prices (e.g. KES, NGN, USD)" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                listings: {
                  type: "array",
                  items: { type: "object", additionalProperties: true }
                },
                total: { type: "integer" },
                page: { type: "integer" },
                limit: { type: "integer" }
              },
              required: ["listings", "total", "page", "limit"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { status, geoPending, page = "1", limit = "20", currency: targetCurrency } = req.query as Record<string, string>;
      const target = targetCurrency?.toUpperCase() || null;

      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const take = Math.min(parseInt(limit, 10), 50);

      const where = {
        providerId,
        deletedAt: null,
        ...(status && status !== "all" ? { status: status as "draft" } : {}),
        ...(geoPending === "true" ? { temporaryActivation: true, category: "apartment" as const } : {}),
        ...(geoPending === "false" ? { NOT: { temporaryActivation: true } } : {}),
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
            pricePerDay: true,
            currency: true,
            submissionCount: true,
            rejectionReasons: true,
            rejectionNote: true,
            createdAt: true,
            updatedAt: true,
            temporaryActivation: true,
            geoVerificationDueAt: true,
            photos: {
              where: { deletedAt: null, position: 1 },
              select: { s3Key: true, cdnUrl: true },
              take: 1,
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

      const signedListings = await Promise.all(
        listings.map(async (l) => {
          const baseCurrency = l.currency ?? "USD";
          const nightlyRate = l.pricePerNight ? Number(l.pricePerNight) : null;
          const dailyRate = l.pricePerDay ? Number(l.pricePerDay) : null;
          const ctx = await getLocalizedContext(baseCurrency, target);
          const localizedNightlyRate =
            ctx.currency === null ? null
            : (ctx.rate !== null && nightlyRate !== null ? ceilingForCurrency(nightlyRate * ctx.rate, ctx.currency) : nightlyRate);
          const localizedDailyRate =
            ctx.currency === null ? null
            : (ctx.rate !== null && dailyRate !== null ? ceilingForCurrency(dailyRate * ctx.rate, ctx.currency) : dailyRate);

          return {
            ...l,
            nightlyRate,
            dailyRate,
            localizedNightlyRate,
            localizedDailyRate,
            localizedCurrency: ctx.currency,
            photos: l.photos,
          };
        }),
      );
      return sendSuccess(reply, 200, { listings: signedListings, total, page: parseInt(page, 10), limit: take });
    } catch (err) {
      req.log.error({ err }, "Failed to fetch provider listings");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching listings.");
    }
  });

  // GET /listings/:id — Get listing detail (UC-2.6)
  app.get("/listings/:id", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      querystring: {
        type: "object",
        properties: {
          currency: { type: "string", description: "ISO 4217 currency code for localized prices (e.g. KES, NGN, USD)" },
        },
      },

    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };
      const { currency: targetCurrency } = (req.query as Record<string, string>) ?? {};
      const target = targetCurrency?.toUpperCase() || null;

      const listing = await prisma.listing.findFirst({
        where: { id, providerId, deletedAt: null },
        include: {
          photos: { where: { deletedAt: null }, orderBy: { position: "asc" } },
          documents: { where: { replacedAt: null } },
          amenities: true,
          customAmenities: true,
          // hotelRoomTypes: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      });

      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

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

      const baseCurrency = listing.currency ?? "USD";
      const nightlyRate = listing.pricePerNight ? Number(listing.pricePerNight) : null;
      const dailyRate = listing.pricePerDay ? Number(listing.pricePerDay) : null;
      const ctx = await getLocalizedContext(baseCurrency, target);
      const localizedNightlyRate =
        ctx.currency === null ? null
        : (ctx.rate !== null && nightlyRate !== null ? ceilingForCurrency(nightlyRate * ctx.rate, ctx.currency) : nightlyRate);
      const localizedDailyRate =
        ctx.currency === null ? null
        : (ctx.rate !== null && dailyRate !== null ? ceilingForCurrency(dailyRate * ctx.rate, ctx.currency) : dailyRate);

      // Localized equivalents for absolute-money fee fields (additive only).
      const feeAmounts: Record<string, number | null> = {
        securityDeposit: listing.securityDeposit != null ? Number(listing.securityDeposit) : null,
        deliveryFee: listing.deliveryFee != null ? Number(listing.deliveryFee) : null,
        cleaningFee: listing.cleaningFee != null ? Number(listing.cleaningFee) : null,
        extraGuestFee: listing.extraGuestFee != null ? Number(listing.extraGuestFee) : null,
        earlyCheckinFee: listing.earlyCheckinFee != null ? Number(listing.earlyCheckinFee) : null,
        lateCheckoutFee: listing.lateCheckoutFee != null ? Number(listing.lateCheckoutFee) : null,
        extraKmRate: listing.extraKmRate != null ? Number(listing.extraKmRate) : null,
        ...(listing.childPriceType === "flat" && listing.childPriceValue != null
          ? { childPrice: Number(listing.childPriceValue) }
          : {}),
      };
      const localizedFee = await getConvertedAmounts(baseCurrency, target, feeAmounts);
      const localizedFeeFields = Object.fromEntries(
        Object.entries(localizedFee.values).map(([k, v]) => [
          `localized${k.charAt(0).toUpperCase()}${k.slice(1)}`,
          v,
        ])
      );

      const formattedListing = {
        ...listing,
        amenities: groupedAmenities,
        // hotelRoomTypes: listing.hotelRoomTypes.map((rt) => ({
        //   ...rt,
        //   pricePerNight: Number(rt.pricePerNight),
        // })),
        photos: listing.photos,
        nightlyRate,
        dailyRate,
        localizedNightlyRate,
        localizedDailyRate,
        localizedCurrency: ctx.currency,
        ...localizedFeeFields,
      };

      return sendSuccess(reply, 200, formattedListing);
    } catch (err) {
      req.log.error({ err }, "Failed to fetch listing details");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching listing details.");
    }
  });

  // PATCH /listings/:id — Update listing fields (UC-2.2 auto-save)
  app.patch("/listings/:id", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      body: {
        type: "object",
        properties: {
          listingTitle: { type: "string", maxLength: 200 },
          roomType: {
            type: "string",
            enum: ["standard", "superior", "deluxe", "suite", "junior_suite", "studio", "family_room", "presidential_suite"],
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
          neighborhood: { type: "string", maxLength: 100 },
          country: { type: "string", minLength: 2, maxLength: 2 },
          amenities: {
            type: "object",
            properties: {
              Connectivity: { type: "array", items: { type: "string" } },
              "Food & Drink": { type: "array", items: { type: "string" } },
              Wellness: { type: "array", items: { type: "string" } },
              Comfort: { type: "array", items: { type: "string" } },
              Services: { type: "array", items: { type: "string" } },
            },
            additionalProperties: true,
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
        },
        additionalProperties: true,
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
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

      const {
        amenities,
        customAmenities,
        listingTitle,
        make,
        model,
        year,
        category,
        pricePerDay,
        // lat/lng are still accepted from the frontend (manual pin drag)
        // but stored as a PostGIS geography point instead of decimal columns
        lat,
        lng,
        ...fields
      } = parsed.data;

      // Map aliases to database columns
      const dbFields: any = { ...fields };
      if (listingTitle !== undefined) dbFields.name = listingTitle;
      if (make !== undefined) dbFields.carMake = make;
      if (model !== undefined) dbFields.carModel = model;
      if (year !== undefined) dbFields.carYear = year;
      if (pricePerDay !== undefined) dbFields.pricePerDay = pricePerDay;
      const driveTypeMap = {
        "2WD": "TWO_WD",
        "4WD": "FOUR_WD",
        "AWD": "AWD",
      };

      if (dbFields.driveType) {
        dbFields.driveType =
          driveTypeMap[dbFields.driveType as keyof typeof driveTypeMap];
      }
      if (category !== undefined && listing.category === "car") {
        dbFields.carCategory = category;
      }

      // Track location as a PostGIS geography point (separate from dbFields since
      // Prisma cannot natively write to a geography column)
      let locationLat: number | null = null;
      let locationLng: number | null = null;

      // Geocoding Rules (Requirement 5)
      // Address selection MUST auto-fill: lat, lng, town, neighborhood, country.
      // Manual pin drag updates ONLY lat/lng.
      if (parsed.data.address && parsed.data.address !== listing.address) {
        const geo = await geocodeAddress(parsed.data.address);
        if (geo) {
          locationLat = geo.lat;
          locationLng = geo.lng;
          dbFields.town = geo.town;
          dbFields.neighborhood = geo.neighborhood;
          dbFields.country = geo.country;
        }
      }

      // Manual pin drag overrides geocoded location
      if (lat != null && lng != null) {
        locationLat = lat;
        locationLng = lng;
      }

      // If location is now provided for an apartment, clear temporary activation
      if (listing.category === "apartment" && locationLat != null && locationLng != null) {
        dbFields.temporaryActivation = false;
        dbFields.geoVerificationDueAt = null;
      }

      // Reset to draft if was rejected; active apartments stay active
      const newStatus = listing.status === "rejected" ? "draft" : listing.status;

      await prisma.$transaction(async (tx) => {
        await tx.listing.update({
          where: { id },
          data: {
            ...dbFields,
            status: newStatus,
            // These fields are non-nullable with DB defaults — convert null→undefined
            // so Prisma leaves the existing value intact rather than throwing a type error.
            roadsideAssistance: dbFields.roadsideAssistance ?? undefined,
            crossBorderAllowed: dbFields.crossBorderAllowed ?? undefined,
            driverProvided: dbFields.driverProvided ?? undefined,
            airportPickup: dbFields.airportPickup ?? undefined,
            deliveryEnabled: dbFields.deliveryEnabled ?? undefined,
            returnSameLocation: dbFields.returnSameLocation ?? undefined,
            allowPreBooking: dbFields.allowPreBooking ?? undefined,
          },
        });

        // Write PostGIS geography point
        if (locationLat != null && locationLng != null) {
          await tx.$executeRaw`
            UPDATE listing.listings
            SET location = public.ST_SetSRID(public.ST_MakePoint(${locationLng}::double precision, ${locationLat}::double precision), 4326)::public.geography
            WHERE id = ${id}
          `;
        }

        if (amenities !== undefined) {
          await tx.listingAmenity.deleteMany({ where: { listingId: id } });
          const flatAmenities: string[] = [];
          for (const [categoryName, keys] of Object.entries(amenities)) {
            if (Array.isArray(keys)) {
              for (const k of keys) {
                flatAmenities.push(`${categoryName}:${k}`);
              }
            }
          }
          if (flatAmenities.length > 0) {
            await tx.listingAmenity.createMany({
              data: flatAmenities.map((key) => ({ listingId: id, amenityKey: key })),
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
    } catch (err) {
      req.log.error({ err }, "Failed to update listing");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while updating listing.");
    }
  });

  // POST /listings/:id/submit — Submit for review (UC-2.7)
  app.post("/listings/:id/submit", {
    schema: {
      tags: ["Listings"],
      description: [
        "Submit a hotel listing for admin review. No request body required.",
        "",
        "Before submitting, the listing must have all of the following already saved via PUT /listings/:id:",
        "- **name** (property name)",
        "- **currency**",
        "- **address**, **town**, **country**",
        "- **cancellationPolicy**",
        "- **checkinTime** and **checkoutTime**",
        "- **minStayNights** (≥ 1)",
        "- **description** (max 1000 chars)",
        "- At least one photo uploaded via POST /listings/:id/photos",
        "- Documents uploaded via POST /listings/:id/documents:",
        "  - `business_licence`",
        "  - `operating_permit` or `hotel_operating_permit`",
        "  - `tourism_certificate` or `tourism_authority_certificate`",
        "",
        "At least one active room type must exist via POST /listings/:id/room-types.",
        "",
        "Only `draft` or `rejected` hotel listings can be submitted.",
      ].join("\n"),
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string", example: "Listing submitted for review." },
              },
            },
          },
        },
        422: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "VALIDATION_ERROR" },
                message: { type: "string", example: "Property name is required. At least one photo is required." },
              },
            },
          },
        },
      },
    },
    preHandler: [requireUser],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };

      const listing = await prisma.listing.findFirst({
        where: { id, providerId, deletedAt: null },
        include: {
          photos: { where: { deletedAt: null } },
          documents: { where: { replacedAt: null } },
        },
      });

      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      if (listing.category !== "hotel") {
        return sendError(reply, 422, "INVALID_CATEGORY", "Only hotel listings require manual admin review. Please use the activation endpoint for apartments and car rentals.");
      }

      if (!["draft", "rejected"].includes(listing.status)) {
        return sendError(reply, 409, "INVALID_STATUS", "Only draft or rejected listings can be submitted.");
      }

      // Pre-submission validation (Hotel Module)
      const failures: string[] = [];
      if (!listing.name?.trim()) failures.push("Property name is required.");

      // Validate at least one active room type exists
      const activeRoomTypes = await prisma.hotelRoomType.count({
        where: { listingId: id, isActive: true },
      });
      if (activeRoomTypes === 0) {
        failures.push("At least one active room type is required.");
      }

      if (!listing.currency) failures.push("Currency is required.");
      if (!listing.address) failures.push("Address is required.");
      if (!listing.town || !listing.country) failures.push("Town and country are required.");
      if (!listing.cancellationPolicy) failures.push("Cancellation policy is required.");
      if (!listing.checkinTime) failures.push("Check-in time is required.");
      if (!listing.checkoutTime) failures.push("Check-out time is required.");
      if (!listing.minStayNights || listing.minStayNights < 1) failures.push("Minimum stay must be at least 1 night.")
      // Description validation
      if (!listing.description?.trim()) failures.push("Description is required.");
      if (listing.description && listing.description.length > 1000) failures.push("Description cannot exceed 1000 characters.");

      // Photos check
      if (listing.photos.length === 0) {
        failures.push("At least one photo is required.");
      } else if (listing.photos.length > 30) {
        failures.push("Maximum of 30 photos is allowed.");
      }

      // Documents check
      const docTypes = listing.documents.map((d) => d.documentType);
      if (!docTypes.includes("business_licence")) failures.push("Business licence document is required.");
      if (!docTypes.includes("operating_permit") && !docTypes.includes("hotel_operating_permit")) {
        failures.push("Hotel operating permit document is required.");
      }
      if (!docTypes.includes("tourism_certificate") && !docTypes.includes("tourism_authority_certificate")) {
        failures.push("Tourism authority certificate is required.");
      }

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
    } catch (err) {
      req.log.error({ err }, "Failed to submit listing for review");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while submitting listing.");
    }
  });

  // POST /listings/:id/activate — Apartment auto-activation (UC-3.5) + Car activation (UC-4.5)
  app.post("/listings/:id/activate", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" },
                status: { type: "string" }
              },
              required: ["message", "status"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };
      const currentYear = new Date().getFullYear();

      const listing = await prisma.listing.findFirst({
        where: { id, providerId, deletedAt: null },
        include: {
          photos: { where: { deletedAt: null } },
          documents: { where: { replacedAt: null } },
        },
      });

      if (!listing) {
        return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
      }

      if (!["apartment", "car"].includes(listing.category)) {
        return sendError(
          reply,
          422,
          "INVALID_CATEGORY",
          "Only apartment and car listings can be auto-activated. Hotels require admin review."
        );
      }

      if (!["draft", "deactivated"].includes(listing.status)) {
        return sendError(reply, 409, "INVALID_STATUS", "Only draft or deactivated listings can be activated.");
      }

      const failures: string[] = [];

      // apartment rules
      if (listing.category === "apartment") {
        if (!listing.name?.trim()) failures.push("Apartment name is required.");
        if (!listing.description?.trim()) failures.push("Description is required.");
        if (listing.description && listing.description.length > 1000) failures.push("Description cannot exceed 1000 characters.");
        if (!listing.address) failures.push("Address is required.");
        if (!listing.town || !listing.country) failures.push("Town and country are required.");
        if (listing.bedrooms === null || listing.bedrooms === undefined || listing.bedrooms < 0) failures.push("Number of bedrooms is required.");
        if (listing.bathrooms === null || listing.bathrooms === undefined || listing.bathrooms < 0) failures.push("Number of bathrooms is required.");
        if (listing.maxGuests === null || listing.maxGuests === undefined || listing.maxGuests < 1) failures.push("Maximum guests must be at least 1.");
        if (!listing.pricePerNight || Number(listing.pricePerNight) <= 0) failures.push("Price per night must be greater than 0.");
        if (!listing.currency) failures.push("Currency is required.");
        if (!listing.checkinTime) failures.push("Check-in time is required.");
        if (!listing.checkoutTime) failures.push("Check-out time is required.");
        if (!listing.cancellationPolicy) failures.push("Cancellation policy is required.");
        if (listing.minStayNights === null || listing.minStayNights === undefined || listing.minStayNights < 1) failures.push("Minimum stay must be at least 1 night.");

        if (listing.longStayEnabled) {
          if (!listing.longStayMinNights || listing.longStayMinNights < 1) failures.push("Long-stay minimum nights must be at least 1 when long-stay discount is enabled.");
          if (!listing.longStayDiscountType) failures.push("Long-stay discount type is required when long-stay discount is enabled.");
          if (!listing.longStayDiscountValue || Number(listing.longStayDiscountValue) <= 0) failures.push("Long-stay discount value must be greater than 0 when long-stay discount is enabled.");
          if (listing.longStayDiscountType === "percentage" && Number(listing.longStayDiscountValue) > 100) failures.push("Long-stay discount percentage cannot exceed 100%.");
        }

        if (listing.photos.length < 3 || listing.photos.length > 30) {
          failures.push(`Photos count must be between 3 and 30. You have ${listing.photos.length}.`);
        }
      }

      // car rules
      if (listing.category === "car") {
        if (!listing.name?.trim()) failures.push("Listing title is required.");
        if (!listing.carMake?.trim()) failures.push("Vehicle make is required.");
        if (!listing.carModel?.trim()) failures.push("Vehicle model is required.");
        if (!listing.carYear || listing.carYear < 1990 || listing.carYear > currentYear) {
          failures.push(`Vehicle year must be between 1990 and ${currentYear}.`);
        }
        if (!listing.carCategory) failures.push("Vehicle category is required.");
        if (!listing.unitCount || listing.unitCount < 1) failures.push("Number of units (fleet count) is required.");
        if (!listing.licencePlate?.trim()) failures.push("Licence plate is required.");
        if (listing.odometerReading === null || listing.odometerReading === undefined) failures.push("Odometer reading is required.");
        if (!listing.transmission) failures.push("Transmission type is required.");
        if (!listing.fuelType) failures.push("Fuel type is required.");
        if (listing.seats === null || listing.seats === undefined || listing.seats < 1) failures.push("Number of seats is required.");
        if (listing.doors === null || listing.doors === undefined || listing.doors < 2) failures.push("Number of doors is required.");
        if (listing.airConditioning === null || listing.airConditioning === undefined) failures.push("Air conditioning is required.");
        if (!listing.driveType) failures.push("Drive type is required.");
        if (!listing.pricePerDay || Number(listing.pricePerDay) <= 0) failures.push("Price per day must be greater than 0.");
        if (!listing.currency) failures.push("Currency is required.");
        if (!listing.cancellationPolicy) failures.push("Cancellation policy is required.");
        if (!listing.fuelPolicy) failures.push("Fuel policy is required.");
        if (!listing.insuranceType) failures.push("Insurance type is required.");

        // Mileage policy
        if (!listing.mileagePolicy) {
          failures.push("Mileage policy is required.");
        } else if (listing.mileagePolicy === "limited") {
          if (!listing.mileageLimitKm || listing.mileageLimitKm < 1) failures.push("Mileage limit in km is required and must be positive when mileage policy is limited.");
          if (listing.extraKmRate === null || listing.extraKmRate === undefined || Number(listing.extraKmRate) < 0) failures.push("Extra km rate is required when mileage policy is limited.");
        }

        // Delivery: if enabled, radius and fee must be set
        if (listing.deliveryEnabled) {
          if (!listing.deliveryRadiusKm || listing.deliveryRadiusKm < 1) failures.push("Delivery radius is required when delivery is enabled.");
          if (listing.deliveryFee === null || listing.deliveryFee === undefined || Number(listing.deliveryFee) < 0) failures.push("Delivery fee is required when delivery is enabled.");
        }

        if (!listing.address) failures.push("Pickup address is required.");
        if (!listing.town || !listing.country) failures.push("Town and country are required.");

        if (!listing.fuelType) failures.push("Fuel type is required.");
        if (!listing.insuranceType) failures.push("Insurance type is required.");

        const docTypes = listing.documents.map((d) => d.documentType);
        if (!docTypes.includes("vehicle_registration")) {
          failures.push("Vehicle registration document is required.");
        }
        if (!docTypes.includes("insurance_certificate")) {
          failures.push("Insurance certificate document is required.");
        }

        if (listing.photos.length < 3 || listing.photos.length > 30) {
          failures.push(`Photos count must be between 3 and 30. You have ${listing.photos.length}.`);
        }
      }

      if (failures.length > 0) {
        return sendError(reply, 422, "VALIDATION_ERROR", failures.join(" "), { failures });
      }

      const hasLocation = await prisma.$queryRaw<Array<{ has_location: boolean }>>`
        SELECT location IS NOT NULL AS has_location FROM listing.listings WHERE id = ${id}
      `;
      const needsGeo = listing.category === "apartment" && !hasLocation[0]?.has_location;

      await prisma.listing.update({
        where: { id },
        data: {
          status: "active",
          activatedAt: listing.activatedAt ?? new Date(),
          ...(needsGeo
            ? {
              temporaryActivation: true,
              geoVerificationDueAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            }
            : {
              temporaryActivation: false,
              geoVerificationDueAt: null,
            }),
        },
      });

      sendListingActivatedEmail(
        providerId,
        listing.name!,
        listing.category as "apartment" | "car"
      ).catch(() => null);

      const msg = needsGeo
        ? "Your apartment is now live with a temporary 180-day activation. Please update your location/address to complete verification and keep your listing active."
        : listing.category === "car"
          ? "Your car rental is now live!"
          : "Your apartment is now live!";

      return sendSuccess(reply, 200, {
        message: msg,
        status: "active",
        temporaryActivation: needsGeo,
        ...(needsGeo ? { geoVerificationDueAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) } : {}),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to activate listing");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while activating listing.");
    }
  });

  // POST /listings/:id/deactivate — UC-2.13 / UC-3.7
  app.post("/listings/:id/deactivate", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };

      const listing = await assertOwner(id, providerId, reply);
      if (!listing) return;

      const liveStatuses = ["apartment", "car"].includes(listing.category) ? ["active"] : ["approved"];
      if (!liveStatuses.includes(listing.status)) {
        return sendError(reply, 409, "INVALID_STATUS", "Only live listings can be deactivated.");
      }

      await prisma.listing.update({ where: { id }, data: { status: "deactivated" } });
      return sendSuccess(reply, 200, { message: "Listing deactivated." });
    } catch (err) {
      req.log.error({ err }, "Failed to deactivate listing");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while deactivating listing.");
    }
  });

  // POST /listings/:id/reactivate — UC-2.13 A1 / UC-3.7
  app.post("/listings/:id/reactivate", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };
      const currentYear = new Date().getFullYear();

      const listing = await prisma.listing.findFirst({
        where: { id, providerId, deletedAt: null },
        include: {
          photos: { where: { deletedAt: null } },
          documents: { where: { replacedAt: null } },
        },
      });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");
      if (listing.status !== "deactivated") return sendError(reply, 409, "INVALID_STATUS", "Listing is not deactivated.");

      if (listing.category === "apartment" || listing.category === "car") {
        const failures: string[] = [];

        // Check PostGIS location availability (replaces old lat/lng column checks)
        const locResult = await prisma.$queryRaw<Array<{ has_location: boolean }>>`
          SELECT location IS NOT NULL AS has_location FROM listing.listings WHERE id = ${id}
        `;
        const hasLocation = locResult[0]?.has_location ?? false;

        // apartment rules
        if (listing.category === "apartment") {
          if (!listing.name?.trim()) failures.push("Apartment name is required.");
          if (!listing.description?.trim()) failures.push("Description is required.");
          if (listing.description && listing.description.length > 1000) failures.push("Description cannot exceed 1000 characters.");
          if (!listing.address || !hasLocation) failures.push("Address with geocoded location is required.");
          if (!listing.town || !listing.country) failures.push("Town and country are required (auto-filled from geocoding).");
          if (listing.bedrooms === null || listing.bedrooms === undefined || listing.bedrooms < 0) failures.push("Number of bedrooms is required.");
          if (listing.bathrooms === null || listing.bathrooms === undefined || listing.bathrooms < 0) failures.push("Number of bathrooms is required.");
          if (listing.maxGuests === null || listing.maxGuests === undefined || listing.maxGuests < 1) failures.push("Maximum guests must be at least 1.");
          if (!listing.pricePerNight || Number(listing.pricePerNight) <= 0) failures.push("Price per night must be greater than 0.");
          if (!listing.currency) failures.push("Currency is required.");
          if (!listing.checkinTime) failures.push("Check-in time is required.");
          if (!listing.checkoutTime) failures.push("Check-out time is required.");
          if (!listing.cancellationPolicy) failures.push("Cancellation policy is required.");
          if (listing.minStayNights === null || listing.minStayNights === undefined || listing.minStayNights < 1) failures.push("Minimum stay must be at least 1 night.");

          if (listing.longStayEnabled) {
            if (!listing.longStayMinNights || listing.longStayMinNights < 1) failures.push("Long-stay minimum nights must be at least 1 when long-stay discount is enabled.");
            if (!listing.longStayDiscountType) failures.push("Long-stay discount type is required when long-stay discount is enabled.");
            if (!listing.longStayDiscountValue || Number(listing.longStayDiscountValue) <= 0) failures.push("Long-stay discount value must be greater than 0 when long-stay discount is enabled.");
            if (listing.longStayDiscountType === "percentage" && Number(listing.longStayDiscountValue) > 100) failures.push("Long-stay discount percentage cannot exceed 100%.");
          }

          if (listing.photos.length < 3 || listing.photos.length > 30) {
            failures.push(`Photos count must be between 3 and 30. You have ${listing.photos.length}.`);
          }
        }

        // car rules
        if (listing.category === "car") {
          if (!listing.name?.trim()) failures.push("Listing title is required.");
          if (!listing.carMake?.trim()) failures.push("Vehicle make is required.");
          if (!listing.carModel?.trim()) failures.push("Vehicle model is required.");
          if (!listing.carYear || listing.carYear < 1990 || listing.carYear > currentYear) {
            failures.push(`Vehicle year must be between 1990 and ${currentYear}.`);
          }
          if (!listing.carCategory) failures.push("Vehicle category is required.");
          if (!listing.unitCount || listing.unitCount < 1) failures.push("Number of units (fleet count) is required.");
          if (!listing.licencePlate?.trim()) failures.push("Licence plate is required.");
          if (listing.odometerReading === null || listing.odometerReading === undefined) failures.push("Odometer reading is required.");
          if (!listing.transmission) failures.push("Transmission type is required.");
          if (!listing.fuelType) failures.push("Fuel type is required.");
          if (listing.seats === null || listing.seats === undefined || listing.seats < 1) failures.push("Number of seats is required.");
          if (listing.doors === null || listing.doors === undefined || listing.doors < 2) failures.push("Number of doors is required.");
          if (listing.airConditioning === null || listing.airConditioning === undefined) failures.push("Air conditioning is required.");
          if (!listing.driveType) failures.push("Drive type is required.");
          if (!listing.pricePerDay || Number(listing.pricePerDay) <= 0) failures.push("Price per day must be greater than 0.");
          if (!listing.currency) failures.push("Currency is required.");
          if (!listing.cancellationPolicy) failures.push("Cancellation policy is required.");
          if (!listing.fuelPolicy) failures.push("Fuel policy is required.");
          if (!listing.insuranceType) failures.push("Insurance type is required.");

          // Mileage policy
          if (!listing.mileagePolicy) {
            failures.push("Mileage policy is required.");
          } else if (listing.mileagePolicy === "limited") {
            if (!listing.mileageLimitKm || listing.mileageLimitKm < 1) failures.push("Mileage limit in km is required and must be positive when mileage policy is limited.");
            if (listing.extraKmRate === null || listing.extraKmRate === undefined || Number(listing.extraKmRate) < 0) failures.push("Extra km rate is required when mileage policy is limited.");
          }

          // Delivery: if enabled, radius and fee must be set
          if (listing.deliveryEnabled) {
            if (!listing.deliveryRadiusKm || listing.deliveryRadiusKm < 1) failures.push("Delivery radius is required when delivery is enabled.");
            if (listing.deliveryFee === null || listing.deliveryFee === undefined || Number(listing.deliveryFee) < 0) failures.push("Delivery fee is required when delivery is enabled.");
          }

          if (!listing.address) failures.push("Pickup address is required.");
          if (!listing.town || !listing.country) failures.push("Town and country are required.");

          if (!listing.fuelType) failures.push("Fuel type is required.");
          if (!listing.insuranceType) failures.push("Insurance type is required.");

          const docTypes = listing.documents.map((d) => d.documentType);
          if (!docTypes.includes("vehicle_registration")) {
            failures.push("Vehicle registration document is required.");
          }
          if (!docTypes.includes("insurance_certificate")) {
            failures.push("Insurance certificate document is required.");
          }

          if (listing.photos.length < 3 || listing.photos.length > 30) {
            failures.push(`Photos count must be between 3 and 30. You have ${listing.photos.length}.`);
          }
        }

        if (failures.length > 0) return sendError(reply, 422, "VALIDATION_ERROR", failures.join(" "), { failures });

        await prisma.listing.update({ where: { id }, data: { status: "active" } });
        return sendSuccess(reply, 200, { message: "Listing is live again." });
      }

      await prisma.listing.update({ where: { id }, data: { status: "approved" } });
      return sendSuccess(reply, 200, { message: "Listing reactivated." });
    } catch (err) {
      req.log.error({ err }, "Failed to reactivate listing");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while reactivating listing.");
    }
  });

  // DELETE /listings/:id — Soft-delete draft (UC-2.13 A2)
  app.delete("/listings/:id", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };

      const listing = await assertOwner(id, providerId, reply);
      if (!listing) return;

      if (listing.status !== "draft") {
        return sendError(reply, 409, "CANNOT_DELETE", "Only draft listings can be deleted. Deactivate approved listings instead.");
      }

      await prisma.listing.update({ where: { id }, data: { deletedAt: new Date() } });
      return sendSuccess(reply, 200, { message: "Draft listing deleted." });
    } catch (err) {
      req.log.error({ err }, "Failed to delete listing");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while deleting listing.");
    }
  });

  // ── Photo endpoints ────────────────────────────────────────────────────────

  // POST /listings/:id/photos/presign — Request presigned S3 upload URL
  app.post("/listings/:id/photos/presign", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      body: {
        type: "object",
        required: ["contentType", "filename"],
        properties: {
          contentType: { type: "string" },
          filename: { type: "string" },
          fileSize: { type: "number" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                uploadUrl: { type: "string" },
                s3Key: { type: "string" }
              },
              required: ["uploadUrl", "s3Key"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };
      const { contentType, filename, fileSize } = req.body as { contentType: string; filename: string; fileSize?: number };

      if (fileSize !== undefined && fileSize > 5 * 1024 * 1024) {
        return sendError(reply, 422, "FILE_TOO_LARGE", "Image size cannot exceed 5 MB.");
      }

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
    } catch (err) {
      req.log.error({ err }, "Failed to generate presigned upload URL for photo");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while requesting photo upload URL.");
    }
  });

  // POST /listings/:id/photos/confirm — Register photo after S3 upload
  app.post("/listings/:id/photos/confirm", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      body: {
        type: "object",
        required: ["s3Key"],
        properties: {
          s3Key: { type: "string" }
        }
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                cdnUrl: { type: "string" },
                position: { type: "integer" }
              },
              required: ["id", "cdnUrl", "position"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
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

      const signedUrl = await createPresignedDownloadUrl(photo.s3Key);
      return sendSuccess(reply, 201, { id: photo.id, cdnUrl: signedUrl, position: photo.position });
    } catch (err) {
      req.log.error({ err }, "Failed to confirm photo upload");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while confirming photo.");
    }
  });

  // PATCH /listings/:id/photos/reorder — Update photo positions (UC-2.5 A1, A2)
  app.patch("/listings/:id/photos/reorder", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      body: {
        type: "object",
        required: ["order"],
        properties: {
          order: { type: "array", items: { type: "string" } }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
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
    } catch (err) {
      req.log.error({ err }, "Failed to reorder photos");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while reordering photos.");
    }
  });

  // DELETE /listings/:id/photos/:photoId — Remove photo (UC-2.5 A3)
  app.delete("/listings/:id/photos/:photoId", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id", "photoId"],
        properties: {
          id: { type: "string" },
          photoId: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
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
    } catch (err) {
      req.log.error({ err }, "Failed to remove photo");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while removing photo.");
    }
  });

  // ── Document endpoints ─────────────────────────────────────────────────────

  // POST /listings/:id/documents/presign — Request presigned S3 URL for document
  app.post("/listings/:id/documents/presign", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      body: {
        type: "object",
        required: ["contentType", "documentType"],
        properties: {
          contentType: { type: "string" },
          documentType: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                uploadUrl: { type: "string" },
                s3Key: { type: "string" }
              },
              required: ["uploadUrl", "s3Key"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };
      const { contentType, documentType } = req.body as { contentType: string; documentType: string };

      if (!isValidDocumentType(contentType)) {
        return sendError(reply, 422, "INVALID_TYPE", "Only PDF, JPEG, PNG, and WEBP files are accepted.");
      }
      if (!ALLOWED_DOC_TYPES.has(documentType)) {
        return sendError(reply, 422, "INVALID_DOC_TYPE", "Invalid document type.");
      }

      const listing = await assertOwner(id, providerId, reply);
      if (!listing) return;

      const s3Key = documentS3Key(id, documentType, fileExtFromContentType(contentType));
      const uploadUrl = await createPresignedUploadUrl(s3Key, contentType);

      return sendSuccess(reply, 200, { uploadUrl, s3Key });
    } catch (err) {
      req.log.error({ err }, "Failed to generate presigned upload URL for document");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while requesting document upload URL.");
    }
  });

  // POST /listings/:id/documents/confirm — Register document after S3 upload
  app.post("/listings/:id/documents/confirm", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" }
        }
      },
      body: {
        type: "object",
        required: ["s3Key", "documentType", "contentType"],
        properties: {
          s3Key: { type: "string" },
          documentType: { type: "string" },
          contentType: { type: "string" }
        }
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                documentType: { type: "string" },
                message: { type: "string" },
                reReview: { type: "boolean" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id } = req.params as { id: string };
      const { s3Key, documentType, contentType } = req.body as { s3Key: string; documentType: string; contentType: string };

      if (!ALLOWED_DOC_TYPES.has(documentType)) {
        return sendError(reply, 422, "INVALID_DOC_TYPE", "Invalid document type.");
      }

      const listing = await assertOwner(id, providerId, reply);
      if (!listing) return;

      // Mark any existing doc of this type as replaced
      await prisma.listingDocument.updateMany({
        where: { listingId: id, documentType: documentType as any, replacedAt: null },
        data: { replacedAt: new Date() },
      });

      // If listing was approved and document is replaced, trigger re-review
      if (listing.status === "approved") {
        const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
        await prisma.$transaction([
          prisma.listingDocument.create({
            data: {
              listingId: id,
              documentType: documentType as any,
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
          documentType: documentType as any,
          s3Key,
          fileType: fileExtFromContentType(contentType),
        },
      });

      return sendSuccess(reply, 201, { id: doc.id, documentType: doc.documentType, message: "Document uploaded successfully." });
    } catch (err) {
      req.log.error({ err }, "Failed to confirm document upload");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while confirming document upload.");
    }
  });

  // DELETE /listings/:id/documents/:docId — Remove document before submission
  app.delete("/listings/:id/documents/:docId", {
    preHandler: [requireUser],
    schema: {
      tags: ["Listings"],
      params: {
        type: "object",
        required: ["id", "docId"],
        properties: {
          id: { type: "string" },
          docId: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { authId: providerId } = req as AuthRequest;
      const { id, docId } = req.params as { id: string; docId: string };

      const listing = await assertOwner(id, providerId, reply);
      if (!listing) return;

      const doc = await prisma.listingDocument.findFirst({
        where: { id: docId, listingId: id, replacedAt: null },
      });
      if (!doc) return sendError(reply, 404, "NOT_FOUND", "Document not found.");
      if (!["draft", "rejected"].includes(listing.status)) {
        return sendError(reply, 409, "CANNOT_DELETE", "Documents can only be removed from draft or rejected listings.");
      }

      await prisma.listingDocument.update({ where: { id: docId }, data: { replacedAt: new Date() } });
      return sendSuccess(reply, 200, { message: "Document removed." });
    } catch (err) {
      req.log.error({ err }, "Failed to remove listing document");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while removing document.");
    }
  });

  // GET /geocode — Geocoding proxy; accepts placeId, address, or lat+lng (UC-2.3)
  app.get("/geocode", {
    preHandler: [requireAuth],
    schema: {
      tags: ["Listings"],
      querystring: {
        type: "object",
        properties: {
          placeId: { type: "string" },
          address: { type: "string" },
          lat: { type: "string" },
          lng: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object", additionalProperties: true }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
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
    } catch (err) {
      req.log.error({ err }, "Geocoding query failed");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred during geocoding.");
    }
  });
}