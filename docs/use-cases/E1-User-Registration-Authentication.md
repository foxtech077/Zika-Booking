# Epic 1 — User Registration & Authentication

**Epic ID:** E1  
**PRD Reference:** §2.1 – §2.5  
**Version:** 1.0  
**Date:** 2026-04-25  
**Status:** Ready for Review

---

## 1. Epic Summary

### Goal
Establish a secure, verified identity for every person interacting with ZikaBooking — guests, providers, and internal admin staff — before they can transact on the platform.

### Actors

| Actor | Description |
|---|---|
| Guest | A traveller registering to search and book accommodation or vehicles |
| Provider / Host | A business or individual registering to list hotels, apartments, or cars |
| Admin User | Any of the six internal roles (Super Admin, Admin, Country Manager, Sales, Support, Finance) accessing the admin panel |
| System | Automated platform processes (token generation, email dispatch, session management) |
| SendGrid | External email delivery service |
| Google OAuth | External identity provider |
| Apple OAuth | External identity provider |

### Scope — IN
- New account registration (Guest and Provider)
- Email verification flow
- OAuth sign-in (Google, Apple)
- Standard email/password sign-in
- Password reset
- Admin panel 2FA setup and login (TOTP + FIDO2)
- Session management and token refresh
- Account status transitions (suspend, ban — triggered by admin action)
- Sign out

### Scope — OUT
- Provider onboarding / listing creation (E2–E4)
- Admin user creation by another admin (E9)
- Biometric sign-in on device (E16 — platform layer)

### Key Business Rules
| ID | Rule |
|---|---|
| BR-1.1 | A new account starts in `pending_verification` status. No bookings or listings can be created until status is `active`. |
| BR-1.2 | Email address must be globally unique across all account types. |
| BR-1.3 | Password: minimum 8 characters, at least 1 uppercase, 1 number, 1 special character. |
| BR-1.4 | Verification token: 64-char hex (256-bit entropy via `crypto.randomBytes(32)`). Only SHA-256 hash stored in DB. |
| BR-1.5 | Verification token TTL: 24 hours. Purged hourly by background job. Single-use — marked `used = true` on first click. |
| BR-1.6 | Max 3 verification email resends per hour per user. Cooldown of 60 seconds between resends. |
| BR-1.7 | Rate limit on `/verify` endpoint: 10 requests/min per IP. |
| BR-1.8 | OAuth accounts (Google/Apple) are created with status = `active` immediately — email pre-verified by provider. |
| BR-1.9 | All admin panel users must complete 2FA on every login. No exceptions. |
| BR-1.10 | Super Admin requires FIDO2/WebAuthn hardware key in addition to TOTP. |
| BR-1.11 | Admin panel session expires after 8 hours of inactivity. |
| BR-1.12 | SMS 2FA is not offered on the platform. |
| BR-1.13 | Errors are returned field-level, never as a single block message. |
| BR-1.14 | If email already exists: error message reads exactly "An account with this email already exists." |
| BR-1.15 | On resend, the previous token is invalidated (superseded) before the new one is generated. |

---

## 2. Use Cases

---

### UC-1.1 — Register as Guest

**ID:** UC-1.1  
**Name:** Register as Guest  
**Primary Actor:** Guest  
**Secondary Actors:** System, SendGrid  
**Priority:** Critical  
**Platform:** Mobile App (iOS, Android), Web PWA

#### Preconditions
- The user has navigated to the registration screen.
- The user has not previously registered with this email address.
- The platform is reachable and SendGrid is operational.

#### Postconditions (Success)
- A new user record exists in `users` table with `status = pending_verification`, `user_type = guest`, `email_verified = false`.
- A `verification_tokens` record exists with the SHA-256 hash of the token, `expires_at = now + 24h`, `used = false`.
- A verification email is dispatched via SendGrid within 5 seconds.
- The user sees a confirmation screen instructing them to check their email.
- The user is NOT automatically signed in yet.

#### Postconditions (Failure)
- No user record is created.
- Field-level validation errors are displayed inline next to the relevant field.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest | Opens ZikaBooking app or web and taps/clicks "Sign Up" or "Create Account". |
| 2 | System | Displays the registration form with fields: First Name, Last Name, Email Address, Password, Confirm Password, Account Type selector (Guest / Provider). |
| 3 | Guest | Selects **Guest** as account type. |
| 4 | Guest | Enters First Name, Last Name, Email Address, Password, and Confirm Password. |
| 5 | Guest | Taps/clicks "Create Account". |
| 6 | System | Performs client-side validation: all required fields present, email format valid, password meets complexity rule (BR-1.3), passwords match. |
| 7 | System | Sends registration payload to the API (`POST /auth/register`). |
| 8 | System | API performs server-side validation: email format check, uniqueness check against `users` table, password strength check. |
| 9 | System | Creates user record: `status = pending_verification`, `user_type = guest`, `email_verified = false`, `password_hash = bcrypt(password, 12)`. |
| 10 | System | Generates verification token: `crypto.randomBytes(32).toString('hex')` → 64-char plain token. Computes `SHA-256(plain_token)` → stores hash in `verification_tokens`. Sets `expires_at = now + 24h`, `used = false`. |
| 11 | System | Enqueues verification email to SendGrid. Email dispatched within 5 seconds. Subject: "Verify your ZikaBooking email". Body contains verification link: `https://zikabooking.com/verify?token=<plain_token>`. |
| 12 | System | Returns HTTP 201 to client. |
| 13 | Guest | Sees confirmation screen: "Check your email — we've sent a verification link to [email]." with a "Resend email" option. |

---

#### Alternative Flows

**A1 — Email already registered**
- At step 8: uniqueness check fails.
- System returns HTTP 409. Error displayed inline on email field: "An account with this email already exists." (BR-1.14)
- Guest may tap "Sign In instead" link shown below the error.

**A2 — Client-side validation fails**
- At step 6: one or more fields fail validation.
- System highlights each failing field with an inline error message:
  - Empty first/last name: "First name is required." / "Last name is required."
  - Invalid email format: "Please enter a valid email address."
  - Password too weak: "Password must be at least 8 characters with 1 uppercase letter, 1 number, and 1 special character."
  - Passwords don't match: "Passwords do not match."
