# E5 — Search & Discovery

*Last updated: 2026-04-25 | Status: Complete*

---

## 1. Epic Summary

E5 covers the complete public-facing discovery journey: location-aware search across all three listing categories (Hotels, Apartments, Car Rentals), filter and sort mechanics, map-based browsing, listing detail pages, availability calendars, and personalisation features (Favourites, Recently Viewed). Search result pages are server-side rendered (Next.js 14 App Router) for SEO. Elasticsearch handles geo-distance, text, and attribute queries; PostgreSQL provides authoritative availability data. No authentication is required to search or view listings; favouriting requires a logged-in Guest account.

**Depends on:** E2, E3, E4 — listings must exist in `approved` / `active` states before they appear in results.  
**Feeds into:** E6 — the Listing Detail page is the entry point to the booking flow.

---

## 2. Actors

| Actor | Description |
|-------|-------------|
| **Guest (Anonymous)** | Any visitor, unauthenticated. May search, browse results, and view Listing Detail pages. Cannot favourite or save history server-side. |
| **Guest (Authenticated)** | Logged-in guest. All anonymous capabilities plus: favourite listings, server-side Recently Viewed history. |
| **Search Service** | Internal Node.js microservice. Queries Elasticsearch for geo/attribute matches, then calls Listing Service for availability post-filtering. |
| **Listing Service** | Internal Node.js microservice. Owns PostgreSQL listing and booking tables; answers availability queries. |
| **Google Places API** | External service providing location autocomplete suggestions. |
| **Google Geocoding API** | External service resolving a `place_id` to lat/lng coordinates. |
| **Google Maps JS/SDK** | External service rendering the interactive map view. |
| **Elasticsearch** | Search engine hosting the `listings` index; handles geo, text, and attribute queries. |
| **FX Rate Service** | External rate service (e.g., exchangerate.host) supplying daily exchange rates for indicative currency conversion. |

---

## 3. Scope

**In scope (V1):**
- Keyword + location + date-range search for Hotels and Apartments
- Location + pickup-datetime/return-datetime search for Car Rentals
- Category-specific filter panels
- Sort: Recommended, Price asc/desc, Rating, Distance, Newest
- Map view with geo-pinned result markers
- Listing Detail pages for all three categories
- Availability calendar widget on Listing Detail pages
- Favourites: save and unsave listings
- Recently Viewed: anonymous (client-side) and authenticated (server-side)
- SSR search result pages with structured data markup (Schema.org)

**Out of scope — Phase 2:**
- Multi-room-type search within a single hotel listing
- Per-vehicle individual availability tracking within a car fleet
- AI-powered personalised ranking / recommendation engine
- Price comparison against external OTAs
- Voice or image search

---

## 4. Business Rules

| ID | Rule |
|----|------|
| **BR-5.1** | Only listings with `status = 'approved'` (Hotels) or `status = 'active'` (Apartments, Cars) are indexed in Elasticsearch and returned in search results. `auto_suspended`, `suspended`, `deactivated`, and `permanently_banned` listings are excluded. |
| **BR-5.2** | A listing must have a non-null `lat`/`lng` geocode pair **and** at least one approved, active photo to be indexed and searchable. Listings failing either condition are removed from the index within 60 seconds of the disqualifying event. |
| **BR-5.3** | Default geo-radius is **25 km** from the searched coordinates. Users may change radius to 10, 25, 50, or 100 km via a filter control. |
| **BR-5.4** | **Hotels/Apartments** — date validation: `check_in ≥ today`; `check_out > check_in`; maximum stay = 365 nights. **Cars** — date validation: `pickup_datetime ≥ now + 1 hour`; `return_datetime > pickup_datetime`; maximum rental period = 90 days. |
| **BR-5.5** | **Availability — Hotels/Apartments:** a listing is available if no booking with `status IN ('confirmed', 'pending_payment')` overlaps the requested range. Overlap condition: `booking.check_out > search.check_in AND booking.check_in < search.check_out`. **Cars:** available if `(listing.unit_count − count_of_overlapping_bookings) ≥ 1`. |
| **BR-5.6** | Elasticsearch returns up to **200 geo/attribute candidates** per search. Listing Service checks availability in PostgreSQL for that candidate set. The final response returns ≤ 20 results after availability filtering plus a continuation cursor. |
| **BR-5.7** | Search result pages are **server-side rendered** (Next.js 14 App Router). Each page includes: `<title>`, `<meta name="description">`, `<link rel="canonical">`, and Schema.org JSON-LD (`Hotel`, `LodgingBusiness`, or `Product` for cars). |
| **BR-5.8** | Pagination is **cursor-based**. The cursor encodes the Elasticsearch sort tiebreaker value of the last result on the current page. Clients pass the cursor as a query parameter to fetch the next page. |
| **BR-5.9** | Prices are displayed in the listing's declared `currency`. When the user's locale currency differs, an indicative converted price is shown in secondary text using daily FX rates. The converted price is labelled "~" (approximate) and bears a disclaimer that rates are indicative. |
| **BR-5.10** | Location autocomplete uses **Google Places Autocomplete** restricted to type `(cities)` for Hotel/Apartment search and type `geocode` for Car pickup-location search. The selected place is resolved to lat/lng from the Places detail response (`geometry.location`); Geocoding API is the fallback if geometry is absent. |
| **BR-5.11** | Search and detail-page viewing are **public** (no authentication). Favouriting and server-side Recently Viewed history require an authenticated Guest session. |
| **BR-5.12** | **Recently Viewed** — anonymous users: last 20 listing IDs stored in `localStorage` / `AsyncStorage`, 30-day TTL (client enforces). Authenticated users: stored in `user_recently_viewed` table; last 20 entries per user, 30-day TTL; re-viewing an already-stored listing updates `viewed_at` rather than adding a duplicate. |
| **BR-5.13** | **Sort options:** Recommended (default — ES relevance score boosted by `rating_avg`, `review_count`, `photo_count`, listing `created_at` recency) · Price: Low to High · Price: High to Low · Guest Rating: High to Low · Distance: Nearest First · Newest Listings. |
| **BR-5.14** | When fewer than 3 results pass availability filtering, the UI renders a "No results" state with three contextual suggestions: (a) expand the radius, (b) adjust dates/times, (c) clear applied filters. |
| **BR-5.15** | The Car Rental Listing Detail page displays the licence plate as the string `"Revealed after booking"`. The full pickup address **is** shown (needed by the guest for logistics planning). |
| **BR-5.16** | For Car search, geo-distance is measured from `listing.pickup_lat` / `listing.pickup_lng`, not the provider's business address. |
| **BR-5.17** | Car listings whose `min_rental_days` exceeds the selected rental duration are excluded from results by the Search Service after the ES query. |
| **BR-5.18** | The homepage search bar defaults to **Hotels**. Switching category tabs triggers a new search and resets the filter panel to that category's defaults. Previously entered location and dates are preserved across tab switches where semantically appropriate (check-in/check-out dates carry over; car pickup-datetime defaults to the check-in date at 09:00). |
| **BR-5.19** | The Elasticsearch `listings` index is kept in sync via an **event-driven pipeline**. Events that trigger an incremental index update (within 60 seconds): listing status change, price/currency edit, photo added/deleted, amenity change, rating average update, geocode assigned. Full index rebuild is a scheduled nightly task for drift correction. |
| **BR-5.20** | Search activity is logged to `search_logs`: `category`, `place_name`, `lat`, `lng`, `radius_km`, `check_in`, `check_out` (or `pickup_datetime`, `return_datetime`), `filters_applied` (JSONB), `sort_applied`, `result_count`, `user_id` (nullable), `created_at`. The table is analytics data subject to the platform privacy policy. |

