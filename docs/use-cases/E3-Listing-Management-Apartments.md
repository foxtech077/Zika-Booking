# Epic 3 — Listing Management: Apartments

**Epic ID:** E3  
**PRD Reference:** §3.2, §3.4, §3.5  
**Version:** 1.0  
**Date:** 2026-04-25  
**Status:** Ready for Review

---

## 1. Epic Summary

### Goal
Enable providers to create and publish apartment listings through a self-service multi-step form that auto-activates upon submission — with no admin approval gate — so that listings go live immediately once basic validation passes.

### How This Epic Differs from E2 (Hotels)

| Dimension | Hotels (E2) | Apartments (E3) |
|---|---|---|
| Activation | Manual admin approval required | Auto-activated on submission |
| Admin review | Full accreditation queue | None at submission; reactive moderation only |
| Required documents | 3 accreditation documents | None |
| Star rating | Admin-assigned (1–5★) | Not applicable |
| Unique fields | Room type | Bedrooms, bathrooms, max guests, long-stay discount |
| Min photos for submission | 1 (recommended more) | ≥ 3 (enforced at submission) |
| Auto-suspension | Not applicable | Yes — 2 consecutive 1★–2★ reviews (see E14) |
| Search visibility | On admin approval | Immediately on auto-activation |

### Actors

| Actor | Description |
|---|---|
| Provider | An apartment host with an active, verified ZikaBooking provider account |
| System | Automated platform processes (validation, auto-activation, notifications) |
| Google Maps Platform | Geocoding, Places Autocomplete, embedded map |
| SendGrid | Transactional email notifications |
| Admin | Admin panel staff — involved only in reactive moderation (suspension/unblock), not at listing creation |

### Scope — IN
- Apartment listing creation, editing, and management (all fields)
- Google Places Autocomplete and live map pin (same behaviour as E2)
- Photo upload and management (minimum 3 required for activation)
- Services and amenities grid selection and custom entries (same grid as E2)
- Long-stay discount configuration
- Auto-activation validation logic
- Instant publication upon activation
- Deactivation and deletion by provider
- Admin reactive suspension (distinct from the auto-suspension triggered by reviews — that process is detailed in E14)

### Scope — OUT
- Hotel listing management (E2)
- Car rental listing management (E4)
- Review submission and auto-suspension trigger logic (E14)
- Admin unblock queue process (E14)
- Channel manager / iCal sync (E13)
- Booking engine (E6)
- Vouchers and promotions (E15)

### Key Business Rules

| ID | Rule |
|---|---|
| BR-3.1 | Apartments are auto-activated on submission. No admin review gate exists. |
| BR-3.2 | Auto-activation requires: all required fields populated, ≥ 3 photos uploaded, basic field validation passed. |
| BR-3.3 | Auto-activated listings appear in guest search immediately (within 5 minutes of activation, cache TTL). |
| BR-3.4 | Bedrooms, bathrooms, and max guests are integer counters. Bedrooms and bathrooms may be 0 (e.g. studio apartments). Max guests must be ≥ 1. |
| BR-3.5 | Price per night must be a positive decimal value. |
| BR-3.6 | Description maximum 1,000 characters. |
| BR-3.7 | Photos: maximum 30 images, ≤ 5 MB each, JPEG/PNG/WEBP. First photo = cover. Minimum 3 required for submission. |
| BR-3.8 | Address must be geocoded (lat/lng) — identical geocoding rules to hotels (BR-2.7 to BR-2.9 apply). |
| BR-3.9 | Long-stay discount is optional. When enabled: provider sets a minimum nights threshold and a discount type (percentage or fixed amount). Discount applied automatically at checkout for bookings meeting the threshold. |
| BR-3.10 | Cancellation policy options: Flexible, Moderate, Strict. Required field. |
| BR-3.11 | Minimum stay default is 1 night. Must be ≥ 1 if set. |
| BR-3.12 | Auto-suspension (2 consecutive 1★–2★ reviews) is system-triggered post-booking — handled in E14. This epic documents the listing status states, not the trigger logic. |
| BR-3.13 | A provider can have multiple apartment listings. Each activates independently. |
| BR-3.14 | Edits to an active listing are applied immediately with no re-review required. |
| BR-3.15 | No accreditation documents are required for apartments. |
| BR-3.16 | No star rating is applicable to apartments. |

---

## 2. Use Cases

---

### UC-3.1 — Create Apartment Listing (Start Draft)

**ID:** UC-3.1  
**Name:** Create Apartment Listing — Start New Draft  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in with `status = active` and `user_type = provider`.
- Provider navigates to "My Listings" and taps "Add new listing".