- Form is not submitted. Guest corrects fields and retries from step 5.

**A3 — SendGrid delivery failure**
- At step 11: SendGrid returns an error or times out.
- System schedules retry: 5 min → 30 min → admin alert after 3 failures.
- User record and token are still created.
- Guest sees confirmation screen as normal. They can use the resend option (UC-1.4) if the email does not arrive.

**A4 — Guest navigates away before completing form**
- No record is created. State is lost (form is not persisted server-side during entry).
- Guest must start over.

---

#### Exception Flows

**E1 — API unreachable (network error)**
- At step 7: request fails due to connectivity.
- Client displays: "Something went wrong. Please check your connection and try again."
- Form data is preserved in the input fields.

**E2 — Rate limit hit on registration endpoint**
- Server returns HTTP 429.
- Client displays: "Too many attempts. Please try again in a few minutes."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `users` | INSERT | `first_name`, `last_name`, `email`, `password_hash`, `status = pending_verification`, `user_type = guest`, `email_verified = false`, `created_at` |
| `verification_tokens` | INSERT | `user_id`, `token_hash`, `token_type = email_verification`, `expires_at`, `used = false`, `created_at` |
| `email_log` | INSERT | `user_id`, `type = verification`, `recipient`, `status`, `sent_at` |

#### API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create new user account |

---

### UC-1.2 — Register as Provider / Host

**ID:** UC-1.2  
**Name:** Register as Provider / Host  
**Primary Actor:** Provider  
**Secondary Actors:** System, SendGrid  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- The user has navigated to the registration screen.
- The user has not previously registered with this email address.

#### Postconditions (Success)
- A new user record exists with `status = pending_verification`, `user_type = provider`.
- Verification email dispatched within 5 seconds.
- Provider cannot list properties or receive bookings until email is verified.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Opens app or web and taps "Sign Up". |
| 2 | System | Displays registration form with account type selector. |
| 3 | Provider | Selects **Provider / Host** as account type. |
| 4 | System | Form dynamically reveals additional fields: **Business Name** (required), **Country** (required, dropdown). |
| 5 | Provider | Completes all fields: First Name, Last Name, Email, Password, Confirm Password, Business Name, Country. |
| 6 | Provider | Taps "Create Account". |
| 7 | System | Client-side validation: all required fields present including business name and country. |
| 8 | System | Sends payload to API (`POST /auth/register`). |
| 9 | System | Server validates: email format, uniqueness, password strength, business name not empty, country is valid ISO 3166-1 alpha-2 code. |
| 10 | System | Creates user record: `status = pending_verification`, `user_type = provider`, `business_name`, `country`. |
| 11 | System | Generates and stores verification token (same as UC-1.1, steps 10–11). |
| 12 | System | Returns HTTP 201. |
| 13 | Provider | Sees confirmation screen: "Check your email — we've sent a verification link to [email]." |

---

#### Alternative Flows

**A1 — Provider selects Guest then switches to Provider**
- Switching account type to Provider dynamically adds Business Name and Country fields.
- Previously entered personal details are retained.

**A2 — Email already registered**
- Identical to UC-1.1 A1.

**A3 — Business name missing**
- Inline error on Business Name field: "Business name is required."

**A4 — Country not selected**
- Inline error: "Please select your country."

---

#### Exception Flows
- Same as UC-1.1 exception flows.

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `users` | INSERT | `first_name`, `last_name`, `email`, `password_hash`, `status = pending_verification`, `user_type = provider`, `business_name`, `country`, `email_verified = false`, `created_at` |
| `verification_tokens` | INSERT | Same as UC-1.1 |

---

### UC-1.3 — Verify Email Address

**ID:** UC-1.3  
**Name:** Verify Email Address  
**Primary Actor:** Guest or Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App (deep link), Web PWA

#### Preconditions
- User has completed registration (UC-1.1 or UC-1.2).
- User has received the verification email.
- The verification token has not expired (within 24h) and has not been used.

#### Postconditions (Success)
- `users.status` → `active`
- `users.email_verified = true`, `users.email_verified_at = now`
- `verification_tokens.used = true`, `verification_tokens.used_at = now`
- User is automatically signed in (JWT issued, refresh token stored).
- User sees toast notification: "Email verified — welcome to ZikaBooking!"
- User is redirected to the home screen (guests) or provider onboarding prompt (providers).

#### Postconditions (Failure)
- User account remains in `pending_verification`.
- Token is not consumed.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest/Provider | Clicks the verification link in their email: `https://zikabooking.com/verify?token=<64-char-token>`. |
| 2 | System | On mobile: OS intercepts the URL via App Links (Android) or Universal Links (iOS) and opens the app. On web: browser navigates to the verification page. |
| 3 | System | Client sends `GET /auth/verify?token=<plain_token>` to the API. |
| 4 | System | Rate limit check: max 10 requests/min per IP (BR-1.7). Request proceeds if within limit. |
| 5 | System | Computes `SHA-256(plain_token)`. Queries `verification_tokens` for matching `token_hash` where `used = false` and `expires_at > now`. |
| 6 | System | Token found and valid. Begins atomic transaction: sets `token.used = true`, `token.used_at = now`; sets `users.status = active`, `users.email_verified = true`, `users.email_verified_at = now`. |
| 7 | System | Transaction committed. |
| 8 | System | Issues JWT access token (short-lived, e.g. 15 min) and refresh token (long-lived, stored in httpOnly cookie or secure storage). |
| 9 | System | Returns HTTP 200 with auth tokens. |
| 10 | System | Client stores tokens, updates local auth state. |
| 11 | System | Displays toast: "Email verified — welcome to ZikaBooking!" |
| 12 | System | Redirects user: Guest → Home screen. Provider → "Set up your first listing" prompt. |

---

#### Alternative Flows

**A1 — Token already used (single-use enforcement)**
- At step 5: token found but `used = true`.
- API returns HTTP 400. User sees: "This verification link has already been used. If you need to verify your email, please request a new link." with "Resend verification email" CTA.

**A2 — Token not found**
- At step 5: no matching token hash in DB.
- API returns HTTP 400. User sees: "This verification link is invalid. Please request a new one."