---

## 5. Use Cases

### UC-5.1 — Homepage Search Entry

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest has opened the ZikaBooking homepage (mobile app or PWA).
- At least some approved/active listings exist in the system.

**Postconditions:**
- Guest is redirected to a Search Results page populated with listings matching the entered location, dates, and category.
- A `search_logs` row is created.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Opens the homepage. The search widget displays three tabs: **Hotels**, **Apartments**, **Car Rentals**. Hotels tab is selected by default. |
| 2 | Guest | Taps/clicks the location field. A **Google Places Autocomplete** dropdown appears (type filter: `(cities)`). |
| 3 | Guest | Types a location query (e.g., "Nairo"). Autocomplete returns matching place suggestions in real time. |
| 4 | Guest | Selects a suggestion (e.g., "Nairobi, Kenya"). System resolves `place_id` to `{ lat, lng, place_name, country_code }` via the Places detail `geometry.location` field. |
| 5 | Guest | Taps the check-in date field. A date-picker appears. Guest selects a check-in date. |
| 6 | Guest | Taps the check-out date field. The picker shows dates after check-in. Guest selects check-out date. |
| 7 | Guest | (Optional) Adjusts the guest count (adults + children) using a stepper. Default is 2 adults, 0 children. |
| 8 | Guest | Taps **Search**. Client validates: check-in ≥ today, check-out > check-in. |
| 9 | System | Constructs a search URL with query parameters. For SSR: Next.js route `/search?category=hotel&lat=...&lng=...&place=Nairobi+Kenya&check_in=...&check_out=...&guests=2`. Navigates to the Search Results page. |
| 10 | System | `GET /api/v1/search` is called (or SSR pre-fetches). Search Service queries Elasticsearch then post-filters availability in PostgreSQL. |
| 11 | System | Logs the search to `search_logs`. Returns up to 20 results with a next-page cursor. |
| 12 | System | SSR renders the page with `<title>Hotels in Nairobi, Kenya — ZikaBooking</title>`, canonical URL, Schema.org JSON-LD, and the result list. |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.1A | Guest switches to **Apartments** tab | Filter panel resets to apartment-specific filters. Location and dates are preserved. Step 2–12 repeat with `category=apartment`. |
| AF-5.1B | Guest switches to **Car Rentals** tab | Date fields change to **Pickup Date/Time** and **Return Date/Time**. Guest count field is replaced by **Pickup Location** field. Location autocomplete type changes to `geocode`. Step 2–12 repeat with `category=car`. |
| AF-5.1C | Guest searches without selecting dates | System performs a date-agnostic search (no availability filtering). Results show all eligible listings in the area. A banner informs the guest: "Add dates to see availability and prices." |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.1A | Guest selects check-out ≤ check-in | Date picker highlights the error inline: "Check-out must be after check-in." Search button remains disabled. |
| EX-5.1B | Google Places API unavailable | Location field falls back to a plain text input. Guest types a city name. System attempts Geocoding API lookup on Search. If geocoding also fails, an error toast is shown: "Location lookup is unavailable. Please try again later." |
| EX-5.1C | Geocoding returns no result for entered text | Inline error: "We couldn't find that location. Please try a different search term." |

**Data Entities Touched:** `search_logs` (INSERT)  
**API Endpoints:** `GET /api/v1/search`, Google Places Autocomplete, Google Geocoding API

---

### UC-5.2 — Search Results — Hotels & Apartments

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest has submitted a hotel or apartment search query (via UC-5.1 or direct URL).
- Valid `lat`, `lng`, `category`, `check_in`, `check_out` parameters are present (dates optional but improve results).

**Postconditions:**
- A paginated list of matching, available listings is displayed.
- If authenticated, the Favourites state (heart icon filled/unfilled) is shown per listing.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | Search Service receives `GET /api/v1/search` with parameters. |
| 2 | System | Constructs Elasticsearch query: `geo_distance` filter (lat/lng + radius_km), `term` filter on `listing_type` and `status`, any attribute filters (price range, star rating, amenities, etc.). Sort mode applied. Requests top 200 hits. |
| 3 | System | Elasticsearch returns up to 200 candidate listing IDs with scores and sort cursors. |
| 4 | System | Listing Service checks PostgreSQL availability for each candidate: `SELECT listing_id, COUNT(*) AS booked FROM bookings WHERE listing_id = ANY($ids) AND status IN ('confirmed', 'pending_payment') AND check_in < $check_out AND check_out > $check_in GROUP BY listing_id`. Available = booked count = 0 (hotels/apartments are single-unit in V1). |
| 5 | System | Merges availability results, filtering out unavailable listings. Selects the first 20 available results. Generates a continuation cursor for the next page. |
| 6 | System | Returns response: `{ results: [...], total_count: N, next_cursor: "...", search_id: "..." }`. Each result item includes: `id`, `listing_type`, `title`, `location` (city, country), `distance_km`, `nightly_rate`, `currency`, `rating_avg`, `review_count`, `primary_photo_url`, `is_accredited` (hotels only), `star_rating` (hotels only), `bedrooms`, `max_guests` (apartments only), `is_favourited` (authenticated guests only). |
| 7 | System | SSR renders each result card. Guest sees: thumbnail photo, title, star rating / bedroom count, location + distance, nightly rate, average rating badge. |
| 8 | Guest | Scrolls through results. Upon reaching the bottom of the page, the client fetches the next page using the `next_cursor`. |
| 9 | Guest | Taps a listing card. System navigates to the Listing Detail page (UC-5.8). |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.2A | No dates provided | Availability filtering (step 4) is skipped. All 200 ES candidates are displayed (up to 20 per page). Price shown; availability message: "Select dates to confirm availability." |
| AF-5.2B | Fewer than 3 results after availability filtering | System renders "No results" state: heading "No listings found in Nairobi for these dates." Three CTAs: "Expand search radius", "Change dates", "Clear filters." |
| AF-5.2C | Guest is authenticated | Step 6 enriches each result with `is_favourited: true/false` by joining `user_favourites`. Heart icon reflects state. |
| AF-5.2D | Listing's `currency` ≠ user locale currency | Each result card shows primary price in listing currency + indicative converted amount (e.g., "KES 8,500/night · ~USD 65"). FX rate is fetched daily and cached. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.2A | Elasticsearch cluster unavailable | Search Service returns HTTP 503. UI shows: "Search is temporarily unavailable. Please try again in a moment." No `search_logs` row is written. |
| EX-5.2B | Elasticsearch returns 200 candidates but all are unavailable in PG | System behaves as AF-5.2B: "No listings found" with suggestions. |
| EX-5.2C | `next_cursor` is stale (results changed between pages) | Search Service re-queries ES from the cursor position. Any listings that have since become unavailable are silently skipped; any newly available listings are not retroactively inserted mid-session. |

