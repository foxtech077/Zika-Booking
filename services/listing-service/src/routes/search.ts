import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, optionalGuest, type GuestRequest } from "../middleware/auth.js";
import { withSignedPhotos } from "../lib/s3.js";

// ── Geo helper ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

  // ── GET /search ──────────────────────────────────────────────────────────
  app.get("/search", { schema: { tags: ["Search"] }, preHandler: [optionalGuest] }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    // Filters
    const priceMin = q["price_min"] ? parseFloat(q["price_min"]) : undefined;
    const priceMax = q["price_max"] ? parseFloat(q["price_max"]) : undefined;
    const ratingMin = q["rating_min"] ? parseFloat(q["rating_min"]) : undefined;
    const cancellationPolicy = q["cancellation_policy"];
    const amenityIds = q["amenity_ids"] ? q["amenity_ids"].split(",") : undefined;
    // Hotel filters
    const starRatings = q["star_rating"] ? q["star_rating"].split(",").map(Number) : undefined;
    // Apartment filters
    const bedroomsMin = q["bedrooms_min"] ? parseInt(q["bedrooms_min"], 10) : undefined;
    const maxGuestsMin = q["max_guests_min"] ? parseInt(q["max_guests_min"], 10) : undefined;
    const longStayDiscount = q["long_stay_discount"] === "true";
    // Car filters
    const transmission = q["transmission"];
    const seatsMin = q["seats_min"] ? parseInt(q["seats_min"], 10) : undefined;
    const mileagePolicy = q["mileage_policy"];
    const carCategory = q["car_category"];
    const driveType = q["drive_type"];
    const airConditioning = q["air_conditioning"];
    const driverAge = q["driver_age"] ? parseInt(q["driver_age"], 10) : undefined;

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
      lat: { not: null },
      lng: { not: null },
    };
    // Category-aware price filtering
    const priceField = category === "car" ? "pricePerDay" : "pricePerNight";
    if (priceMin !== undefined) where[priceField] = { ...where[priceField], gte: priceMin };
    if (priceMax !== undefined) where[priceField] = { ...where[priceField], lte: priceMax };
    if (cancellationPolicy) where.cancellationPolicy = cancellationPolicy;
    if (starRatings?.length) where.starRating = { in: starRatings };
    if (bedroomsMin !== undefined) where.bedrooms = { gte: bedroomsMin };
    if (maxGuestsMin !== undefined) where.maxGuests = { gte: maxGuestsMin };
    if (longStayDiscount) where.longStayEnabled = true;
    if (transmission) where.transmission = transmission;
    if (seatsMin !== undefined) where.seats = { gte: seatsMin };
    if (mileagePolicy) where.mileagePolicy = mileagePolicy;
    if (carCategory) where.carCategory = carCategory;
    if (driveType) where.driveType = driveType;
    if (airConditioning !== undefined) where.airConditioning = airConditioning === "true";
    if (driverAge !== undefined) {
      where.OR = [
        { minimumDriverAge: null },
        { minimumDriverAge: { lte: driverAge } },
      ];
    }
    if (amenityIds?.length) {
      where.amenities = { some: { amenityKey: { in: amenityIds } } };
    }

    // Fetch candidates (wide net — geo filter in JS)
    const candidates = await prisma.listing.findMany({
      where,
      include: {
        photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 },
        amenities: true,
      },
      take: 500,
    });

    // Geo filter
    const withDistance = candidates
      .map((l) => ({
        ...l,
        distanceKm: haversineKm(lat, lng, Number(l.lat), Number(l.lng)),
      }))
      .filter((l) => l.distanceKm <= radiusKm);

    // Availability filter (when dates provided)
    const candidateIds = withDistance.map((l) => l.id);
    const bookedIds = await getBookedListingIds(
      candidateIds, checkIn, checkOut, pickupDatetime, returnDatetime,
    );
    const available = withDistance.filter((l) => !bookedIds.has(l.id));

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

    const results = page.map((l) => ({
      id: l.id,
      listingType: l.category,
      title: l.name,
      city: l.town,
      countryCode: l.country,
      distanceKm: Math.round(l.distanceKm * 10) / 10,
      primaryPhotoUrl: l.photos[0]?.cdnUrl ?? null,
      nightlyRate: l.category !== "car" && l.pricePerNight ? Number(l.pricePerNight) : null,
      dailyRate: l.category === "car" && l.pricePerDay ? Number(l.pricePerDay) : null,
      currency: l.currency,
      cancellationPolicy: l.cancellationPolicy,
      // Hotel
      starRating: l.starRating,
      isAccredited: !!l.approvedAt,
      roomType: l.roomType,
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
    }));

    return sendSuccess(reply, 200, {
      totalCount: total,
      availableCount: available.length,
      nextCursor,
      results,
    });
  });

  // ── GET /listings/:id/public — public listing detail ─────────────────────
  app.get("/listings/:id/public", { schema: { tags: ["Search"] }, preHandler: [optionalGuest] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const guestId = (req as GuestRequest).guestId;
    const { id } = req.params as { id: string };

    const listing = await prisma.listing.findUnique({
      where: { id, deletedAt: null },
      include: {
        photos: { where: { deletedAt: null }, orderBy: { position: "asc" } },
        amenities: true,
        customAmenities: true,
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

    const signedPhotos = await withSignedPhotos(listing.photos);

    // Strip sensitive car fields pre-booking
    const data: any = {
      ...listing,
      photos: signedPhotos,
      licencePlate: undefined, // Never expose car licence plate here
      isFavourited: guestId ? isFavourited : undefined,
    };
    if (data.licencePlate !== undefined) {
      delete data.licencePlate;
    }

    return sendSuccess(reply, 200, data);
  });

  // ── GET /listings/:id/availability ───────────────────────────────────────
  app.get("/listings/:id/availability", { schema: { tags: ["Search"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { month } = req.query as { month?: string };

    const listing = await prisma.listing.findUnique({ where: { id, deletedAt: null }, select: { id: true, status: true } });
    if (!listing) return sendError(reply, 404, "NOT_FOUND", "Listing not found.");

    // Build date range for the month query
    const now = new Date();
    let rangeStart = now;
    if (month) {
      const [y, m] = month.split("-").map(Number);
      rangeStart = new Date(y!, m! - 1, 1);
    }
    const rangeEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 3, 1); // 3 months forward

    const bookings = await prisma.booking.findMany({
      where: {
        listingId: id,
        status: { in: ["pending_payment", "confirmed"] as any },
        OR: [
          { checkIn: { gte: rangeStart, lt: rangeEnd }, checkOut: { not: null } },
          { pickupDatetime: { gte: rangeStart, lt: rangeEnd }, returnDatetime: { not: null } },
        ],
      },
      select: { checkIn: true, checkOut: true, pickupDatetime: true, returnDatetime: true },
    });

    const unavailableRanges = bookings.map((b) => ({
      start: (b.checkIn ?? b.pickupDatetime)?.toISOString().slice(0, 10) ?? null,
      end: (b.checkOut ?? b.returnDatetime)?.toISOString().slice(0, 10) ?? null,
    })).filter((r) => r.start && r.end);

    return sendSuccess(reply, 200, { unavailableRanges });
  });

  // ── POST /listings/batch-summary — for anonymous recently-viewed ─────────
  app.post("/listings/batch-summary", { schema: { tags: ["Search"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
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
        countryCode: l.country,
        nightlyRate: l.pricePerNight ? Number(l.pricePerNight) : null,
        currency: l.currency,
        primaryPhotoUrl: l.photos[0]?.cdnUrl ?? null,
      })),
    });
  });

  // ── Favourites ───────────────────────────────────────────────────────────

  app.post("/guests/me/favourites", { schema: { tags: ["Favourites"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  });

  app.delete("/guests/me/favourites/:listingId", { schema: { tags: ["Favourites"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).providerId as string;
    const { listingId } = req.params as { listingId: string };

    await prisma.userFavourite.deleteMany({ where: { userId, listingId } });
    reply.status(204).send();
  });

  app.get("/guests/me/favourites", { schema: { tags: ["Favourites"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
          countryCode: f.listing.country,
          nightlyRate: f.listing.pricePerNight ? Number(f.listing.pricePerNight) : null,
          currency: f.listing.currency,
          primaryPhotoUrl: f.listing.photos[0]?.cdnUrl ?? null,
        },
      })),
      nextCursor: hasMore ? String(cursor + limit) : null,
    });
  });

  // ── Recently Viewed ───────────────────────────────────────────────────────

  app.post("/guests/me/recently-viewed", { schema: { tags: ["Recently Viewed"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).providerId as string;
    const { listingId } = req.body as { listingId: string };

    const listing = await prisma.listing.findUnique({ where: { id: listingId, deletedAt: null } });
    if (!listing) return reply.status(204).send(); // silent on invalid

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

    reply.status(204).send();
  });

  app.get("/guests/me/recently-viewed", { schema: { tags: ["Recently Viewed"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
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
          nightlyRate: v.listing.pricePerNight ? Number(v.listing.pricePerNight) : null,
          currency: v.listing.currency,
          primaryPhotoUrl: v.listing.photos[0]?.cdnUrl ?? null,
        },
      })),
    });
  });

  app.post("/guests/me/recently-viewed/import", { schema: { tags: ["Recently Viewed"] }, preHandler: [requireProvider] }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    reply.status(204).send();
  });
}