**A3 — User account already active**
- At step 6 (pre-check): `users.status` is already `active`.
- System still issues JWT and signs the user in gracefully.
- Toast: "You're already verified. Welcome back!"

**A4 — Mobile deep link not available (falls back to web)**
- If app is not installed, the universal/app link opens in the default browser.
- Web verification page handles the token in the same way as A.

---

#### Exception Flows

**E1 — Token expired**
- At step 5: `expires_at < now`.
- API returns HTTP 410 (Gone). User is shown the expiry page: "Your verification link has expired." with a prominent "Send a new verification link" CTA (leads to UC-1.4).

**E2 — Rate limit exceeded**
- At step 4: IP has exceeded 10 requests/min.
- API returns HTTP 429. User sees: "Too many requests. Please wait a moment and try again."

**E3 — Database transaction failure**
- At step 6–7: transaction rolls back.
- API returns HTTP 500. Token is NOT consumed. User sees: "Something went wrong. Please try clicking the link again."

---

#### Data Entities

| Entity | Operation | Fields Changed |
|---|---|---|
| `verification_tokens` | UPDATE | `used = true`, `used_at = now` |
| `users` | UPDATE | `status = active`, `email_verified = true`, `email_verified_at = now` |

#### API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/auth/verify?token=<token>` | Validate and consume a verification token |

---

### UC-1.4 — Resend Verification Email

**ID:** UC-1.4  
**Name:** Resend Verification Email  
**Primary Actor:** Guest or Provider  
**Secondary Actors:** System, SendGrid  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- User account exists with `status = pending_verification`.
- User is on the verification pending screen or the expired link screen.
- User has not exceeded the resend rate limit (max 3/hour per user, 60s cooldown).

#### Postconditions (Success)
- Previous active token for this user is invalidated (`invalidated_reason = superseded`).
- New token generated and stored.
- New verification email sent via SendGrid.
- 60-second cooldown begins on the resend button.

#### Postconditions (Failure)
- No new token generated.
- User shown appropriate rate-limit messaging.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest/Provider | Taps "Resend verification email" on the pending screen or expired link screen. |
| 2 | System | Checks resend rate: has the user requested a resend within the last 60 seconds? Is the hourly count < 3? |
| 3 | System | Both checks pass. |
| 4 | System | Invalidates all existing unused tokens for this user: sets `invalidated_reason = superseded`, `used = true`, `used_at = now`. |
| 5 | System | Generates a new 64-char token. Stores SHA-256 hash with fresh `expires_at = now + 24h`. |
| 6 | System | Dispatches new verification email via SendGrid. |
| 7 | System | Returns HTTP 200. |
| 8 | System | UI shows: "Verification email resent. Please check your inbox." Resend button disabled for 60 seconds with countdown displayed. |

---

#### Alternative Flows

**A1 — 60-second cooldown active**
- At step 2: last resend was less than 60 seconds ago.
- API returns HTTP 429. UI shows: "Please wait [X] seconds before requesting another email." Resend button remains disabled showing countdown.

**A2 — Hourly limit reached (3 resends)**
- At step 2: user has already resent 3 times in the current hour.
- API returns HTTP 429. UI shows: "You've requested the maximum number of verification emails. Please wait before trying again, or contact support." Support link displayed.

**A3 — Account already verified**
- API detects `users.status = active`.
- Returns HTTP 409. UI shows: "Your account is already verified. Please sign in."

---

#### Data Entities

| Entity | Operation | Fields Changed |
|---|---|---|
| `verification_tokens` (old) | UPDATE | `used = true`, `used_at = now`, `invalidated_reason = superseded` |
| `verification_tokens` (new) | INSERT | New token hash, `expires_at = now + 24h`, `used = false` |
| `email_log` | INSERT | `type = verification_resend`, `recipient`, `status`, `sent_at` |

#### API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/resend-verification` | Invalidate old token and send a new one |

---

### UC-1.5 — Sign In with Email and Password

**ID:** UC-1.5  
**Name:** Sign In with Email and Password  
**Primary Actor:** Guest or Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- User has a registered account.
- User knows their email and password.

#### Postconditions (Success)
- JWT access token and refresh token issued.
- User is signed in and redirected to their home/dashboard.

#### Postconditions (Failure)
- No tokens issued.
- Appropriate error displayed.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Navigates to sign-in screen. Enters email and password. Taps "Sign In". |
| 2 | System | Client sends `POST /auth/login` with `{ email, password }`. |
| 3 | System | Looks up user by email. User found. |
| 4 | System | Verifies `bcrypt.compare(password, users.password_hash)`. Match confirmed. |
| 5 | System | Checks `users.status`. Status is `active`. |
| 6 | System | Issues JWT access token (signed, short TTL) and refresh token (long TTL, stored as httpOnly cookie on web; in SecureStorage on mobile). |
| 7 | System | Returns HTTP 200 with user profile data and access token. |
| 8 | User | Redirected to home screen (Guest) or provider dashboard (Provider). |

---

#### Alternative Flows

**A1 — Account is `pending_verification`**
- At step 5: status check fails.
- System returns HTTP 403. UI shows: "Please verify your email address to sign in. [Resend verification email]".

**A2 — Account is `suspended`**
- At step 5: status = `suspended`.
- System returns HTTP 403. UI shows: "Your account has been suspended. Please contact support for assistance."

**A3 — Account is `banned`**
- At step 5: status = `banned`.
- System returns HTTP 403. UI shows: "Your account has been permanently removed from ZikaBooking."

**A4 — Incorrect password**
- At step 4: bcrypt comparison fails.
- System returns HTTP 401. UI shows inline error: "Incorrect email or password." (generic — does not reveal which field is wrong, prevents enumeration).

**A5 — Email not found**
- At step 3: no user with this email.
- System returns HTTP 401 with same generic message as A4: "Incorrect email or password."

**A6 — User taps "Forgot password?"**
- Flow exits to UC-1.7 (Password Reset).

---

#### Exception Flows

**E1 — Network error**
- Request fails. UI shows: "Unable to connect. Please check your network and try again." Email and password fields retain values.

---

#### Data Entities

| Entity | Operation | Notes |
|---|---|---|
| `users` | SELECT | Lookup by email for authentication |

