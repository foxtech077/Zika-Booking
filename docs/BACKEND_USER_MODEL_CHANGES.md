# Backend Rework — Unified Users & Strictly-Anonymous Guests

> Summary for the **frontend team**. These changes landed on the backend
> (auth-service, listing-service, payment-service, and the shared
> `@zika/types` / `@zika/validators` packages). The frontend apps
> (`apps/web`, `apps/mobile`, `apps/admin`) have **not** been updated yet —
> this document is the contract to build against.

---

## 1. The big picture

Two concepts are gone: **provider** and **traveller** (and "guest" as an
account type). There is now exactly one account type — **`user`** — and one
kind of anonymous session — **`anonymous`**.

- A registered `user` can book **and** create listings (hosting is available to
  every registered account — there is no host application or approval step).
- An **anonymous** visitor can only browse public things, book, and pay.
  They cannot access settings, my-reservations, favourites, messaging, etc.
- Anonymous bookings are automatically attached to a user's account when
  they sign up / log in with the **same email** (adopt-by-email).

The JWT now carries which kind of session is making the request, so every
endpoint can enforce these rules.

---

## 2. The new auth model

### JWT payload (`type` claim)

| Old value   | New value  | Meaning                                  |
|-------------|------------|------------------------------------------|
| `"guest"`   | `"user"`   | Real registered account (a user)         |
| `"provider"`| `"user"`   | Real registered account (a user)         |
| —           | `"anonymous"` | Anonymous checkout session (no account) |

There is **no** `hostStatus` claim in the JWT anymore. Host accreditation and
the `Accreditation` table/enum were removed entirely — every registered user
can manage listings without an approval step.

### Account type field

- `user.userType` in API responses is always `"user"` now. Treat it as an
  extensible role field, not something you branch UI on.
- The old `/auth/account-type` endpoint and `needsAccountType` response flag
  are **removed**. Do not call them.

### Anonymous token endpoint renamed

- `POST /auth/guest-token` → **`POST /auth/anonymous-token`**
- Returns the same shape: `{ accessToken, expiresIn }`.
- Token `sub` prefix is `anon_...` (was `guest_...`).
- TTL env var renamed `JWT_GUEST_ACCESS_TTL_SECONDS` → `JWT_ANONYMOUS_ACCESS_TTL_SECONDS` (default 1800s).

---

## 3. What changed in each service

### Auth service (`services/auth-service`)

- `POST /auth/register` — **no longer accepts `userType`**. Payload is now:
  `firstName, lastName, email, password, confirmPassword` (+ optional
  `businessName`, `country`, `phone`, `acceptedTerms`, `acceptedPrivacy`).
- `POST /auth/oauth/google`, `POST /auth/oauth/apple` — **no longer accept
  `userType`**. No provider/guest branching; `needsAccountType` removed.
- `POST /auth/account-type` — **removed**.
- `requireAuth`-protected endpoints (`/auth/me`, `/auth/profile`,
  `/auth/change-password`, `/auth/accept-terms`, `/auth/logout-all`) now
  **reject anonymous tokens** with `403 ACCOUNT_REQUIRED`.
- `PATCH /auth/profile` — `businessName`/`country`/`phone` are no longer
  restricted to "provider" accounts; any user may set them.
- `/admin/users` filters by account status only (no host-status filter).

### Listing service (`services/listing-service`)

New middleware guard semantics:

| Guard        | Who passes                          | Used for |
|--------------|-------------------------------------|----------|
| `authenticate` | Anyone (optional)                 | Public search / listing detail (enriches `isFavourited` for real users only) |
| `requireAuth`  | `user` **or** `anonymous`         | Booking, payment-adjacent, own booking documents, `/bookings/claim` |
| `requireUser`  | `user` only (rejects anonymous)   | Favourites, recently-viewed, my-reservations, loyalty, messaging, notifications, reviews, profile photos, **and all listing-management routes** (any registered user) |

Endpoint-level impact:

- **Booking** (`/bookings/initiate`, `/bookings/pricing-estimate`,
  `/bookings/lock/*`, `/bookings`, `/bookings/:id/cancel`) — still works for
  anonymous. **No change**.
- **My reservations** (`GET /guests/me/bookings`) — **now requires a registered user**.
  Anonymous gets `403 ACCOUNT_REQUIRED`.
- **Single booking detail** (`GET /guests/me/bookings/:id`) — accepts a `user`
  **or** `anonymous` token, but only for the session that owns the booking
  (the guestId owner check rejects any other session). This lets anonymous
  guests view their own payment confirmation, matching how booking documents
  (receipt / voucher / QR) already behave. The list endpoint above stays
  user-only.
- **Favourites / Recently-viewed** (`/guests/me/favourites*`,
  `/guests/me/recently-viewed*`) — **now require a registered user**.
- **Loyalty** (`/guests/me/loyalty`, `/guests/me/points-history`),
  **Messaging**, **Notifications**, **Reviews**, **profile photos** — now
  require a registered user.
- **Vouchers** — `/vouchers/validate` + `/vouchers/applicable` still work for
  anonymous (checkout flow); `/vouchers/wallet` requires a user.
- **Booking documents** (receipt / voucher PDF / QR) — still accessible with
  an anonymous token for the user's own booking, and via the emailed link.

### Payment service (`services/payment-service`)

- Payment endpoints (`/payments/*`) — unchanged, anonymous can pay.
- **Merchant & payouts** (`/merchant/me/*`, `/provider/me/payouts*`) — now
  require a registered user (anonymous rejected). The old
  `if (userType !== "provider")` checks are gone — any registered user may
  set up merchant/payout details.
- **Payment methods** (`/guests/me/payment-methods*`) — now require a
  registered user (anonymous rejected).

---

## 4. Things frontend MUST update

1. **Stop sending `userType`** on register and OAuth flows.
2. **Stop calling `/auth/account-type`**; remove any `needsAccountType` handling.
3. **Rename guest-token usage**: call `POST /auth/anonymous-token` instead of
   `/auth/guest-token`.
4. **Route on `user.type` / a session flag, not `userType`**:
   - `"user"` → full experience (booking + hosting).
   - `"anonymous"` → public browsing + booking + payment only.
   - Do **not** treat `userType === "guest"` as "anonymous" anymore — that
     value no longer exists.
5. **Gate UI on the new guards' errors**: anonymous users hitting
   user-only endpoints get `403 { code: "ACCOUNT_REQUIRED" }`. Show a
   "create an account" prompt instead of an opaque error.
6. **Host onboarding**: there is none. Any registered user can open
   `/dashboard` and create/manage listings immediately. Listing creation no
   longer returns `403 HOST_REQUIRED`.
7. **Home/dashboard redirect**: all users share one home surface; there is no
   provider-vs-traveller split anymore. Host dashboard access depends only on
   being signed in.

### Migration / stale-code checklist

- Remove `userType === "provider"` / `userType === "guest"` comparisons.
- Remove `guest-token`, `account-type`, `needsAccountType` references.
- Remove `hostStatus`, `requireHost`, and host-application references
  (`/auth/host/profile`, `/admin/accreditations`, "become a host" UI).
- Update any TypeScript that imports `UserType` expecting `"guest" | "provider"`
  — it is now `"user"`.

---

## 5. Error codes you'll see

| Code                 | Meaning                                                     |
|----------------------|-------------------------------------------------------------|
| `403 ACCOUNT_REQUIRED` | Anonymous token hit an account-scoped endpoint. Prompt sign-in/sign-up. |
| `401 NO_TOKEN`         | Missing/invalid token.                                      |

---

## 6. What did NOT change

- Booking + payment flow for anonymous users (mint `anonymous-token` → book → pay).
- Adopt-by-email: anonymous bookings attach to the account on sign-up/login
  with the same email (server-side, no client action needed).
- Public search / listing detail / reviews display.
- Public API response shapes for listings and bookings.
