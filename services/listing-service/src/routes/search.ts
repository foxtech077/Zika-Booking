import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, optionalGuest, type GuestRequest } from "../middleware/auth.js";

import { DriveType, FuelType } from "../generated/index.js";

// ── Availability check ────────────────────────────────────────────────────────

async function getBookedListingIds(
  listingIds: string[],
  checkIn?: string,
  checkOut?: string,
  pickupDatetime?: string,
  returnDatetime?: string,
): Promise<Set<string>> {
  if (!listingIds.length) return new Set();

  // Hotels/apartments: date overlap
  if (checkIn && checkOut) {
    const booked = await prisma.booking.findMany({
      where: {
        listingId: { in: listingIds },
        status: { in: ["pending_payment", "confirmed"] as any },
        checkIn: { lt: new Date(checkOut) },
        checkOut: { gt: new Date(checkIn) },
      },
      select: { listingId: true },
    });
    return new Set(booked.map((b) => b.listingId));
  }

  // Cars: datetime overlap
  if (pickupDatetime && returnDatetime) {
    const booked = await prisma.booking.findMany({
      where: {
        listingId: { in: listingIds },
        status: { in: ["pending_payment", "confirmed"] as any },
        pickupDatetime: { lt: new Date(returnDatetime) },
        returnDatetime: { gt: new Date(pickupDatetime) },
      },
      select: { listingId: true },
    });
    return new Set(booked.map((b) => b.listingId));
  }

  return new Set();
}

// ── Route plugin ─────────────────────────────────────────────────────────────