#### Postconditions (Success)
- A new listing record is created: `status = draft`, `category = apartment`, `provider_id = current_user`.
- Provider is taken into the multi-step apartment listing form.
- Draft is auto-saved at each step.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps "Add new listing" from the Provider Dashboard or "My Listings" screen. |
| 2 | System | Displays listing category selection: Hotel / Apartment / Car Rental. Each card shows a brief description. Apartment card reads: "List your apartment or self-contained unit. Goes live instantly." |
| 3 | Provider | Selects **Apartment**. |
| 4 | System | Creates a new listing record: `status = draft`, `category = apartment`, `provider_id = current_user`. |
| 5 | System | Opens the multi-step apartment form. Displays step progress indicator (Step 1 of 6). Shows a notice: "Your apartment will go live automatically once you complete all required fields and upload at least 3 photos. No admin review needed." |
| 6 | Provider | Proceeds through each step (UC-3.2 through UC-3.5). |

---

#### Alternative Flows

**A1 — Provider has an incomplete apartment draft already**
- Before creating a new draft, system checks for existing `draft` apartment listings.
- Displays prompt: "You have an unfinished apartment listing: '[Name or Untitled]'. Continue where you left off?" with "Continue" and "Start new listing" options.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | INSERT | `provider_id`, `category = apartment`, `status = draft`, `created_at` |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/listings` | Create new draft listing with `category = apartment` |

---

### UC-3.2 — Complete Apartment Listing Details (Step-by-Step Form)

**ID:** UC-3.2  
**Name:** Complete Apartment Listing Details  
**Primary Actor:** Provider  
**Secondary Actors:** System, Google Maps Platform  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- A draft apartment listing exists for this provider.
- Provider is on the listing form.

#### Postconditions (Success)
- All required fields populated and valid.
- Draft saved with all entered data.
- Provider can proceed to submission and auto-activation (UC-3.6).

---

#### Step 1 — Basic Information

**Fields:**

| Field | Type | Required | Validation / Notes |
|---|---|---|---|
| Listing title (Name) | Text | Yes | Max 200 chars. E.g. "Cosy 2-bed in Westlands". |
| Description | Textarea | No | Max 1,000 chars. Character counter shown in real time. |

**Main Success Scenario — Step 1:**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Enters a descriptive listing title (e.g. "Modern 2BR Apartment — Karen, Nairobi"). |
| 2 | Provider | Optionally enters a description of the property. Character counter decrements as they type. |
| 3 | Provider | Taps "Next". |
| 4 | System | Validates: title not empty. Description within 1,000 chars if entered. |
| 5 | System | Saves via `PATCH /listings/{id}`. Advances to Step 2. |

**Alternative Flows — Step 1:**

**A1 — Description exceeds 1,000 characters**
- Character counter turns red. Inline error: "Description cannot exceed 1,000 characters." "Next" is disabled until trimmed.

**A2 — Title left empty**
- Inline error on tap "Next": "Listing title is required."

---

#### Step 2 — Location & Address

This step is functionally identical to the hotel address step (UC-2.3). The same Google Places Autocomplete, geocoding API call, and draggable map pin behaviour applies. Town/city auto-fills from geocoding and is editable. Country auto-fills and is read-only.

**Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| Address | Text + Autocomplete | Yes | Google Places Autocomplete |
| Town / City | Text | Yes | Auto-filled from geocoding; editable by provider |
| Country | Text (read-only) | Yes | Auto-filled from geocoding |
| Map pin | Draggable map marker | Yes | Must be placed (geocoding confirms it) |

*Refer to UC-2.3 for full alternative flows (manual pin placement, API unavailability, etc.).*

---

#### Step 3 — Property Details

**Fields:**

| Field | Type | Required | Validation / Notes |
|---|---|---|---|
| Bedrooms | Integer counter (stepper) | Yes | ≥ 0 (0 = studio). Stepper: − / + buttons + manual entry. |
| Bathrooms | Integer counter (stepper) | Yes | ≥ 0. |
| Max guests | Integer counter (stepper) | Yes | ≥ 1. |

**Main Success Scenario — Step 3:**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 3 — Property Details. |
| 2 | System | Displays three stepper controls: Bedrooms (default 1), Bathrooms (default 1), Max guests (default 2). Each stepper has − and + buttons and a numeric input in the centre. |
| 3 | Provider | Taps + or − on each stepper, or directly types the value, to set the correct counts (e.g. 2 bedrooms, 1 bathroom, 4 guests). |
| 4 | System | Enforces floor values in real time: Bedrooms ≥ 0; Bathrooms ≥ 0; Max guests ≥ 1. The − button is disabled when the field is at its minimum. |
| 5 | Provider | Taps "Next". |
| 6 | System | Validates: all three fields are set. Max guests ≥ 1. Saves and advances to Step 4. |

**Alternative Flows — Step 3:**

**A1 — Provider manually types an invalid value in a stepper**
- E.g. provider types "-2" in the Bedrooms field.
- System immediately resets the field to 0 (the floor) and shows inline: "Minimum value is 0."

**A2 — Provider sets max guests to 0**
- The − button is disabled at 1. If manually typed as 0: inline error: "At least 1 guest must be accommodated."

**A3 — Studio apartment (0 bedrooms)**
- Bedrooms set to 0. Bathrooms set to 1. This is valid.
- A contextual hint appears: "Listing 0 bedrooms indicates a studio apartment. Guests will see this displayed as 'Studio'."

---

#### Step 4 — Pricing & Policies

**Fields:**

| Field | Type | Required | Validation / Notes |
|---|---|---|---|
| Price per night | Decimal input | Yes | > 0, max 2 decimal places |
| Currency | Select dropdown | Yes | Defaults to provider account locale; full ISO 4217 list |
| Minimum stay (nights) | Integer input | No | Default 1; must be ≥ 1 if set |
| Check-in time | Time picker | No | HH:MM (24h) |
| Check-out time | Time picker | No | HH:MM (24h); must be after check-in if both set |
| Cancellation policy | Single select | Yes | Flexible / Moderate / Strict |
| Smoking allowed | Toggle | No | Default: Off |
| Pets allowed | Toggle | No | Default: Off |

**Main Success Scenario — Step 4:**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 4 — Pricing & Policies. |
| 2 | Provider | Enters price per night (e.g. 85.00). |
| 3 | Provider | Selects or confirms the currency from the dropdown. |
| 4 | Provider | Optionally sets minimum stay (e.g. 3 nights). |
| 5 | Provider | Optionally sets check-in and check-out times using the time pickers. |
| 6 | Provider | Selects cancellation policy (e.g. Moderate). |
| 7 | Provider | Toggles Smoking and Pets as applicable. |
| 8 | Provider | Taps "Next". System validates and saves. Advances to Step 5. |

**Alternative Flows — Step 4:**

**A1 — Price entered as 0 or negative**
- Inline error: "Price per night must be greater than 0."

**A2 — Check-out time is before or equal to check-in**
- Inline error: "Check-out time must be after check-in time."

**A3 — Minimum stay set to 0**
- Field resets to 1 with inline: "Minimum stay must be at least 1 night."

**A4 — Cancellation policy not selected**
- On "Next": inline error: "Please select a cancellation policy."

---

#### Step 5 — Services & Amenities

This step is functionally identical to the hotel amenities step (UC-2.4). The same five-category amenity grid (Connectivity, Food & drink, Wellness, Comfort, Services) and free-text custom amenity input apply.

*Refer to UC-2.4 for the full main success scenario and alternative flows.*

Key note for apartments: The amenity "Kitchen / kitchenette" (under Food & drink) is particularly relevant and commonly selected for self-contained units. No changes to the grid itself.

---

#### Step 6 — Photos

This step is functionally identical to the hotel photo upload step (UC-2.5) with one critical difference:

**Minimum 3 photos are required before the listing can be submitted for auto-activation** (BR-3.7). In hotels, 1 photo is sufficient for submission (admin review assesses quality). For apartments, 3 is the auto-activation threshold.

**Fields:**

| Field | Type | Required | Validation |
|---|---|---|---|
| Photos | Multi-image upload | Yes | ≥ 3 required for activation; max 30; ≤ 5 MB each; JPEG/PNG/WEBP |

**Main Success Scenario — Step 6 (Apartment-specific behaviour):**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 6 — Photos. Instructions read: "Add at least 3 photos to activate your listing. Up to 30 photos. First photo is your cover. JPEG, PNG, or WEBP. Max 5 MB each." |
| 2 | System | Shows a photo counter: "0 / 3 minimum uploaded". Counter updates as photos are added. |
| 3 | Provider | Uploads 3 or more photos (same upload flow as UC-2.5 steps 2–9). |
| 4 | System | Once 3 photos are uploaded, the counter shows "3 / 3 minimum ✓" in green. The "Submit & Go Live" button becomes enabled. |
| 5 | Provider | Can continue adding more photos (up to 30) before submitting. |
| 6 | Provider | Satisfied with photos. Taps "Submit & Go Live" (proceeds to UC-3.6). |

**Alternative Flows — Step 6:**

**A1 — Provider taps "Submit & Go Live" with fewer than 3 photos**
- Button is disabled with a tooltip: "Upload at least 3 photos to activate your listing."
- The photo counter shows "X / 3 minimum" in amber (< 3) or green (≥ 3).

*All other photo alternative flows (reorder, delete, retry on failure, camera capture) are identical to UC-2.5.*

---

### UC-3.3 — Configure Long-Stay Discount

**ID:** UC-3.3  
**Name:** Configure Long-Stay Discount for an Apartment  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Medium  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is editing an apartment listing (draft or active).
- Provider navigates to the Pricing & Policies step or a dedicated "Offers" section in the listing edit view.

#### Postconditions (Success)
- Long-stay discount is configured and saved against the listing.
- For active listings: discount applies automatically to new bookings that meet the threshold going forward.
- Guest-facing listing detail page displays the long-stay offer (e.g. "Save 15% when you stay 7+ nights").

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On the Pricing & Policies step (or listing edit screen), locates the "Long-stay discount" section. Sees the toggle in the Off state. |
| 2 | Provider | Taps the toggle to enable it. |
| 3 | System | Reveals the long-stay discount configuration fields. |
| 4 | Provider | Sets **Minimum nights threshold**: the number of nights a booking must reach or exceed to qualify for the discount (e.g. 7). |
| 5 | Provider | Selects **Discount type**: Percentage (%) or Fixed amount. |
| 6 | Provider | Enters **Discount value**: e.g. 15 (meaning 15% off) or 50 (meaning $50/KES 50/etc. off the total). |
| 7 | System | Displays a live preview: "Guests who book 7+ nights will save 15% on the total nightly rate." |
| 8 | Provider | Reviews the preview. Taps "Save". |
| 9 | System | Validates: threshold ≥ 1 night; discount value > 0; for percentage type: discount ≤ 99%; for fixed: discount < price_per_night × threshold (cannot discount to ≤ 0). |
| 10 | System | Saves via `PATCH /listings/{id}`. Updates `long_stay_discount_enabled = true`, `long_stay_min_nights`, `long_stay_discount_type`, `long_stay_discount_value`. |
| 11 | System | On the guest-facing listing: a badge appears on the listing card and detail page: "Long-stay offer — save [X%/$X] on 7+ nights." |

---

#### Alternative Flows

**A1 — Provider disables a previously active long-stay discount**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Toggles the Long-stay discount toggle from On to Off. |
| 2 | System | Displays confirmation: "Disable your long-stay discount? Bookings already confirmed with this discount will not be affected. Future bookings will no longer receive the discount." |
| 3 | Provider | Confirms. |
| 4 | System | Sets `long_stay_discount_enabled = false`. Configuration fields are hidden. Confirmed bookings retain their discounted price (discount locked at booking creation time). |

**A2 — Discount percentage set to 100% or above**
- Inline error: "Discount cannot exceed 99%."

**A3 — Fixed discount equals or exceeds the total booking cost**
- At step 9: system calculates `price_per_night × threshold` and checks the discount does not exceed it.
- Inline error: "The fixed discount amount cannot exceed the total booking value for the minimum stay period."

**A4 — Minimum nights threshold set lower than the listing's minimum stay**
- E.g. listing minimum stay = 5 nights; provider sets long-stay threshold = 3 nights.
- Warning (not blocking): "Your long-stay discount threshold (3 nights) is less than your minimum stay (5 nights). The discount will apply to all bookings since the minimum stay already exceeds the threshold. Is this intentional?" Provider can proceed or adjust.

**A5 — Provider edits long-stay discount while active bookings exist**
- System allows edits. Warning displayed: "Changes apply to new bookings only. Guests with existing confirmed bookings retain their original discount."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | PATCH | `long_stay_discount_enabled`, `long_stay_min_nights`, `long_stay_discount_type`, `long_stay_discount_value` |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/listings/{id}` | Save long-stay discount configuration |