**Data Entities Touched:** `search_logs` (INSERT on first page), `listings`, `bookings`, `listing_photos`, `user_favourites` (read if authenticated)  
**API Endpoints:** `GET /api/v1/search`

---

### UC-5.3 — Search Results — Car Rentals

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest has submitted a car rental search with a pickup location and optionally pickup/return datetimes.

**Postconditions:**
- A paginated list of available car listings near the pickup location is displayed.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | Search Service receives `GET /api/v1/search` with `category=car`, `lat`, `lng` (pickup location), optional `pickup_datetime` and `return_datetime`. |
| 2 | System | Constructs ES query: `geo_distance` on `pickup_location` field (lat/lng + radius_km), `term` filter `listing_type=car` and `status=active`. Attribute filters applied (see UC-5.4). Sort applied. Requests top 200. |
| 3 | System | Elasticsearch returns up to 200 candidate car listing IDs. |
| 4 | System | If dates provided: Listing Service queries PG for overlapping bookings per listing. Available cars = `(unit_count − overlapping_bookings) ≥ 1`. If no dates: availability check skipped. |
| 5 | System | Post-filter: remove listings where `min_rental_days > requested_duration_days` (BR-5.17). |
| 6 | System | Returns first 20 available results. Each result item includes: `id`, `title` (e.g., "Toyota RAV4 2022"), `vehicle_category`, `transmission`, `seats`, `ac`, `daily_rate`, `currency`, `distance_km`, `mileage_policy` (Unlimited / Limited), `rating_avg`, `review_count`, `primary_photo_url`, `delivery_available`, `airport_pickup`, `is_favourited` (authenticated). |
| 7 | System | SSR renders each car result card: photo, title, key specs (seats, transmission, A/C), mileage badge ("Unlimited" or "Limited"), distance, daily rate, rating. |
| 8 | Guest | Taps a car listing card. System navigates to the Car Listing Detail page (UC-5.9). |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.3A | Guest sets **Airport Pickup** filter ON | ES filter adds `airport_pickup = true`. Only listings with this flag appear. |
| AF-5.3B | Guest sets **Unlimited Mileage** filter ON | ES filter adds `mileage_policy = 'unlimited'`. |
| AF-5.3C | Guest sets **Cross-Border** filter ON | ES filter adds `cross_border_allowed = true`. |
| AF-5.3D | Rental duration < some listings' `min_rental_days` | Those listings are excluded (step 5). The car results card is not shown for them. No user-visible message per listing; the filter effect is transparent. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.3A | Return datetime ≤ pickup datetime | Client prevents submission: "Return must be after pickup." |
| EX-5.3B | Pickup datetime < now + 1 hour | Client prevents submission: "Pickup must be at least 1 hour from now." |

**Data Entities Touched:** `search_logs` (INSERT), `listings`, `bookings`, `listing_photos`, `user_favourites`  
**API Endpoints:** `GET /api/v1/search`

---

### UC-5.4 — Apply & Manage Filters

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest is on a Search Results page (UC-5.2 or UC-5.3).

**Postconditions:**
- Results are re-fetched and re-rendered reflecting the active filter set.
- Applied filters are reflected in the URL query string (deep-linkable, SSR-compatible).

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Taps **Filters** button. A filter panel slides in (mobile bottom sheet; web right-side panel). |
| 2 | System | Renders the appropriate filter panel for the active category. |
| 3 | Guest | Adjusts filter controls (see tables below). |
| 4 | Guest | Taps **Apply Filters** (or, on web, changes take effect immediately with a 300ms debounce). |
| 5 | System | Updates URL query string with active filters. Re-calls `GET /api/v1/search` with updated parameters. |
| 6 | System | Returns refreshed results. Filter panel displays active filter count badge (e.g., "Filters · 3"). |
| 7 | Guest | Taps a filter chip in the results header to remove a single filter individually. |
| 8 | Guest | Taps **Clear All** to reset all filters to defaults. |

**Hotel Filter Controls:**

| Filter | Control Type | Default | ES/PG Field |
|--------|-------------|---------|-------------|
| Price range (per night) | Range slider | Full range | `nightly_rate` (range) |
| Star rating | Multi-select chips (1★–5★) | None selected | `star_rating` (terms) |
| Amenities | Multi-select checklist | None | `amenity_ids` (terms, all-match) |
| Accredited only | Toggle | OFF | `is_accredited = true` |
| Guest rating | Minimum selector (3+, 4+, 4.5+) | None | `rating_avg ≥ value` |
| Free cancellation | Toggle | OFF | `cancellation_policy = 'free'` |
| Search radius | Segment control (10 / 25 / 50 / 100 km) | 25 km | `geo_distance.distance` |

**Apartment Filter Controls:**

| Filter | Control Type | Default | ES/PG Field |
|--------|-------------|---------|-------------|
| Price range (per night) | Range slider | Full range | `nightly_rate` (range) |
| Bedrooms | Chips: Studio, 1+, 2+, 3+, 4+ | None | `bedrooms ≥ value` |
| Bathrooms | Chips: 1+, 2+, 3+ | None | `bathrooms ≥ value` |
| Max guests | Stepper (min) | None | `max_guests ≥ value` |
| Amenities | Multi-select checklist | None | `amenity_ids` (terms) |
| Long-stay discount | Toggle | OFF | `long_stay_discount_enabled = true` |
| Guest rating | Minimum selector | None | `rating_avg ≥ value` |
| Free cancellation | Toggle | OFF | `cancellation_policy = 'free'` |
| Search radius | Segment control | 25 km | `geo_distance.distance` |

**Car Rental Filter Controls:**

| Filter | Control Type | Default | ES/PG Field |
|--------|-------------|---------|-------------|
| Price range (per day) | Range slider | Full range | `daily_rate` (range) |
| Vehicle category | Multi-select chips | None | `vehicle_category` (terms) |
| Transmission | Chips: Any / Automatic / Manual | Any | `transmission` (term) |
| Seats | Chips: 2+, 4+, 5+, 7+ | None | `seats ≥ value` |
| Air conditioning | Toggle | OFF | `ac = true` |
| Unlimited mileage | Toggle | OFF | `mileage_policy = 'unlimited'` |
| Airport pickup | Toggle | OFF | `airport_pickup = true` |
| Cross-border | Toggle | OFF | `cross_border_allowed = true` |
| Delivery available | Toggle | OFF | `delivery_available = true` |
| Max driver age req. | Chips: 18+, 21+, 25+ | None | `min_driver_age ≤ value` |
| Guest rating | Minimum selector | None | `rating_avg ≥ value` |
| Search radius | Segment control | 25 km | `geo_distance.distance` |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.4A | Applied filters yield zero results | System shows AF-5.2B "No results" state with "Clear filters" CTA. |
| AF-5.4B | Guest deep-links to a URL with filter params | SSR hydrates the filter panel state from URL params; results are pre-rendered server-side. |

