# E7 — Payment System (Stripe & Tara)

*Last updated: 2026-05-02 | Status: Complete*

---

## 1. Epic Summary

E7 defines how ZikaBooking processes payments, handles failures, and executes refunds across two payment rails: **Stripe** (global card / digital wallet payments) and **Tara** (African mobile money). The Payment Service sits between the guest-facing booking flow and both payment providers. It receives a `payment_context` from the Booking Service after a `pending_payment` record is created (E6 UC-6.3), orchestrates the appropriate payment provider flow, confirms or fails the booking via internal callbacks to the Booking Service (E6), and later processes refunds when cancellations occur.

ZikaBooking never stores raw card data. Stripe tokenises card details client-side (Stripe.js / Stripe React Native SDK); the Payment Service only ever handles Stripe PaymentIntent IDs. Tara mobile money numbers are stored masked (last 4 digits).

**Depends on:** E6 (Booking Engine — creates `pending_payment` record and supplies `payment_context`).  
**Feeds into:** E6 (confirm / fail callbacks), E8 (confirmation email triggered after payment success), E11 (commission & provider payout calculation — based on `payments` records), E12 (Provider Dashboard payment status).

---

## 2. Actors

| Actor | Description |
|-------|-------------|
| **Guest (Authenticated)** | Logged-in user who pays for a booking. |
| **Payment Service** | Internal Node.js microservice. Owns `payments`, `refunds`, and `payment_methods` tables. Orchestrates Stripe and Tara API calls. Calls Booking Service callbacks on payment outcomes. |
| **Stripe** | External payment processor for card and digital wallet payments globally. Provides PaymentIntents, SetupIntents, webhook events, and refund APIs. |
| **Tara** | External African mobile money platform. Provides STK push initiation, payment status polling, webhook callbacks, and refund initiation. |
| **Booking Service** | Internal microservice (E6). Creates `pending_payment` records and exposes confirm/fail callback endpoints. |
| **Scheduler** | Internal cron process. Polls Tara for pending payment status when webhook delivery is unreliable (fallback). |

---

## 3. Scope

**In scope (V1):**
- Payment session creation from booking context
- Stripe card payment (including 3DS / SCA authentication)
- Tara STK push mobile money payment
- Stripe and Tara webhook ingestion and signature verification
- Payment failure handling and booking failure callback
- Refund initiation and tracking (Stripe refunds; Tara reversals)
- Saving and managing guest payment methods (Stripe saved cards; Tara mobile numbers)
- Payment status polling endpoint for client use
- Payment retry up to 3 attempts per booking

**Out of scope (other epics):**
- Booking record lifecycle (E6)
- Confirmation email and PDF voucher (E8)
- Provider payout and commission disbursement (E11)
- Security deposit collection at vehicle pickup (handled offline by provider in V1)
- Currency conversion (informational only — BR-5.9; payments are always in listing currency)

---

## 4. Business Rules