#### API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Authenticate user and issue tokens |
| POST | `/auth/refresh` | Exchange refresh token for new access token |

---

### UC-1.6 — Sign In with Google (OAuth)

**ID:** UC-1.6  
**Name:** Sign In / Register with Google OAuth  
**Primary Actor:** Guest or Provider  
**Secondary Actors:** System, Google OAuth  
**Priority:** High  
**Platform:** Mobile App (Google Sign-In SDK), Web PWA

#### Preconditions
- User has a Google account.
- Google Sign-In is configured in the app.
- Platform: on iOS, Sign in with Apple must also be offered alongside (App Store requirement — UC-1.7).

#### Postconditions — New User (Success)
- User record created: `status = active`, `email_verified = true` (pre-verified by Google), `user_type` determined by the onboarding flow.
- Welcome email (no verification link) sent via SendGrid.
- JWT and refresh token issued.
- User lands on account type selection (Guest or Provider) if first time.

#### Postconditions — Returning User (Success)
- JWT and refresh token issued.
- User lands on home screen / provider dashboard.

---

#### Main Success Scenario (New User)

| Step | Actor | Action |
|---|---|---|
| 1 | Guest/Provider | Taps "Continue with Google" on sign-in or registration screen. |
| 2 | System | Initiates Google OAuth flow via platform SDK (Google Sign-In for React Native / Google Identity Services for web). |
| 3 | Google OAuth | User selects their Google account and grants permission. Google returns an ID token. |
| 4 | System | Client sends Google ID token to the backend: `POST /auth/oauth/google` with `{ id_token }`. |
| 5 | System | Backend verifies ID token with Google's public keys. Extracts `email`, `given_name`, `family_name`, `google_sub` (unique Google user ID). |
| 6 | System | Looks up `users` by email. No existing account found. |
| 7 | System | Creates user record: `status = active`, `email_verified = true`, `email_verified_at = now`, `oauth_provider = google`, `oauth_sub = google_sub`. |
| 8 | System | Enqueues welcome email (no verification link) via SendGrid. |
| 9 | System | Issues JWT and refresh token. Returns HTTP 201. |
| 10 | System | On client: user is signed in. Presented with account type selection screen (Guest / Provider) to complete profile setup. |
| 11 | Guest/Provider | Selects account type. If Provider: also enters Business Name and Country. |
| 12 | System | Updates `users` record with `user_type` and provider fields. Redirects to appropriate home screen. |

---

#### Main Success Scenario (Returning User)

| Step | Actor | Action |
|---|---|---|
| 1–5 | (Same as new user steps 1–5) | |
| 6 | System | Looks up `users` by email. Existing account found with `oauth_provider = google`. |
| 7 | System | Verifies account is `active`. Issues JWT and refresh token. Returns HTTP 200. |
| 8 | User | Redirected to home screen / dashboard. |

---

#### Alternative Flows

**A1 — Email exists as a password account**
- At step 6: email found but `oauth_provider IS NULL` (standard password registration).
- System returns HTTP 409. UI shows: "An account with this email already exists. Please sign in with your password." with a "Sign in with password" CTA.
- Account linking is not supported in v1.0.

**A2 — Google OAuth cancelled by user**
- At step 3: user dismisses the Google sign-in prompt.
- Flow returns to sign-in screen with no error. No record created.

**A3 — Google ID token invalid or expired**
- At step 5: verification with Google fails.
- System returns HTTP 401. UI shows: "Sign in with Google failed. Please try again."

**A4 — Suspended or banned account**
- At step 7 (returning user): status check fails.
- Same messaging as UC-1.5 A2/A3.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `users` | INSERT (new) or SELECT (returning) | `oauth_provider = google`, `oauth_sub`, `email_verified = true`, `status = active` |
| `email_log` | INSERT | `type = welcome`, `recipient`, `status` |

#### API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/oauth/google` | Verify Google ID token and issue platform tokens |

---

### UC-1.7 — Sign In with Apple (OAuth)

**ID:** UC-1.7  
**Name:** Sign In / Register with Apple OAuth  
**Primary Actor:** Guest or Provider  
**Secondary Actors:** System, Apple OAuth  
**Priority:** High — **Mandatory on iOS per App Store Review Guideline**  
**Platform:** Mobile App (iOS mandatory), Web PWA (Safari)

#### Preconditions
- User has an Apple ID.
- App is configured with Sign in with Apple entitlement (iOS) / Apple JS (web).
- NOTE: This use case is a **mandatory offering** on iOS — it must appear on any screen where social sign-in is presented (App Store Review Guideline 4.8).

#### Postconditions
- Identical to UC-1.6 but with Apple-specific nuances (see Alternative Flows).

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Guest/Provider | Taps "Sign in with Apple" button. |
| 2 | System | Initiates Apple OAuth via `ASAuthorizationAppleIDProvider` (iOS) or Apple JS (web). |
| 3 | Apple OAuth | User authenticates with Face ID / Touch ID or Apple ID password. Apple returns an authorization code and identity token. Apple may provide a relay email (`privaterelay@privaterelay.appleid.com`) if user chose to hide their email. |
| 4 | System | Client sends authorization code and identity token to backend: `POST /auth/oauth/apple`. |
| 5 | System | Backend validates identity token against Apple's public keys. Exchanges authorization code for refresh token (for future token refresh). Extracts `sub` (Apple's user ID — stable per app), `email` (may be relay address). |
| 6 | System | Looks up `users` by `oauth_sub` (Apple `sub`) first, then by email. New user path or returning user path proceeds identically to UC-1.6. |
| 7 | System | If new user and email is a relay address: stores relay email. User can optionally add a real email in profile settings later. |
| 8 | System | Issues JWT and refresh token. Welcome email or sign-in continues as per UC-1.6. |

---

#### Alternative Flows

**A1 — User hides email (Apple relay address)**
- At step 3: Apple provides `privaterelay@appleid.com` address.
- System stores the relay email as the user's email. All platform emails (booking confirmations, etc.) are forwarded via Apple's relay service.
- Platform must be registered as an Apple relay domain.
- Account type selection still required on first sign-in.