**Exception Flows:** None specific — filter validation is client-side (controls constrain invalid states).

**Data Entities Touched:** `listings` (read via ES and PG), `user_favourites` (read)  
**API Endpoints:** `GET /api/v1/search` (re-called with updated params)

---

### UC-5.5 — Sort Search Results

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest is on a Search Results page with at least one result.

**Postconditions:**
- Results are re-ordered and re-rendered per the selected sort mode.
- Sort selection is reflected in the URL (`?sort=price_asc`).

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Taps the **Sort** control (mobile: bottom sheet; web: dropdown). |
| 2 | System | Displays sort options with the current selection checked. |
| 3 | Guest | Selects a sort option. |
| 4 | System | Updates URL `sort` parameter. Re-calls `GET /api/v1/search?...&sort=<option>`. |
| 5 | System | Elasticsearch re-executes with the new sort; results re-render. |

**Sort Options and Elasticsearch Behaviour:**

| Label | `sort` Param | ES Sort Configuration |
|-------|-------------|----------------------|
| Recommended | `recommended` | `_score` DESC (script score: `rating_avg × log(review_count + 1) + photo_count_boost + recency_decay`) |
| Price: Low to High | `price_asc` | `nightly_rate ASC` (or `daily_rate ASC` for cars), then `_score DESC` |
| Price: High to Low | `price_desc` | `nightly_rate DESC`, then `_score DESC` |
| Guest Rating | `rating` | `rating_avg DESC`, then `review_count DESC` |
| Distance: Nearest | `distance` | `_geo_distance ASC` on `location` field |
| Newest Listings | `newest` | `created_at DESC` |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.5A | Sort by Rating with many zero-review listings | Listings with `review_count = 0` are sorted to the end when `sort=rating` (ES script: listings with no reviews receive a score of 0). |

**Data Entities Touched:** `listings` (ES query)  
**API Endpoints:** `GET /api/v1/search`

---

### UC-5.6 — Map-Based Search

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest is on a Search Results page.
- Google Maps JS/SDK has loaded.

**Postconditions:**
- Guest can view listing locations on an interactive map and trigger new searches by moving the map viewport.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Taps the **Map** toggle (or Map tab on mobile). The view splits into a list panel (left/bottom) and a Google Map panel (right/top). |
| 2 | System | Renders the Google Map centred on the searched coordinates. Places a marker pin for each result from the current page, labelled with the price (e.g., "KES 8,500"). |
| 3 | Guest | Taps a marker pin. A map popup card appears: listing photo thumbnail, title, price, rating, and a **View** link. |
| 4 | Guest | Pans or zooms the map. After the map stops moving (300ms debounce), **Search this area** button appears. |
| 5 | Guest | Taps **Search this area**. System extracts the new map centre coordinates and the visible bounding box radius. Calls `GET /api/v1/search` with updated `lat`, `lng`, and a `radius_km` matching the visible bounding box. |
| 6 | System | Returns updated results. Markers update on the map. List panel updates below/beside the map. |
| 7 | Guest | Taps **View** on a popup card or a listing card in the list panel. Navigates to the Listing Detail page. |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.6A | More than 200 markers would be rendered | System uses **marker clustering** (Google Maps MarkerClusterer). Clusters show the count of listings within the cluster. Zooming in splits clusters into individual pins. |
| AF-5.6B | Guest taps a cluster | Map zooms in to fit the cluster bounds. |
| AF-5.6C | Mobile: guest prefers list view | Taps **List** toggle. Map slides away. List view re-renders (identical to UC-5.2 / UC-5.3). |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.6A | Google Maps SDK fails to load | Map panel shows: "Map unavailable — try refreshing the page." List view still functions. |

**Data Entities Touched:** `listings` (read via ES + PG availability)  
**API Endpoints:** `GET /api/v1/search`, Google Maps JS SDK (client-side)

---

### UC-5.7 — Location Autocomplete

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest has focused the location input field on the homepage, search bar, or search results page.
- Google Places API key is configured.

**Postconditions:**
- A resolved `{ lat, lng, place_name, country_code }` tuple is stored in the search state and encoded in the URL.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Focuses the location input. A dropdown panel appears (empty initially). |
| 2 | Guest | Types at least 2 characters (e.g., "Acc"). |
| 3 | System | Client calls Google Places Autocomplete API with the input string and session token. `types=(cities)` for Hotels/Apartments; `types=geocode` for Cars. |
| 4 | System | Autocomplete returns up to 5 suggestions (place descriptions + `place_id`). Each suggestion rendered as a row in the dropdown: city name, country name. |
| 5 | Guest | Selects a suggestion (tap or keyboard Enter). |
| 6 | System | Client fetches the Place Detail for the selected `place_id` (fields: `geometry.location, address_components`). Extracts `{ lat, lng }` and `country_code` (ISO 3166-1 alpha-2 from `address_components`). |
| 7 | System | Stores `{ lat, lng, place_name, country_code }` in the search form state. Location input displays the selected place name. |
| 8 | Guest | Completes remaining search fields and submits (UC-5.1, step 8). |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.7A | Guest clears the location field | Search state resets `lat`, `lng`, `place_name`, `country_code` to null. Search button is disabled until a location is selected. |
| AF-5.7B | Guest changes location on the Search Results page | Same steps 1–7. On completion, the search re-executes with the new coordinates. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.7A | Google Places API quota exceeded | Dropdown shows: "Location suggestions unavailable." Guest can type a place name manually and proceed — Search Service will attempt geocoding on submission. |
| EX-5.7B | Place Detail returns no `geometry.location` | System falls back to Google Geocoding API: `GET /geocode/json?address={place_name}&key={API_KEY}`. If still no result, inline error: "We couldn't locate this place. Try a nearby city." |

**Data Entities Touched:** None (client-side state only)  
**API Endpoints:** Google Places Autocomplete API (client-side), Google Place Detail API (client-side), Google Geocoding API (fallback, via server proxy to protect API key)

---

### UC-5.8 — View Hotel / Apartment Listing Detail Page

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest has tapped a listing card from search results or navigated to a direct listing URL.
- The listing has `status = 'approved'` (hotel) or `status = 'active'` (apartment).