| ID | Rule |
|----|------|
| **BR-7.1** | **Payment rail availability:** Stripe is available for all currencies and all guest locations. Tara is available only when the listing's `currency` is in the set of Tara-supported currencies (KES, NGN, GHS, ZAR, UGX, TZS) AND the guest's account has a Tara-registered mobile number or enters one at checkout. If Tara is not available, only Stripe is shown. |
| **BR-7.2** | **Payment amount integrity:** The Payment Service fetches `bookings.total_amount` and `bookings.currency` directly from the Booking Service (or its own database read) at payment initiation. The amount used to charge the guest is always sourced from the booking record, never from the client. Any client-supplied amount is ignored. |
| **BR-7.3** | **Idempotency:** Every charge attempt carries an idempotency key of the form `pay-{booking_id}-{attempt_number}`. Stripe's idempotency key mechanism and Tara's deduplication header use this value. If a network timeout occurs and the guest retries, the same idempotency key ensures no double charge. |
| **BR-7.4** | **Retry limit:** A guest may attempt payment for a given booking at most **3 times**. After the 3rd failure, the booking is set to `cancelled_by_system` and the guest must start a new booking. The `payments` table records all attempts. |
| **BR-7.5** | **Payment window:** The booking record's `status = 'pending_payment'` expires after 10 minutes (BR-6.16). If a payment is not captured within 10 minutes of booking creation, the Scheduler cancels the booking (regardless of any in-flight payment attempt). |
| **BR-7.6** | **Stripe PaymentIntent:** For Stripe payments, the Payment Service creates a PaymentIntent server-side with `amount` (in smallest currency unit, e.g. cents / kobo), `currency`, `capture_method = 'automatic'`, `metadata = { booking_id, booking_reference }`, and `statement_descriptor_suffix = 'ZIKA-{reference}'`. The client secret is returned to the client to complete payment client-side using Stripe.js or the Stripe React Native SDK. |
| **BR-7.7** | **Stripe 3DS / SCA:** When Stripe requires additional authentication (3DS), the Stripe SDK handles the redirect / challenge natively. The Payment Service does not need to manage 3DS state; it awaits the `payment_intent.succeeded` webhook event. |
| **BR-7.8** | **Tara STK push:** For Tara payments, the Payment Service calls the Tara `initiate_payment` API with `{ amount, currency, mobile_number, reference: booking_reference, description: "ZikaBooking – {listing_title}" }`. Tara pushes a payment prompt to the guest's handset. The guest enters their Tara PIN on their phone to authorise. The Payment Service awaits a Tara webhook (or polls the Tara status API as a fallback — BR-7.11). |
| **BR-7.9** | **Tara timeout:** If no Tara webhook or successful poll result is received within **90 seconds** of STK push initiation, the Payment Service marks the attempt as timed out. A timed-out attempt counts toward the 3-attempt limit. The guest is shown a "Mobile money request timed out" message and may retry. |
| **BR-7.10** | **Webhook signature verification:** Stripe webhooks must have a valid `Stripe-Signature` header (HMAC-SHA256, using the webhook signing secret). Tara webhooks must have a valid `X-Tara-Signature` header (HMAC-SHA256 using the Tara webhook secret). Requests failing signature verification are rejected with HTTP 400 and logged; they are not processed. |
| **BR-7.11** | **Tara polling fallback:** Every 15 seconds (up to the 90-second timeout), the Payment Service polls the Tara `payment_status` API for any Tara payment in `pending` state. This guards against unreliable webhook delivery in low-connectivity markets. On receiving a conclusive status (`successful` or `failed`), polling stops and the outcome is processed immediately. |
| **BR-7.12** | **Booking Service callbacks:** On a successful payment, the Payment Service calls `PATCH /api/v1/bookings/{booking_id}/confirm` (E6 UC-6.5) with `{ payment_id, payment_provider }`. On a final failure, it calls `PATCH /api/v1/bookings/{booking_id}/fail` with `{ failure_reason }`. These are internal mTLS-authenticated calls. |
| **BR-7.13** | **Card data storage:** ZikaBooking never stores raw card numbers, CVV codes, or expiry dates. Saved payment methods are stored as Stripe PaymentMethod IDs (`pm_xxx`). The guest's Stripe Customer ID (`cus_xxx`) is stored in the `users` table. Card metadata displayed to guests (last 4 digits, brand, expiry month/year) is retrieved from Stripe's API or cached locally at save time. |
| **BR-7.14** | **Tara mobile number storage:** Guest Tara mobile numbers are stored masked: only the last 4 digits are stored in plain text; the full number is stored encrypted (AES-256-GCM, key from KMS) in `payment_methods.mobile_number_encrypted`. The masked display format is `+XXX *** *** XXXX` (country code visible, digits masked). |
| **BR-7.15** | **Refund routing:** Refunds are always returned to the original payment method used for the charge. Cross-method refunds (e.g., refunding a Stripe charge to a Tara account) are not supported. The `refunds.payment_id` foreign key ensures the correct provider and PaymentMethod are used. |
| **BR-7.16** | **Refund SLA communication:** The guest is informed of expected refund timelines: Stripe card refunds: 5–10 business days; Tara reversals: 2–3 business days. The platform does not guarantee these timelines (they are provider-governed) but communicates them at point of cancellation. |
| **BR-7.17** | **Partial refunds:** The `refunds.amount` is set to `bookings.refund_amount` (computed by E6 per the cancellation policy). The Payment Service passes this amount to Stripe's Refund API or Tara's reversal API. Multiple partial refunds on a single payment are not supported in V1; only one refund record per payment. |
| **BR-7.18** | **Security deposit:** In V1 the security deposit (`bookings.security_deposit`) is **not** processed through the platform's payment system. It is collected by the provider directly at vehicle pickup. The Payment Service takes no action on `security_deposit`. |
| **BR-7.19** | **Currency:** All payment amounts are in the listing's currency (same as `bookings.currency`). No currency conversion is performed by the Payment Service. Stripe handles currency routing to acquire the payment in the correct currency. Tara payments must be in a Tara-supported currency (BR-7.1). |
| **BR-7.20** | **Stripe Connect readiness:** Provider payouts are handled via Stripe Connect in E11. The Payment Service charges to the platform's Stripe account (not the provider's). The `on_behalf_of` field is not used at payment time; E11 handles the transfer. |

---

## 5. Use Cases

### UC-7.1 — Initiate Payment Session

**Primary Actor:** Guest (Authenticated)  
**Preconditions:**
- A `pending_payment` booking record exists (created in E6 UC-6.3, step 10).
- The Booking Service has returned `payment_context: { booking_id, booking_reference, total_amount, currency, listing_title }` to the client.
- The booking is within the 10-minute payment window (BR-7.5).