---

### UC-3.4 — View Apartment Listing Submission Preview

**ID:** UC-3.4  
**Name:** Review Listing Summary Before Activation  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- All required fields are completed.
- At least 3 photos are uploaded.
- Provider is on the final step of the listing form.

#### Postconditions
- Provider has reviewed all entered information.
- Provider proceeds to submit (UC-3.6) or returns to edit any step.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | After completing Step 6 (Photos), arrives at the "Review & Go Live" summary screen. |
| 2 | System | Displays a read-only preview of the entire listing as it will appear to guests. Sections shown: |
| | | • Cover photo (large hero image) |
| | | • Listing title and location (town, country) |
| | | • Property details: bedrooms, bathrooms, max guests |
| | | • Price per night with currency |
| | | • Long-stay discount (if configured) |
| | | • Cancellation policy |
| | | • Check-in / check-out times (if set) |
| | | • Minimum stay (if set) |
| | | • Smoking / pets policy |
| | | • Amenities list (standard + custom) |
| | | • All photos in a scrollable strip |
| | | • Full description |
| | | • Map with pin |
| 3 | System | Runs the final pre-activation validation checklist and displays results: |
| | | ✓ Title provided |
| | | ✓ Address geocoded |
| | | ✓ Price set |
| | | ✓ Cancellation policy selected |
| | | ✓ 3 or more photos uploaded (shows count: "X photos") |
| 4 | System | All checks pass. "Submit & Go Live" button is enabled. |
| 5 | Provider | Reviews the preview. Satisfied with the content. |
| 6 | Provider | Proceeds to UC-3.6. |