**Postconditions:**
- Guest has seen the full listing detail.
- A `user_recently_viewed` record is created/updated (authenticated) or the listing ID is added to `localStorage` (anonymous).
- Guest can proceed to initiate a booking (E6 entry point).

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | SSR pre-fetches `GET /api/v1/listings/:id` (with `include=photos,amenities,policies,host`). |
| 2 | System | Renders the Listing Detail page server-side with full `<head>` SEO tags and Schema.org JSON-LD. |
| 3 | Guest | Sees the **photo gallery** at the top: first photo displayed full-width; swipe/tap to navigate all photos. Photo count badge shown. |
| 4 | Guest | Sees the **listing header**: title, location (city, country + neighbourhood), official star rating badge (hotels only), claimed star rating (if differs), Accredited badge (hotels only, if `is_accredited = true`). |
| 5 | Guest | Sees the **quick-spec row** (apartments): bedrooms, bathrooms, max guests icons. |
| 6 | Guest | Sees the **description** (truncated at 300 chars with "Read more" expand). |
| 7 | Guest | Sees the **amenities** section: icons + labels for all amenities, grouped by category. |
| 8 | Guest | Sees the **location section**: Google Maps embed showing a pin at the listing coordinates. "Nairobi, Kenya" label (full address revealed post-booking for apartments; full address shown for hotels). |
| 9 | Guest | Sees the **policies section**: check-in time, check-out time, cancellation policy, house rules (apartments). |
| 10 | Guest | Sees the **host section**: provider display name, member since date, response rate (if available). |
| 11 | Guest | Sees the **reviews summary**: average rating (to 1 decimal), breakdown by category (5-star chart), most recent 3 reviews. "View all reviews" link. |
| 12 | Guest | Sees the **sticky Book panel** (mobile: bottom bar; web: right-side card): nightly rate, date picker inputs prefilled from search params, total nights + total price once dates selected, **Book Now** CTA button. |
| 13 | Guest | If authenticated: sees heart icon (filled if in favourites). May toggle (UC-5.11). |
| 14 | System | Records the view: authenticated → INSERT/UPDATE `user_recently_viewed`; anonymous → client appends listing ID to `localStorage`. |
| 15 | Guest | Taps **Book Now**. System checks that dates are selected; if not, prompts date selection. If dates valid, navigates to Booking Initiation (E6 — UC-6.1). |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.8A | Guest arrived without search dates | Price shown as "From [rate]/night". Date picker in Book panel is empty. Guest must select dates before proceeding to Book. |
| AF-5.8B | Long-stay discount applies (apartments) | Book panel calculates discounted nightly rate for stays ≥ `long_stay_min_nights`. Displays: original rate crossed out, discounted rate, "Long-stay discount applied" badge. |
| AF-5.8C | Guest taps "View all reviews" | Navigates to `/listings/:id/reviews` page. Returns to detail page on back. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.8A | Listing `status` has changed to inactive since search results were rendered | `GET /api/v1/listings/:id` returns HTTP 410 Gone. SSR renders: "This listing is no longer available." with a **Search Again** CTA. No Book button rendered. |
| EX-5.8B | Listing not found (`id` invalid) | HTTP 404. Standard 404 page. |

**Data Entities Touched:** `listings`, `listing_photos`, `listing_amenities`, `listing_custom_amenities`, `user_recently_viewed` (INSERT/UPDATE), `user_favourites` (read)  
**API Endpoints:** `GET /api/v1/listings/:id`, `POST /api/v1/guests/me/recently-viewed`

---

### UC-5.9 — View Car Rental Listing Detail Page

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest has tapped a car listing card from search results.
- The listing has `status = 'active'`.

**Postconditions:**
- Guest has viewed the full car listing detail, with licence plate hidden.
- A recently-viewed record is created/updated.
- Guest can proceed to initiate a car rental booking (E6).

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | SSR pre-fetches `GET /api/v1/listings/:id` (with `include=photos,documents_summary,policies`). Listing Service returns the car listing data. Licence plate field is **never included** in any API response pre-booking (server enforces exclusion regardless of auth state). |
| 2 | System | Renders the Car Listing Detail page server-side. `<title>` pattern: "[Make Model Year] for Rent in [City] — ZikaBooking". Schema.org `Product` JSON-LD. |
| 3 | Guest | Sees the **photo gallery**: all approved vehicle photos. |
| 4 | Guest | Sees the **vehicle header**: title (Make · Model · Year), vehicle category badge (e.g., "SUV"), colour. |
| 5 | Guest | Sees the **vehicle specs table**: |
|   |        | — Seats: N · Doors: N |
|   |        | — Transmission: Automatic / Manual |
|   |        | — Fuel Type: Petrol / Diesel / Electric / Hybrid |
|   |        | — Air Conditioning: Yes / No |
|   |        | — Drive Type: FWD / RWD / AWD / 4WD |
|   |        | — Engine: [size]L / Electric |
|   |        | — Licence Plate: **Revealed after booking** |
| 6 | Guest | Sees the **fleet note** (if `unit_count > 1`): "Fleet of [N] vehicles — your specific car may vary." |
| 7 | Guest | Sees the **rental terms section**: |
|   |        | — Price: [daily_rate] [currency] / day |
|   |        | — Minimum rental: [min_rental_days] day(s) |
|   |        | — Mileage: Unlimited · OR · Limited: [km_per_day] km/day; extra km at [extra_km_rate] [currency]/km |
|   |        | — Fuel policy: Full-to-Full ("Return with a full tank") / Full-to-Empty ("Pre-filled, return empty") / Pre-purchase ("Purchase fuel package upfront") |
|   |        | — Security deposit: [amount] [currency] (held at pickup, released on return) |
|   |        | — Minimum driver age: [min_driver_age] years |
| 8 | Guest | Sees the **insurance & extras section**: |
|   |        | — Insurance type: Third-Party / Comprehensive / None — Bring Your Own |
|   |        | — Roadside assistance: Included / Not included |
|   |        | — Cross-border travel: Allowed / Not allowed |
| 9 | Guest | Sees the **pickup & return section**: |
|   |        | — Pickup address: [full street address shown] on a Google Map embed |
|   |        | — Return location: Same as pickup · OR · [different address] |
|   |        | — Airport pickup: Available / Not available |
|   |        | — Delivery: Available within [delivery_radius_km] km · Delivery fee: [delivery_fee] [currency] · OR · Not available |
|   |        | — Pickup hours: [pickup_hours_from] – [pickup_hours_to] |
| 10 | Guest | Sees the **cancellation policy** text. |
| 11 | Guest | Sees the **reviews summary** (if any). |
| 12 | Guest | Sees the **sticky Book panel**: price per day, pickup/return datetime pickers (prefilled from search), total days + total price, **Book Now** CTA. |
| 13 | System | Records recently viewed (same as UC-5.8, step 14). |
| 14 | Guest | Taps **Book Now**. System validates: datetime range selected, rental duration ≥ `min_rental_days`. If valid, navigates to E6 — UC-6.1. |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.9A | `min_rental_days > 1` | Book panel shows a notice: "Minimum rental: [N] days." If selected duration < minimum, Book Now is disabled with message: "Minimum rental period is [N] days." |
| AF-5.9B | Delivery is available | Book panel includes a **Request Delivery** toggle. If toggled on, delivery address field appears. Delivery fee is shown as a line item in the total. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.9A | Listing `status` changed to inactive | HTTP 410. "This vehicle is no longer available for rent." |
| EX-5.9B | API returns `licence_plate` (hypothetical bug) | Client-side: a display guard component always renders the static string "Revealed after booking" for the plate field regardless of API response. Server-side: the field is stripped before serialisation. |

