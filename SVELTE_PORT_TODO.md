# SVELTE_PORT_TODO

Feature, flow and implementation parity checklist: **apps/web** (Next.js reference) → **apps/web-svelte** (SvelteKit port).

Legend:
- **MISSING** — not present in web-svelte; port from web.
- **DIFFERENT** — present but behaves differently; align if the web behavior is the desired one.
- **N/A** — intentionally handled already; do not re-port.

Scope notes: the provider dashboard and Stripe Connect (section E) are a large, separate effort — web-svelte currently links out to `${PROVIDER_URL}`. The FAQ provider copy is intentionally divergent (web-svelte already reflects the post-accreditation no-approval flow) and is excluded.

---

## A. Booking & Payments

- [ ] **A1. Stripe Connect onboarding** — MISSING. No `/stripe/connect/complete` or `/stripe/connect/refresh` routes; no merchant/payout API helpers (`getMerchantProfile`, `updateMerchantProfile`, `startStripeConnect`, `refreshStripeConnect`, `getStripeConnectStatus`, `getPayouts`, `getPayoutDetail`). web: `apps/web/app/stripe/connect/*`, `apps/web/lib/payment-api.ts:187-250`. Tied to E1/E2.
- [ ] **A2. Saved payment methods** — MISSING. `paymentMethodId` exists in the API surface but there is no `GET /guests/me/payment-methods` fetch or selection/default-method UI. web: `fetchSavedMethods()` in `apps/web/app/traveller/TravellerPageClient.tsx`.
- [ ] **A3. Voucher wallet + tier-aware validation** — MISSING. No `/vouchers/wallet` dropdown, no `/vouchers/applicable` auto-assignment, no promotion-override UI, `guestTier` never sent to `/vouchers/validate`. web: `apps/web/app/traveller/TravellerPageClient.tsx:857-957, 1674-1723, 1760-1805`. Svelte currently supports manual code only (`apps/web-svelte/src/routes/(main)/booking/review/+page.svelte:453-486`).
- [ ] **A4. Post-checkout "Ready to review" CTA** — MISSING. No `storeLatestReviewContext`/`GiveReviewEntry` equivalent; the review context is never persisted after payment. web: `apps/web/app/traveller/components/GiveReviewEntry.tsx`, `apps/web/services/traveller/index.ts:179-204`.
- [ ] **A5. Cancellation policy label on booking detail** — MISSING. web renders a "Cancellation Policy" card with a `POLICY_LABEL` mapping (flexible/moderate/strict/non_refundable); web-svelte booking detail pages only show the generic "check-in already started" note. web: `apps/web/app/bookings/[code]/BookingManageView.tsx`.
- [ ] **A6. Children count in checkout** — MISSING. web collects `adults` + `children`; web-svelte sends a single `guests` value with `children: 0` hardcoded. web-svelte: `apps/web-svelte/src/routes/(main)/booking/review/+page.svelte:525`.
- [ ] **A7. Pre-lock pricing-estimate call** — DIFFERENT (low). web calls `POST /bookings/pricing-estimate` before locking; web-svelte relies solely on `/bookings/initiate`. Decide whether to add the estimate call.
- [ ] **A8. Payment-step card logos** — DIFFERENT (minor). Payment step shows 6 logos vs 9 (missing UnionPay, Bank Debit, Klarna). web-svelte: `apps/web-svelte/src/routes/(main)/booking/review/+page.svelte:1613`.
- [ ] **A9. Message-host gating** — DIFFERENT. web shows the message-host entry for any listing; web-svelte gates it behind `allowPreBooking && auth.isAuthenticated`. web-svelte: `apps/web-svelte/src/routes/(main)/listings/[category]/[id]/+page.svelte:379-399`. Decide whether to relax the gate.

## B. Account pages

- [x] **B1. Bookings list parity** — FIXED in `apps/web-svelte/src/routes/(main)/(account)/bookings/+page.svelte`: `cancelled_by_provider` → "Cancelled by Host", red styling for all cancelled variants, the confirmed Cancel button is gated on a client-computed `canCancel` (start date in the future), cancellation shows a success/refund banner (or error), and zero-count status filter tabs are hidden — mirroring apps/web.
- [ ] **B2. Wishlist category tabs + per-category empty states** — MISSING. web has All/Hotels/Home/Cars tabs (currently commented out in web) and per-category empty states; web-svelte has a flat list + single empty state. web: `apps/web/app/traveller/wishlist/WishlistClient.tsx:240-262, 287-299`; web-svelte: `apps/web-svelte/src/routes/(main)/(account)/wishlist/+page.svelte`.
- [ ] **B3. Reviews page parity** — MISSING in `apps/web-svelte/src/routes/(main)/(account)/reviews/+page.svelte`:
  - "Hidden" stat card in the rating summary (Total/Average/Replies/Hidden). web: `apps/web/app/traveller/reviews/page.tsx:414-421`.
  - Provider reply date (`providerRepliedAt`) in the reply box, `:332-337`.
  - Listing-id context in the write form ("Listing {shortId}"), `:109-117`.
  - localStorage "latest review context" fallback when no `?bookingId` param, web: `apps/web/app/traveller/reviews/page.tsx:203-208`.
  - 30s auto-refresh of the list.
