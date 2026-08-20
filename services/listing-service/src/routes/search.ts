import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireUser, optionalAuth, type AuthRequest } from "../middleware/auth.js";
import { getCommissionRate, getCommissionRateBatch } from "./bookings.js";
import { SERVICE_FEE_RATE } from "../services/billing.service.js";
import { getRatesBatch, getExchangeRate, ceilingForCurrency, getConvertedAmounts, getLocalizedContext } from "../services/exchangeRate.services.js";
import { buildPriceFilter, buildGuestPriceExpr } from "../lib/priceFilter.js";
import { buildUserRatingFilterClause, userRatingsOrderExpr } from "../lib/searchFilters.js";

// ── Route plugin ─────────────────────────────────────────────────────────────

export async function searchRoutes(app: FastifyInstance) {

  // ── Shared search handler ─────────────────────────────────────────────────
  // NOTE: The mobile app's listingApi has baseURL "https://api.kainook.com/listings",
  // so calling .get("/search") resolves to /listings/search. We register the
  // handler at both /search and /listings/search to cover both paths.
  async function handleSearch(req: FastifyRequest, reply: FastifyReply) {
    try {
      const guestId = (req as AuthRequest).authId;
      const q = req.query as Record<string, string>;

    const category = q["category"] as string | undefined;
    const lat = parseFloat(q["lat"] ?? "");
    const lng = parseFloat(q["lng"] ?? "");
    const placeName = q["place_name"] ?? "";
    // Free-text search. Matches listing name as well as location fields,
    // because the box is commonly used for both.
    const textQuery = (q["q"] ?? "").trim();
    // Whether the typed destination resolved to a real geocoded location.
    // Only a resolved place unlocks the "nearby" fallback; an unresolved
    // text query returns exact/partial matches only so junk never returns
    // the entire category.
    const placeResolved = q["place_resolved"] === "true";
    // Radius is optional — when omitted, results are ranked nearest-first with
    // no distance cap (the historical 20000km default that faked a global sort).
    const radiusKm = q["radius_km"] ? parseInt(q["radius_km"], 10) : undefined;
    // ~half Earth's circumference: the "give up on locality" tier.
    const GLOBAL_RADIUS_KM = 20100;
    // Airbnb-style page fill: stop widening once this many results exist.
    const MIN_AREA_RESULTS = 6;
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
    const airportPickup = q["airport_pickup"];
    const instantBooking = q["instant_booking"];
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
    const targetCurrency = q["currency"]?.toUpperCase() || null;

    if (!category) {
      return sendError(reply, 400, "INVALID_PARAMS", "category is required.");
    }

    // Determine valid statuses per category
    const validStatuses = category === "hotel" ? ["approved"] : ["active"];

    // ── Single SQL search core ──────────────────────────────────────────────
    // All filtering, ranking (exact → partial → nearby), availability and
    // rating are computed in Postgres. Only the requested page is ever held in
    // memory — no wide-net candidate load.
    const priceCol = category === "car" ? "price_per_day" : "price_per_night";

    let p = 0;
    const next = () => `$${++p}`;
    const params: unknown[] = [];
    const where: string[] = ["l.deleted_at IS NULL"];
    const push = (cond: string, ...vals: unknown[]) => {
      where.push(cond);
      params.push(...vals);
    };

    push(`l.category::text = ${next()}`, category);
    push(`l.status::text = ANY(${next()})`, validStatuses);

    // Category-aware price filtering — applied to the guest-payable price
    // (raw list price, converted to the requested currency, ceiling-
    // rounded), i.e. the exact `localizedNightlyRate`/`localizedDailyRate`
    // values the response exposes, minus the client-side promo badge (a
    // category-wide label, not a per-booking guarantee). This prevents a
    // `price_max` bound in the display currency from leaking listings whose
    // displayed localized price exceeds it (e.g. a 1.0 KYD listing at 10%
    // commission returned as $1.33 USD under price_max=1).
    let priceJoins = "";
    if (priceMin !== undefined || priceMax !== undefined) {
      const usdToTargetRate = targetCurrency ? await getExchangeRate("USD", targetCurrency) : null;
      const priceFilter = buildPriceFilter({
        category,
        priceMin,
        priceMax,
        targetCurrency,
        usdToTargetRate,
        next,
      });
      priceJoins = priceFilter.joins;
      if (priceFilter.clause) {
        push(priceFilter.clause);
        params.push(...priceFilter.params);
      }
    }
    if (cancellationPolicy) push(`l.cancellation_policy::text = ${next()}`, cancellationPolicy);
    if (roomType) {
      if (category === "hotel") {
        push(
          `EXISTS (SELECT 1 FROM listing.hotel_room_types hrt WHERE hrt.listing_id = l.id AND hrt.room_type::text = ${next()} AND hrt.is_active = true)`,
          roomType,
        );
      } else {
        push(`l.room_type::text = ${next()}`, roomType);
      }
    }
    if (smokingAllowed !== undefined) push(`l.smoking_allowed = ${next()}`, smokingAllowed === "true");
    if (petsAllowed !== undefined) push(`l.pets_allowed = ${next()}`, petsAllowed === "true");
    // Hotel
    if (starRatings?.length) {
      const ph = starRatings.map(() => next()).join(", ");
      push(`l.star_rating IN (${ph})`, ...starRatings);
    }
    // Apartment
    if (bedroomsMin !== undefined) push(`l.bedrooms >= ${next()}`, bedroomsMin);
    if (bathroomsMin !== undefined) push(`l.bathrooms >= ${next()}`, bathroomsMin);
    if (maxGuestsMin !== undefined) push(`l.max_guests >= ${next()}`, maxGuestsMin);
    if (longStayDiscount) push(`l.long_stay_discount_enabled = true`);
    // Car
    if (carMake) push(`l.car_make ILIKE ${next()}`, `%${carMake}%`);
    if (carModel) push(`l.car_model ILIKE ${next()}`, `%${carModel}%`);
    if (transmission) push(`l.transmission::text = ${next()}`, transmission);
    if (fuelType) {
      const ftMap: Record<string, string> = {
        petrol: "petrol", diesel: "diesel", electric: "electric",
        hybrid: "hybrid", lpg: "lpg",
      };
      if (ftMap[fuelType]) push(`l.fuel_type::text = ${next()}`, ftMap[fuelType]);
    }
    if (seatsMin !== undefined) push(`l.seats >= ${next()}`, seatsMin);
    if (mileagePolicy) push(`l.mileage_policy::text = ${next()}`, mileagePolicy);
    if (carCategory) push(`l.car_category::text = ${next()}`, carCategory);
    if (driveType) {
      const driveMap: Record<string, string> = { "2WD": "2WD", "4WD": "4WD", AWD: "AWD" };
      if (driveMap[driveType]) push(`l.drive_type::text = ${next()}`, driveMap[driveType]);
    }
    if (airConditioning !== undefined) push(`l.air_conditioning = ${next()}`, airConditioning === "true");
    if (delivery !== undefined) push(`l.delivery_enabled = ${next()}`, delivery === "true");
    if (airportPickup !== undefined) push(`l.airport_pickup = ${next()}`, airportPickup === "true");
    if (instantBooking !== undefined) push(`l.instant_booking = ${next()}`, instantBooking === "true");
    // Amenities — each requested key is an EXISTS over the join table
    if (amenityIds?.length) {
      const PREFIXES = ["Connectivity", "Food & Drink", "Wellness", "Comfort", "Services"];
      const seen = new Set<string>();
      for (const id of amenityIds) {
        const col = id.indexOf(":");
        const base = col === -1 ? id : id.slice(col + 1);
        if (!seen.has(base)) {
          seen.add(base);
          const keys = [base, ...PREFIXES.map((prefix) => `${prefix}:${base}`)];
          const ph = keys.map(() => next()).join(", ");
          push(
            `EXISTS (SELECT 1 FROM listing.listing_amenities la WHERE la.listing_id = l.id AND la.amenity_key IN (${ph}))`,
            ...keys,
          );
        }
      }
    }
    // Nullable range guards
    if (driverAge !== undefined) push(`(l.minimum_driver_age IS NULL OR l.minimum_driver_age <= ${next()})`, driverAge);
    if (minRentalDays !== undefined) push(`(l.minimum_rental_days IS NULL OR l.minimum_rental_days <= ${next()})`, minRentalDays);
    if (minStayNights !== undefined) push(`(l.min_stay_nights IS NULL OR l.min_stay_nights <= ${next()})`, minStayNights);

    // Availability — overlapping bookings excluded at the SQL level
    if (checkIn && checkOut) {
      const inRef = next();
      const outRef = next();
      push(
        `NOT EXISTS (SELECT 1 FROM listing.bookings b WHERE b.listing_id = l.id AND b.status IN ('pending_payment', 'confirmed') AND b.check_in < ${outRef} AND b.check_out > ${inRef})`,
        new Date(checkIn),
        new Date(checkOut),
      );
    }
    if (pickupDatetime && returnDatetime) {
      const inRef = next();
      const outRef = next();
      push(
        `NOT EXISTS (SELECT 1 FROM listing.bookings b WHERE b.listing_id = l.id AND b.status IN ('pending_payment', 'confirmed') AND b.pickup_datetime < ${outRef} AND b.return_datetime > ${inRef})`,
        new Date(pickupDatetime),
        new Date(returnDatetime),
      );
    }

    // User rating (guest review score) — explicit NULL semantics: listings
    // without visible reviews are excluded when a threshold is applied, and the
    // clause states that directly (COALESCE sentinel) instead of relying on
    // three-valued logic. Correlated subquery keeps the COUNT query correct
    // beside LIMIT/OFFSET.
    if (ratingMin !== undefined) {
      push(buildUserRatingFilterClause(next, ratingMin), ratingMin);
    }

    // Geo anchor (optional) — distance ranking needs both coordinates. No
    // artificial radius cap: radius_km narrows only when explicitly chosen,
    // otherwise results sort nearest-first.
    //
    // For a text query the anchor is only trustworthy when the typed place
    // actually resolved (place_resolved=true) — otherwise we run in text-only
    // mode (exact/partial matches only) so an unresolved/junk term never
    // returns the whole category disguised as "nearby".
    const hasGeoCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const textOnly = !!textQuery && !(placeResolved && hasGeoCoords);
    const hasGeo = hasGeoCoords && !textOnly;
    let lngRef: string | null = null;
    let latRef: string | null = null;
    // Airbnb-style adaptive area: when the caller gives an anchor but no
    // explicit radius, start local and widen only until a page's worth of
    // results exists. A fixed radius fails both ways on a sparse inventory —
    // 200 km returns nothing almost everywhere, and an Earth-sized one turns
    // "near Kollam" into a list of the whole planet.
    const ADAPTIVE_TIERS_KM = [100, 500, 2000, GLOBAL_RADIUS_KM];
    const adaptive = hasGeo && !radiusKm;
    let radiusParamIdx: number | null = null;
    if (hasGeo) {
      lngRef = next();
      params.push(lng);
      latRef = next();
      params.push(lat);
      if (radiusKm || adaptive) {
        push(
          `(l.location IS NULL OR public.ST_DWithin(l.location, public.ST_SetSRID(public.ST_MakePoint(${lngRef}, ${latRef}), 4326)::public.geography, ${next()}))`,
          (radiusKm ?? ADAPTIVE_TIERS_KM[0]!) * 1000,
        );
        // The tier loop below rebinds this single value; indexes of every
        // other param stay untouched.
        radiusParamIdx = params.length - 1;
      }
    }

    // Free-text rank — accent-insensitive via the immutable f_unaccent wrapper
    // (unaccent itself is not immutable, so it cannot be indexed directly).
    let textRankExpr = "0 AS text_rank";
    if (textQuery) {
      const normQ = `public.f_unaccent(lower(${next()}))`;
      params.push(textQuery);
      const fields = ["l.name", "l.town", "l.neighborhood", "l.address"];
      const exact = fields.map((f) => `public.f_unaccent(lower(${f})) = ${normQ}`);
      const partial = fields.map((f) => `public.f_unaccent(lower(${f})) LIKE '%' || ${normQ} || '%'`);
      textRankExpr = `CASE WHEN ${exact.join(" OR ")} THEN 0 WHEN ${partial.join(" OR ")} THEN 1 ELSE 2 END AS text_rank`;
      // Text-only mode: the destination did not resolve to a real location, so
      // only genuine text matches (exact/partial) are eligible — no nearby fill.
      if (textOnly) {
        push(`(${exact.join(" OR ")} OR ${partial.join(" OR ")})`);
      }
    }

    const pointExpr = hasGeo && lngRef && latRef
      ? `public.ST_SetSRID(public.ST_MakePoint(${lngRef}, ${latRef}), 4326)::public.geography`
      : null;
    const distanceExpr = pointExpr
      ? `COALESCE(public.ST_Distance(l.location, ${pointExpr}) / 1000, 999999) AS distance_km`
      : "NULL::double precision AS distance_km";
    const latExpr = hasGeo ? "public.ST_Y(l.location::public.geometry) AS lat" : "NULL::double precision AS lat";
    const lngExpr = hasGeo ? "public.ST_X(l.location::public.geometry) AS lng" : "NULL::double precision AS lng";

    const whereSql = where.join("\n      AND ");
    const selectExprs = ["l.id", textRankExpr, distanceExpr, latExpr, lngExpr].join(",\n      ");

    // Price sort — order by the SAME guest-payable price the response displays
    // (min active room-type price for hotels / raw listing price, converted to
    // the requested currency and ceiling-rounded), not the raw listing column.
    // The expression's placeholders are allocated after all WHERE params, and
    // their values are pushed after `paginationStart` is captured, so the COUNT
    // query never receives params it does not reference.
    let priceOrderExpr: string | null = null;
    let priceOrderParams: unknown[] = [];
    const priceSorting = sort === "price_asc" || sort === "price_desc";
    if (priceSorting) {
      const usdToTargetRate = targetCurrency ? await getExchangeRate("USD", targetCurrency) : null;
      const price = buildGuestPriceExpr({ category, targetCurrency, usdToTargetRate, next });
      priceOrderExpr = price.expr;
      priceOrderParams = price.params;
      if (!priceJoins) priceJoins = price.joins;
    }

    const orderCols: string[] = [];
    if (textQuery) orderCols.push("text_rank ASC");
    if (sort === "price_asc") orderCols.push(`${priceOrderExpr ?? `l.${priceCol}`} ASC NULLS LAST`);
    else if (sort === "price_desc") orderCols.push(`${priceOrderExpr ?? `l.${priceCol}`} DESC NULLS LAST`);
    else if (sort === "newest") orderCols.push("l.created_at DESC");
    else if (sort === "user_ratings_desc") orderCols.push(userRatingsOrderExpr());
    else orderCols.push(hasGeo ? "distance_km ASC" : "l.created_at DESC");

    // Pagination (cursor = offset)
    const paginationStart = params.length;
    // Price-sort params are referenced only by the ORDER BY (page query), so
    // they must come after the COUNT slice but before LIMIT/OFFSET.
    if (priceOrderParams.length) params.push(...priceOrderParams);
    const fromSql = `FROM listing.listings l${priceJoins ? "\n      " + priceJoins : ""}`;
    const pageSql = `
      SELECT ${selectExprs}
      ${fromSql}
      WHERE ${whereSql}
      ORDER BY ${orderCols.join(", ")}
      LIMIT ${next()} OFFSET ${next()}
    `;
    params.push(limit, cursor);

    // The text-query param appears in the COUNT's WHERE only in text-only mode;
    // in resolved mode it lives only in the SELECT (text_rank), so the COUNT
    // must exclude it there or Postgres rejects the bind.
    const countParamCount = paginationStart - (textQuery && !textOnly ? 1 : 0);

    const countSql = `SELECT COUNT(*)::int AS total ${fromSql} WHERE ${whereSql}`;

    let total: number;
    let effectiveRadiusKm: number | null = radiusKm ?? null;
    if (adaptive && radiusParamIdx !== null) {
      // Widen tier by tier until enough results exist. Counts are cheap and
      // sequential probes only happen while the area is still sparse.
      total = 0;
      for (const tierKm of ADAPTIVE_TIERS_KM) {
        params[radiusParamIdx] = tierKm * 1000;
        const rows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
          countSql, ...params.slice(0, countParamCount),
        );
        total = rows[0]?.total ?? 0;
        effectiveRadiusKm = tierKm;
        if (total >= MIN_AREA_RESULTS) break;
      }
    } else {
      const rows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
        countSql, ...params.slice(0, countParamCount),
      );
      total = rows[0]?.total ?? 0;
    }

    const pageRows = await prisma.$queryRawUnsafe<Array<{ id: string; distance_km: number | null; lat: number | null; lng: number | null }>>(
      pageSql, ...params,
    );
    const available = total;
    const nextCursor = cursor + limit < total ? String(cursor + limit) : null;

    const pageIds = pageRows.map((r) => r.id);
    const distanceMap = new Map(pageRows.map((r) => [r.id, Number(r.distance_km ?? 0)]));
    const coordsMap = new Map(pageRows.map((r) => [r.id, { lat: r.lat ?? null, lng: r.lng ?? null }]));

    // Enrich the page rows only (bounded to page size), preserving SQL order
    const rows = await prisma.listing.findMany({
      where: { id: { in: pageIds } },
      include: {
        photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 },
        amenities: true,
        hotelRoomTypes: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const page = pageIds
      .map((id) => rowsById.get(id))
      .filter((row): row is NonNullable<typeof row> => !!row)
      .map((l) => ({
        ...l,
        distanceKm: distanceMap.get(l.id) ?? 0,
        lat: coordsMap.get(l.id)?.lat ?? null,
        lng: coordsMap.get(l.id)?.lng ?? null,
      }));

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
    const logLat = Number.isFinite(lat) ? lat : 0;
    const logLng = Number.isFinite(lng) ? lng : 0;
    await prisma.searchLog.create({
      data: {
        userId: guestId ?? undefined,
        category,
        placeName,
        lat: logLat,
        lng: logLng,
        radiusKm: radiusKm ?? 25,
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

    // Batch-fetch exchange rates for all listing currencies in one query
    let rateMap = new Map<string, number>();
    if (targetCurrency) {
      const listingCurrencies = page.map((l) => l.currency ?? "USD");
      rateMap = await getRatesBatch(listingCurrencies, targetCurrency);
    }

    // Batch-fetch commission rates for the page's countries (one query, no N+1)
    const commissionRates = await getCommissionRateBatch(page.map((l) => l.country ?? null));

    const results = page.map((l) => {
      const commissionRate = commissionRates.get(l.country ?? null) ?? 0;

      // Calculate the guest-facing rate: use the minimum room-type price for
      // hotels, otherwise the raw list price. The commission is no longer baked
      // into the guest price — guests pay listPrice + service fee, and commission
      // is deducted from the provider's payout instead.
      let nightlyRate: number | null = null;
      if (l.category !== "car") {
        if (l.category === "hotel" && l.hotelRoomTypes.length > 0) {
          // Use the minimum pricePerNight across active room types
          nightlyRate = Math.min(...l.hotelRoomTypes.map((rt) => Number(rt.pricePerNight)));
        } else if (l.pricePerNight) {
          nightlyRate = Number(l.pricePerNight);
        }
      }
      const dailyRate = l.category === "car" && l.pricePerDay ? Number(l.pricePerDay) : null;

      const baseCurrency = l.currency ?? "USD";
      const wantLocalized = !!targetCurrency && targetCurrency !== baseCurrency;
      const rate = wantLocalized ? rateMap.get(baseCurrency) : undefined;
      const conversionUnavailable = wantLocalized && !rate;
      const localizedCurrency = wantLocalized ? (conversionUnavailable ? null : targetCurrency) : baseCurrency;

      let localizedNightlyRate: number | null = conversionUnavailable ? null : nightlyRate;
      let localizedDailyRate: number | null = conversionUnavailable ? null : dailyRate;
      let localizedRoomTypes = l.category === "hotel"
        ? l.hotelRoomTypes.map((rt) => {
            const pricePerNight = Number(rt.pricePerNight);
            return {
              id: rt.id,
              name: rt.name,
              roomType: rt.roomType,
              pricePerNight,
              unitCount: rt.unitCount,
              maxGuests: rt.maxGuests,
              localizedPricePerNight:
                conversionUnavailable ? null
                : (rate ? ceilingForCurrency(pricePerNight * rate, targetCurrency!) : pricePerNight),
            };
          })
        : undefined;

      if (wantLocalized && rate) {
        if (nightlyRate !== null) localizedNightlyRate = ceilingForCurrency(nightlyRate * rate, targetCurrency);
        if (localizedDailyRate !== null) localizedDailyRate = ceilingForCurrency(localizedDailyRate * rate, targetCurrency);
      }

      return {
        id: l.id,
        listingType: l.category,
        title: l.name,
        city: l.town,
        neighborhood: l.neighborhood,
        countryCode: l.country,
        distanceKm: Math.round(l.distanceKm * 10) / 10,
        lat: (l as any).lat ?? null,
        lng: (l as any).lng ?? null,
        primaryPhotoUrl: l.photos[0]?.cdnUrl ?? null,
        nightlyRate,
        dailyRate,
        currency: l.currency,
        localizedNightlyRate,
        localizedDailyRate,
        localizedCurrency,
        commissionRate,
        serviceFeeRate: SERVICE_FEE_RATE,
        cancellationPolicy: l.cancellationPolicy,
        // Stays (hotel + apartment) — clients badge this when > 1 night
        minStayNights: l.category === "car" ? null : l.minStayNights,
        // Hotel
        starRating: l.starRating,
        isAccredited: !!l.approvedAt,
        roomType: l.category === "hotel" ? null : l.roomType,
        roomTypes: localizedRoomTypes,
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
      availableCount: available,
      nextCursor,
      results,
      // How far the search actually reached. `expanded` means the local area
      // was too sparse and the radius widened — clients show an Airbnb-style
      // "showing results further away" note on it.
      searchArea: {
        effectiveRadiusKm,
        expanded: adaptive && effectiveRadiusKm !== ADAPTIVE_TIERS_KM[0],
      },
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
          lat: { type: "number", description: "Latitude of search centre — optional; omitted → no distance ranking" },
          lng: { type: "number", description: "Longitude of search centre — optional; omitted → no distance ranking" },
          q: { type: "string", description: "Free-text destination search — matches listing name/location fields accent-insensitively; exact → partial → nearby ranked" },
          place_resolved: { type: "string", enum: ["true", "false"], description: "Set true only when the typed destination resolved to a real geocoded location; unlocks the nearby fallback for q. When false/absent, q returns exact/partial text matches only." },
          place_name: { type: "string", description: "Human-readable place name (for logging)" },
          radius_km: { type: "integer", description: "Search radius in km — only applied when explicitly provided; omitted → nearest-first without a cap" },
          check_in: { type: "string", description: "Hotel/apartment check-in date (YYYY-MM-DD)" },
          check_out: { type: "string", description: "Hotel/apartment check-out date (YYYY-MM-DD)" },
          pickup_datetime: { type: "string", description: "Car pickup datetime (ISO 8601)" },
          return_datetime: { type: "string", description: "Car return datetime (ISO 8601)" },
          guests: { type: "integer", description: "Number of guests" },
          sort: {
            type: "string",
            enum: ["recommended", "price_asc", "price_desc", "distance", "newest", "user_ratings_desc"],
            default: "recommended",
            description: "Sort order. user_ratings_desc sorts by average guest review score, highest first (unrated listings last).",
          },
          limit: { type: "integer", default: 20, description: "Page size (max 50)" },
          cursor: { type: "integer", default: 0, description: "Pagination offset cursor" },
          price_min: { type: "number", description: "Minimum price per night/day" },
          price_max: { type: "number", description: "Maximum price per night/day" },
          rating_min: { type: "number", description: "Minimum average guest review rating (1–5). Only listings whose visible guest reviews average >= this value are returned; listings with no reviews are excluded." },
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
          star_rating: { type: "string", pattern: "^[1-5](,[1-5])*$", description: "Hotel star classification filter. Comma-separated values from 1 to 5, e.g. 3,4,5. Hotel category only." },
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
          airport_pickup: { type: "string", enum: ["true", "false"], description: "Car filter: only listings offering airport pickup" },
          instant_booking: { type: "string", enum: ["true", "false"], description: "Filter listings that support instant booking" },
          currency: { type: "string", description: "ISO 4217 currency code for localized prices (e.g. KES, NGN, USD)" },
        },
        required: ["category"],
      },
    },
    preHandler: [optionalAuth],
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
        querystring: {
          type: "object",
          properties: {
            currency: { type: "string", description: "ISO 4217 currency code for localized prices (e.g. KES, NGN, USD)" },
          },
        },
      },
      preHandler: [optionalAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const guestId = (req as AuthRequest).authId;
        const { id } = req.params as { id: string };
        const { currency: targetCurrency } = (req.query as Record<string, string>) ?? {};

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

      const coords = await prisma.$queryRaw<Array<{ lat: number | null; lng: number | null }>>`
        SELECT public.ST_Y(location::public.geometry) AS lat, public.ST_X(location::public.geometry) AS lng
        FROM listing.listings
        WHERE id = ${id}
      `;

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

      const commissionRate = await getCommissionRate(listing.country ?? null);

      const baseCurrency = listing.currency ?? "USD";
      const target = targetCurrency?.toUpperCase() || null;
      const ctx = await getLocalizedContext(baseCurrency, target);
      // Guest-facing rates are the raw list prices — no commission baked in.
      const baseNightlyRate: number | null = listing.category !== "car"
        ? (listing.category === "hotel" && listing.hotelRoomTypes.length > 0
            ? Math.min(...listing.hotelRoomTypes.map((rt) => Number(rt.pricePerNight)))
            : (listing.pricePerNight ? Number(listing.pricePerNight) : null))
        : null;
      const nightlyRate: number | null = baseNightlyRate;
      const baseDailyRate: number | null = listing.category === "car" && listing.pricePerDay ? Number(listing.pricePerDay) : null;
      const dailyRate: number | null = baseDailyRate;
      const localizedNightlyRate: number | null =
        ctx.currency === null ? null
        : (ctx.rate !== null && nightlyRate !== null ? ceilingForCurrency(nightlyRate * ctx.rate, ctx.currency) : nightlyRate);
      const localizedDailyRate: number | null =
        ctx.currency === null ? null
        : (ctx.rate !== null && dailyRate !== null ? ceilingForCurrency(dailyRate * ctx.rate, ctx.currency) : dailyRate);
      let localizedRoomTypes = listing.category === "hotel"
        ? listing.hotelRoomTypes.map((rt) => {
            const pricePerNight = Number(rt.pricePerNight);
            return {
              id: rt.id,
              name: rt.name,
              roomType: rt.roomType,
              pricePerNight,
              unitCount: rt.unitCount,
              maxGuests: rt.maxGuests,
              localizedPricePerNight:
                ctx.currency === null ? null
                : (ctx.rate !== null ? ceilingForCurrency(pricePerNight * ctx.rate, ctx.currency) : pricePerNight),
            };
          })
        : undefined;

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

      // Strip sensitive car fields pre-booking
      const data: any = {
        ...listing,
        commissionRate,
        serviceFeeRate: SERVICE_FEE_RATE,
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
        lat: coords[0]?.lat ?? null,
        lng: coords[0]?.lng ?? null,
        // Raw list-price rates (guests pay listPrice + service fee).
        nightlyRate,
        dailyRate,
        pricePerNight: listing.category !== "car" ? nightlyRate : (listing.pricePerNight ? Number(listing.pricePerNight) : null),
        pricePerDay: listing.category === "car" && dailyRate != null ? dailyRate : (listing.pricePerDay ? Number(listing.pricePerDay) : null),
        localizedNightlyRate,
        localizedDailyRate,
        localizedCurrency: ctx.currency,
        // Override the raw `hotelRoomTypes` from the listing spread with the
        // localized room-type prices — consumers prefer `hotelRoomTypes` over
        // `roomTypes`, so leaving the raw row here would mislabel them when a
        // display currency is set.
        hotelRoomTypes: localizedRoomTypes,
        roomTypes: localizedRoomTypes,
        isAccredited: !!listing.approvedAt,
        longStayDiscountEnabled: listing.longStayEnabled,
        promoBadge,
        ...localizedFeeFields,
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
            currency: { type: "string", description: "ISO 4217 currency code for localized prices (e.g. KES, NGN, USD)" },
          },
          required: ["ids"],
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = req.body as { ids?: string[]; currency?: string };
        const ids = (body.ids ?? []).slice(0, 20);
        const target = body.currency?.toUpperCase() || null;
      if (!ids.length) return sendSuccess(reply, 200, { listings: [] });

      const listings = await prisma.listing.findMany({
        where: { id: { in: ids }, deletedAt: null, status: { in: ["approved", "active"] } },
        include: { photos: { where: { deletedAt: null }, orderBy: { position: "asc" }, take: 1 } },
      });

      const commissionRates = await getCommissionRateBatch(listings.map((l) => l.country ?? null));

      const listingsWithLocale = await Promise.all(listings.map(async (l) => {
        const commissionRate = commissionRates.get(l.country ?? null) ?? 0;
        const baseCurrency = l.currency ?? "USD";
        const rawNightlyRate = l.pricePerNight ? Number(l.pricePerNight) : null;
        const nightlyRate = rawNightlyRate;
        const ctx = await getLocalizedContext(baseCurrency, target);
        const localizedNightlyRate =
          ctx.currency === null ? null
          : (ctx.rate !== null && nightlyRate !== null ? ceilingForCurrency(nightlyRate * ctx.rate, ctx.currency) : nightlyRate);

        return {
          id: l.id,
          title: l.name,
          category: l.category,
          city: l.town,
          neighborhood: l.neighborhood,
          countryCode: l.country,
          nightlyRate,
          currency: l.currency,
          localizedNightlyRate,
          localizedCurrency: ctx.currency,
          commissionRate,
          serviceFeeRate: SERVICE_FEE_RATE,
          primaryPhotoUrl: l.photos[0]?.cdnUrl ?? null,
        };
      }));

      return sendSuccess(reply, 200, { listings: listingsWithLocale });
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
      preHandler: [requireUser],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as AuthRequest).authId as string;
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
      preHandler: [requireUser],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as AuthRequest).authId as string;
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
            currency: { type: "string", description: "ISO 4217 currency code for localized prices (e.g. KES, NGN, USD)" },
          },
        },
      },
      preHandler: [requireUser],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as AuthRequest).authId as string;
        const q = req.query as Record<string, string>;
      const cursor = q["cursor"] ? parseInt(q["cursor"], 10) : 0;
      const target = q["currency"]?.toUpperCase() || null;
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

      const commissionRates = await getCommissionRateBatch(page.map((f) => f.listing.country ?? null));

      return sendSuccess(reply, 200, {
        favourites: await Promise.all(page.map(async (f) => {
          const commissionRate = commissionRates.get(f.listing.country ?? null) ?? 0;
          const baseCurrency = f.listing.currency ?? "USD";
          const rawNightlyRate = f.listing.pricePerNight ? Number(f.listing.pricePerNight) : null;
          const nightlyRate = rawNightlyRate;
          const ctx = await getLocalizedContext(baseCurrency, target);
          const localizedNightlyRate =
            ctx.currency === null ? null
            : (ctx.rate !== null && nightlyRate !== null ? ceilingForCurrency(nightlyRate * ctx.rate, ctx.currency) : nightlyRate);

          return {
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
              nightlyRate,
              currency: f.listing.currency,
              localizedNightlyRate,
              localizedCurrency: ctx.currency,
              commissionRate,
              serviceFeeRate: SERVICE_FEE_RATE,
              primaryPhotoUrl: f.listing.photos[0]?.cdnUrl ?? null,
            },
          };
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
      preHandler: [requireUser],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as AuthRequest).authId as string;
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
        querystring: {
          type: "object",
          properties: {
            currency: { type: "string", description: "ISO 4217 currency code for localized prices (e.g. KES, NGN, USD)" },
          },
        },
      },
      preHandler: [requireUser],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as AuthRequest).authId as string;
        const q = req.query as Record<string, string>;
        const target = q["currency"]?.toUpperCase() || null;

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

      const commissionRates = await getCommissionRateBatch(views.map((v) => v.listing.country ?? null));

      return sendSuccess(reply, 200, {
        recentlyViewed: await Promise.all(views.map(async (v) => {
          const commissionRate = commissionRates.get(v.listing.country ?? null) ?? 0;
          const baseCurrency = v.listing.currency ?? "USD";
          const rawNightlyRate = v.listing.pricePerNight ? Number(v.listing.pricePerNight) : null;
          const nightlyRate = rawNightlyRate;
          const ctx = await getLocalizedContext(baseCurrency, target);
          const localizedNightlyRate =
            ctx.currency === null ? null
            : (ctx.rate !== null && nightlyRate !== null ? ceilingForCurrency(nightlyRate * ctx.rate, ctx.currency) : nightlyRate);

          return {
            listingId: v.listingId,
            viewedAt: v.viewedAt,
            listing: {
              id: v.listing.id,
              title: v.listing.name,
              category: v.listing.category,
              status: v.listing.status,
              city: v.listing.town,
              neighborhood: v.listing.neighborhood,
              nightlyRate,
              currency: v.listing.currency,
              localizedNightlyRate,
              localizedCurrency: ctx.currency,
              commissionRate,
              serviceFeeRate: SERVICE_FEE_RATE,
              primaryPhotoUrl: v.listing.photos[0]?.cdnUrl ?? null,
            },
          };
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
      preHandler: [requireUser],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (req as AuthRequest).authId as string;
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