**Data Entities Touched:** `listings`, `listing_photos`, `user_recently_viewed` (INSERT/UPDATE), `user_favourites` (read)  
**API Endpoints:** `GET /api/v1/listings/:id`, `POST /api/v1/guests/me/recently-viewed`

---

### UC-5.10 — Check Listing Availability Calendar

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest is on a Listing Detail page (Hotel, Apartment, or Car Rental).

**Postconditions:**
- Guest can see which dates/date ranges are unavailable before committing to a booking.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Taps anywhere on the date picker area in the Book panel, or taps the "Check availability" link in the listing body. |
| 2 | System | Calls `GET /api/v1/listings/:id/availability?month=YYYY-MM` for the current and next calendar month in parallel. |
| 3 | System | Listing Service queries: `SELECT check_in, check_out FROM bookings WHERE listing_id = :id AND status IN ('confirmed', 'pending_payment') AND check_out >= CURRENT_DATE`. Computes unavailable date ranges. For cars: also checks unit_count — a date is fully unavailable only if all units are booked. |
| 4 | System | Returns `{ unavailable_ranges: [{ start: "YYYY-MM-DD", end: "YYYY-MM-DD" }, ...] }` (end is exclusive). |
| 5 | System | Renders a two-month calendar widget. Unavailable dates are shown in a muted/strikethrough style. Past dates are disabled. |
| 6 | Guest | Sees a visual heat-map of availability. Can tap an available check-in date; calendar then highlights valid check-out options (check-out must not cross an unavailable range). |
| 7 | Guest | Selects check-in and check-out (or pickup/return datetimes for cars). Book panel auto-populates and calculates the total. |
| 8 | Guest | May navigate forward/backward through months. System fetches additional months on demand (`GET /api/v1/listings/:id/availability?month=YYYY-MM`). |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.10A | Car with `unit_count > 1` | A date is greyed-out only if all units are booked. Otherwise the date appears available even if some units are taken. |
| AF-5.10B | Listing has iCal blocks (E13) | External calendar blocks (from Airbnb/Booking.com sync) are treated as confirmed bookings for display purposes; those dates appear unavailable. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.10A | Availability API call fails | Calendar renders with a warning banner: "Availability data could not be loaded. Please try again." All dates appear available (optimistic), but server-side checks at booking initiation (E6) will catch conflicts. |

**Data Entities Touched:** `bookings` (read), `calendar_blocks` (read, E13)  
**API Endpoints:** `GET /api/v1/listings/:id/availability`

---

### UC-5.11 — Save & Unsave a Listing (Favourites)

**Primary Actor:** Guest (Authenticated)  
**Preconditions:**
- Guest is authenticated.
- Guest is viewing a search results page or a Listing Detail page.

**Postconditions:**
- The listing is saved to or removed from the guest's Favourites. `user_favourites` table is updated.

**Main Success Scenario — Save:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Taps the heart icon on a listing card or Listing Detail page. The icon is currently hollow (not favourited). |
| 2 | System | Client sends `POST /api/v1/guests/me/favourites` with `{ listing_id }`. JWT required. |
| 3 | System | Server checks the listing exists and is not permanently banned. Upserts a row in `user_favourites (user_id, listing_id)`. |
| 4 | System | Returns HTTP 201 or 200. Client immediately fills the heart icon (optimistic UI). |

**Main Success Scenario — Unsave:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Taps the heart icon (currently filled). |
| 2 | System | Client sends `DELETE /api/v1/guests/me/favourites/:listingId`. JWT required. |
| 3 | System | Server deletes the `user_favourites` row. Returns HTTP 204. |
| 4 | System | Client immediately unfills the heart icon. |

**View Favourites List:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Navigates to **Saved Listings** (bottom nav "Saved" tab). |
| 2 | System | Calls `GET /api/v1/guests/me/favourites`. Returns a paginated list of favourited listings (20 per page) with key display data: photo, title, price, rating. |
| 3 | Guest | Taps a listing to view its detail page. |
| 4 | Guest | Taps a heart icon within the saved list to unsave. Row is removed with an animation. |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.11A | Unauthenticated guest taps the heart icon | Client displays a modal: "Sign in to save listings." Two CTAs: **Log In**, **Create Account**. No API call made. After login, the original save action is retried automatically. |
| AF-5.11B | A previously saved listing is no longer active/approved | In the Favourites list, the listing card shows a banner: "No longer available" (greyed out). **Book** button hidden. Heart icon shows with a strikethrough. The `user_favourites` row is retained. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.11A | `POST /api/v1/guests/me/favourites` returns 409 (already favourited) | Client treats as success (idempotent). UI already shows filled heart. |

**Data Entities Touched:** `user_favourites` (INSERT, DELETE, SELECT)  
**API Endpoints:** `POST /api/v1/guests/me/favourites`, `DELETE /api/v1/guests/me/favourites/:listingId`, `GET /api/v1/guests/me/favourites`

---

### UC-5.12 — Recently Viewed Listings

**Primary Actor:** Guest (Anonymous or Authenticated)  
**Preconditions:**
- Guest has previously viewed one or more Listing Detail pages during the current or a prior session.

**Postconditions:**
- Guest can review recently seen listings without repeating a search.

**Main Success Scenario — Authenticated Guest:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | When a Listing Detail page is loaded (UC-5.8, UC-5.9), client sends `POST /api/v1/guests/me/recently-viewed` with `{ listing_id }`. |
| 2 | System | Server upserts `user_recently_viewed`: if the row exists, updates `viewed_at = NOW()`; otherwise inserts. If the guest now has > 20 rows, the oldest row is deleted. Rows older than 30 days are purged by a nightly job. |
| 3 | Guest | Navigates to "Recently Viewed" section (homepage carousel or dedicated screen). |
| 4 | System | Calls `GET /api/v1/guests/me/recently-viewed`. Returns up to 20 listing stubs ordered by `viewed_at DESC`. |
| 5 | Guest | Taps a recently viewed listing. Navigates to the Listing Detail page. |