- [ ] **B4. Messages parity** — MISSING in `apps/web-svelte/src/routes/(main)/(account)/messages/+page.svelte`:
  - Per-conversation status badge (closed/open) in list + chat header. web: `apps/web/app/traveller/messages/page.tsx:392-396, 481-485`.
  - Unread pill badge ("X unread"/"All read"), `:329-333`.
  - Auto-select the first conversation on load, `:196-199`.
  - Auto-focus the composer when opened via `?conversationId=`, `:266-272`.
  - Send-error display (currently keeps text silently), `:121-123`.
  - List-pane "Refresh conversations" button, `:414-424`.
  - Absolute timestamps on bubbles (currently relative only), `:136`.
- [ ] **B5. Notifications parity** — MISSING (minor) in `apps/web-svelte/src/routes/(main)/(account)/notifications/+page.svelte` + `Header.svelte`:
  - Unread badge on the dropdown Notifications item (only the bell shows it).
  - Bell badge cap "99+" (currently "9+").
  - Mark-read rollback on API failure.
- [ ] **B6. Recently-viewed parity** — MISSING (minor) in `apps/web-svelte/src/routes/(main)/(account)/recently-viewed/+page.svelte`:
  - "Back → Home" navigation link.
  - Explicit per-card "View" button (web uses a `View` action).
- [ ] **B7. Account pill-nav** — MISSING (minor). `apps/web-svelte/src/routes/(main)/(account)/+layout.svelte:24-39` nav omits a Notifications entry (reachable only via the header bell).
- [ ] **B8. Profile host-status row** — N/A. Already removed in web-svelte with the host-accreditation port; do not re-add.

## C. Home / Search / Listings

- [x] **C1. Home "Stay in Excellence" interactive tabs** — FIXED. The category pills are now interactive buttons that re-fetch featured listings (and the category promotion) per category with skeleton placeholders and a dynamic "View all {category}" CTA, mirroring apps/web (`apps/web-svelte/src/routes/(main)/+page.svelte`).
- [x] **C2. Home featured promo badges** — FIXED. The home SSR load now fetches `/promotions/active?category=hotel`, and the featured cards receive a promotion badge (`%`/`OFF` label) via a new `promotionBadge` prop on `ListingCard`, mirroring apps/web (`apps/web-svelte/src/routes/(main)/+page.server.ts`, `apps/web-svelte/src/lib/components/ListingCard.svelte`).
- [x] **C3. Instant Book filter** — N/A. The listing-service `/search` has no `instant_booking` filter, and apps/web's category-page Instant Book toggle is commented out; the only live occurrence (web's home-search sidebar) sends a parameter the server ignores. Adding a non-functional toggle is not worthwhile.
- [x] **C4. Sort "Most Popular"** — N/A. apps/web's category pages expose exactly the same sort options as web-svelte; "Most Popular" (`popularity_desc`) only appears on web's home-search select, whose sort is never sent to the API, and the listing-service backend does not implement it as a distinct sort. No change.
- [x] **C5. Room-type selector in the booking widget** — FIXED. `BookingWidget.svelte` now shows a room-type dropdown (per-room price, defaulting to the cheapest) when a hotel has multiple active room types; the selected type drives the price, availability check and the `roomTypeId` sent to `/booking/review`, matching apps/web.
- [x] **C6. Public reviews section on listing detail** — FIXED. `ReviewsSection.svelte` is now a client-side paginated component (4 per page, prev/next) with an overall-rating summary card, a Refresh button, and error/retry state, fed by the SSR first page and the paginated `/listings/:id/reviews` endpoint. Note: apps/web's in-section "Write a Review" modal is commented out there, so it is not ported.
- [x] **C7. Guest wishlist heart + auth prompt** — FIXED. The heart/Save button is now always shown (listing cards + listing detail); a guest tapping it gets a "Sign in to save" dialog with a Sign In link, matching apps/web (`apps/web-svelte/src/lib/components/ListingCard.svelte`, `apps/web-svelte/src/routes/(main)/listings/[category]/[id]/+page.svelte`).
- [x] **C8. Map marker popups** — FIXED. Markers in `apps/web-svelte/src/lib/components/ListingMap.svelte` now open a popup with the listing name, price per night/day and star rating, mirroring apps/web.
- [x] **C9. `rooms` search param** — FIXED. `rooms` is now parsed into `SearchState` and sent to `/search` when >1, matching apps/web. Note the listing-service route ignores the param today, so this is contract parity (`apps/web-svelte/src/lib/load-listings.ts`, `apps/web-svelte/src/lib/listing-api.ts`).
- [x] **C10. Client-side text filter + `name` param** — FIXED. `/search` now also sends `name` alongside `q`, and `ListingsPage.svelte` applies the same client-side text gate as apps/web: for an unresolved destination only listings whose name/town/country/address/description (or car make/model) contain the term are rendered.
- [x] **C11. Hero autocomplete apiSuggestions** — FIXED. `HeroSearch.svelte` now accepts an `apiSuggestions` prop and blends listing/town suggestions with Nominatim results (Nominatim first, then filtered suggestions), mirroring apps/web. The home page feeds it town/listing names from the featured listings.
- [x] **C12. Loyalty tier perks** — FIXED. Each tier card now lists two perks, matching apps/web (`apps/web-svelte/src/routes/(main)/+page.svelte`).