**Postconditions:**
- A `payments` row is created with `status = 'initiated'`.
- The client has a Stripe `client_secret` (for Stripe flow) or a Tara confirmation (for Tara flow) needed to complete payment.
- The guest is on the Payment screen.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | The booking flow transitions from the Review screen (E6 UC-6.3) to the Payment screen. Client displays the `total_amount` and `currency` from `payment_context`. |
| 2 | System | Client calls `POST /api/v1/payments/initiate` with `{ booking_id, payment_provider: 'stripe' \| 'tara', payment_method_id (optional — saved PM) }`. |
| 3 | System | Payment Service validates: booking exists; `booking.status = 'pending_payment'`; booking is within the 10-minute window; attempt count < 3 (BR-7.4). |
| 4 | System | Payment Service reads `total_amount` and `currency` from the booking record (not from client — BR-7.2). Computes `attempt_number` (1 for first attempt). |
| 5 | System | Inserts a row into `payments` with `status = 'initiated'`, `attempt_number`, `idempotency_key = 'pay-{booking_id}-{attempt_number}'`. |
| 6 | System | **If `payment_provider = 'stripe'`:** Creates a Stripe PaymentIntent (see BR-7.6). Returns HTTP 200: `{ payment_id, client_secret, publishable_key }` to the client. Client proceeds to UC-7.2. |
|    |        | **If `payment_provider = 'tara'`:** Calls the Tara `initiate_payment` API (see BR-7.8). Returns HTTP 200: `{ payment_id, tara_reference, message: "Check your phone for a payment prompt" }` to the client. Client proceeds to UC-7.3. |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-7.1A | Guest has a saved payment method and selects it | Client sends `payment_method_id` in the request. Payment Service attaches the saved PM to the PaymentIntent (Stripe) or pre-fills the Tara mobile number. Guest skips manual entry on the Payment screen. |
| AF-7.1B | Only one payment rail is available (e.g., no Tara support for the currency) | Client only renders the available rail. Tara option is hidden if the booking currency is not Tara-supported (BR-7.1). |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-7.1A | Booking is not in `pending_payment` state (already confirmed, cancelled, or expired) | HTTP 409. Client shows: "This booking is no longer available for payment." |
| EX-7.1B | Attempt count = 3 (BR-7.4) | HTTP 429 `payment_attempts_exceeded`. Client shows: "You've reached the maximum number of payment attempts. Please start a new booking." |
| EX-7.1C | Stripe API unavailable at PaymentIntent creation | HTTP 503. Client shows: "Payment is temporarily unavailable. Please try again in a moment." No `payments` row is inserted (or it is rolled back). |
| EX-7.1D | Tara API unavailable at STK push initiation | HTTP 503. Client shows: "Mobile money is temporarily unavailable. Please try card payment or try again." |

**Data Entities Touched:** `payments` (INSERT — `initiated`), `bookings` (read), Stripe API (PaymentIntent create), Tara API (initiate_payment)  
**API Endpoints:** `POST /api/v1/payments/initiate`

---

### UC-7.2 — Complete Payment via Stripe

**Primary Actor:** Guest (Authenticated)  
**Preconditions:**
- Payment session is initiated (`payments.status = 'initiated'`, `payment_provider = 'stripe'`).
- Client has a Stripe `client_secret` and has loaded the Stripe SDK.

**Postconditions:**
- On success: `payments.status = 'captured'`. Payment Service calls E6 confirm callback. Booking status becomes `confirmed`.
- On failure: `payments.status = 'failed'`. Payment Service calls E6 fail callback (or books for retry if within attempt limit).

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | Payment screen renders: Stripe card entry component (Stripe.js CardElement on web; Stripe React Native PaymentSheet on mobile). |
| 2 | Guest | Enters card details (number, expiry, CVC) or selects Apple Pay / Google Pay. Taps **Pay [amount] [currency]**. |
| 3 | System | Stripe SDK submits the card details directly to Stripe servers. Stripe tokenises and confirms the PaymentIntent using the `client_secret`. |
| 4 | System | If Stripe requires 3DS authentication (SCA): The Stripe SDK presents the bank's authentication challenge inline (Face ID, OTP, redirect). Guest completes the challenge. |
| 5 | System | Stripe confirms the PaymentIntent and sends a `payment_intent.succeeded` webhook to `POST /api/v1/payments/stripe/webhook`. |
| 6 | System | Payment Service processes the webhook (UC-7.4): verifies signature, looks up `payment_id` from metadata, updates `payments.status = 'captured'`, `provider_payment_id = pi_xxx`, `captured_at = NOW()`. |
| 7 | System | Payment Service calls Booking Service: `PATCH /api/v1/bookings/{booking_id}/confirm` with `{ payment_id, payment_provider: 'stripe' }`. |
| 8 | System | Client receives confirmation (via polling `GET /api/v1/payments/{payment_id}/status` or WebSocket push). Navigates to Booking Confirmation screen. |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-7.2A | Guest uses a saved card | Client sends `payment_method_id` to UC-7.1. Stripe attaches the PM to the PaymentIntent. Step 2 is skipped (no card entry); guest just taps **Pay**. If 3DS is required on the saved card, step 4 still applies. |
| AF-7.2B | PaymentIntent requires 3DS and guest cancels the challenge | Stripe SDK returns a failure. Client shows: "Payment authentication was cancelled." Guest may try again (attempt count increments — AF-7.4A). |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-7.2A | Card declined | Stripe returns `card_declined` error code. Client shows: "Your card was declined. Please try a different card or contact your bank." Attempt count increments (BR-7.4). **Try Again** CTA presented. |
| EX-7.2B | Insufficient funds | Stripe returns `insufficient_funds`. Client shows: "Insufficient funds. Please try a different payment method." |
| EX-7.2C | Expired card | Stripe returns `expired_card`. Client shows: "Your card has expired. Please use a different card." |
| EX-7.2D | Webhook not received within 60 seconds of PaymentIntent creation | Client polls `GET /api/v1/payments/{payment_id}/status`. If Stripe PaymentIntent status is `succeeded`, Payment Service triggers confirm callback. If `requires_payment_method` (failed), triggers fail callback. |