**A2 — Apple revokes the credential**
- System receives `com.apple.credential.revoked` notification via Apple server-to-server notification.
- System sets `users.oauth_revoked = true`. Next sign-in attempt returns HTTP 401 with "Please sign in again to reconnect your Apple account."

**A3 — Flow cancelled by user**
- User dismisses the Apple sheet. Returns to sign-in screen. No record created.

---

#### Data Entities
- Same as UC-1.6 with `oauth_provider = apple`, `oauth_sub = apple_sub`.

#### API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/oauth/apple` | Validate Apple identity token and issue platform tokens |

---

### UC-1.8 — Reset Password (Forgot Password)

**ID:** UC-1.8  
**Name:** Reset Password  
**Primary Actor:** Guest or Provider  
**Secondary Actors:** System, SendGrid  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- User has a password-based account (not OAuth-only).
- User knows their registered email address.

#### Postconditions (Success)
- A password reset token is generated and emailed.
- Upon using the token: `users.password_hash` updated with new bcrypt hash.
- Token is consumed (single-use).
- All existing refresh tokens for this user are invalidated (security: other sessions signed out).
- User is signed in with a new session.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | On sign-in screen, taps "Forgot password?". |
| 2 | System | Displays "Reset your password" screen with email field. |
| 3 | User | Enters their email address. Taps "Send reset link". |
| 4 | System | API: `POST /auth/forgot-password`. Looks up email in `users`. |
| 5 | System | **Always** returns HTTP 200 regardless of whether email exists (prevents user enumeration). Displays: "If an account with that email exists, we've sent a password reset link." |
| 6 | System | If email found and account is `active`: generates reset token (same entropy model as verification token, BR-1.4). Stores SHA-256 hash with `token_type = password_reset`, `expires_at = now + 1h`. Sends email with reset link. |
| 7 | User | Receives email. Clicks reset link: `https://zikabooking.com/reset-password?token=<plain_token>`. |
| 8 | System | Opens password reset form (app deep link or web page). Validates token: `SHA-256(token)` must match a valid, unused, non-expired `password_reset` token. |
| 9 | User | Enters new password and confirms it. Taps "Set new password". |
| 10 | System | Validates: password complexity (BR-1.3), passwords match. |
| 11 | System | Atomic transaction: updates `users.password_hash = bcrypt(new_password, 12)`. Marks token `used = true`. Invalidates all existing refresh tokens for this user. |
| 12 | System | Issues new JWT and refresh token. Returns HTTP 200. |
| 13 | User | Sees success message: "Your password has been updated. You're now signed in." Redirected to home screen. |

---

#### Alternative Flows

**A1 — Reset token expired (1h TTL)**
- At step 8: `expires_at < now`.
- UI shows: "This password reset link has expired. Please request a new one." with "Reset password" CTA back to step 1.

**A2 — Reset token already used**
- At step 8: `used = true`.
- UI shows: "This reset link has already been used. If you need to reset your password again, please request a new link."

**A3 — New password fails complexity check**
- At step 10: password does not meet BR-1.3.
- Inline error on password field. User corrects and retries step 9.

**A4 — OAuth-only account**
- At step 4: user found but `password_hash IS NULL` and `oauth_provider IS NOT NULL`.
- Despite the enumeration-safe HTTP 200 response, no reset email is sent.
- If the user calls support, they are advised to sign in via their OAuth provider.

---

#### Data Entities

| Entity | Operation | Notes |
|---|---|---|
| `verification_tokens` | INSERT | `token_type = password_reset`, 1h TTL |
| `verification_tokens` (used) | UPDATE | `used = true`, `used_at = now` |
| `users` | UPDATE | `password_hash` updated |

#### API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/forgot-password` | Request password reset email |
| POST | `/auth/reset-password` | Submit new password with valid reset token |

---

### UC-1.9 — Sign Out

**ID:** UC-1.9  
**Name:** Sign Out  
**Primary Actor:** Guest, Provider, or Admin User  
**Secondary Actors:** System  
**Priority:** High  
**Platform:** Mobile App, Web PWA, Admin Panel

#### Preconditions
- User is currently signed in with a valid session.

#### Postconditions
- Refresh token is revoked server-side.
- Local tokens (access token, refresh token) are cleared from device storage.
- User is redirected to the sign-in screen.
- All in-flight API requests using the old token receive HTTP 401 and are aborted.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | User | Taps "Sign Out" in the account menu or sidebar. |
| 2 | System | (Optional) Displays confirmation: "Are you sure you want to sign out?" |
| 3 | User | Confirms sign out. |
| 4 | System | Client sends `POST /auth/logout` with the current refresh token in the request body (or httpOnly cookie on web). |
| 5 | System | Server revokes the refresh token (adds to token denylist or deletes from `sessions` table). Access token expires naturally (short TTL). |
| 6 | System | Returns HTTP 200. |
| 7 | System | Client clears access token and refresh token from storage (SecureStorage on mobile, clears httpOnly cookie on web). |
| 8 | System | Clears local app state (auth store reset via Zustand). |
| 9 | User | Redirected to sign-in / landing screen. |

---

#### Alternative Flows

**A1 — Network unavailable during sign out**
- At step 4: request fails.
- Client still clears local tokens and auth state — user is effectively signed out locally.
- Server-side revocation will complete when connectivity is restored (best-effort retry or the refresh token simply expires naturally).

**A2 — Sign out from all devices**
- User selects "Sign out of all devices" in account security settings.
- `POST /auth/logout-all` revokes ALL refresh tokens associated with this user.
- All active sessions on other devices become invalid on next access token use.

---

#### API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/logout` | Revoke current refresh token |
| POST | `/auth/logout-all` | Revoke all refresh tokens for the user |

---

### UC-1.10 — Admin Panel: Set Up TOTP Two-Factor Authentication

**ID:** UC-1.10  
**Name:** Set Up TOTP Two-Factor Authentication (Admin Users)  
**Primary Actor:** Admin User (any of the 6 roles)  
**Secondary Actors:** System, TOTP Authenticator App (Google Authenticator, Authy, etc.)  
**Priority:** Critical  
**Platform:** Web Admin Panel only  
**Trigger:** Mandatory on first login to admin panel after account creation.