---

#### Alternative Flows

**A1 — One or more validation checks fail**
- At step 3: failing checks are shown with ✗ icons in red.
- "Submit & Go Live" button is disabled.
- Each failing check is a tappable link that navigates directly to the relevant form step.

**A2 — Provider wants to edit a section from the preview**
- Provider taps an "Edit" pen icon next to any section on the preview.
- System navigates back to the relevant form step.
- On save, provider returns to the preview screen.

---

### UC-3.5 — Submit Apartment Listing for Auto-Activation

**ID:** UC-3.5  
**Name:** Submit Apartment Listing — Auto-Activation  
**Primary Actor:** Provider  
**Secondary Actors:** System, SendGrid  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- All required fields are populated.
- At least 3 photos are uploaded (BR-3.7).
- Address has been geocoded (lat/lng present).
- Provider is on the "Review & Go Live" screen (UC-3.4).

#### Postconditions (Success)
- `listings.status` → `active`.
- `listings.activated_at` set to now.
- Listing indexed in Elasticsearch. Appears in guest search within 5 minutes.
- Provider receives an activation confirmation notification (in-app + email).
- No admin review task created.

#### Postconditions (Failure)
- Status remains `draft`.
- Specific validation failure communicated to provider.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On the "Review & Go Live" screen. Taps "Submit & Go Live". |
| 2 | System | Displays activation modal: "Your apartment will go live immediately on ZikaBooking. Guests will be able to find and book it right away. Continue?" |
| 3 | Provider | Taps "Confirm". |
| 4 | System | Performs server-side auto-activation validation: |
| | | • Title present and not empty |
| | | • Address: `lat` and `lng` are not null |
| | | • `price_per_night > 0` |
| | | • `cancellation_policy` is set |
| | | • `max_guests >= 1` |
| | | • Photo count ≥ 3 (queries `listing_photos` where `deleted_at IS NULL`) |
| 5 | System | All validation passes. Begins atomic transaction: |
| | | • Sets `listings.status = active` |
| | | • Sets `listings.activated_at = now` |
| | | • Triggers Elasticsearch indexing job for this listing |
| 6 | System | Transaction committed. Returns HTTP 200. |
| 7 | System | Sends provider in-app notification: "Your listing '[Title]' is now live! Guests can find and book it on ZikaBooking." |
| 8 | System | Sends provider email via SendGrid: Subject: "Your apartment is live on ZikaBooking — '[Title]'." Body: listing title, location, price per night, link to view the live listing, tips for attracting first bookings. |
| 9 | System | Listing appears in Elasticsearch search index within 5 minutes. |
| 10 | Provider | App shows success state: "🎉 You're live! Your listing is now visible to guests." with a "View listing" CTA. |
| 11 | Provider | "My Listings" now shows the listing with a green "Active" status badge. |