**Data Entities Touched:** `payments` (UPDATE `captured`), Stripe API (PaymentIntent confirm via SDK), Booking Service confirm callback  
**API Endpoints:** Stripe webhook → `POST /api/v1/payments/stripe/webhook`; `GET /api/v1/payments/{id}/status` (client polling)

---

### UC-7.3 — Complete Payment via Tara (Mobile Money)

**Primary Actor:** Guest (Authenticated)  
**Preconditions:**
- Payment session is initiated (`payments.status = 'initiated'`, `payment_provider = 'tara'`).
- Guest has a Tara-registered mobile number and sufficient Tara balance.

**Postconditions:**
- On success: `payments.status = 'captured'`. Booking confirmed.
- On timeout / failure: `payments.status = 'failed'` or `'timed_out'`. Booking fails or guest retries.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | Payment screen shows: "A payment request of [amount] [currency] has been sent to your Tara mobile number ([masked number]). Please check your phone and enter your Tara PIN to confirm." |
| 2 | System | An animated spinner with a countdown (90 seconds — BR-7.9) is displayed. |
| 3 | Guest | Guest receives an STK push notification on their handset. Tara prompts for PIN confirmation. Guest enters their Tara PIN and confirms. |
| 4 | Tara | Tara processes the payment and calls `POST /api/v1/payments/tara/webhook` with the payment outcome. |
| 5 | System | Payment Service processes the Tara webhook (UC-7.4): verifies signature, updates `payments.status = 'captured'`, calls Booking Service confirm callback. |
| 6 | System | Client is polling `GET /api/v1/payments/{payment_id}/status`. It receives `status: 'captured'`. Client navigates to Booking Confirmation screen. |

**Alternative Flows:**