#### Preconditions
- Admin user account has been created by a Super Admin or Admin (UC in E9).
- Admin user is logging in to the admin panel for the first time.
- User has a TOTP-compatible authenticator app installed on their personal device.

#### Postconditions (Success)
- `admin_users.totp_enabled = true`.
- TOTP secret stored securely (encrypted at rest) in the database.
- Recovery codes generated and presented to the user once.
- Admin can now complete the 2FA step during all future logins (UC-1.11).

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Logs in with email and password at the admin portal URL. |
| 2 | System | Detects `totp_enabled = false`. Forces 2FA setup before proceeding. Cannot be skipped. |
| 3 | System | Generates a TOTP secret (RFC 6238 compliant, 160-bit base32). Displays setup screen. |
| 4 | System | Displays a QR code encoding `otpauth://totp/ZikaBooking:[admin_email]?secret=[base32_secret]&issuer=ZikaBooking`. |
| 5 | Admin | Opens authenticator app. Scans QR code (or manually enters the displayed base32 secret). |
| 6 | Admin | Authenticator app begins generating 6-digit TOTP codes (30-second window). |
| 7 | Admin | Enters the current 6-digit TOTP code from the app into the "Verify code" field. Taps "Verify". |
| 8 | System | Validates TOTP code server-side (allows ±1 time step for clock drift). |
| 9 | System | Code valid. Stores encrypted TOTP secret: `admin_users.totp_secret_encrypted = encrypt(secret)`, `admin_users.totp_enabled = true`. |
| 10 | System | Generates 8 one-time recovery codes. Displays them once on screen. |
| 11 | System | Displays warning: "Save these recovery codes in a secure place. They will not be shown again." Copy button and download as text file provided. |
| 12 | Admin | Confirms "I've saved my recovery codes" checkbox. Taps "Continue". |
| 13 | System | Marks setup complete. Issues admin session. Redirects to admin dashboard. |

---

#### Alternative Flows

**A1 — Incorrect TOTP code entered**
- At step 8: code validation fails.
- UI shows inline error: "Invalid code. Please check your authenticator app and try again." Admin retries step 7. After 5 consecutive failures, account is temporarily locked for 15 minutes.

**A2 — Admin manually enters secret instead of scanning**
- At step 5: admin taps "Can't scan? Enter this code manually" link.
- System displays plain text base32 secret. Flow continues from step 6.

---

#### Exception Flows

**E1 — Clock drift too large**
- At step 8: TOTP code fails even though user entered the displayed code.
- UI shows: "Code verification failed. Please ensure your device clock is set to automatic/network time and try again."

---

### UC-1.11 — Admin Panel: Sign In with TOTP 2FA

**ID:** UC-1.11  
**Name:** Sign In to Admin Panel (Email + Password + TOTP)  
**Primary Actor:** Admin User (roles: Admin, Country Manager, Sales, Support, Finance)  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Web Admin Panel only

#### Preconditions
- Admin user account is active and has `totp_enabled = true`.
- User has their authenticator app available.

#### Postconditions (Success)
- Admin session token issued (expires after 8 hours of inactivity — BR-1.11).
- Admin redirected to their role-appropriate dashboard.
- Login event logged to `audit_log`.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Navigates to admin panel URL. Enters email and password. Taps "Sign In". |
| 2 | System | Validates email/password as per UC-1.5 steps 3–5. |
| 3 | System | Password valid, account active. Does NOT issue session token yet. Returns a short-lived (5-minute) intermediate token and displays the 2FA screen. |
| 4 | Admin | Opens authenticator app. Reads the current 6-digit TOTP code. |
| 5 | Admin | Enters the 6-digit code on the 2FA screen. Taps "Verify". |
| 6 | System | Validates TOTP code against stored secret (±1 step clock drift tolerance). |
| 7 | System | Code valid. Issues full admin session token with `inactivity_timeout = 8h`. |
| 8 | System | Logs sign-in to `audit_log`: `action = admin_login`, `user_id`, `role`, `ip_address`, `timestamp`. |
| 9 | Admin | Redirected to admin dashboard appropriate for their role. |

---

#### Alternative Flows

**A1 — Wrong TOTP code**
- At step 6: validation fails.
- UI shows: "Invalid verification code. Please try again." (max 5 attempts, then 15-minute lockout with audit log entry).

**A2 — Lost authenticator — use recovery code**
- At step 5: admin taps "Use a recovery code".
- Admin enters one of their 8 single-use recovery codes.
- System validates code. If valid, marks it as used. Allows sign-in.
- System immediately prompts: "Your recovery code has been used. Please set up a new authenticator app to maintain access." (Forced 2FA re-setup on next action.)

**A3 — Intermediate token expired (5-minute window)**
- At step 5 (late): intermediate token is expired.
- UI shows: "Your session has timed out for security. Please start sign-in again." Redirects to step 1.

**A4 — Session inactivity timeout**
- After sign-in: if admin is inactive for 8 hours (BR-1.11), session token expires.
- Next admin action → HTTP 401. Client redirects to sign-in screen. Any unsaved admin form data is lost.

---

#### Data Entities

| Entity | Operation | Notes |
|---|---|---|
| `admin_users` | SELECT | Authenticate by email |
| `audit_log` | INSERT | Every sign-in attempt logged |

---

### UC-1.12 — Admin Panel: Super Admin Sign In with FIDO2/WebAuthn

**ID:** UC-1.12  
**Name:** Super Admin Sign In (Email + Password + FIDO2/WebAuthn Hardware Key)  
**Primary Actor:** Super Admin  
**Secondary Actors:** System, FIDO2/WebAuthn Hardware Security Key (e.g. YubiKey)  
**Priority:** Critical  
**Platform:** Web Admin Panel only  
**Note:** Super Admin requires hardware key IN ADDITION to TOTP, or as the primary strong factor. Per BR-1.10.

#### Preconditions
- Super Admin account is configured with both TOTP and a registered FIDO2 hardware key.
- Super Admin has their hardware key physically present.