## D. Auth & infrastructure

- [x] **D1. Register payload drops `dob`** — FIXED. The UI collects DOB (18+ gate) but `register()` never sent it; `dob` is now included in the payload (`apps/web-svelte/src/lib/auth-api.ts:94`, `apps/web-svelte/src/routes/auth/register/+page.svelte`). Note: the auth-service zod schema doesn't persist DOB, so this is payload parity with web, not new storage.
- [x] **D2. Reset-password route mismatch** — FIXED. The auth service emails `/reset-password?token=...` but web-svelte's screen lives at `/auth/reset-password`; added `src/routes/reset-password/+page.server.ts` that 308-redirects to `/auth/reset-password`, preserving the token.
- [x] **D3. Auth-endpoint 401 recovery** — FIXED. `request()` in `apps/web-svelte/src/lib/auth-api.ts` now refreshes the access token once (via the shared singleton) and retries on 401 for authenticated endpoints, clearing the session if the refresh fails. Unauthenticated entry points (login, register, verify, oauth, resend, forgot/reset password) never refresh.
- [x] **D4. `?next=` login behavior** — Decision: keep web-svelte's behavior. web-svelte honors `?next=` (the account-guard redirect relies on it, e.g. `/auth/login?next=/wishlist`); web always goes to `/`. No change.
- [x] **D5. `ACCOUNT_PENDING_APPROVAL` redirect target** — N/A / resolved. The auth service no longer emits that code (removed with the accreditation flow in PR #342), so it was dead code; removed the branch from `apps/web-svelte/src/routes/auth/login/+page.svelte`.
- [x] **D6. Register `?email=` prefill** — FIXED. The register page now prefills the email field from `?email=` (via an `$effect`), matching apps/web (`apps/web-svelte/src/routes/auth/register/+page.svelte`).
- [x] **D7. `/verify` expired-state email recovery** — FIXED. The `/verify` page now recovers the email from the error body's `fields.email` on `TOKEN_EXPIRED`, so "Send a new link" always appears, matching apps/web (`apps/web-svelte/src/routes/verify/+page.svelte`).

## E. Provider dashboard & Stripe Connect (in scope, large/separate effort)

- [ ] **E1. Provider dashboard** — MISSING in web-svelte. web has `apps/web/app/(provider)/dashboard/*`: dashboard overview (financial metrics, bookings, available units), listings (index / new / `[id]/edit` with Apartment/Hotel/Car forms, photo & document uploaders, geocoding), bookings, calendar (monthly availability), channel (iCal sync), earnings (revenue analytics), messaging, notifications, payments (bookings revenue, payout history/details/reports, settings), reviews (+ replies), settings. web-svelte currently links out to `${PROVIDER_URL}/dashboard` instead (`apps/web-svelte/src/lib/components/Header.svelte`, `apps/web-svelte/src/lib/config.ts`).
  - Requires a decision: build the dashboard in-app, or keep the external link (recommended for now — separate `apps/provider` exists).
- [ ] **E2. Stripe Connect** — MISSING. Onboarding redirect pages `/stripe/connect/complete` and `/stripe/connect/refresh`, plus the payment-settings onboarding start page and merchant/payout API helpers. web: `apps/web/app/stripe/connect/*`, `apps/web/app/(provider)/dashboard/payments/settings/page.tsx`. Depends on E1.

## Notes

- **Excluded:** FAQ provider copy (web-svelte already reflects the no-approval flow; web's copy is being updated by PR #342).
- **N/A (already ahead/extra in web-svelte, not port targets):** localized currency display + `CountrySelector`, `/my-bookings/[id]` signed-in booking detail, lock renewal, guest recently-viewed support (web has this too), error/retry states, notification deep-links, listing-detail JSON-LD/OG meta.