---

#### Alternative Flows

**A1 — Validation fails server-side (field missing)**
- At step 4: one or more required fields are null or invalid despite client-side checks.
- Server returns HTTP 422 with a structured error body listing which validation rules failed.
- Client displays: "Some required information is missing. Please review your listing." with a checklist of failing items.
- Status remains `draft`. Provider is taken back to the relevant form step.

**A2 — Photo count is below 3 at the time of server-side check**
- This can occur if a photo upload appeared to succeed client-side but failed server-side.
- Server returns HTTP 422: `{ error: "insufficient_photos", count: X, required: 3 }`.
- Client displays: "Your listing needs at least 3 photos to go live. You currently have [X]. Please upload [3-X] more."

**A3 — Provider cancels the activation modal**
- Taps "Cancel" on the modal at step 2. No action taken. Status remains `draft`. Provider returns to the preview.

**A4 — Elasticsearch indexing fails**
- Listing status is still set to `active` in PostgreSQL (source of truth).
- Indexing is retried asynchronously (3 attempts, exponential backoff). Admin alerted after 3 failures.
- Listing will appear in search once indexing succeeds (may be delayed up to 15 minutes in failure scenario).
- Provider UX is not affected — they see "You're live!" normally.

**A5 — Provider submits a reactivated draft (previously deactivated listing)**
- Same flow. If listing was previously `active` (deactivated by provider), resubmission runs the same server-side validation.
- No new admin review is triggered. Status moves directly to `active`.

---

#### Exception Flows

**E1 — Database transaction fails**
- Status remains `draft`. System returns HTTP 500.
- Client shows: "We couldn't activate your listing. Please try again." The "Submit & Go Live" button is re-enabled.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = active`, `activated_at = now` |
| `email_log` | INSERT | `type = listing_activated`, provider email |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/listings/{id}/activate` | Trigger auto-activation validation and publish |

---

### UC-3.6 — Edit an Active Apartment Listing

**ID:** UC-3.6  
**Name:** Edit an Active Apartment Listing  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in.
- The apartment listing belongs to this provider.
- Listing status is `active`, `draft`, or `deactivated`.