export async function searchRoutes(app: FastifyInstance) {

  // ── Shared search handler ─────────────────────────────────────────────────
  // NOTE: The mobile app's listingApi has baseURL "https://api.kainook.com/listings",
  // so calling .get("/search") resolves to /listings/search. We register the
  // handler at both /search and /listings/search to cover both paths.
  async function handleSearch(req: FastifyRequest, reply: FastifyReply) {
    try {
      const guestId = (req as GuestRequest).guestId;
      const q = req.query as Record<string, string>;

    const category = q["category"] as string | undefined;
    const lat = parseFloat(q["lat"] ?? "");
    const lng = parseFloat(q["lng"] ?? "");
    const placeName = q["place_name"] ?? "";
    const radiusKm = parseInt(q["radius_km"] ?? "25", 10);
    const checkIn = q["check_in"];
    const checkOut = q["check_out"];
    const pickupDatetime = q["pickup_datetime"];
    const returnDatetime = q["return_datetime"];
    const guests = q["guests"] ? parseInt(q["guests"], 10) : undefined;
    const sort = q["sort"] ?? "recommended";
    const limit = Math.min(parseInt(q["limit"] ?? "20", 10), 50);
    const cursor = q["cursor"] ? parseInt(q["cursor"], 10) : 0;

    // Filters — common
    const priceMin = q["price_min"] ? parseFloat(q["price_min"]) : undefined;
    const priceMax = q["price_max"] ? parseFloat(q["price_max"]) : undefined;
    const ratingMin = q["rating_min"] ? parseFloat(q["rating_min"]) : undefined;
    const cancellationPolicy = q["cancellation_policy"];
    const amenityIds = q["amenity_ids"] ? q["amenity_ids"].split(",") : undefined;
    const smokingAllowed = q["smoking_allowed"];
    const petsAllowed = q["pets_allowed"];
    const roomType = q["room_type"];
    // Hotel filters
    const starRatings = q["star_rating"] ? q["star_rating"].split(",").map(Number) : undefined;
    // Apartment filters
    const bedroomsMin = q["bedrooms_min"] ? parseInt(q["bedrooms_min"], 10) : undefined;
    const bathroomsMin = q["bathrooms_min"] ? parseInt(q["bathrooms_min"], 10) : undefined;
    const maxGuestsMin = q["max_guests_min"] ? parseInt(q["max_guests_min"], 10) : undefined;
    const longStayDiscount = q["long_stay_discount"] === "true";
    const minStayNights = q["min_stay_nights"] ? parseInt(q["min_stay_nights"], 10) : undefined;
    // Car filters
    const carMake = q["car_make"];
    const carModel = q["car_model"];
    const transmission = q["transmission"];
    const fuelType = q["fuel_type"];
    const seatsMin = q["seats_min"] ? parseInt(q["seats_min"], 10) : undefined;
    const mileagePolicy = q["mileage_policy"];
    const carCategory = q["car_category"];
    const driveType = q["drive_type"];
    const airConditioning = q["air_conditioning"];
    const driverAge = q["driver_age"] ? parseInt(q["driver_age"], 10) : undefined;
    const minRentalDays = q["min_rental_days"] ? parseInt(q["min_rental_days"], 10) : undefined;
    const delivery = q["delivery"];

    if (!category || isNaN(lat) || isNaN(lng)) {
      return sendError(reply, 400, "INVALID_PARAMS", "category, lat, and lng are required.");
    }

    // Determine valid statuses per category
    const validStatuses = category === "hotel" ? ["approved"] : ["active"];

    // Build Prisma where clause
    const where: any = {
      deletedAt: null,
      category,
      status: { in: validStatuses },
    };
    // Category-aware price filtering
    const priceField = category === "car" ? "pricePerDay" : "pricePerNight";
    if (priceMin !== undefined) where[priceField] = { ...where[priceField], gte: priceMin };
    if (priceMax !== undefined) where[priceField] = { ...where[priceField], lte: priceMax };
    if (cancellationPolicy) where.cancellationPolicy = cancellationPolicy;
    if (roomType) {
      if (category === "hotel") {
        where.hotelRoomTypes = { some: { roomType: roomType as any, isActive: true } };
      } else {
        where.roomType = roomType;
      }
    }
    if (smokingAllowed !== undefined) where.smokingAllowed = smokingAllowed === "true";
    if (petsAllowed !== undefined) where.petsAllowed = petsAllowed === "true";
    // Hotel
    if (starRatings?.length) where.starRating = { in: starRatings };
    // Apartment
    if (bedroomsMin !== undefined) where.bedrooms = { gte: bedroomsMin };
    if (bathroomsMin !== undefined) where.bathrooms = { gte: bathroomsMin };
    if (maxGuestsMin !== undefined) where.maxGuests = { gte: maxGuestsMin };
    if (longStayDiscount) where.longStayEnabled = true;
    // Car
    if (carMake) where.carMake = { contains: carMake, mode: "insensitive" };
    if (carModel) where.carModel = { contains: carModel, mode: "insensitive" };
    if (transmission) where.transmission = transmission;
    if (fuelType) {
      const ftMap: Record<string, FuelType> = {
        petrol: FuelType.petrol, diesel: FuelType.diesel, electric: FuelType.electric,
        hybrid: FuelType.hybrid, lpg: FuelType.lpg,
      };
      if (ftMap[fuelType]) where.fuelType = ftMap[fuelType];
    }
    if (seatsMin !== undefined) where.seats = { gte: seatsMin };
    if (mileagePolicy) where.mileagePolicy = mileagePolicy;
    if (carCategory) where.carCategory = carCategory;
    if (driveType) {
      if (driveType === "2WD") where.driveType = DriveType.TWO_WD;
      else if (driveType === "4WD") where.driveType = DriveType.FOUR_WD;
      else if (driveType === "AWD") where.driveType = DriveType.AWD;
    }
    if (airConditioning !== undefined) where.airConditioning = airConditioning === "true";
    if (delivery !== undefined) where.deliveryEnabled = delivery === "true";
    // Nullable range guards — combined into AND so they don't overwrite each other
    const andClauses: any[] = [];
    if (amenityIds?.length) {
      const PREFIXES = ["Connectivity", "Food & Drink", "Wellness", "Comfort", "Services"];
      const seen = new Set<string>();
      for (const id of amenityIds) {
        const col = id.indexOf(":");
        const base = col === -1 ? id : id.slice(col + 1);
        if (!seen.has(base)) {
          seen.add(base);
          andClauses.push({
            amenities: { some: { amenityKey: { in: [base, ...PREFIXES.map(p => `${p}:${base}`)] } } }
          });
        }
      }
    }
    if (driverAge !== undefined) {
      andClauses.push({ OR: [{ minimumDriverAge: null }, { minimumDriverAge: { lte: driverAge } }] });
    }
    if (minRentalDays !== undefined) {
      andClauses.push({ OR: [{ minimumRentalDays: null }, { minimumRentalDays: { lte: minRentalDays } }] });
    }
    if (minStayNights !== undefined) {
      andClauses.push({ OR: [{ minStayNights: null }, { minStayNights: { lte: minStayNights } }] });
    }
    if (andClauses.length) where.AND = andClauses;

    // Fetch candidates (wide net — geo filter in JS)
    const candidates = await prisma.listing.findMany({
      where,
      include: {
        photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 },
        amenities: true,
        hotelRoomTypes: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
      take: 500,
    });

    // PostGIS geo filter — replaces in-memory Haversine
    const candidateIds = candidates.map((l) => l.id) as string[];
    let distanceMap = new Map<string, number>();
    if (candidateIds.length > 0) {
      const geoResults = await prisma.$queryRaw<Array<{ id: string; distance_km: number }>>`
        SELECT l.id,
          COALESCE(ST_Distance(l.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000, 0) AS distance_km
        FROM listing.listings l
        WHERE l.id = ANY(${candidateIds})
          AND (l.location IS NULL OR ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusKm * 1000}))
      `;
      distanceMap = new Map(geoResults.map((r) => [r.id, Number(r.distance_km)]));
    }
    const withDistance = candidates
      .filter((l) => distanceMap.has(l.id))
      .map((l) => ({ ...l, distanceKm: distanceMap.get(l.id) ?? 0 }));

    // Availability filter (when dates provided)
    const availIds = withDistance.map((l) => l.id);
    const bookedIds = await getBookedListingIds(
      availIds, checkIn, checkOut, pickupDatetime, returnDatetime,
    );
    let available = withDistance.filter((l) => !bookedIds.has(l.id));

    // Review rating post-filter (single aggregate query over the filtered set)
    if (ratingMin !== undefined) {
      const ratingAggs = await prisma.listingReview.groupBy({
        by: ["listingId"],
        where: { listingId: { in: available.map((l) => l.id) }, isHidden: false },
        _avg: { rating: true },
        having: { rating: { _avg: { gte: ratingMin } } },
      });
      const qualifiedIds = new Set(ratingAggs.map((r) => r.listingId));
      available = available.filter((l) => qualifiedIds.has(l.id));
    }

    // Sort
    const sortPriceField = category === "car" ? "pricePerDay" : "pricePerNight";
    let sorted = [...available];
    if (sort === "price_asc") sorted.sort((a, b) => Number((a as any)[sortPriceField] ?? 0) - Number((b as any)[sortPriceField] ?? 0));
    else if (sort === "price_desc") sorted.sort((a, b) => Number((b as any)[sortPriceField] ?? 0) - Number((a as any)[sortPriceField] ?? 0));
    else if (sort === "distance") sorted.sort((a, b) => a.distanceKm - b.distanceKm);
    else if (sort === "newest") sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    else sorted.sort((a, b) => a.distanceKm - b.distanceKm); // recommended default = nearest

    // Pagination (cursor = offset)
    const total = sorted.length;
    const page = sorted.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < total ? String(cursor + limit) : null;

    // Favourites enrichment
    let favouriteSet = new Set<string>();
    if (guestId) {
      const favs = await prisma.userFavourite.findMany({
        where: { userId: guestId, listingId: { in: page.map((l) => l.id) } },
        select: { listingId: true },
      });
      favouriteSet = new Set(favs.map((f) => f.listingId));
    }

    // Log search
    await prisma.searchLog.create({
      data: {
        userId: guestId ?? undefined,
        category,
        placeName,
        lat,
        lng,
        radiusKm,
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        pickupDatetime: pickupDatetime ? new Date(pickupDatetime) : undefined,
        returnDatetime: returnDatetime ? new Date(returnDatetime) : undefined,
        guests,
        sortApplied: sort,
        resultCount: total,
      },
    }).catch(() => { /* non-critical */ });

    // Fetch active promotion badge for this category (non-critical — never blocks search)
    let promoBadge: { labelText: string; labelColour: string } | null = null;
    try {
      const now = new Date();
      const promo = await (prisma as any).activityPromotion.findFirst({
        where: { activity: category, status: "active", validFrom: { lte: now }, validUntil: { gte: now } },
        orderBy: { createdAt: "desc" },
        select: { labelText: true, labelColour: true },
      });
      if (promo) promoBadge = { labelText: promo.labelText, labelColour: promo.labelColour };
    } catch { /* non-critical */ }

    const results = page.map((l) => {
      // Calculate nightly rate: use minimum room type price for hotels with room types
      let nightlyRate: number | null = null;
      if (l.category !== "car") {
        if (l.category === "hotel" && l.hotelRoomTypes.length > 0) {
          // Use the minimum pricePerNight across active room types
          nightlyRate = Math.min(...l.hotelRoomTypes.map((rt) => Number(rt.pricePerNight)));
        } else if (l.pricePerNight) {
          nightlyRate = Number(l.pricePerNight);
        }
      }

      return {
        id: l.id,
        listingType: l.category,
        title: l.name,
        city: l.town,
        neighborhood: l.neighborhood,
        countryCode: l.country,
        distanceKm: Math.round(l.distanceKm * 10) / 10,
        primaryPhotoUrl: l.photos[0]?.cdnUrl ?? null,
        nightlyRate,
        dailyRate: l.category === "car" && l.pricePerDay ? Number(l.pricePerDay) : null,
        currency: l.currency,
        cancellationPolicy: l.cancellationPolicy,
        // Hotel
        starRating: l.starRating,
        isAccredited: !!l.approvedAt,
        roomType: l.category === "hotel" ? null : l.roomType,
        roomTypes: l.category === "hotel"
          ? l.hotelRoomTypes.map((rt) => ({
              id: rt.id,
              name: rt.name,
              roomType: rt.roomType,
              pricePerNight: Number(rt.pricePerNight),
              unitCount: rt.unitCount,
              maxGuests: rt.maxGuests,
            }))
          : undefined,
        // Apartment
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        maxGuests: l.maxGuests,
        longStayDiscountEnabled: l.longStayEnabled,
        // Car
        carMake: l.carMake,
        carModel: l.carModel,
        carYear: l.carYear,
        transmission: l.transmission,
        seats: l.seats,
        mileagePolicy: l.mileagePolicy,
        // Favourited
        isFavourited: guestId ? favouriteSet.has(l.id) : undefined,
        // Promotion badge (null when no active campaign for this category)
        promoBadge,
      };
    });

    return sendSuccess(reply, 200, {
      totalCount: total,
      availableCount: available.length,
      nextCursor,
      results,
    });
    } catch (err) {
      req.log.error({ err }, "Failed to execute search");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while searching.");
    }
  }

  // Register at /search (direct service calls) and /listings/search (mobile app via listingApi)
  const searchOpts = {
    schema: {
      tags: ["Search"],
      querystring: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["hotel", "apartment", "car"], description: "Listing category (required)" },
          lat: { type: "number", description: "Latitude of search centre (required)" },
          lng: { type: "number", description: "Longitude of search centre (required)" },
          place_name: { type: "string", description: "Human-readable place name (for logging)" },
          radius_km: { type: "integer", default: 25, description: "Search radius in km (default 25)" },
          check_in: { type: "string", description: "Hotel/apartment check-in date (YYYY-MM-DD)" },
          check_out: { type: "string", description: "Hotel/apartment check-out date (YYYY-MM-DD)" },
          pickup_datetime: { type: "string", description: "Car pickup datetime (ISO 8601)" },
          return_datetime: { type: "string", description: "Car return datetime (ISO 8601)" },
          guests: { type: "integer", description: "Number of guests" },
          sort: {
            type: "string",
            enum: ["recommended", "price_asc", "price_desc", "distance", "newest"],
            default: "recommended",
            description: "Sort order",
          },
          limit: { type: "integer", default: 20, description: "Page size (max 50)" },
          cursor: { type: "integer", default: 0, description: "Pagination offset cursor" },
          price_min: { type: "number", description: "Minimum price per night/day" },
          price_max: { type: "number", description: "Maximum price per night/day" },
          rating_min: { type: "number", description: "Minimum average guest review rating (0–5). Only listings with rated reviews >= this value are returned." },
          cancellation_policy: { type: "string", description: "Cancellation policy filter" },
          amenity_ids: { type: "string", description: "Comma-separated amenity keys to require (e.g. wifi,pool)" },
          smoking_allowed: { type: "string", enum: ["true", "false"], description: "Filter by smoking policy" },
          pets_allowed: { type: "string", enum: ["true", "false"], description: "Filter by pet policy" },
          room_type: {
            type: "string",
            enum: ["standard", "superior", "deluxe", "suite", "junior_suite", "studio", "family_room", "presidential_suite"],
            description: "Hotel room type filter",
          },
          // Hotel filters
          star_rating: { type: "string", description: "Comma-separated hotel star classifications e.g. 3,4,5" },
          // Apartment filters
          bedrooms_min: { type: "integer", description: "Minimum number of bedrooms" },
          bathrooms_min: { type: "integer", description: "Minimum number of bathrooms" },
          max_guests_min: { type: "integer", description: "Minimum max-guests capacity" },
          long_stay_discount: { type: "string", enum: ["true", "false"], description: "Filter listings that have a long-stay discount enabled" },
          min_stay_nights: { type: "integer", description: "User's planned stay duration in nights — filters out listings that require more than this many nights minimum" },
          // Car filters
          car_make: { type: "string", description: "Car brand/make (case-insensitive partial match, e.g. Toyota)" },
          car_model: { type: "string", description: "Car model (case-insensitive partial match, e.g. Hilux)" },
          transmission: { type: "string", enum: ["automatic", "manual", "semi_auto"], description: "Transmission type" },
          fuel_type: { type: "string", enum: ["petrol", "diesel", "electric", "hybrid", "lpg"], description: "Fuel type filter" },
          seats_min: { type: "integer", description: "Minimum number of seats" },
          mileage_policy: { type: "string", enum: ["unlimited", "limited"], description: "Mileage policy filter" },
          car_category: { type: "string", enum: ["Economy", "Compact", "SUV", "Minivan", "Pickup", "Luxury", "Electric", "Convertible"], description: "Car category" },
          drive_type: { type: "string", enum: ["2WD", "4WD", "AWD"], description: "Drive type" },
          air_conditioning: { type: "string", enum: ["true", "false"], description: "Air conditioning filter" },
          driver_age: { type: "integer", description: "Driver age — filters out listings with minimum driver age requirement above this value" },
          min_rental_days: { type: "integer", description: "User's planned rental duration in days — filters out listings that require more than this many days minimum" },
          delivery: { type: "string", enum: ["true", "false"], description: "Filter by delivery availability" },
        },
        required: ["category", "lat", "lng"],
      },
    },
    preHandler: [optionalGuest],
  };
  app.get("/search", searchOpts, handleSearch);
  app.get("/listings/search", searchOpts, handleSearch);

  // ── GET /listings/:id/public — public listing detail ─────────────────────
  app.get(
    "/listings/:id/public",
    {
      schema: {
        tags: ["Search"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", description: "Listing ID" },
          },
          required: ["id"],
        },
      },
      preHandler: [optionalGuest],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const guestId = (req as GuestRequest).guestId;
        const { id } = req.params as { id: string };

      const listing = await prisma.listing.findUnique({
        where: { id, deletedAt: null },
        include: {
          photos: { where: { deletedAt: null }, orderBy: { position: "asc" } },
          amenities: true,
          customAmenities: true,
          hotelRoomTypes: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        },
      });

      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      const validStatuses = ["approved", "active"];
      if (!validStatuses.includes(listing.status)) {
        return reply.status(410).send({
          success: false,
          error: { code: "LISTING_INACTIVE", message: "This listing is no longer available." },
        });
      }

      let isFavourited = false;
      if (guestId) {
        const fav = await prisma.userFavourite.findUnique({ where: { userId_listingId: { userId: guestId, listingId: id } } });
        isFavourited = !!fav;
      }

      const listingPhotos = listing.photos;

      // Fetch active promotion badge for this category
      let promoBadge: { labelText: string; labelColour: string } | null = null;
      try {
        const now = new Date();
        const promo = await (prisma as any).activityPromotion.findFirst({
          where: { activity: listing.category, status: "active", validFrom: { lte: now }, validUntil: { gte: now } },
          orderBy: { createdAt: "desc" },
          select: { labelText: true, labelColour: true },
        });
        if (promo) promoBadge = { labelText: promo.labelText, labelColour: promo.labelColour };
      } catch { /* non-critical */ }

      // Strip sensitive car fields pre-booking
      const data: any = {
        ...listing,
        photos: listingPhotos,
        licencePlate: undefined,
        isFavourited: guestId ? isFavourited : undefined,
        // Add basic information aliases to match /listings/search
        listingType: listing.category,
        title: listing.name,
        city: listing.town,
        neighborhood: listing.neighborhood,
        countryCode: listing.country,
        primaryPhotoUrl: listingPhotos[0]?.cdnUrl ?? null,
        nightlyRate: listing.category !== "car"
          ? (listing.category === "hotel" && listing.hotelRoomTypes.length > 0
              ? Math.min(...listing.hotelRoomTypes.map((rt) => Number(rt.pricePerNight)))
              : (listing.pricePerNight ? Number(listing.pricePerNight) : null))
          : null,
        dailyRate: listing.category === "car" && listing.pricePerDay ? Number(listing.pricePerDay) : null,
        roomTypes: listing.category === "hotel"
          ? listing.hotelRoomTypes.map((rt) => ({
              id: rt.id,
              name: rt.name,
              roomType: rt.roomType,
              pricePerNight: Number(rt.pricePerNight),
              unitCount: rt.unitCount,
              maxGuests: rt.maxGuests,
            }))
          : undefined,
        isAccredited: !!listing.approvedAt,
        longStayDiscountEnabled: listing.longStayEnabled,
        promoBadge,
      };
      if (data.licencePlate !== undefined) {
        delete data.licencePlate;
      }

      return sendSuccess(reply, 200, data);
      } catch (err) {
        req.log.error({ err }, "Failed to fetch public listing details");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching listing details.");
      }
    },
  );

  // ── GET /listings/:id/availability ───────────────────────────────────────
  const LOCK_TTL_MS = 300_000; // 5 minutes — must match bookings.ts

  function nextDay(dateStr: string): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  app.get(
    "/listings/:id/availability",
    {
      schema: {
        tags: ["Search"],
        params: {
          type: "object",
          properties: {
            id: { type: "string", description: "Listing ID" },
          },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            month: { type: "string", description: "Month to query availability (YYYY-MM). Defaults to current month. Returns 3 months forward." },
            start: { type: "string", description: "Start date (YYYY-MM-DD). Overrides month-based window." },
            end: { type: "string", description: "End date (YYYY-MM-DD). Overrides month-based window." },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };
        const { month, start, end } = req.query as { month?: string; start?: string; end?: string };

      const listing = await prisma.listing.findUnique({
        where: { id, deletedAt: null },
        select: { id: true, status: true, unitCount: true, category: true },
      });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      const now = new Date();
      let rangeStart: Date;
      let rangeEnd: Date;

      if (start && end) {
        rangeStart = new Date(start);
        rangeEnd = new Date(end);
      } else if (month) {
        const [y, m] = month.split("-").map(Number);
        rangeStart = new Date(y!, m! - 1, 1);
        rangeEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 3, 1);
      } else {
        rangeStart = now;
        rangeEnd = new Date(now.getFullYear(), now.getMonth() + 3, 1);
      }

      const pendingExpiry = new Date(Date.now() - LOCK_TTL_MS);

      // If listing has room types, return per-room-type availability
      if (listing.category === "hotel") {
        const roomTypes = await prisma.hotelRoomType.findMany({
          where: { listingId: id, isActive: true },
          orderBy: { sortOrder: "asc" },
        });

        if (roomTypes.length === 0) {
          return sendSuccess(reply, 200, { roomTypeAvailability: [] });
        }

        const roomTypeIds = roomTypes.map((rt) => rt.id);

        // Fetch bookings grouped by roomTypeId
        const bookings = await prisma.$queryRawUnsafe<{
          room_type_id: string | null;
          check_in: Date | null;
          check_out: Date | null;
          pickup_datetime: Date | null;
          return_datetime: Date | null;
        }[]>(`
          SELECT room_type_id, check_in, check_out, pickup_datetime, return_datetime
          FROM bookings
          WHERE listing_id = $1
            AND room_type_id IS NOT NULL
            AND (
              status = 'confirmed'
              OR status = 'checked_in'
              OR (status = 'pending_payment' AND created_at > $4)
            )
            AND (
              (check_in IS NOT NULL AND check_in < $3 AND check_out > $2)
              OR (pickup_datetime IS NOT NULL AND pickup_datetime < $3 AND return_datetime > $2)
            )
        `, id, rangeStart, rangeEnd, pendingExpiry);

        // Fetch iCal blocked dates (affects ALL room types)
        const blockedDates = await prisma.icalBlockedDate.findMany({
          where: {
            listingId: id,
            startDate: { lt: rangeEnd },
            endDate: { gt: rangeStart },
          },
          select: { startDate: true, endDate: true },
        });

        // Build per-room-type availability
        const roomTypeAvailability = roomTypes.map((rt) => {
          const dayCounts = new Map<string, number>();

          function addRange(start: Date, end: Date) {
            const cur = new Date(start);
            while (cur < end) {
              const key = cur.toISOString().slice(0, 10);
              dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
              cur.setDate(cur.getDate() + 1);
            }
          }

          // Add bookings for this room type
          for (const b of bookings) {
            if (b.room_type_id === rt.id) {
              const s = b.check_in ?? b.pickup_datetime;
              const e = b.check_out ?? b.return_datetime;
              if (s && e) addRange(s, e);
            }
          }

          // Add iCal blocked dates (affects all room types)
          for (const bd of blockedDates) {
            addRange(bd.startDate, bd.endDate);
          }

          // Only mark a day unavailable when all units of this room type are taken
          const unavailableDays: string[] = [];
          for (const [day, count] of dayCounts) {
            if (count >= rt.unitCount) unavailableDays.push(day);
          }

          // Group consecutive days into ranges
          unavailableDays.sort();
          const unavailableRanges: { start: string; end: string }[] = [];
          let cur: { start: string; end: string } | null = null;
          for (const day of unavailableDays) {
            if (!cur || day > nextDay(cur.end)) {
              if (cur) unavailableRanges.push(cur);
              cur = { start: day, end: day };
            } else {
              cur!.end = day;
            }
          }
          if (cur) unavailableRanges.push(cur);

          return {
            roomTypeId: rt.id,
            roomType: rt.roomType,
            name: rt.name,
            unitCount: rt.unitCount,
            unavailableRanges,
          };
        });

        return sendSuccess(reply, 200, { roomTypeAvailability });
      }

      // Legacy: no room types — return single unavailable ranges
      const unitCount = Math.max(1, listing.unitCount ?? 1);

      const [bookings, blockedDates] = await Promise.all([
        prisma.$queryRawUnsafe<{ check_in: Date | null; check_out: Date | null; pickup_datetime: Date | null; return_datetime: Date | null }[]>(`
          SELECT check_in, check_out, pickup_datetime, return_datetime
          FROM bookings
          WHERE listing_id = $1
            AND (
              status = 'confirmed'
              OR status = 'checked_in'
              OR (status = 'pending_payment' AND created_at > $4)
            )
            AND (
              (check_in IS NOT NULL AND check_in < $3 AND check_out > $2)
              OR (pickup_datetime IS NOT NULL AND pickup_datetime < $3 AND return_datetime > $2)
            )
        `, id, rangeStart, rangeEnd, pendingExpiry),
        prisma.icalBlockedDate.findMany({
          where: {
            listingId: id,
            startDate: { lt: rangeEnd },
            endDate: { gt: rangeStart },
          },
          select: { startDate: true, endDate: true },
        }),
      ]);

      // Build per-day overlap counts
      const dayCounts = new Map<string, number>();

      function addRange(start: Date, end: Date) {
        const cur = new Date(start);
        while (cur < end) {
          const key = cur.toISOString().slice(0, 10);
          dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
          cur.setDate(cur.getDate() + 1);
        }
      }

      for (const b of bookings) {
        const s = b.check_in ?? b.pickup_datetime;
        const e = b.check_out ?? b.return_datetime;
        if (s && e) addRange(s, e);
      }
      for (const bd of blockedDates) {
        addRange(bd.startDate, bd.endDate);
      }

      // Only mark a day unavailable when all units are taken
      const unavailableDays: string[] = [];
      for (const [day, count] of dayCounts) {
        if (count >= unitCount) unavailableDays.push(day);
      }

      // Group consecutive days into ranges
      unavailableDays.sort();
      const unavailableRanges: { start: string; end: string }[] = [];
      let cur: { start: string; end: string } | null = null;
      for (const day of unavailableDays) {
        if (!cur || day > nextDay(cur.end)) {
          if (cur) unavailableRanges.push(cur);
          cur = { start: day, end: day };
        } else {
          cur.end = day;
        }
      }
      if (cur) unavailableRanges.push(cur);

      return sendSuccess(reply, 200, { unavailableRanges });

      } catch (err) {
        req.log.error({ err }, "Failed to fetch listing availability");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching availability.");
      }
    },
  );

  // ── POST /listings/batch-summary — for anonymous recently-viewed ─────────
  app.post(
    "/listings/batch-summary",
    {
      schema: {
        tags: ["Search"],
        body: {
          type: "object",
          properties: {
            ids: {
              type: "array",
              items: { type: "string" },
              maxItems: 20,
              description: "Array of listing IDs (max 20)",
            },
          },
          required: ["ids"],
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = req.body as { ids?: string[] };
        const ids = (body.ids ?? []).slice(0, 20);
      if (!ids.length) return sendSuccess(reply, 200, { listings: [] });

      const listings = await prisma.listing.findMany({
        where: { id: { in: ids }, deletedAt: null, status: { in: ["approved", "active"] } },
        include: { photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 } },
      });

      return sendSuccess(reply, 200, {
        listings: listings.map((l) => ({
          id: l.id,
          title: l.name,
          category: l.category,
          city: l.town,
          neighborhood: l.neighborhood,
          countryCode: l.country,
          nightlyRate: l.pricePerNight ? Number(l.pricePerNight) : null,
          currency: l.currency,
          primaryPhotoUrl: l.photos[0]?.cdnUrl ?? null,
        })),
      });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch batch listing summaries");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching listing summaries.");
      }
    },
  );

  // ── Favourites ───────────────────────────────────────────────────────────

  app.post(
    "/guests/me/favourites",
    {
      schema: {
        tags: ["Favourites"],
        body: {
          type: "object",
          properties: {
            listingId: { type: "string", description: "Listing ID to favourite" },
          },
          required: ["listingId"],
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as any).providerId as string;
        const { listingId } = req.body as { listingId: string };

      const listing = await prisma.listing.findUnique({ where: { id: listingId, deletedAt: null } });
      if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

      await prisma.userFavourite.upsert({
        where: { userId_listingId: { userId, listingId } },
        create: { userId, listingId },
        update: {},
      });

      return sendSuccess(reply, 201, { message: "Saved to favourites." });
      } catch (err) {
        req.log.error({ err }, "Failed to save favourite listing");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while saving favourite.");
      }
    },
  );

  app.delete(
    "/guests/me/favourites/:listingId",
    {
      schema: {
        tags: ["Favourites"],
        params: {
          type: "object",
          properties: {
            listingId: { type: "string", description: "Listing ID to remove from favourites" },
          },
          required: ["listingId"],
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as any).providerId as string;
        const { listingId } = req.params as { listingId: string };

      await prisma.userFavourite.deleteMany({ where: { userId, listingId } });
      return sendSuccess(reply, 200, { message: "Favourite removed successfully." });
      } catch (err) {
        req.log.error({ err }, "Failed to remove favourite listing");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while removing favourite.");
      }
    },
  );

  app.get(
    "/guests/me/favourites",
    {
      schema: {
        tags: ["Favourites"],
        querystring: {
          type: "object",
          properties: {
            cursor: { type: "integer", default: 0, description: "Pagination offset cursor" },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as any).providerId as string;
        const q = req.query as Record<string, string>;
      const cursor = q["cursor"] ? parseInt(q["cursor"], 10) : 0;
      const limit = 20;

      const favs = await prisma.userFavourite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: cursor,
        take: limit + 1,
        include: {
          listing: {
            include: { photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 } },
          },
        },
      });

      const hasMore = favs.length > limit;
      const page = hasMore ? favs.slice(0, limit) : favs;

      return sendSuccess(reply, 200, {
        favourites: page.map((f) => ({
          listingId: f.listingId,
          savedAt: f.createdAt,
          listing: {
            id: f.listing.id,
            title: f.listing.name,
            category: f.listing.category,
            status: f.listing.status,
            city: f.listing.town,
            neighborhood: f.listing.neighborhood,
            countryCode: f.listing.country,
            nightlyRate: f.listing.pricePerNight ? Number(f.listing.pricePerNight) : null,
            currency: f.listing.currency,
            primaryPhotoUrl: f.listing.photos[0]?.cdnUrl ?? null,
          },
        })),
        nextCursor: hasMore ? String(cursor + limit) : null,
      });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch favourite listings");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching favourites.");
      }
    },
  );

  // ── Recently Viewed ───────────────────────────────────────────────────────

  app.post(
    "/guests/me/recently-viewed",
    {
      schema: {
        tags: ["Recently Viewed"],
        body: {
          type: "object",
          properties: {
            listingId: { type: "string", description: "Listing ID to mark as recently viewed" },
          },
          required: ["listingId"],
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as any).providerId as string;
        const { listingId } = req.body as { listingId: string };

      const listing = await prisma.listing.findUnique({ where: { id: listingId, deletedAt: null } });
      if (!listing) return reply.status(204).send();

      await prisma.userRecentlyViewed.upsert({
        where: { userId_listingId: { userId, listingId } },
        create: { userId, listingId },
        update: { viewedAt: new Date() },
      });

      // Prune to last 20
      const all = await prisma.userRecentlyViewed.findMany({
        where: { userId },
        orderBy: { viewedAt: "desc" },
        select: { listingId: true },
      });
      if (all.length > 20) {
        const toDelete = all.slice(20).map((r) => r.listingId);
        await prisma.userRecentlyViewed.deleteMany({ where: { userId, listingId: { in: toDelete } } });
      }

      return sendSuccess(reply, 200, { message: "Recently viewed updated." });
      } catch (err) {
        req.log.error({ err }, "Failed to update recently viewed listing");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while updating recently viewed.");
      }
    },
  );

  app.get(
    "/guests/me/recently-viewed",
    {
      schema: {
        tags: ["Recently Viewed"],
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as any).providerId as string;

      const views = await prisma.userRecentlyViewed.findMany({
        where: { userId },
        orderBy: { viewedAt: "desc" },
        take: 20,
        include: {
          listing: {
            include: { photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 } },
          },
        },
      });

      return sendSuccess(reply, 200, {
        recentlyViewed: views.map((v) => ({
          listingId: v.listingId,
          viewedAt: v.viewedAt,
          listing: {
            id: v.listing.id,
            title: v.listing.name,
            category: v.listing.category,
            status: v.listing.status,
            city: v.listing.town,
            neighborhood: v.listing.neighborhood,
            nightlyRate: v.listing.pricePerNight ? Number(v.listing.pricePerNight) : null,
            currency: v.listing.currency,
            primaryPhotoUrl: v.listing.photos[0]?.cdnUrl ?? null,
          },
        })),
      });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch recently viewed listings");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching recently viewed.");
      }
    },
  );

  app.post(
    "/guests/me/recently-viewed/import",
    {
      schema: {
        tags: ["Recently Viewed"],
        body: {
          type: "object",
          properties: {
            items: {
              type: "array",
              maxItems: 20,
              description: "Array of recently viewed items to import (max 20)",
              items: {
                type: "object",
                properties: {
                  listingId: { type: "string" },
                  viewedAt: { type: "string", description: "ISO 8601 datetime" },
                },
                required: ["listingId", "viewedAt"],
              },
            },
          },
          required: ["items"],
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as any).providerId as string;
        const { items } = req.body as { items: { listingId: string; viewedAt: string }[] };

      if (!Array.isArray(items)) return sendError(reply, 400, "INVALID_BODY", "items array required.");

      for (const item of items.slice(0, 20)) {
        const listing = await prisma.listing.findUnique({ where: { id: item.listingId, deletedAt: null } });
        if (!listing) continue;
        await prisma.userRecentlyViewed.upsert({
          where: { userId_listingId: { userId, listingId: item.listingId } },
          create: { userId, listingId: item.listingId, viewedAt: new Date(item.viewedAt) },
          update: { viewedAt: new Date(item.viewedAt) },
        });
      }

      return sendSuccess(reply, 200, {
        message: "Recently viewed imported successfully.",
        importedCount: items.slice(0, 20).length,
      });
      } catch (err) {
        req.log.error({ err }, "Failed to import recently viewed listings");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while importing recently viewed.");
      }
    },
  );
}