**Main Success Scenario — Anonymous Guest:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | When a Listing Detail page loads, client appends the `listing_id` to a `recently_viewed` array in `localStorage` / `AsyncStorage`. If array length > 20, oldest entry removed. Each entry stores `{ listing_id, viewed_at }`. Entries older than 30 days are pruned on next app load. |
| 2 | Guest | Returns to the homepage. Client reads `localStorage`, calls `POST /api/v1/listings/batch-summary` with the stored listing IDs to fetch display data. |
| 3 | System | Returns listing stubs for IDs that still exist and are active/approved. Deactivated listings are omitted. |
| 4 | Guest | Sees the recently viewed carousel. |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-5.12A | Anonymous guest creates an account / logs in | On first authenticated page load, client reads `localStorage` recently-viewed IDs, sends them to `POST /api/v1/guests/me/recently-viewed/import`. Server merges them into the server-side table (deduped, capped at 20). `localStorage` is cleared. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-5.12A | `POST /api/v1/guests/me/recently-viewed` fails (network error) | Silently swallowed — this is a non-critical tracking call. No error shown to guest. |

**Data Entities Touched:** `user_recently_viewed` (INSERT/UPDATE, SELECT, DELETE), `listings` (read for batch summary)  
**API Endpoints:** `POST /api/v1/guests/me/recently-viewed`, `GET /api/v1/guests/me/recently-viewed`, `POST /api/v1/listings/batch-summary`, `POST /api/v1/guests/me/recently-viewed/import`

---

## 6. Data Model

### 6.1 PostgreSQL Tables

```sql
-- Tracks every search for analytics
CREATE TABLE search_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,  -- nullable (anon)
    category        VARCHAR(20) NOT NULL CHECK (category IN ('hotel', 'apartment', 'car')),
    place_name      TEXT        NOT NULL,
    lat             NUMERIC(10,7) NOT NULL,
    lng             NUMERIC(10,7) NOT NULL,
    radius_km       SMALLINT    NOT NULL DEFAULT 25,
    check_in        DATE,
    check_out       DATE,
    pickup_datetime TIMESTAMPTZ,
    return_datetime TIMESTAMPTZ,
    guests          SMALLINT,
    filters_applied JSONB       NOT NULL DEFAULT '{}',
    sort_applied    VARCHAR(20) NOT NULL DEFAULT 'recommended',
    result_count    INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_logs_user     ON search_logs(user_id);
CREATE INDEX idx_search_logs_category ON search_logs(category, created_at DESC);
CREATE INDEX idx_search_logs_created  ON search_logs(created_at DESC);

-- Guest favourited listings
CREATE TABLE user_favourites (
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id  UUID    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX idx_user_favourites_user    ON user_favourites(user_id, created_at DESC);
CREATE INDEX idx_user_favourites_listing ON user_favourites(listing_id);

-- Server-side recently viewed history (authenticated guests only)
CREATE TABLE user_recently_viewed (
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id  UUID    NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX idx_recently_viewed_user ON user_recently_viewed(user_id, viewed_at DESC);
```

---

### 6.2 Elasticsearch Index Mapping — `listings`

The single `listings` index holds all three listing types. A `listing_type` discriminator field routes category-specific queries. The availability state is **not** stored in ES (it lives in PostgreSQL bookings); only status eligibility is indexed.

```json
{
  "mappings": {
    "properties": {
      "id":               { "type": "keyword" },
      "listing_type":     { "type": "keyword" },
      "status":           { "type": "keyword" },
      "provider_id":      { "type": "keyword" },

      "title":            { "type": "text", "analyzer": "standard", "fields": { "keyword": { "type": "keyword" } } },
      "description":      { "type": "text", "analyzer": "standard" },

      "location":         { "type": "geo_point" },
      "pickup_location":  { "type": "geo_point" },
      "city":             { "type": "keyword" },
      "country_code":     { "type": "keyword" },

      "currency":         { "type": "keyword" },
      "nightly_rate":     { "type": "float" },
      "daily_rate":       { "type": "float" },

      "rating_avg":       { "type": "float" },
      "review_count":     { "type": "integer" },
      "photo_count":      { "type": "integer" },

      "amenity_ids":      { "type": "keyword" },
      "cancellation_policy": { "type": "keyword" },

      "created_at":       { "type": "date" },
      "activated_at":     { "type": "date" },

      "is_accredited":    { "type": "boolean" },
      "star_rating":      { "type": "byte" },
      "claimed_star_rating": { "type": "byte" },

      "bedrooms":         { "type": "byte" },
      "bathrooms":        { "type": "byte" },
      "max_guests":       { "type": "byte" },
      "long_stay_discount_enabled": { "type": "boolean" },

      "vehicle_category": { "type": "keyword" },
      "seats":            { "type": "byte" },
      "doors":            { "type": "byte" },
      "transmission":     { "type": "keyword" },
      "fuel_type":        { "type": "keyword" },
      "ac":               { "type": "boolean" },
      "drive_type":       { "type": "keyword" },
      "mileage_policy":   { "type": "keyword" },
      "min_rental_days":  { "type": "byte" },
      "min_driver_age":   { "type": "byte" },
      "cross_border_allowed": { "type": "boolean" },
      "airport_pickup":   { "type": "boolean" },
      "delivery_available": { "type": "boolean" },
      "unit_count":       { "type": "byte" }
    }
  },
  "settings": {
    "number_of_shards":   3,
    "number_of_replicas": 1,
    "refresh_interval":   "10s"
  }
}
```

**Index sync events (BR-5.19):**

| Trigger | Fields Updated |
|---------|---------------|
| Listing status change | `status` |
| Price / currency edit | `nightly_rate`, `daily_rate`, `currency` |
| Photo added / deleted | `photo_count`, (remove from index if `photo_count = 0`) |
| Amenity change | `amenity_ids` |
| Review posted (E14) | `rating_avg`, `review_count` |
| Geocode assigned | `location`, `pickup_location` |
| Listing deactivated | Document deleted from index |

---

## 7. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/search` | Optional (JWT enriches `is_favourited`) | Main search endpoint — Hotels, Apartments, or Cars |
| `GET` | `/api/v1/listings/:id` | None (public) | Listing Detail — full data for any listing type |
| `GET` | `/api/v1/listings/:id/availability` | None (public) | Availability calendar for a listing. Query param: `month=YYYY-MM` |
| `POST` | `/api/v1/listings/batch-summary` | None (public) | Fetch display stubs for a set of listing IDs (used by Recently Viewed for anonymous users) |
| `POST` | `/api/v1/guests/me/favourites` | JWT required | Save a listing to Favourites |
| `DELETE` | `/api/v1/guests/me/favourites/:listingId` | JWT required | Remove a listing from Favourites |
| `GET` | `/api/v1/guests/me/favourites` | JWT required | Retrieve the authenticated guest's Favourites list (cursor-paginated, 20/page) |
| `POST` | `/api/v1/guests/me/recently-viewed` | JWT required | Record or refresh a listing view in the server-side history |
| `GET` | `/api/v1/guests/me/recently-viewed` | JWT required | Retrieve server-side Recently Viewed list (up to 20, ordered by `viewed_at DESC`) |
| `POST` | `/api/v1/guests/me/recently-viewed/import` | JWT required | Merge an array of `{ listing_id, viewed_at }` from client `localStorage` into the server-side table (used on first login) |