#### Postconditions (Success)
- Listing data is updated.
- If listing was `active`: changes are applied immediately. No re-review required (BR-3.14). Elasticsearch index updated within 5 minutes.
- If listing was `draft`: changes saved to draft.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On "My Listings", taps "Edit" on the target apartment. |
| 2 | System | Checks listing status. Status is `active`. Loads the listing form pre-populated with all current values. Displays a notice: "This listing is live. Any changes you save will be visible to guests immediately." |
| 3 | Provider | Navigates to the step they want to modify using the step tabs at the top of the form. |
| 4 | Provider | Makes desired changes. Examples: |
| | | • Updates price per night |
| | | • Enables long-stay discount |
| | | • Adds 2 more photos |
| | | • Changes cancellation policy from Moderate to Flexible |
| | | • Adds a custom amenity |
| 5 | Provider | Taps "Save changes" on the modified step. |
| 6 | System | Validates the changed fields. |
| 7 | System | Applies changes via `PATCH /listings/{id}`. Returns HTTP 200. |
| 8 | System | For field changes (price, description, amenities, etc.): triggers Elasticsearch re-indexing. Guest-facing listing reflects changes within 5 minutes. |
| 9 | System | For photo changes: CDN cache invalidated for changed photo URLs. |
| 10 | Provider | Sees toast: "Changes saved." |

---

#### Alternative Flows

**A1 — Provider changes the price on a listing with future confirmed bookings**
- Price change is applied to NEW bookings only.
- System displays a notice: "Your new price will apply to future bookings. Guests with existing confirmed bookings will be charged at their original agreed rate."
- No action is taken on confirmed bookings.

**A2 — Provider reduces max guests below an existing confirmed booking's guest count**
- E.g. listing had max_guests = 6; a booking exists for 5 guests; provider reduces max_guests to 4.
- System displays: "Reducing maximum guests may conflict with existing bookings. Guests with confirmed bookings for more than 4 guests will not be affected." (Existing confirmed bookings are not cancelled.)
- Provider can proceed.

**A3 — Provider changes minimum stay above an existing confirmed booking's duration**
- Same approach as A2. Change applies to future bookings only. Warning displayed.

**A4 — Provider edits a deactivated listing**
- Form opens with all fields editable.
- At the bottom: "This listing is deactivated. Save your changes and reactivate it when you're ready." A "Reactivate" button appears alongside "Save changes".

---

#### Data Entities

| Entity | Operation | Notes |
|---|---|---|
| `listings` | PATCH | Any editable field; `updated_at` refreshed |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/listings/{id}` | Load listing for editing |
| PATCH | `/listings/{id}` | Save changes to listing |

---

### UC-3.7 — Provider Deactivates or Deletes an Apartment Listing

**ID:** UC-3.7  
**Name:** Deactivate or Delete Apartment Listing  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Medium  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in.
- Target listing belongs to this provider.

#### Postconditions — Deactivate
- `listings.status` → `deactivated`.
- Listing removed from guest search within 5 minutes.
- New bookings cannot be made.
- Existing confirmed bookings remain unaffected.

#### Postconditions — Delete (Draft only)
- Draft listing soft-deleted.
- Active listings can only be deactivated, not hard-deleted.

---

#### Main Success Scenario — Deactivate an Active Listing

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On "My Listings", taps the kebab menu (⋮) on an active apartment. Selects "Deactivate listing". |
| 2 | System | Displays confirmation modal: "Deactivating this listing will remove it from search immediately. No new bookings will be possible. Existing confirmed bookings will not be affected. Deactivate?" |
| 3 | Provider | Confirms. |
| 4 | System | Sets `listings.status = deactivated`. Triggers Elasticsearch de-indexing (listing removed from search within 5 minutes). |
| 5 | Provider | Listing shows "Deactivated" badge on "My Listings". A "Reactivate" button appears. |

---

#### Main Success Scenario — Reactivate a Deactivated Listing

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On "My Listings", taps "Reactivate" on a deactivated apartment. |
| 2 | System | Runs the same auto-activation validation as UC-3.5, step 4. |
| 3 | System | All checks pass. Sets `listings.status = active`. Re-indexes in Elasticsearch. |
| 4 | Provider | Sees: "Your listing is live again." Active badge restored. |

---

#### Main Success Scenario — Delete a Draft Listing

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On "My Listings", taps the kebab menu on a draft listing. Selects "Delete draft". |
| 2 | System | Displays: "Delete this draft? This cannot be undone. All entered information will be lost." |
| 3 | Provider | Confirms. |
| 4 | System | Soft-deletes listing: sets `listings.deleted_at = now`. Associated photos deleted from S3 (background job). |
| 5 | Provider | Draft removed from "My Listings" view. |

---

#### Alternative Flows

**A1 — Provider attempts to hard-delete an active or previously active listing**
- System prevents: "This listing cannot be deleted because it has booking history. You can deactivate it instead."

**A2 — Reactivation fails because photos dropped below 3**
- Provider had 3 photos, then deleted 2 while deactivated. Now only 1 photo remains.
- Reactivation validation fails: "Your listing needs at least 3 photos to go live. You currently have 1. Please upload 2 more before reactivating."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = deactivated` or `status = active` (reactivate) |
| `listings` | UPDATE | `deleted_at = now` (draft delete) |

