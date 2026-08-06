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

- [ ] **B1. Bookings list parity** — MISSING/DIFFERENT in `apps/web-svelte/src/routes/(main)/(account)/bookings/+page.svelte`:
  - `cancelled_by_provider` → "Cancelled by Host" label (currently collapsed to "Cancelled"), `:91-97`.
  - Red styling for all cancelled variants, `:105-110`.
  - `canCancel` gating on the list card cancel button (currently shown for any confirmed/pending booking), `:320-360`.
  - Cancellation success/refund feedback (web shows a result alert), `:112-132`.
  - Hide zero-count status filter tabs.
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

- [ ] **C1. Home "Stay in Excellence" interactive tabs** — MISSING. Svelte category pills are static links; web re-fetches featured listings per category with skeletons + a dynamic "View all {category}s" CTA. web: `apps/web/app/traveller/TravellerPageClient.tsx:3469-3541`; web-svelte: `apps/web-svelte/src/routes/(main)/+page.svelte:248-290`.
- [ ] **C2. Home featured promo badges** — MISSING. Home SSR never calls `/promotions/active`, so featured cards miss category promo badges. web-svelte: `apps/web-svelte/src/routes/(main)/+page.server.ts`.
- [ ] **C3. Instant Book filter** — MISSING. No `instant_booking` param in `apps/web-svelte/src/lib/components/ListingsFilterPanel.svelte` / `buildSearchApiParams` (`apps/web-svelte/src/lib/listing-api.ts:543-588`).
- [ ] **C4. Sort "Most Popular"** — DIFFERENT. `SORT_OPTIONS` lacks `popularity_desc`; web also defaults to `distance_asc`. web-svelte: `apps/web-svelte/src/lib/listing-meta.ts:67-73`.
- [ ] **C5. Room-type selector in the booking widget** — MISSING. web shows a room-type dropdown (per-room discounted prices, cheapest auto-selected); web-svelte shows the cheapest room as a static line. web-svelte: `apps/web-svelte/src/lib/components/BookingWidget.svelte:24-32`.
- [ ] **C6. Public reviews section on listing detail** — MISSING. Svelte renders the first 10 SSR reviews only; web has pagination, an overall-rating summary card, refresh/retry, and an in-page write-review modal. web: `apps/web/app/traveller/components/PublicReviewsSection.tsx`; web-svelte: `apps/web-svelte/src/lib/components/ReviewsSection.svelte` + `apps/web-svelte/src/routes/(main)/listings/[category]/[id]/+page.server.ts`.
- [ ] **C7. Guest wishlist heart + auth prompt** — DIFFERENT. web always shows the heart and opens an auth-prompt modal for guests; web-svelte hides the heart for unauthenticated users. Decide whether to adopt the prompt behavior. web-svelte: `apps/web-svelte/src/lib/components/ListingCard.svelte`.
- [ ] **C8. Map marker popups** — DIFFERENT (minor). `apps/web-svelte/src/lib/components/ListingMap.svelte` markers are click-only; web's react-leaflet markers open a popup with name/price/rating.
- [ ] **C9. `rooms` search param** — MISSING (minor). Collected in the hero but never mapped into `SearchState`/`buildSearchApiParams`; web sends `rooms` when >1.
- [ ] **C10. Client-side text filter + `name` param** — DIFFERENT (minor). web additionally filters results client-side and sends both `q` and `name`; web-svelte relies on the backend `q` only.
- [ ] **C11. Hero autocomplete apiSuggestions** — DIFFERENT (minor). Svelte's `HeroSearch.svelte` shows Nominatim suggestions only; web blends in town/listing-name suggestions from prior search results.
- [ ] **C12. Loyalty tier perks** — DIFFERENT (minor). Svelte shows 1 perk per tier; web shows 2. Align copy if desired.

## D. Auth & infrastructure

- [x] **D1. Register payload drops `dob`** — FIXED. The UI collects DOB (18+ gate) but `register()` never sent it; `dob` is now included in the payload (`apps/web-svelte/src/lib/auth-api.ts:94`, `apps/web-svelte/src/routes/auth/register/+page.svelte`). Note: the auth-service zod schema doesn't persist DOB, so this is payload parity with web, not new storage.
- [x] **D2. Reset-password route mismatch** — FIXED. The auth service emails `/reset-password?token=...` but web-svelte's screen lives at `/auth/reset-password`; added `src/routes/reset-password/+page.server.ts` that 308-redirects to `/auth/reset-password`, preserving the token.
- [x] **D3. Auth-endpoint 401 recovery** — FIXED. `request()` in `apps/web-svelte/src/lib/auth-api.ts` now refreshes the access token once (via the shared singleton) and retries on 401 for authenticated endpoints, clearing the session if the refresh fails. Unauthenticated entry points (login, register, verify, oauth, resend, forgot/reset password) never refresh.
- [ ] **D4. `?next=` login behavior** — DIFFERENT. web ignores `?next=` and always goes to `/` (or accept-terms); web-svelte honors `?next`. Decide which behavior is desired.
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