#### Postconditions
- Same as UC-1.11 for session issuance and audit logging.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Super Admin | Navigates to admin panel. Enters email and password. |
| 2 | System | Validates credentials. Detects `role = super_admin`. Displays FIDO2 authentication step. |
| 3 | System | Issues WebAuthn challenge via `navigator.credentials.get()` with RP ID `admin.zikabooking.com`. |
| 4 | Super Admin | Inserts hardware key into USB port (or taps NFC key). Presses the key's physical button when prompted. |
| 5 | System | Hardware key signs the challenge with its private key. Browser returns the signed assertion. |
| 6 | System | Backend verifies assertion signature against the stored public key and validates the challenge. |
| 7 | System | Verification successful. Issues Super Admin session token. Logs to `audit_log`. |
| 8 | Super Admin | Redirected to Super Admin dashboard. |

---

#### Alternative Flows

**A1 — Hardware key not recognised / wrong key**
- At step 6: signature verification fails.
- UI shows: "Authentication failed. Please use your registered security key." Admin may retry.

**A2 — Hardware key not present**
- Super Admin cannot complete sign-in without the physical key. No alternative 2FA method is accepted for Super Admin.
- UI shows: "A registered security key is required to sign in as Super Admin. Please contact platform security if you have lost your key."

**A3 — Register a new FIDO2 key**
- Super Admin navigates to Account Security settings (while signed in).
- `POST /auth/webauthn/register` begins the registration ceremony.
- After the new key is registered, old keys can be deregistered.

---

### UC-1.13 — Account Status Transitions (Suspend / Ban)

**ID:** UC-1.13  
**Name:** Suspend or Ban a User Account (Admin Action)  
**Primary Actor:** Admin User (Super Admin, Admin, Country Manager within scope)  
**Secondary Actors:** System, Affected User  
**Priority:** High  
**Platform:** Web Admin Panel

#### Preconditions
- Admin is signed in with appropriate permissions.
- Target user account exists and is currently `active`.

#### Postconditions — Suspend
- `users.status = suspended`.
- User cannot sign in or perform any platform actions.
- All active reservation locks for this user are released.
- Audit log entry created.
- Notification sent to the affected user.

#### Postconditions — Ban
- `users.status = banned`.
- All active listings de-listed.
- All future bookings cancelled (refunds initiated per cancellation policy).
- Audit log entry created.

---

#### Main Success Scenario — Suspend

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Navigates to user management. Finds target user. Opens user profile. |
| 2 | Admin | Selects "Suspend account". |
| 3 | System | Displays confirmation modal: "Suspend this account? The user will immediately lose access to ZikaBooking. All active reservation locks will be released." Requires admin to enter a suspension reason (free text, required). |
| 4 | Admin | Enters reason. Confirms. |
| 5 | System | Atomic transaction: sets `users.status = suspended`. Revokes all refresh tokens. Releases all active reservation locks for this user. |
| 6 | System | Writes to `audit_log`: `action = account_suspended`, `target_type = user`, `target_id = user_id`, `old_value = active`, `new_value = suspended`, `reason`, `ip_address`, `timestamp`. |
| 7 | System | Sends notification email to affected user: "Your ZikaBooking account has been suspended. Please contact support." |
| 8 | Admin | Sees success confirmation. User record now shows status: Suspended. |

---

#### Main Success Scenario — Ban (Permanent)

| Step | Actor | Action |
|---|---|---|
| 1–3 | (Same as suspend) | Admin selects "Ban account (permanent)" instead. |
| 4 | Admin | Enters reason. Confirms. |
| 5 | System | Sets `users.status = banned`. Revokes all tokens. If provider: sets all listings to `permanently_banned`. Cancels all future bookings per cancellation policy. Initiates refunds. |
| 6 | System | Writes to `audit_log`. |
| 7 | System | Sends notification to user. |

---

#### Alternative Flows

**A1 — Unsuspend (Reinstate) Account**
- Admin selects "Reinstate account" on a suspended user.
- Confirmation modal: "Reinstate this account? The user will regain access to ZikaBooking."
- System sets `users.status = active`. Logs to `audit_log`.
- User notified by email: "Your ZikaBooking account has been reinstated."

**A2 — Admin attempts to ban a Super Admin**
- System returns HTTP 403: "You cannot suspend or ban a Super Admin account."

**A3 — Country Manager tries to act on out-of-scope user**
- API-level scope check fails. Returns HTTP 403.

---

#### Data Entities

| Entity | Operation | Fields Changed |
|---|---|---|
| `users` | UPDATE | `status = suspended` or `banned` |
| `audit_log` | INSERT | Full audit entry |
| `reservation_locks` | UPDATE | Status = `released` for all active locks |

---

## 3. Data Model — Epic 1 Entities

```
users
  id                    UUID PRIMARY KEY
  first_name            VARCHAR(100) NOT NULL
  last_name             VARCHAR(100) NOT NULL
  email                 VARCHAR(255) UNIQUE NOT NULL
  password_hash         VARCHAR(255) NULL  -- null for OAuth-only accounts
  status                ENUM('pending_verification','active','suspended','banned') NOT NULL DEFAULT 'pending_verification'
  user_type             ENUM('guest','provider') NOT NULL
  business_name         VARCHAR(255) NULL  -- providers only
  country               CHAR(2) NULL       -- providers only (ISO 3166-1)
  email_verified        BOOLEAN NOT NULL DEFAULT FALSE
  email_verified_at     TIMESTAMPTZ NULL
  oauth_provider        ENUM('google','apple') NULL
  oauth_sub             VARCHAR(255) NULL
  current_tier          ENUM('bronze','silver','gold','diamond') NOT NULL DEFAULT 'bronze'
  loyalty_points        INTEGER NOT NULL DEFAULT 0
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()

verification_tokens
  id                    UUID PRIMARY KEY
  user_id               UUID NOT NULL REFERENCES users(id)
  token_hash            CHAR(64) NOT NULL  -- SHA-256 of plain token
  token_type            ENUM('email_verification','password_reset') NOT NULL
  expires_at            TIMESTAMPTZ NOT NULL
  used                  BOOLEAN NOT NULL DEFAULT FALSE
  used_at               TIMESTAMPTZ NULL
  invalidated_reason    VARCHAR(50) NULL  -- 'superseded', 'expired'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()

admin_users
  id                    UUID PRIMARY KEY
  name                  VARCHAR(200) NOT NULL
  email                 VARCHAR(255) UNIQUE NOT NULL
  password_hash         VARCHAR(255) NOT NULL
  role                  ENUM('super_admin','admin','country_manager','sales','support','finance') NOT NULL
  country_scope         CHAR(2)[] NOT NULL DEFAULT '{}'
  totp_enabled          BOOLEAN NOT NULL DEFAULT FALSE
  totp_secret_encrypted TEXT NULL
  fido2_credential      JSONB NULL  -- super_admin only; stores public key + credential ID
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()

audit_log
  id                    UUID PRIMARY KEY
  user_id               UUID NOT NULL REFERENCES admin_users(id)
  role                  VARCHAR(50) NOT NULL
  action                VARCHAR(100) NOT NULL
  target_type           VARCHAR(50) NULL
  target_id             UUID NULL
  old_value             TEXT NULL
  new_value             TEXT NULL
  ip_address            INET NOT NULL
  timestamp             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Immutable: no UPDATE or DELETE permitted. 7-year retention.

email_log
  id                    UUID PRIMARY KEY
  user_id               UUID NULL REFERENCES users(id)
  booking_id            UUID NULL
  type                  VARCHAR(50) NOT NULL  -- 'verification', 'welcome', 'password_reset', etc.
  recipient             VARCHAR(255) NOT NULL
  status                ENUM('sent','failed','bounced') NOT NULL
  sendgrid_message_id   VARCHAR(255) NULL
  sent_at               TIMESTAMPTZ NULL
```