---

### UC-3.8 — Admin: Reactive Suspension of an Active Apartment Listing

**ID:** UC-3.8  
**Name:** Admin Reactively Suspends an Active Apartment Listing  
**Primary Actor:** Admin (Super Admin, Admin, Country Manager within scope)  
**Secondary Actors:** System, SendGrid  
**Priority:** High  
**Platform:** Web Admin Panel

#### Preconditions
- Apartment listing has `status = active`.
- Admin has grounds for suspension (complaint, safety report, policy violation — distinct from the automated review-triggered suspension in E14).

#### Postconditions
- `listings.status` → `suspended`.
- Listing removed from guest search.
- Active reservation locks cancelled. Affected guests notified.
- Provider notified.
- `audit_log` entry created.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Searches for the listing in the admin panel. Opens the listing detail page. |
| 2 | Admin | Clicks "Suspend listing". |
| 3 | System | Displays suspension form: Reason (free text, required, max 500 chars) · Notify provider toggle (default ON) · Internal note (optional, max 500 chars, not shared). |
| 4 | Admin | Enters reason (e.g. "Guest safety complaint — under investigation"). Confirms. |
| 5 | System | Atomic transaction: sets `listings.status = suspended`. Cancels all active `reservation_locks` for this listing. Notifies affected guests: "Unfortunately, this property is no longer available. Your reservation hold has been released and no charge has been made." |
| 6 | System | If notify provider ON: sends suspension email to provider. |
| 7 | System | Writes to `audit_log`: `action = listing_suspended`, `target_id`, `admin_id`, `reason`, `ip_address`, `timestamp`. |

---

#### Alternative Flows

**A1 — Admin reinstates a suspended listing**
- Admin clicks "Reinstate listing" on a suspended apartment.
- Confirmation required with a mandatory note (reason for reinstatement, max 500 chars).
- Sets `listings.status = active`. Re-indexes in Elasticsearch. Provider notified. `audit_log` entry created.

**Note — Automated Suspension (Review-Triggered):** If the suspension was triggered automatically by 2 consecutive 1★–2★ reviews, the listing status is `auto_suspended` (distinct value). The reinstatement of auto-suspended listings is handled through the agent unblock process documented in **E14**. The admin suspension in this use case (UC-3.8) sets `status = suspended` and follows a different reinstatement path.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = suspended` |
| `reservation_locks` | UPDATE | `status = cancelled` for all active locks |
| `audit_log` | INSERT | Suspension entry |

---

### UC-3.9 — Provider Views Listing Performance Summary

**ID:** UC-3.9  
**Name:** Provider Views Apartment Listing Performance  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Low  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in.
- At least one apartment listing exists.

#### Postconditions
- Provider can see per-listing stats to inform management decisions.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On "My Listings", taps a listing name (not "Edit"). |
| 2 | System | Opens the listing overview page. Displays: |
| | | • Current status badge (Active / Deactivated / Draft / Suspended) |
| | | • Cover photo and key details |
| | | • Performance metrics: Total confirmed bookings · Bookings this month · Average star rating (from reviews) · Cancellation rate (last 90 days) |
| | | • Upcoming check-ins (next 3) |
| | | • Quick actions: Edit listing · Deactivate · View calendar · Add offer |
| 3 | Provider | Taps any quick action to navigate to the relevant screen. |

---

## 3. Apartment Listing Status State Machine

```
                ┌─────────────┐
   Create       │             │
────────────>   │    DRAFT    │ <──── Edit reverts here if was rejected*
                │             │        (*not applicable for apartments —
                └──────┬──────┘         no rejection flow exists)
                       │
                       │ Submit & Auto-Activate (UC-3.5)
                       │ [server-side validation passes]
                       ▼
                ┌─────────────┐
                │   ACTIVE    │ <──── Reactivate (provider/admin)
                │  (live)     │
                └──────┬──────┘
                       │
          ┌────────────┼──────────────┐
          │            │              │
          ▼            ▼              ▼
    DEACTIVATED    SUSPENDED     AUTO_SUSPENDED
    (provider)   (admin action)  (review-triggered
                                  — see E14)
