# Implementation Plan - ZikaBooking Premium Traveler Guest Portal

## Goal Description
Integrate the Zika-Booking frontend traveler module (`/traveller` route) with the backend `listing-service` and `auth-service` APIs without modifying the backend. We will implement a high-fidelity, visually stunning single-page application (SPA) layout that matches the uploaded image precisely. 

The application will support:
1. **Dynamic Authentication & Profiles**: Displays the guest name, loyalty tier (Bronze, Silver, Gold, Diamond), and points.
2. **Mockup-Perfect Landing Page**: Hero section with search card tabs (Hotels, Apartments, Cars), Trending Destinations, Featured Accommodations grid, Premium promo banners, Luxury Fleet grid, Recently Viewed, and Footer.
3. **Robust Backend Search & Filter Integration**: Queries `/listing-api/search` with appropriate coordinates based on selected destination, dates, and category.
4. **Interactive Simulated Vector Map & Split View**: Left-hand sidebar filters and listing cards feed; right-hand simulated SVG map with interactive floating price pins.
5. **Detailed Listing Sheet & Reservation Flow**: Detailed layout for stays vs cars, 5-minute reservation timer lock using `POST /bookings/initiate`, interactive checkout form, and voucher validation (supporting code `ZIKA30`).
6. **Checkout Payment & Confirmation**: Calls `POST /bookings` and simulates payment confirmation using `PATCH /bookings/:id/confirm`, awarding loyalty points instantly.
7. **Interactive Booking History**: Queries `GET /guests/me/bookings` to list guest bookings, showing status badges and allowing cancellations with refund calculations using `POST /bookings/:id/cancel`.
8. **Stunning Light Premium Theme**: Built using Inter & Outfit typography, rich gradients, micro-animations, drop shadows, and glassmorphism.

---

## User Review Required
> [!IMPORTANT]
> - **API Integration**: We will connect to `/listing-api/search`, `/bookings/initiate`, `/bookings`, `/bookings/:id/confirm`, `/guests/me/bookings`, and `/bookings/:id/cancel` endpoints proxied under `/listing-api` and `/api`.
> - **Mock/Dummy Data Fallbacks**: If the database is empty or the services return empty arrays, we will automatically fallback to pre-populating high-quality stays and luxury vehicles matching the mockup exactly (e.g., The Ritz-Carlton Paris, Bentley Flying Spur) so that the UI is fully functional and stunning.
> - **Fonts**: We will use premium styling with Inter and Outfit.

---

## Open Questions
- Do you want us to extract reusable sub-components into `apps/web/components/` or keep the Single-Page Application logic self-contained in `apps/web/app/traveller/page.tsx` to ensure absolute stability and ease of integration? *(Recommended: keep self-contained in a single page to avoid import resolving issues and maintain absolute control).*

---

## Proposed Changes

### [Component Name] Zika-Booking Web Client

#### [MODIFY] [page.tsx](file:///c:/Users/Salma/Documents/GitHub/Zika-Booking/apps/web/app/traveller/page.tsx)
- Complete rewrite of `/traveller/page.tsx` to implement:
  - Responsive state machine (`activeTab: "home" | "search" | "bookings"`).
  - Premium navbar matching the mockup with notifications and avatar.
  - Search bar tab inputs with autocomplete destinations (Paris, New York, Bali, Phuket, etc.) providing precise coordinate mapping required by the backend search API.
  - Featured stays and vehicles feed with rating badge, exceptional text, price per night/day, and reserving trigger.
  - Interactive SVG map layout with animated price pin tags that sync with the active listing.
  - Details panel with checkout details, driver requirements for cars, live countdown timer, and voucher code validation field.
  - Booking success modal displaying reference code, paid amount, and points earned.
  - Reservation history panel categorized by upcoming, completed, and cancelled bookings.

---

## Verification Plan

### Automated & Manual Verification
1. Run `pnpm --filter @zika/web typecheck` to verify zero TypeScript errors.
2. Build the production app using `pnpm --filter @zika/web build` to verify Next.js compiling succeeds.
3. Manually verify search results, filters, live countdown, voucher applying, checkout, and cancellation workflows.