---

## 4. API Endpoint Summary — Epic 1

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Register new guest or provider |
| GET | `/auth/verify` | None | Verify email token |
| POST | `/auth/resend-verification` | None | Resend verification email |
| POST | `/auth/login` | None | Email + password sign in |
| POST | `/auth/logout` | Bearer token | Revoke refresh token |
| POST | `/auth/logout-all` | Bearer token | Revoke all refresh tokens |
| POST | `/auth/refresh` | Refresh token | Issue new access token |
| POST | `/auth/forgot-password` | None | Request password reset email |
| POST | `/auth/reset-password` | None | Submit new password with reset token |
| POST | `/auth/oauth/google` | None | Google OAuth sign in/register |
| POST | `/auth/oauth/apple` | None | Apple OAuth sign in/register |
| POST | `/admin/auth/login` | None | Admin panel email + password (step 1 of 2FA) |
| POST | `/admin/auth/totp/verify` | Intermediate token | Submit TOTP code (step 2 of 2FA) |
| POST | `/admin/auth/webauthn/challenge` | Intermediate token | Get FIDO2 challenge (Super Admin) |
| POST | `/admin/auth/webauthn/verify` | Intermediate token | Submit signed FIDO2 assertion |
| POST | `/admin/auth/totp/setup` | Admin session | Begin TOTP setup |
| POST | `/admin/auth/totp/confirm` | Admin session | Confirm TOTP setup with first code |
| POST | `/admin/auth/webauthn/register` | Admin session | Register a FIDO2 hardware key |

---

## 5. Acceptance Criteria

### AC-1.1 — Registration
- [ ] A guest can register with valid details and receives a verification email within 5 seconds.
- [ ] A provider sees Business Name and Country fields that are required before submission.
- [ ] Submitting a duplicate email returns an inline field error: "An account with this email already exists."
- [ ] A weak password (e.g. "password") is rejected with a field-level error before submission.
- [ ] Errors are shown per-field, not as a block message.

### AC-1.2 — Email Verification
- [ ] Clicking a valid verification link sets `status = active` and auto-signs in the user.
- [ ] Clicking an expired link shows the expiry page with "Send a new verification link" CTA.
- [ ] Clicking a used link shows a "link already used" message, not a generic error.
- [ ] The plain token is never stored in the database — only the SHA-256 hash.
- [ ] `/verify` endpoint is rate-limited to 10 requests/min per IP.

### AC-1.3 — Resend
- [ ] Resending invalidates the old token before generating a new one.
- [ ] A 60-second cooldown is enforced and shown on the UI with a countdown.
- [ ] After 3 resends in one hour, further attempts show a rate-limit message.

### AC-1.4 — OAuth
- [ ] Google sign-in creates an `active` account without a verification email.
- [ ] Apple sign-in is available on every iOS screen where Google sign-in appears.
- [ ] A relay email from Apple is stored correctly and emails route via Apple's relay.
- [ ] An OAuth sign-in with an email that already has a password account returns a friendly merge-prevention error.

### AC-1.5 — 2FA (Admin)
- [ ] An admin user with `totp_enabled = false` is forced through TOTP setup before any admin action.
- [ ] TOTP setup cannot be skipped.
- [ ] A Super Admin cannot complete login without a registered FIDO2 hardware key.
- [ ] Admin sessions expire after 8 hours of inactivity and require full re-authentication.
- [ ] Every admin login attempt (success and failure) is written to `audit_log` with IP address.

### AC-1.6 — Password Reset
- [ ] The forgot-password endpoint always returns HTTP 200 (prevents email enumeration).
- [ ] A valid reset token expires after 1 hour.
- [ ] Completing a password reset invalidates all existing refresh tokens (forces all devices to re-authenticate).

---

## 6. Security Notes

1. **Token storage:** Verification and reset token plain text is NEVER stored server-side. Only SHA-256 hash persisted.
2. **Password storage:** bcrypt with cost factor 12. Never stored in plaintext or reversible encryption.
3. **Enumeration prevention:** Login errors are generic ("Incorrect email or password"). Password reset always returns 200.
4. **FIDO2 origin binding:** WebAuthn credentials are bound to `admin.zikabooking.com` RP ID. Cannot be phished to another domain.
5. **TOTP secret encryption:** Stored encrypted at rest (AES-256). Key managed via AWS KMS or equivalent.
6. **Refresh token rotation:** On each refresh, old token is revoked and a new one issued (prevents token theft replay).
7. **Rate limiting:** Applied at API gateway level. Backed by Redis counters (not in-process) to work across microservice instances.

---

*End of E1 — User Registration & Authentication*  
*Next: E2 — Listing Management (Hotels)*