### `GET /api/v1/search` — Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | `hotel \| apartment \| car` | Yes | Listing type |
| `lat` | float | Yes | Geo-search centre latitude |
| `lng` | float | Yes | Geo-search centre longitude |
| `place_name` | string | No | Human-readable place name (stored in `search_logs`) |
| `radius_km` | 10 \| 25 \| 50 \| 100 | No | Default: 25 |
| `check_in` | `YYYY-MM-DD` | No | Hotels/Apartments — required for availability filtering |
| `check_out` | `YYYY-MM-DD` | No | Hotels/Apartments |
| `guests` | integer | No | Hotels/Apartments — informational only in V1 (no per-guest pricing) |
| `pickup_datetime` | ISO 8601 | No | Cars — required for availability filtering |
| `return_datetime` | ISO 8601 | No | Cars |
| `sort` | string | No | Default: `recommended` |
| `cursor` | string | No | Pagination cursor from previous page |
| `limit` | integer | No | Default: 20, max: 50 |
| `price_min` | float | No | Minimum nightly/daily rate |
| `price_max` | float | No | Maximum nightly/daily rate |
| `star_rating` | comma-separated integers | No | Hotels only |
| `amenity_ids` | comma-separated UUIDs | No | Must match all listed amenities |
| `is_accredited` | boolean | No | Hotels only |
| `rating_min` | float | No | Minimum `rating_avg` (e.g., 4.0) |
| `cancellation_policy` | string | No | `free \| moderate \| strict` |
| `bedrooms_min` | integer | No | Apartments only |
| `bathrooms_min` | integer | No | Apartments only |
| `max_guests_min` | integer | No | Apartments only |
| `long_stay_discount` | boolean | No | Apartments only |
| `vehicle_category` | comma-separated strings | No | Cars only |
| `transmission` | `automatic \| manual` | No | Cars only |
| `seats_min` | integer | No | Cars only |
| `ac` | boolean | No | Cars only |
| `mileage_policy` | `unlimited \| limited` | No | Cars only |
| `airport_pickup` | boolean | No | Cars only |
| `cross_border` | boolean | No | Cars only |
| `delivery` | boolean | No | Cars only |
| `max_driver_age_req` | integer | No | Cars only — filter listings whose `min_driver_age ≤ value` |

### `GET /api/v1/search` — Response Schema

```jsonc
{
  "search_id": "uuid",              // logged in search_logs
  "total_count": 142,               // total ES hits (before availability filter; approximate)
  "available_count": 87,            // after availability post-filter
  "next_cursor": "eyJzb3J0IjpbMC4...", // null if no more results
  "results": [
    {
      "id": "uuid",
      "listing_type": "hotel",
      "title": "Serena Hotel Nairobi",
      "slug": "serena-hotel-nairobi",
      "city": "Nairobi",
      "country_code": "KE",
      "distance_km": 1.4,
      "primary_photo_url": "https://cdn.zikabooking.com/...",
      "nightly_rate": 8500,
      "currency": "KES",
      "rating_avg": 4.7,
      "review_count": 234,
      "star_rating": 5,
      "is_accredited": true,
      "is_favourited": false,       // only if JWT provided
      "amenity_ids": ["wifi", "pool", "parking"],
      // Apartment-specific (when listing_type=apartment):
      "bedrooms": 2,
      "bathrooms": 1,
      "max_guests": 4,
      "long_stay_discount_enabled": true,
      // Car-specific (when listing_type=car):
      "vehicle_category": "suv",
      "seats": 7,
      "transmission": "automatic",
      "ac": true,
      "mileage_policy": "unlimited",
      "daily_rate": 4500,
      "airport_pickup": true,
      "delivery_available": false
    }
  ]
}
```

---

## 8. Acceptance Criteria

### AC-5.1 — Search Correctness
- [ ] Only listings with `status = 'approved'` (hotels) or `status = 'active'` (apartments, cars) are returned.
- [ ] A listing deactivated after being indexed does not appear in results within 60 seconds of deactivation.
- [ ] A listing with zero approved photos is not returned.
- [ ] Searching near a known location returns listings within the specified radius and excludes listings outside it.

### AC-5.2 — Availability Filtering
- [ ] A hotel/apartment with a confirmed booking for the exact requested date range is excluded from results.
- [ ] A car with all `unit_count` units booked for the requested period is excluded; one with at least one free unit is included.
- [ ] Performing a search without dates returns all geo/attribute-matching listings without availability filtering.

### AC-5.3 — SEO & SSR
- [ ] The search results page HTML served by the Next.js SSR includes a `<title>` tag and `<meta name="description">` tag.
- [ ] Schema.org JSON-LD is present and validates against Google's Rich Results Test for Hotel / LodgingBusiness / Product schemas.
- [ ] A direct URL to a search results page renders the same results as a client-side navigation to that URL.

### AC-5.4 — Filters & Sort
- [ ] Selecting price range [min, max] returns only listings whose rate falls within the range.
- [ ] Selecting `is_accredited = true` (hotel) returns only accredited hotel listings.
- [ ] Selecting bedrooms ≥ 2 (apartment) returns no studio or 1-bedroom apartments.
- [ ] Setting `rating_min = 4` returns no listings with `rating_avg < 4`.
- [ ] Switching sort to `price_asc` returns results ordered by ascending nightly/daily rate.
- [ ] Switching sort to `distance` returns results ordered nearest first.

### AC-5.5 — Car-Specific Rules
- [ ] Car listings whose `min_rental_days > requested_duration` are excluded from results.
- [ ] The licence plate field is absent from `GET /api/v1/listings/:id` responses for car listings for all unauthenticated and authenticated guest requests.
- [ ] Car pickup location pins on the map use `pickup_lat`/`pickup_lng`, not the provider's business address.

### AC-5.6 — Listing Detail Pages
- [ ] Navigating to a Listing Detail page for a listing that became inactive returns an appropriate HTTP 410 response with a user-facing message.
- [ ] Long-stay discount is shown in the Book panel (discounted rate, badge) when stay duration ≥ `long_stay_min_nights` and the toggle is enabled.
- [ ] All amenities stored in `listing_amenities` and `listing_custom_amenities` appear on the Listing Detail page.

### AC-5.7 — Favourites & Recently Viewed
- [ ] An unauthenticated guest who taps the heart icon is shown a login prompt; no `user_favourites` row is created.
- [ ] After login, the pending favourite save is retried automatically.
- [ ] A listing saved as a favourite appears in `GET /api/v1/guests/me/favourites`.
- [ ] Unsaving removes it from the Favourites list (DELETE + 204 response).
- [ ] An authenticated guest who views 25 listings over time has at most 20 entries in `user_recently_viewed`, with the oldest removed automatically.
- [ ] The Recently Viewed import endpoint (`POST .../recently-viewed/import`) successfully merges client-side history on first login.

---

*End of E5 — Search & Discovery — Next: E6 — Booking Engine & Reservation Locks*