| ID | Trigger | Steps |
|----|---------|-------|
| AF-7.3A | Guest taps **Enter a different number** | Guest can enter a different Tara mobile number (e.g., a family member's). Payment Service cancels the previous STK push (Tara cancel API) if supported, and re-initiates with the new number. This counts as a new attempt. |
| AF-7.3B | Webhook not received; polling fallback triggers | Payment Service polls Tara `payment_status` API every 15 seconds (BR-7.11). If a conclusive status is received before the 90-second timeout, it is processed immediately. |
| AF-7.3C | Guest has no saved Tara number | Payment screen shows a number entry field. After entry, guest taps **Send Payment Request**. The number is used for this payment only (not saved automatically unless guest opts in at step 6+). |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-7.3A | 90-second timeout with no Tara response (BR-7.9) | `payments.status = 'timed_out'` (counts as a failed attempt). Client shows: "Your mobile money request timed out. The payment was not deducted from your account. Please try again or use a card." **Try Again** and **Pay with Card** CTAs. |
| EX-7.3B | Tara returns payment failed (insufficient funds / wrong PIN) | `payments.status = 'failed'`. Client shows: "Mobile money payment failed: [Tara error message]. Please check your balance or try again." Attempt count increments. |
| EX-7.3C | Tara STK push was sent but guest dismissed it (explicit rejection) | Tara webhook delivers `status: failed, reason: user_cancelled`. Same handling as EX-7.3B. |

**Data Entities Touched:** `payments` (UPDATE `captured` / `timed_out` / `failed`), Tara API (poll / webhook), Booking Service confirm callback  
**API Endpoints:** Tara webhook → `POST /api/v1/payments/tara/webhook`; `GET /api/v1/payments/{id}/status`

---

### UC-7.4 — Handle Payment Webhook

**Primary Actor:** Stripe / Tara (external webhook)  
**Preconditions:**
- A payment attempt is in progress (`payments.status = 'initiated'` or `'pending'`).
- The webhook carries a valid provider signature.

**Postconditions:**
- `payments` row is updated to the correct terminal status (`captured`, `failed`, `timed_out`).
- Booking Service confirm or fail callback is triggered.
- Duplicate webhook deliveries are idempotently handled.

**Main Success Scenario — Stripe:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Stripe | Delivers `payment_intent.succeeded` event to `POST /api/v1/payments/stripe/webhook`. |
| 2 | System | Payment Service verifies the `Stripe-Signature` header using the webhook signing secret (BR-7.10). Returns HTTP 400 immediately if invalid. |
| 3 | System | Extracts `metadata.booking_id` from the PaymentIntent object. Looks up the `payments` row. |
| 4 | System | Checks `payments.status`. If already `captured` (duplicate delivery), returns HTTP 200 immediately (idempotent). |
| 5 | System | Updates `payments.status = 'captured'`, `provider_payment_id = pi_xxx`, `captured_at = NOW()`. |
| 6 | System | Calls `PATCH /api/v1/bookings/{booking_id}/confirm` (internal). |
| 7 | System | Returns HTTP 200 to Stripe to acknowledge delivery. |

**Main Success Scenario — Tara:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Tara | Delivers payment outcome to `POST /api/v1/payments/tara/webhook`. |
| 2 | System | Verifies `X-Tara-Signature` header (BR-7.10). |
| 3 | System | Looks up `payments` row by `tara_reference`. Checks idempotency. |
| 4 | System | **If `status = 'successful'`:** Updates `payments.status = 'captured'`. Calls Booking Service confirm. |
|    |        | **If `status = 'failed'`:** Updates `payments.status = 'failed'`, records `failure_reason`. Calls Booking Service fail. |
| 5 | System | Returns HTTP 200 to Tara. |

**Failure Webhook Handling (both providers):**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | On receiving a failure event, updates `payments.status = 'failed'`, records `failure_code` and `failure_message`. |
| 2 | System | Calls Booking Service fail callback: `PATCH /api/v1/bookings/{booking_id}/fail`. |
| 3 | System | If `attempt_number < 3`: the guest may retry via UC-7.8 (attempt count is not final until booking is cancelled). |
|    |        | If `attempt_number = 3`: Booking Service sets booking to `cancelled_by_system`. |

**Data Entities Touched:** `payments` (UPDATE), Booking Service confirm/fail callbacks  
**API Endpoints:** `POST /api/v1/payments/stripe/webhook`, `POST /api/v1/payments/tara/webhook`

---

### UC-7.5 — Process Refund

**Primary Actor:** Booking Service (internal trigger)  
**Preconditions:**
- A booking has been cancelled (E6 UC-6.7 or UC-6.8) and `bookings.refund_amount > 0`.
- The corresponding `payments` row has `status = 'captured'`.
- No prior refund row exists for this `payment_id` (V1 supports one refund per payment — BR-7.17).

**Postconditions:**
- A `refunds` row is created with `status = 'pending'` initially, transitioning to `'succeeded'` or `'failed'` on provider response.
- Guest is informed of the refund via E8 (email) and push notification.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Booking Service | After a cancellation, calls `POST /api/v1/payments/refunds` (internal mTLS) with `{ booking_id, refund_amount, reason }`. |
| 2 | Payment Service | Validates: `bookings.refund_amount = refund_amount` (cross-checks amounts). Looks up `payment_id` for the booking. Verifies no existing refund for this payment (idempotency). |
| 3 | Payment Service | Inserts a `refunds` row: `status = 'pending'`, `amount = refund_amount`, `currency`, `payment_id`, `reason`. |
| 4 | Payment Service | **If `payments.payment_provider = 'stripe'`:** Calls Stripe Refund API: `POST /v1/refunds` with `{ payment_intent: pi_xxx, amount: refund_amount_in_smallest_unit, reason: 'requested_by_customer' }`. |
|    |                  | **If `payments.payment_provider = 'tara'`:** Calls Tara Reversal API with `{ tara_reference, amount, reason }`. |
| 5 | System | Updates `refunds.status = 'submitted'`, `provider_refund_id = re_xxx` (Stripe) or Tara reversal ID. |
| 6 | Stripe / Tara | Provider processes the refund and sends a webhook (`charge.refunded` for Stripe; reversal webhook for Tara) or the refund is confirmed synchronously (Tara V1 may be synchronous). |
| 7 | System | On `charge.refunded` webhook: updates `refunds.status = 'succeeded'`, `refunded_at = NOW()`. |
| 8 | System | Notification Service sends push to guest: "Your refund of [amount] [currency] is on its way. Expected: 5–10 business days (card) / 2–3 business days (Tara)." |
| 9 | E8 | Sends refund confirmation email to guest with refund details. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-7.5A | Stripe refund API returns an error (e.g., charge already fully refunded) | `refunds.status = 'failed'`, `failure_reason` recorded. An alert is sent to the Finance admin team for manual resolution (E9). |
| EX-7.5B | Tara reversal API returns an error | Same as EX-7.5A — escalated to Finance team. |
| EX-7.5C | `refund_amount = 0` (non-refundable cancellation) | Booking Service does not call the refund endpoint. No `refunds` row is created. |

**Data Entities Touched:** `refunds` (INSERT, UPDATE), `payments` (read), Stripe Refunds API / Tara Reversal API  
**API Endpoints:** `POST /api/v1/payments/refunds` (internal)

---

### UC-7.6 — Save Payment Method

**Primary Actor:** Guest (Authenticated)  
**Preconditions:**
- Guest is authenticated.
- Guest is either in the payment flow (saving for future use) or managing saved methods in Account Settings.

**Postconditions:**
- A `payment_methods` row is created linked to the guest.
- For Stripe: a SetupIntent is used to tokenise and save the card without charging.
- For Tara: the mobile number is encrypted and stored.

**Main Success Scenario — Stripe Card:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | On the Payment screen, checks **Save this card for future payments** (or visits Account Settings → Payment Methods → Add Card). |
| 2 | System | Client calls `POST /api/v1/guests/me/payment-methods/stripe/setup` to create a Stripe SetupIntent. Returns `setup_intent_client_secret`. |
| 3 | Guest | Enters card details. Stripe SDK confirms the SetupIntent (tokenises the card, verifying it with a $0 auth if needed). |
| 4 | Stripe | Returns `payment_method_id = pm_xxx`. Sends `setup_intent.succeeded` webhook to Payment Service. |
| 5 | System | Payment Service retrieves the PaymentMethod object from Stripe to extract display metadata: `{ brand, last4, exp_month, exp_year }`. |
| 6 | System | Inserts `payment_methods` row: `user_id`, `payment_provider = 'stripe'`, `provider_pm_id = pm_xxx`, `type = 'card'`, `last4`, `brand`, `exp_month`, `exp_year`, `is_default` (true if first saved method). |
| 7 | System | Returns HTTP 201 with the new saved method display data. |

**Main Success Scenario — Tara Mobile Number:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Enters Tara mobile number. Checks **Save this number for future payments**. |
| 2 | System | Client calls `POST /api/v1/guests/me/payment-methods/tara` with `{ mobile_number }`. |
| 3 | System | Payment Service validates the mobile number format (E.164). Encrypts the full number (AES-256-GCM). Stores masked version (last 4 digits). |
| 4 | System | Inserts `payment_methods` row: `type = 'mobile_money'`, `mobile_number_masked = '*** *** XXXX'`, `mobile_number_encrypted`. |
| 5 | System | Returns HTTP 201 with masked display data. |

**Data Entities Touched:** `payment_methods` (INSERT), Stripe SetupIntent API (Stripe flow)  
**API Endpoints:** `POST /api/v1/guests/me/payment-methods/stripe/setup`, `POST /api/v1/guests/me/payment-methods/tara`

---

### UC-7.7 — Manage Saved Payment Methods

**Primary Actor:** Guest (Authenticated)  
**Preconditions:**
- Guest is authenticated and has at least one saved payment method.

**Postconditions:**
- Guest can view, set default, or remove saved payment methods.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | Guest | Navigates to Account Settings → **Payment Methods**. |
| 2 | System | Calls `GET /api/v1/guests/me/payment-methods`. Returns list of saved methods: each with `id`, `type`, `last4` / `mobile_number_masked`, `brand` (cards), `exp_month/year` (cards), `is_default`. |
| 3 | Guest | Taps **Set as Default** on a non-default method. Client calls `PATCH /api/v1/guests/me/payment-methods/{id}` with `{ is_default: true }`. System sets the selected method as default and clears the previous default. |
| 4 | Guest | Taps **Remove** on a method. Client calls `DELETE /api/v1/guests/me/payment-methods/{id}`. |
| 5 | System | For Stripe cards: calls Stripe API to detach the PaymentMethod (`DELETE /v1/payment_methods/{pm_id}/detach`). Soft-deletes or hard-deletes the `payment_methods` row. |
|    |        | For Tara numbers: deletes the `payment_methods` row and clears the encrypted data. |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-7.7A | Guest tries to delete the only saved method | Allowed — no minimum required. If it is the default, the `is_default` flag is cleared; no new default is auto-assigned. |
| EX-7.7B | Stripe detach API fails | Log the error. The row is still soft-deleted locally (marked `is_deleted = true`). The PaymentMethod will be orphaned on Stripe; Finance team handles cleanup. |

**Data Entities Touched:** `payment_methods` (read, UPDATE, DELETE), Stripe PaymentMethod detach API  
**API Endpoints:** `GET /api/v1/guests/me/payment-methods`, `PATCH /api/v1/guests/me/payment-methods/{id}`, `DELETE /api/v1/guests/me/payment-methods/{id}`

---

### UC-7.8 — Payment Retry

**Primary Actor:** Guest (Authenticated)  
**Preconditions:**
- A payment attempt has failed (EX-7.2A–C, EX-7.3A–C).
- The booking is still in `pending_payment` state.
- `attempt_number < 3` (BR-7.4).
- The booking is within the 10-minute payment window (BR-7.5).

**Postconditions:**
- A new payment attempt is initiated (new `payments` row with incremented `attempt_number`).
- If the retry succeeds, booking is confirmed; if it fails and `attempt_number = 3`, booking is cancelled.

**Main Success Scenario:**

| Step | Actor | Action / System Response |
|------|-------|--------------------------|
| 1 | System | After a payment failure, the client displays the error and two CTAs: **Try Again** and **Use a Different Payment Method**. |
| 2 | Guest | Taps **Try Again** or **Use a Different Payment Method** (selects a different card or switches between Stripe and Tara). |
| 3 | System | Client calls `POST /api/v1/payments/initiate` again with the same `booking_id` (and optionally a different `payment_provider` or `payment_method_id`). |
| 4 | System | Payment Service increments `attempt_number`. Creates a new `payments` row for this attempt. New idempotency key: `pay-{booking_id}-{attempt_number}`. |
| 5 | System | Flow continues as UC-7.2 (Stripe) or UC-7.3 (Tara). |

**Exception Flows:**

| ID | Trigger | System Response |
|----|---------|-----------------|
| EX-7.8A | 3rd attempt fails | `payments.status = 'failed'`. Payment Service calls Booking Service fail callback. Booking is set to `cancelled_by_system`. Client shows: "We were unable to process your payment after 3 attempts. Your reservation has been released. Please start a new booking." |
| EX-7.8B | Guest tries to retry after the 10-minute booking window has closed | Payment Service validates the booking window (BR-7.5). HTTP 409 `booking_expired`. Client shows: "Your booking has expired. Please search again." |

**Data Entities Touched:** `payments` (INSERT new attempt row), `bookings` (read status + window)  
**API Endpoints:** `POST /api/v1/payments/initiate`

---

## 6. Data Model

```sql
-- Payment provider enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
        CREATE TYPE payment_provider AS ENUM ('stripe', 'tara');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM (
            'initiated',
            'pending',
            'captured',
            'failed',
            'timed_out',
            'refunded',
            'partially_refunded'
        );
    END IF;
END $$;

-- One row per payment attempt (up to 3 per booking)
CREATE TABLE payments (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id              UUID            NOT NULL REFERENCES bookings(id),
    payment_provider        payment_provider NOT NULL,
    status                  payment_status  NOT NULL DEFAULT 'initiated',
    attempt_number          SMALLINT        NOT NULL DEFAULT 1,
    idempotency_key         VARCHAR(100)    UNIQUE NOT NULL,
    -- ZIKA-internal: 'pay-{booking_id}-{attempt_number}'

    -- Provider references
    provider_payment_id     TEXT,           -- Stripe: pi_xxx  |  Tara: tara_txn_id
    provider_pm_id          TEXT,           -- Stripe: pm_xxx  |  Tara: mobile_number_masked

    -- Amount (immutable — copied from bookings at initiation time)
    amount                  NUMERIC(12, 2)  NOT NULL,
    currency                CHAR(3)         NOT NULL,

    -- Payment method display metadata (denormalized for history)
    payment_method_type     VARCHAR(20),    -- 'card', 'mobile_money', 'apple_pay', 'google_pay'
    card_brand              VARCHAR(20),    -- 'visa', 'mastercard', etc.
    card_last4              CHAR(4),
    mobile_number_masked    VARCHAR(20),

    -- Failure context
    failure_code            VARCHAR(100),
    failure_message         TEXT,

    -- Timestamps
    captured_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_booking   ON payments(booking_id, attempt_number DESC);
CREATE INDEX idx_payments_provider  ON payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX idx_payments_status    ON payments(status, created_at DESC);

-- Refunds (one per payment in V1)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
        CREATE TYPE refund_status AS ENUM ('pending', 'submitted', 'succeeded', 'failed');
    END IF;
END $$;

CREATE TABLE refunds (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id              UUID            NOT NULL REFERENCES payments(id),
    booking_id              UUID            NOT NULL REFERENCES bookings(id),
    amount                  NUMERIC(12, 2)  NOT NULL,
    currency                CHAR(3)         NOT NULL,
    status                  refund_status   NOT NULL DEFAULT 'pending',
    reason                  TEXT,           -- 'cancelled_by_guest', 'cancelled_by_provider', etc.
    provider_refund_id      TEXT,           -- Stripe: re_xxx  |  Tara: reversal_id
    failure_reason          TEXT,
    refunded_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (payment_id)     -- One refund per payment in V1
);

CREATE INDEX idx_refunds_booking ON refunds(booking_id);
CREATE INDEX idx_refunds_status  ON refunds(status, created_at DESC);

-- Saved payment methods (per guest)
CREATE TABLE payment_methods (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 TEXT            NOT NULL,
    payment_provider        payment_provider NOT NULL,
    type                    VARCHAR(20)     NOT NULL CHECK (type IN ('card', 'mobile_money')),

    -- Stripe
    provider_pm_id          TEXT,           -- pm_xxx (Stripe PaymentMethod ID)
    card_brand              VARCHAR(20),
    card_last4              CHAR(4),
    card_exp_month          SMALLINT,
    card_exp_year           SMALLINT,

    -- Tara
    mobile_number_masked    VARCHAR(20),
    mobile_number_encrypted BYTEA,          -- AES-256-GCM; decrypted only for STK push

    is_default              BOOLEAN         NOT NULL DEFAULT FALSE,
    is_deleted              BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pm_user         ON payment_methods(user_id, is_deleted) WHERE is_deleted = FALSE;
CREATE UNIQUE INDEX idx_pm_default ON payment_methods(user_id) WHERE is_default = TRUE AND is_deleted = FALSE;
```

### Redis Key Reference (Payment-Specific)

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `tara:poll:{payment_id}` | STRING | 90 s | Tara polling job marker — prevents duplicate poll goroutines |
| `pay:attempts:{booking_id}` | INTEGER | 24 h | Attempt counter per booking (fallback if DB count query is expensive) |

---

## 7. API Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/payments/initiate` | JWT (Guest) | Create a payment session; returns Stripe `client_secret` or Tara initiation confirmation |
| `GET` | `/api/v1/payments/{id}/status` | JWT (Guest) | Poll for current payment status — used by client after Stripe/Tara SDK handoff |
| `POST` | `/api/v1/payments/stripe/webhook` | Stripe signature | Stripe webhook receiver (signature-verified) |
| `POST` | `/api/v1/payments/tara/webhook` | Tara signature | Tara webhook receiver (signature-verified) |
| `POST` | `/api/v1/payments/refunds` | mTLS (Booking Service) | Initiate a refund; called by Booking Service after a cancellation with `refund_amount > 0` |
| `GET` | `/api/v1/payments/refunds/{id}` | mTLS (internal) | Get refund status (for internal monitoring and Finance dashboard in E9) |
| `POST` | `/api/v1/guests/me/payment-methods/stripe/setup` | JWT (Guest) | Create a Stripe SetupIntent to save a card without charging |
| `POST` | `/api/v1/guests/me/payment-methods/tara` | JWT (Guest) | Save a Tara mobile number |
| `GET` | `/api/v1/guests/me/payment-methods` | JWT (Guest) | List saved payment methods (display metadata only — no sensitive data) |
| `PATCH` | `/api/v1/guests/me/payment-methods/{id}` | JWT (Guest) | Update a saved method (e.g., set as default) |
| `DELETE` | `/api/v1/guests/me/payment-methods/{id}` | JWT (Guest) | Remove a saved payment method; detaches from Stripe |

---

## 8. Acceptance Criteria

### AC-7.1 — Payment Initiation
- [ ] `POST /api/v1/payments/initiate` with a valid `booking_id` for a `pending_payment` booking returns a Stripe `client_secret` (Stripe flow) or a Tara `tara_reference` (Tara flow) within 2 seconds under normal conditions.
- [ ] The amount used for the Stripe PaymentIntent or Tara STK push exactly matches `bookings.total_amount` regardless of any amount field sent by the client.
- [ ] If the booking is not in `pending_payment` state, the endpoint returns HTTP 409.
- [ ] After 3 failed attempts, a 4th `POST /api/v1/payments/initiate` for the same `booking_id` returns HTTP 429 `payment_attempts_exceeded`.

### AC-7.2 — Idempotency
- [ ] Sending the same Stripe `payment_intent.succeeded` webhook twice results in exactly one `payments` row update and exactly one Booking Service confirm callback (no double-confirmation).
- [ ] Two simultaneous `POST /api/v1/payments/initiate` calls for the same `booking_id` and `attempt_number` produce only one `payments` row (idempotency key constraint enforced by the UNIQUE index).

### AC-7.3 — Webhook Security
- [ ] A Stripe webhook with a tampered or missing `Stripe-Signature` header is rejected with HTTP 400 and not processed.
- [ ] A Tara webhook with an invalid `X-Tara-Signature` is rejected with HTTP 400 and not processed.
- [ ] Both webhook endpoints return HTTP 200 within 5 seconds of valid event processing to avoid provider retry storms.

### AC-7.4 — Tara Flow
- [ ] An STK push is delivered to the Tara-registered mobile number within 5 seconds of `POST /api/v1/payments/initiate` with `payment_provider = 'tara'`.
- [ ] If no Tara webhook is received within 90 seconds and polling also returns no conclusive status, `payments.status` is set to `timed_out` and the Booking Service fail callback is called.
- [ ] Polling the Tara status API occurs at 15-second intervals; the polling job stops immediately on receiving a conclusive status.

### AC-7.5 — Refunds
- [ ] A call to `POST /api/v1/payments/refunds` with `refund_amount = total_amount` results in a Stripe refund or Tara reversal for the exact amount stored on the `payments` row.
- [ ] A second call to `POST /api/v1/payments/refunds` for the same `payment_id` is rejected (UNIQUE constraint on `refunds.payment_id`), preventing double refunds.
- [ ] When `refund_amount = 0` (non-refundable), the Booking Service does not call the refund endpoint; no `refunds` row is created.

### AC-7.6 — Saved Payment Methods
- [ ] A saved Stripe card is stored as a Stripe PaymentMethod ID only; no raw card number, CVV, or full expiry date is persisted in ZikaBooking's database.
- [ ] A saved Tara mobile number is stored with only the last 4 digits in plain text; the full number is AES-256-GCM encrypted.
- [ ] `DELETE /api/v1/guests/me/payment-methods/{id}` for a Stripe card calls the Stripe detach API before removing the local record.

### AC-7.7 — Booking Interaction
- [ ] A successful Stripe `payment_intent.succeeded` webhook results in the booking transitioning from `pending_payment` to `confirmed` within 3 seconds of webhook arrival.
- [ ] A failed payment on the 3rd attempt results in the booking transitioning to `cancelled_by_system` and no further payment attempts being accepted for that `booking_id`.

---

*End of E7 — Payment System (Stripe & Tara) — Next: E8 — Billing, Confirmation Email & PDF Voucher*