```

---

## 4. Differences Between Apartment Statuses

| Status | Who Sets | Search Visible | New Bookings | Reinstate Path |
|---|---|---|---|---|
| `draft` | System (on create) | No | No | Submit & Go Live |
| `active` | System (on activation) | Yes | Yes | N/A |
| `deactivated` | Provider | No | No | Provider taps Reactivate |
| `suspended` | Admin (manual) | No | No | Admin action (UC-3.8 A1) |
| `auto_suspended` | System (review trigger) | No | No | Agent unblock process (E14) |
| `permanently_banned` | Admin only | No | No | Super Admin override only |

---

## 5. Data Model — Epic 3 Additions

The core `listings` table from E2 is reused. The following fields are specific to or particularly relevant for apartments:

```sql
-- Fields added/clarified for apartment category on the listings table:
listings
  ...
  -- apartment-specific fields (NULL for hotel and car categories):
  bedrooms                    SMALLINT DEFAULT 0 CHECK (bedrooms >= 0)
  bathrooms                   SMALLINT DEFAULT 0 CHECK (bathrooms >= 0)
  max_guests                  SMALLINT CHECK (max_guests >= 1)
  long_stay_discount_enabled  BOOLEAN NOT NULL DEFAULT FALSE
  long_stay_min_nights        SMALLINT NULL CHECK (long_stay_min_nights >= 1)
  long_stay_discount_type     ENUM('percentage','fixed') NULL
  long_stay_discount_value    DECIMAL(10,2) NULL CHECK (long_stay_discount_value > 0)
  activated_at                TIMESTAMPTZ NULL  -- set on first activation
  ...
```

**No new tables** are introduced by the apartment listing flow. All shared tables from E2 apply:
- `listing_photos` — identical structure and behaviour
- `listing_amenities` and `listing_custom_amenities` — identical to hotels
- `audit_log` — all admin actions logged identically

**Tables NOT used for apartments (hotel-specific):**
- `listing_documents` — not applicable (no accreditation documents)
- `listing_review_tasks` — not applicable (no admin review queue)

---

## 6. API Endpoint Summary — Epic 3

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/listings` | Provider | Create draft listing (`category = apartment`) |
| GET | `/listings/{id}` | Provider | Load listing data |
| PATCH | `/listings/{id}` | Provider | Save any listing field (draft or active) |
| POST | `/listings/{id}/activate` | Provider | Auto-activation: validate and set status active |
| POST | `/listings/{id}/deactivate` | Provider | Deactivate a live listing |
| POST | `/listings/{id}/reactivate` | Provider | Reactivate a deactivated listing |
| DELETE | `/listings/{id}` | Provider | Soft-delete a draft listing |
| POST | `/listings/{id}/photos` | Provider | Upload photos (same as E2) |
| PATCH | `/listings/{id}/photos/reorder` | Provider | Reorder photos / set cover (same as E2) |
| DELETE | `/listings/{id}/photos/{photo_id}` | Provider | Remove a photo (same as E2) |
| POST | `/admin/listings/{id}/suspend` | Admin | Admin suspends an active listing |
| POST | `/admin/listings/{id}/reinstate` | Admin | Admin reinstates a suspended listing |

---

## 7. Acceptance Criteria

### AC-3.1 — Auto-Activation Logic
- [ ] A listing with all required fields and ≥ 3 photos is activated immediately on submission with no admin intervention.
- [ ] Server-side validation at activation rejects submissions missing any required field, even if the client allows submission.
- [ ] A listing with fewer than 3 photos cannot be submitted — the "Submit & Go Live" button is disabled and shows the photo count requirement.
- [ ] On successful activation, the listing appears in Elasticsearch search results within 5 minutes.
- [ ] Provider receives both an in-app notification and an email on activation.

### AC-3.2 — Property Details
- [ ] Bedrooms and bathrooms accept 0 (for studio apartments).
- [ ] Max guests minimum of 1 is enforced with an inline error if set to 0.
- [ ] The stepper UI prevents going below the minimum value using the − button.
- [ ] A listing with 0 bedrooms displays "Studio" to guests (not "0 bedrooms").

### AC-3.3 — Long-Stay Discount
- [ ] The long-stay discount toggle is off by default.
- [ ] When enabled, all three configuration fields (threshold, type, value) must be completed before saving.
- [ ] A percentage discount value of 100% or above is rejected.
- [ ] Disabling the discount does not affect existing confirmed bookings that were booked with it.
- [ ] The discount badge appears on the guest-facing listing card and detail page when enabled.

### AC-3.4 — Editing an Active Listing
- [ ] Any field on an active listing can be edited and saved without triggering a re-review.
- [ ] Elasticsearch reflects the change within 5 minutes of saving.
- [ ] Price changes apply only to new bookings; existing confirmed bookings are unaffected.

### AC-3.5 — Status Transitions
- [ ] Deactivated listings are removed from search results within 5 minutes.
- [ ] A reactivated listing that now has fewer than 3 photos cannot go live until photos are added.
- [ ] Admin-suspended listings show `status = suspended`, distinct from `auto_suspended` (review-triggered).
- [ ] Suspending a listing cancels all active reservation locks within 5 seconds and guests are notified.

### AC-3.6 — No Admin Involvement at Creation
- [ ] Submitting a valid apartment listing creates no entry in any admin review queue.
- [ ] No admin notification is sent when an apartment goes live.
- [ ] The admin panel has no "Apartment accreditation queue" — reactive moderation only.

---

*End of E3 — Listing Management: Apartments*  
*Next: E4 — Listing Management: Car Rentals*
