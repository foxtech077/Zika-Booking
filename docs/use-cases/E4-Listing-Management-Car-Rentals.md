# Epic 4 — Listing Management: Car Rentals

**Epic ID:** E4  
**PRD Reference:** §3.3, §3.4 (shared amenity grid not applicable), §3.5, §10  
**Version:** 1.0  
**Date:** 2026-04-25  
**Status:** Ready for Review

---

## 1. Epic Summary

### Goal
Enable providers to create vehicle listings — individual cars or fleet units of the same type — that auto-activate on submission, capturing all vehicle identity, technical specifications, rental terms, insurance documentation, and pickup/return logistics required for a complete and trustworthy car rental offer.

### How This Epic Differs from E2 and E3

| Dimension | Hotels (E2) | Apartments (E3) | Car Rentals (E4) |
|---|---|---|---|
| Activation | Manual admin approval | Auto-activate | Auto-activate |
| Unit model | Room type (1 room type per listing) | Single unit per listing | Fleet model: 1 listing = N identical vehicles |
| Pricing unit | Per night | Per night | Per day |
| Required documents | 3 accreditation docs | None | Vehicle registration + insurance cert |
| Unique fields | Star rating, room type | Bedrooms/bathrooms/max guests, long-stay discount | Vehicle specs, mileage policy, fuel policy, driver age, pickup/return, delivery |
| Amenities grid | Yes (shared) | Yes (shared) | No — replaced by vehicle-specific features |
| Auto-suspension | No | Yes (E14) | Yes (E14) |
| Channel manager | Yes (E13) | Yes (E13) | Yes — per vehicle unit (E13) |
| Map pin purpose | Property location | Property location | Pickup location |

### Actors

| Actor | Description |
|---|---|
| Provider | A car rental operator or individual vehicle owner with an active ZikaBooking provider account |
| System | Automated platform (validation, auto-activation, geocoding calls, document storage) |
| Google Maps Platform | Geocoding, Places Autocomplete, embedded map for pickup/return address |
| SendGrid | Transactional email notifications |
| Admin | Admin panel staff — involved only in reactive moderation; no approval role at creation |

### Scope — IN
- Car rental listing creation and editing (all fields across all form steps)
- Vehicle identity and classification
- Technical specifications
- Rental terms including mileage and fuel policies
- Insurance type selection and document upload (vehicle registration, insurance certificate, roadworthiness cert)
- Pickup and return location configuration with geocoding
- Delivery option configuration (radius + fee)
- Photo upload and management
- Auto-activation validation and publication
- Fleet count management
- Provider deactivation and deletion
- Admin reactive suspension

### Scope — OUT
- Hotel and apartment listing management (E2, E3)
- Review submission and auto-suspension trigger (E14)
- Channel manager / iCal sync for vehicles (E13)
- Booking engine and reservation locks (E6)
- Vouchers and promotions (E15)
- Provider dashboard calendar (E12)

### Key Business Rules

| ID | Rule |
|---|---|
| BR-4.1 | Car rental listings auto-activate on submission. No admin approval gate. Reactive moderation only after going live. |
| BR-4.2 | Vehicle year must be between 1990 and the current calendar year (inclusive). |
| BR-4.3 | Vehicle category: Economy / Compact / SUV / Minivan / Pickup / Luxury / Electric / Convertible. |
| BR-4.4 | Number of units represents the fleet count — how many identical vehicles of this make/model/year are available. Must be ≥ 1. |
| BR-4.5 | Licence plate is required at submission. Marked private — displayed to guest only after booking is confirmed, never in search results or listing detail pre-booking. |
| BR-4.6 | Odometer reading is required (km). Informational — displayed to guest on listing detail page for transparency. |
| BR-4.7 | Transmission: Manual / Automatic / Semi-auto. Required. |
| BR-4.8 | Fuel type: Petrol / Diesel / Hybrid / Electric / LPG. Required. |
| BR-4.9 | Drive type: 2WD / 4WD / AWD. Optional. |
| BR-4.10 | Air conditioning: required toggle (yes/no). |
| BR-4.11 | Mileage policy: Unlimited OR Limited. If Limited: km/day allowance and extra km rate (per km) are both required. |
| BR-4.12 | Fuel policy: Full-to-Full / Full-to-Empty / Pre-purchase. Required. |
| BR-4.13 | Minimum driver age defaults to 21. Must be ≥ 18. |
| BR-4.14 | Insurance type: Basic 3rd party / Comprehensive / Premium zero-excess. Required. |
| BR-4.15 | Vehicle registration document upload is required for activation. Insurance certificate is required. Roadworthiness certificate is optional. |
| BR-4.16 | Pickup address must be geocoded (lat/lng). This is the source of truth for search radius queries. |
| BR-4.17 | If return location differs from pickup: a separate return address with geocoding is required. |
| BR-4.18 | If delivery is enabled: delivery radius (km) and delivery fee are both required. Delivery fee may be 0 (free delivery). |
| BR-4.19 | Pickup hours define availability window (from / to). Optional. If not set, interpreted as "contact provider for hours". |
| BR-4.20 | Pricing is per day (not per night). |
| BR-4.21 | Security deposit is optional. If set, displayed prominently on listing detail and checkout. |
| BR-4.22 | Auto-activation requires: all required fields populated, vehicle registration and insurance cert uploaded, at least 1 photo. |
| BR-4.23 | Auto-suspension after 2 consecutive 1★–2★ reviews (E14). |
| BR-4.24 | iCal channel manager applies per vehicle unit in the fleet (E13). |
| BR-4.25 | Cross-border allowed: boolean toggle — if Off, displayed as a restriction on the listing ("No cross-border trips"). |
| BR-4.26 | Roadside assistance: boolean toggle — displayed as a feature on the listing if On. |

---

## 2. Use Cases

---

### UC-4.1 — Create Car Rental Listing (Start Draft)

**ID:** UC-4.1  
**Name:** Create Car Rental Listing — Start New Draft  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in with `status = active` and `user_type = provider`.
- Provider navigates to "My Listings" and initiates "Add new listing".

#### Postconditions (Success)
- New listing record created: `status = draft`, `category = car`, `provider_id = current_user`.
- Provider enters the multi-step car rental form.
- Draft auto-saved at each step.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps "Add new listing" from the Provider Dashboard. |
| 2 | System | Displays category selection: Hotel / Apartment / Car Rental. Car Rental card reads: "List your vehicle or fleet. Goes live automatically." |
| 3 | Provider | Selects **Car Rental**. |
| 4 | System | Creates listing record: `status = draft`, `category = car`, `provider_id = current_user`. Returns `listing_id`. |
| 5 | System | Opens the 6-step car rental form. Displays progress indicator. Shows notice: "Your vehicle listing goes live automatically once required information and documents are uploaded. No admin approval needed." |
| 6 | Provider | Proceeds through each step (UC-4.2 through UC-4.9). |

---

#### Alternative Flows

**A1 — Provider has an existing car rental draft**
- Before creating, system checks for incomplete `draft` car listings.
- Prompts: "You have an unfinished vehicle listing: '[Title or Untitled]'. Continue where you left off?" — "Continue" or "Start new listing".

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | INSERT | `provider_id`, `category = car`, `status = draft`, `created_at` |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/listings` | Create draft listing with `category = car` |

---

### UC-4.2 — Complete Vehicle Identity and Classification (Step 1)

**ID:** UC-4.2  
**Name:** Enter Vehicle Identity and Classification  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Draft car listing exists. Provider is on Step 1.

#### Postconditions
- Vehicle identity fields saved to draft.

---

#### Field Reference — Step 1

| Field | Type | Required | Validation / Notes |
|---|---|---|---|
| Listing title | Text | Yes | Max 200 chars. E.g. "Toyota Camry 2022 — Nairobi CBD". |
| Make (brand) | Text / searchable select | Yes | Max 60 chars. E.g. Toyota, BMW, Ford. Searchable from common makes list; free-text fallback. |
| Model | Text | Yes | Max 60 chars. E.g. Camry, X5, Ranger. |
| Year | Integer select | Yes | 1990 – current year (BR-4.2). Dropdown or numeric picker. |
| Category | Single select | Yes | Economy / Compact / SUV / Minivan / Pickup / Luxury / Electric / Convertible (BR-4.3). |
| Number of units | Integer stepper | Yes | ≥ 1. Fleet count of identical vehicles (BR-4.4). |
| Colour | Single select (palette) | No | Standard colour palette (White, Black, Silver, Grey, Red, Blue, Green, Yellow, Orange, Brown, Other). |
| Licence plate | Text | Yes | Max 20 chars. Stored private (BR-4.5). |
| Odometer reading (km) | Integer input | Yes | ≥ 0 (BR-4.6). |

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 1 — Vehicle Identity. |
| 2 | Provider | Enters listing title (e.g. "2022 Toyota Camry — Automatic, Nairobi"). |
| 3 | Provider | Types in the Make field. System suggests common makes from a predefined list as the provider types (e.g. typing "Toyo" suggests "Toyota"). Provider selects or types freely. |
| 4 | Provider | Enters Model (e.g. "Camry"). |
| 5 | Provider | Selects Year from dropdown (e.g. 2022). Dropdown shows 1990 to current year in descending order. |
| 6 | Provider | Selects vehicle Category (e.g. "Compact" or "Luxury"). |
| 7 | Provider | Sets Number of units using the stepper (e.g. 3 for a fleet of 3 identical Camrys). |
| 8 | System | If units > 1: displays an informational note: "You're listing a fleet of 3 identical vehicles. Guests can book any available unit. All units share this listing's availability calendar." |
| 9 | Provider | Optionally selects Colour from the palette (e.g. "Silver"). |
| 10 | Provider | Enters Licence plate (e.g. "KBZ 123A"). System shows a lock icon next to the field with tooltip: "Your licence plate is private — only revealed to guests after a confirmed booking." |
| 11 | Provider | Enters current Odometer reading (e.g. 34500). |
| 12 | Provider | Taps "Next". |
| 13 | System | Validates: title not empty, make not empty, model not empty, year in range, category selected, units ≥ 1, licence plate not empty, odometer ≥ 0. |
| 14 | System | Saves via `PATCH /listings/{id}`. Advances to Step 2. |

---

#### Alternative Flows

**A1 — Year selected is outside 1990–current year**
- Dropdown only shows valid years (1990 to current). If manually typed: inline error: "Please enter a year between 1990 and [current year]."

**A2 — Number of units set to 0 or negative**
- Stepper prevents going below 1. If manually typed as 0: inline error: "At least 1 unit is required."

**A3 — Licence plate contains special characters beyond alphanumeric + space + dash**
- Inline error: "Licence plate may only contain letters, numbers, spaces, and dashes."

**A4 — Provider increases fleet count after activation**
- Provider is editing an active listing. Increases units from 3 to 5.
- System saves the change. Reservation lock and availability logic automatically accounts for the new count (booking engine uses `unit_count` from the listing).

**A5 — Provider decreases fleet count below currently booked units**
- E.g. 5 units, 4 currently booked on overlapping dates, provider reduces to 3.
- System warns: "Reducing to 3 units conflicts with 4 active bookings on [dates]. Existing bookings will not be cancelled, but availability may show as overbooked. Please review your calendar." Provider must confirm to proceed.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | PATCH | `name`, `make`, `model`, `year`, `vehicle_category`, `unit_count`, `colour`, `licence_plate_encrypted`, `odometer_km` |

*Note: `licence_plate` stored encrypted at rest using AES-256. Decrypted only for confirmed booking parties.*

---

### UC-4.3 — Complete Technical Specifications (Step 2)

**ID:** UC-4.3  
**Name:** Enter Vehicle Technical Specifications  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Step 1 (UC-4.2) completed. Provider is on Step 2.

#### Postconditions
- Technical specification fields saved to draft.

---

#### Field Reference — Step 2

| Field | Type | Required | Validation / Notes |
|---|---|---|---|
| Seats | Integer stepper | Yes | 1–9 range typical; max 20. |
| Doors | Integer stepper | Yes | 2 / 3 / 4 / 5 options (or numeric). |
| Transmission | Single select | Yes | Manual / Automatic / Semi-auto (BR-4.7). |
| Fuel type | Single select | Yes | Petrol / Diesel / Hybrid / Electric / LPG (BR-4.8). |
| Drive type | Single select | No | 2WD / 4WD / AWD (BR-4.9). |
| Engine size (cc) | Integer input | No | E.g. 1800. Displayed as "1.8L" to guests. |
| Air conditioning | Toggle | Yes | On / Off (BR-4.10). |

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 2 — Technical Specifications. |
| 2 | Provider | Sets Seats using the stepper (e.g. 5). |
| 3 | Provider | Sets Doors: taps one of the option chips — "2", "3", "4", "5". |
| 4 | Provider | Selects Transmission from the selector (e.g. Automatic). |
| 5 | Provider | Selects Fuel type (e.g. Hybrid). |
| 6 | System | If Fuel type = Electric: Drive type field shows "Electric vehicles are typically AWD or 2WD" as a hint. |
| 7 | Provider | Optionally selects Drive type (e.g. AWD). |
| 8 | Provider | Optionally enters Engine size in cc (e.g. 2500). |
| 9 | System | If fuel type = Electric and engine size is entered: shows inline note: "Electric vehicles typically do not have a traditional engine size. This field is optional for EVs." |
| 10 | Provider | Toggles Air conditioning On or Off. |
| 11 | Provider | Taps "Next". |
| 12 | System | Validates: seats ≥ 1, doors selected, transmission selected, fuel type selected, air_conditioning not null. |
| 13 | System | If engine size entered: validates it is a positive integer. |
| 14 | System | Saves and advances to Step 3. |

---

#### Alternative Flows

**A1 — Seats set to 0**
- Inline error: "A vehicle must have at least 1 seat."

**A2 — Fuel type changed from Petrol to Electric after engine size entered**
- System clears engine size value and shows: "Engine size is not applicable for electric vehicles. The field has been cleared."

**A3 — Provider selects "Semi-auto" transmission**
- No additional fields required. A tooltip appears: "Semi-automatic transmission — guests will see this displayed as 'Semi-Auto (Paddle Shift)' on the listing."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | PATCH | `seats`, `doors`, `transmission`, `fuel_type`, `drive_type`, `engine_size_cc`, `air_conditioning` |

---

### UC-4.4 — Complete Rental Terms (Step 3)

**ID:** UC-4.4  
**Name:** Enter Rental Terms, Pricing, and Policies  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Step 2 (UC-4.3) completed. Provider is on Step 3.

#### Postconditions
- Rental terms saved to draft. Mileage policy and fuel policy are fully defined.

---

#### Field Reference — Step 3

| Field | Type | Required | Validation / Notes |
|---|---|---|---|
| Price per day | Decimal | Yes | > 0; max 2 d.p. |
| Currency | Select | Yes | ISO 4217; defaults to provider locale |
| Minimum rental days | Integer | No | Default 1; ≥ 1 if set |
| Minimum driver age | Integer | No | Default 21; ≥ 18 (BR-4.13) |
| Mileage policy | Single select | Yes | Unlimited / Limited (BR-4.11) |
| — if Limited: km/day | Integer | Conditional | Required if Limited. ≥ 1. |
| — if Limited: extra km rate | Decimal | Conditional | Required if Limited. > 0; max 2 d.p. |
| Fuel policy | Single select | Yes | Full-to-Full / Full-to-Empty / Pre-purchase (BR-4.12) |
| Security deposit | Decimal | No | ≥ 0; max 2 d.p. If 0 or blank: no deposit required. |
| Cancellation policy | Single select | Yes | Flexible / Moderate / Strict |

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 3 — Rental Terms. |
| 2 | Provider | Enters price per day (e.g. 75.00). |
| 3 | Provider | Selects currency (e.g. KES). |
| 4 | Provider | Optionally sets minimum rental days (e.g. 2). |
| 5 | Provider | Optionally sets minimum driver age (default 21, provider may increase e.g. to 25). |
| 6 | Provider | Selects mileage policy. Selects "Limited". |
| 7 | System | Reveals conditional fields: "km/day allowance" and "Extra km rate". |
| 8 | Provider | Enters km/day (e.g. 200) and extra km rate (e.g. 0.15 per km). |
| 9 | System | Displays live preview: "Guests get 200 km/day included. Each additional km costs KES 0.15." |
| 10 | Provider | Selects fuel policy (e.g. Full-to-Full). |
| 11 | System | Displays a plain-language explanation beneath the selector: "Full-to-Full: Guest collects the car with a full tank and returns it full. If returned less than full, a refuelling charge applies." |
| 12 | Provider | Optionally enters security deposit (e.g. 500.00). |
| 13 | System | If security deposit > 0: shows note: "A security deposit of KES 500.00 will be displayed to guests and collected separately at vehicle pickup." |
| 14 | Provider | Selects cancellation policy (e.g. Moderate). |
| 15 | Provider | Taps "Next". System validates all required and conditional fields. Saves and advances to Step 4. |

---

#### Alternative Flows

**A1 — Mileage policy = Unlimited selected**
- At step 6: provider selects "Unlimited".
- Conditional km/day and extra km rate fields are hidden and their values cleared.
- System shows: "Guests can drive unlimited km per day at no extra charge."

**A2 — Mileage policy switched from Limited back to Unlimited**
- Conditional fields collapse. Previously entered km values are cleared from the form.
- System shows a brief confirmation: "Mileage policy updated to Unlimited. km/day and extra km rate have been removed."

**A3 — Extra km rate entered as 0**
- This would be contradictory with Limited policy (limited km with no charge for excess is effectively Unlimited).
- Inline warning: "An extra km rate of 0 means there is no charge for exceeding the daily allowance. Consider using 'Unlimited' mileage policy instead." Not blocking — provider may proceed.

**A4 — Minimum driver age set below 18**
- Inline error: "Minimum driver age cannot be less than 18."

**A5 — Security deposit set to a very large value (> price_per_day × 30)**
- Non-blocking warning: "Your security deposit (X) is significantly higher than a 30-day rental. Please ensure this is correct." Provider may proceed.

**A6 — Fuel policy = Full-to-Empty selected**
- Explanation shown: "Full-to-Empty: Guest receives the car with a full tank and keeps whatever is unused. No refuelling required on return. The cost of the full tank is typically included in the rental price."

**A7 — Fuel policy = Pre-purchase selected**
- Explanation shown: "Pre-purchase: Guest pays for a full tank of fuel upfront at the start of the rental. Any unused fuel is not refunded. The guest does not need to refuel before returning."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | PATCH | `price_per_day`, `currency`, `min_rental_days`, `min_driver_age`, `mileage_policy`, `km_per_day`, `extra_km_rate`, `fuel_policy`, `security_deposit`, `cancellation_policy` |

---

### UC-4.5 — Upload Vehicle Insurance and Registration Documents (Step 4)

**ID:** UC-4.5  
**Name:** Upload Vehicle Documents and Set Insurance Options  
**Primary Actor:** Provider  
**Secondary Actors:** System, AWS S3  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Step 3 (UC-4.4) completed. Provider is on Step 4.

#### Postconditions
- Required documents (vehicle registration, insurance certificate) uploaded to S3.
- Insurance options and toggles saved to draft.
- Provider can proceed to Step 5.

---

#### Field Reference — Step 4

| Field | Type | Required | Validation / Notes |
|---|---|---|---|
| Insurance type | Single select | Yes | Basic 3rd party / Comprehensive / Premium zero-excess (BR-4.14) |
| Roadside assistance | Toggle | No | Default Off (BR-4.26) |
| Cross-border allowed | Toggle | No | Default Off (BR-4.25) |
| Vehicle registration | File upload | Yes for activation | PDF / JPEG / PNG / WEBP; max 10 MB (BR-4.15) |
| Insurance certificate | File upload | Yes for activation | PDF / JPEG / PNG / WEBP; max 10 MB (BR-4.15) |
| Roadworthiness certificate | File upload | No | PDF / JPEG / PNG / WEBP; max 10 MB (BR-4.15) |

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 4 — Insurance & Documents. |
| 2 | Provider | Selects insurance type (e.g. "Comprehensive"). |
| 3 | System | Displays a plain-language description of the selected insurance type beneath the selector: "Comprehensive: Covers damage to this vehicle and third-party property or injury. Recommended for full peace of mind." |
| 4 | Provider | Toggles Roadside assistance On (e.g. the provider offers 24/7 roadside assistance). |
| 5 | Provider | Reviews Cross-border toggle. Leaves it Off (vehicle not permitted to cross national borders). |
| 6 | System | Shows a visible flag in the document section: "Two documents are required for your listing to go live: Vehicle Registration and Insurance Certificate." |
| 7 | Provider | Taps "Upload" next to "Vehicle Registration". Device file picker opens. |
| 8 | Provider | Selects the vehicle registration document (PDF scan). |
| 9 | System | Validates: file type is PDF/JPEG/PNG/WEBP; file size ≤ 10 MB. |
| 10 | System | Uploads file to S3 in a secure, non-public prefix. Returns internal document ID. Shows filename with green checkmark: "Vehicle Registration ✓". |
| 11 | Provider | Taps "Upload" next to "Insurance Certificate". Selects the insurance cert image (JPEG). |
| 12 | System | Validates and uploads. Shows "Insurance Certificate ✓". |
| 13 | Provider | Optionally taps "Upload" next to "Roadworthiness Certificate". Uploads the document. |
| 14 | Provider | All required documents uploaded. Taps "Next". |
| 15 | System | Validates: insurance type selected, vehicle registration uploaded, insurance cert uploaded. Saves and advances to Step 5. |

---

#### Alternative Flows

**A1 — Provider skips required documents and taps "Next"**
- At step 15: validation fails.
- Inline checklist shows: ✗ Vehicle registration — not uploaded · ✗ Insurance certificate — not uploaded.
- "Next" is disabled until both are present.

**A2 — File type not supported**
- Inline per-file error: "'[filename]' is not a supported format. Please upload a PDF, JPEG, PNG, or WEBP file."

**A3 — File exceeds 10 MB**
- Inline error: "'[filename]' exceeds the 10 MB size limit. Please compress or scan at a lower resolution."

**A4 — Provider replaces an already-uploaded document**
- Provider taps "Replace" on an uploaded document.
- File picker opens. New file is uploaded. Old S3 object scheduled for deletion. New checkmark displayed.
- For active listings: replacement of a required document does NOT trigger a re-review (no admin approval exists for cars). However, if the document is later found to be invalid, admin may suspend reactively.

**A5 — Cross-border allowed toggled ON**
- System shows an informational note: "Guests will see 'Cross-border travel allowed' on your listing. Ensure your insurance policy covers cross-border trips before enabling this."

**A6 — Insurance type = Basic 3rd party selected**
- System shows a guest-facing preview: "Guests will see: Insurance: Basic 3rd party coverage. Guests are responsible for damages not covered by 3rd party insurance." with a recommendation: "Consider upgrading to Comprehensive for broader guest confidence."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | PATCH | `insurance_type`, `roadside_assistance`, `cross_border_allowed` |
| `listing_documents` | INSERT | `listing_id`, `document_type` (registration / insurance_cert / roadworthiness), `s3_key`, `file_type`, `uploaded_at` |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/listings/{id}/documents` | Upload vehicle document |
| DELETE | `/listings/{id}/documents/{doc_id}` | Remove / replace a document |

---

### UC-4.6 — Configure Pickup and Return Details (Step 5)

**ID:** UC-4.6  
**Name:** Configure Vehicle Pickup and Return Location  
**Primary Actor:** Provider  
**Secondary Actors:** System, Google Maps Platform  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Step 4 (UC-4.5) completed. Provider is on Step 5.

#### Postconditions
- Pickup address geocoded and saved (`lat`, `lng`, `town`, `country`).
- Return policy configured (same location or separate return address).
- Airport pickup and delivery options configured.
- Pickup hours saved.

---

#### Field Reference — Step 5

| Field | Type | Required | Validation / Notes |
|---|---|---|---|
| Pickup address | Text + Autocomplete | Yes | Google Places Autocomplete + geocoding. This is the search radius source of truth (BR-4.16). |
| Town / City | Text | Yes | Auto-filled from geocoding; editable |
| Country | Text (read-only) | Yes | Auto-filled from geocoding |
| Map pin | Draggable marker | Yes | Represents exact pickup point |
| Return same location | Toggle | No | Default On. If Off: return address fields revealed. |
| Return address | Text + Autocomplete | Conditional | Required if return same location = Off (BR-4.17). |
| Airport pickup | Toggle | No | Default Off. If On: listing displayed in airport vehicle search. |
| Delivery available | Toggle | No | Default Off. If On: delivery radius and fee fields revealed. |
| — Delivery radius (km) | Integer | Conditional | Required if delivery On (BR-4.18). ≥ 1. |
| — Delivery fee | Decimal | Conditional | Required if delivery On (BR-4.18). ≥ 0 (0 = free delivery). |
| Pickup hours — From | Time picker | No | HH:MM (24h) |
| Pickup hours — To | Time picker | No | HH:MM (24h); must be after From if both set |

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 5 — Pickup & Return. |
| 2 | Provider | Taps the "Pickup address" field. Google Places Autocomplete activates. |
| 3 | Provider | Types the pickup address (e.g. "Kenyatta Ave, Nairobi"). Selects from autocomplete suggestions. |
| 4 | System | Calls Google Geocoding API. Extracts `lat`, `lng`, `locality` (→ town), `country`. Auto-fills Town and Country. Drops a draggable map pin at the geocoded coordinates. |
| 5 | Provider | Reviews the pin position. Drags the pin slightly to mark the exact kerbside pickup point if needed. |
| 6 | System | On pin release: updates `lat`/`lng` only. Address text fields unchanged. |
| 7 | Provider | Confirms the Return same location toggle is On (vehicle must be returned to the same address). |
| 8 | Provider | Reviews Airport pickup toggle. Taps to enable it: this vehicle can be collected from or returned to the nearest airport. |
| 9 | System | When airport pickup is enabled: shows a note: "Your listing will appear in airport vehicle searches. Guests will see 'Airport pickup available'." |
| 10 | Provider | Enables Delivery toggle. |
| 11 | System | Reveals delivery configuration fields. |
| 12 | Provider | Enters delivery radius: 20 km. |
| 13 | Provider | Enters delivery fee: 500 (KES). |
| 14 | System | Shows live preview: "You'll deliver the vehicle within a 20 km radius of your pickup location for KES 500." |
| 15 | Provider | Sets pickup hours: From 07:00, To 20:00. |
| 16 | Provider | Taps "Next". |
| 17 | System | Validates: pickup address geocoded (lat/lng not null), town not empty. If return different location: return address geocoded. If delivery On: radius ≥ 1, fee ≥ 0. If pickup hours set: To > From. |
| 18 | System | Saves all Step 5 data. Advances to Step 6. |

---

#### Alternative Flows

**A1 — Return same location toggled OFF**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Toggles "Return same location" to Off. |
| 2 | System | Reveals a second address block: "Return address". Includes a second Google Places Autocomplete field and a second embedded map showing both the pickup pin (blue) and the return pin (red). |
| 3 | Provider | Enters return address. Autocomplete and geocoding run for the return address independently. |
| 4 | System | Return address geocoded. Return pin placed on the map. |
| 5 | Provider | Confirms. Both addresses saved. Guest-facing listing will show "Pickup: [address]" and "Return: [address]" as distinct locations. |

**A2 — Pickup address not found in Google Places**
- Provider uses manual pin placement (same as UC-2.3 A3 — refers to the manual pin flow documented in E2).
- Pickup town and country must be manually entered.

**A3 — Delivery toggled Off after being configured**
- All delivery fields (radius, fee) collapse and their values are cleared from the form.
- Confirmation: "Disable delivery? Your delivery radius and fee settings will be removed." Provider confirms.

**A4 — Delivery fee set to 0**
- Valid. System shows preview: "You'll deliver the vehicle within [X] km for free." No blocking error.

**A5 — Airport pickup toggled On for a listing in a city with multiple airports**
- System stores `airport_pickup = true` without specifying which airport. Guest-facing listing shows "Airport pickup available — contact the provider for details."

**A6 — Pickup hours: To time is before From time**
- E.g. From = 18:00, To = 06:00. This could indicate overnight pickup availability.
- System shows: "Your pickup window crosses midnight (18:00 – 06:00 next day). Is this correct?" Provider confirms or corrects.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | PATCH | `pickup_address`, `pickup_lat`, `pickup_lng`, `pickup_town`, `country`, `return_same_location`, `return_address`, `return_lat`, `return_lng`, `airport_pickup`, `delivery_available`, `delivery_radius_km`, `delivery_fee`, `pickup_hours_from`, `pickup_hours_to` |

---

### UC-4.7 — Upload Vehicle Photos (Step 6)

**ID:** UC-4.7  
**Name:** Upload Car Rental Listing Photos  
**Primary Actor:** Provider  
**Secondary Actors:** System, AWS S3  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Step 5 (UC-4.6) completed. Provider is on Step 6.

#### Postconditions
- At least 1 photo uploaded (BR-4.22 — minimum for auto-activation).
- Photos stored in S3 with CDN URLs.
- First photo = cover image.

---

#### Field Reference — Step 6

| Field | Type | Required | Validation |
|---|---|---|---|
| Photos | Multi-image upload | Yes | ≥ 1 for activation; max 30; ≤ 5 MB each; JPEG/PNG/WEBP |

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 6 — Photos. Instructions: "Add photos of your vehicle. First photo is the cover shown in search. JPEG, PNG, or WEBP. Max 5 MB each. Upload up to 30." Recommended guidance shown: "Include exterior (front, rear, sides), interior (dashboard, seats), and boot/trunk for best results." |
| 2 | Provider | Taps "Add photos". Selects one or more photos from gallery or takes photos with camera (mobile). |
| 3 | System | Validates each file: type (JPEG/PNG/WEBP), size (≤ 5 MB), count (≤ 30 total). |
| 4 | System | Uploads valid photos to S3 asynchronously. Shows progress per photo. Renders thumbnails in the photo grid on completion. |
| 5 | System | First uploaded photo automatically assigned as cover with "Cover" badge. |
| 6 | Provider | Uploads additional photos (e.g. interior shots, boot, dashboard). |
| 7 | Provider | Reorders photos using drag-and-drop (web) or long-press drag (mobile) so the best exterior shot is in position 1 (cover). |
| 8 | Provider | Satisfied with photos. Minimum 1 photo uploaded. Taps "Next — Review & Go Live". |

---

#### Alternative Flows

**A1 — Provider uploads only 1 photo**
- Allowed — 1 photo meets the minimum for car rental activation (unlike apartments which require 3).
- System shows a recommendation: "Adding more photos — exterior, interior, and boot — increases booking rates. Consider adding at least 4 photos." Not blocking.

**A2 — File too large or wrong type**
- Same behaviour as UC-2.5 A5/A6. Per-file error. Other files in the batch that are valid continue uploading.

**A3 — Provider deletes the cover photo**
- The next photo in the list becomes the new cover. Same as UC-2.5 A3.

*All other photo flows (reorder, retry on failure, camera capture) are identical to UC-2.5.*

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listing_photos` | INSERT | `listing_id`, `s3_key`, `cdn_url`, `position`, `uploaded_at` |

---

### UC-4.8 — Review Car Rental Listing Before Activation

**ID:** UC-4.8  
**Name:** Review Car Rental Listing Summary  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- All steps (1–6) completed. Provider is on the "Review & Go Live" screen.

#### Postconditions
- Provider has reviewed all entered information.
- Provider proceeds to submit (UC-4.9) or navigates back to correct any step.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | After Step 6, arrives at "Review & Go Live" summary. |
| 2 | System | Displays a structured preview of all listing information: |
| | | **Vehicle overview:** Cover photo (hero image) · Listing title · Make, Model, Year, Colour · Category · Fleet size (units) |
| | | **Specs:** Seats, Doors, Transmission, Fuel type, Drive type, Engine size, A/C |
| | | **Rental terms:** Price per day · Currency · Min rental days · Min driver age · Mileage policy (with km/day and extra km rate if Limited) · Fuel policy · Security deposit · Cancellation policy |
| | | **Insurance:** Insurance type · Roadside assistance (Yes/No) · Cross-border allowed (Yes/No) |
| | | **Documents:** Vehicle registration ✓ · Insurance certificate ✓ · Roadworthiness cert ✓ or N/A |
| | | **Pickup & return:** Pickup address with map pin · Return policy · Airport pickup · Delivery (radius and fee if enabled) · Pickup hours |
| | | **Photos:** All photos in scrollable strip (cover marked) |
| 3 | System | Runs auto-activation pre-check and displays results: |
| | | ✓ Listing title |
| | | ✓ Make, Model, Year |
| | | ✓ Price per day |
| | | ✓ Mileage policy configured |
| | | ✓ Fuel policy selected |
| | | ✓ Cancellation policy selected |
| | | ✓ Pickup address geocoded |
| | | ✓ Vehicle registration uploaded |
| | | ✓ Insurance certificate uploaded |
| | | ✓ At least 1 photo uploaded |
| 4 | System | All checks pass. "Submit & Go Live" button enabled. |
| 5 | Provider | Reviews. Taps "Submit & Go Live" to proceed to UC-4.9. |

---

#### Alternative Flows

**A1 — One or more checks fail**
- Failing checks shown with ✗ in red.
- "Submit & Go Live" disabled.
- Each failing item is a tappable link to the relevant step.

**A2 — Provider wants to edit before submitting**
- Taps "Edit" pen icon next to any section.
- Navigates to that step. Makes changes. Returns to summary.

---

### UC-4.9 — Submit Car Rental Listing for Auto-Activation

**ID:** UC-4.9  
**Name:** Submit Car Rental Listing — Auto-Activation  
**Primary Actor:** Provider  
**Secondary Actors:** System, SendGrid  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- All required fields populated.
- Vehicle registration and insurance certificate uploaded.
- At least 1 photo uploaded.
- Provider is on the "Review & Go Live" screen.

#### Postconditions (Success)
- `listings.status` → `active`.
- `listings.activated_at` = now.
- Listing indexed in Elasticsearch. Appears in guest search within 5 minutes.
- Provider receives in-app notification and email.
- No admin review task created.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps "Submit & Go Live" on the review screen. |
| 2 | System | Displays activation modal: "Your vehicle listing will go live immediately on ZikaBooking. Guests will be able to search and book it right away. Your licence plate will only be revealed to guests after a confirmed booking. Continue?" |
| 3 | Provider | Taps "Confirm". |
| 4 | System | Performs server-side auto-activation validation: |
| | | • `name` not empty |
| | | • `make`, `model`, `year` not null |
| | | • `vehicle_category` not null |
| | | • `unit_count ≥ 1` |
| | | • `licence_plate` not empty |
| | | • `odometer_km ≥ 0` (not null) |
| | | • `seats ≥ 1`, `doors` not null, `transmission` not null |
| | | • `fuel_type` not null |
| | | • `air_conditioning` not null |
| | | • `price_per_day > 0` |
| | | • `mileage_policy` not null |
| | | • If mileage_policy = Limited: `km_per_day ≥ 1` AND `extra_km_rate > 0` |
| | | • `fuel_policy` not null |
| | | • `cancellation_policy` not null |
| | | • `insurance_type` not null |
| | | • `pickup_lat` and `pickup_lng` not null |
| | | • `listing_documents` contains at least 1 vehicle_registration AND 1 insurance_cert |
| | | • `listing_photos` count ≥ 1 |
| 5 | System | All validation passes. Atomic transaction: |
| | | • `listings.status = active` |
| | | • `listings.activated_at = now` |
| | | • Triggers Elasticsearch indexing job |
| 6 | System | Returns HTTP 200. |
| 7 | System | Sends provider in-app push notification: "Your vehicle '[Make] [Model] [Year]' is now live on ZikaBooking!" |
| 8 | System | Sends provider email via SendGrid. Subject: "Your vehicle listing is live — '[Title]'." Body: vehicle summary, pickup location, price per day, link to view live listing, tips for first bookings. |
| 9 | Provider | App shows: "Your vehicle is live! Guests can now find and book it." with "View listing" CTA. |
| 10 | Provider | "My Listings" shows the listing with a green "Active" badge. Fleet size shown: "3 units". |

---

#### Alternative Flows

**A1 — Mileage policy is Limited but km/day or extra km rate is missing**
- Server returns HTTP 422: `{ error: "mileage_policy_incomplete", detail: "km_per_day and extra_km_rate are required when mileage_policy is limited" }`.
- Client directs provider back to Step 3.

**A2 — Vehicle registration document missing**
- Server returns HTTP 422: `{ error: "missing_documents", missing: ["vehicle_registration"] }`.
- Client shows: "Your vehicle registration document is required to go live. Please upload it in Step 4."

**A3 — Pickup address not geocoded**
- Server returns HTTP 422: `{ error: "pickup_not_geocoded" }`.
- Client shows: "Please set and confirm your pickup address in Step 5 before going live."

**A4 — Provider cancels the activation modal**
- Status remains `draft`. Provider returns to the review screen.

**A5 — Elasticsearch indexing fails post-activation**
- Status is `active` in PostgreSQL (source of truth). Indexing retried asynchronously.
- Provider UX is unaffected. Listing appears in search once indexing succeeds.

---

#### Exception Flows

**E1 — Database transaction failure**
- Status remains `draft`. HTTP 500 returned.
- Client: "We couldn't activate your listing. Please try again."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = active`, `activated_at = now` |
| `email_log` | INSERT | `type = listing_activated`, provider email |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/listings/{id}/activate` | Server-side validation and auto-activation |

---

### UC-4.10 — Edit an Active Car Rental Listing

**ID:** UC-4.10  
**Name:** Edit Active Car Rental Listing  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in.
- Car rental listing exists and belongs to this provider.
- Status is `active`, `draft`, or `deactivated`.

#### Postconditions (Success)
- Listing data updated. For `active` listings: changes applied immediately, Elasticsearch updated within 5 minutes.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On "My Listings", taps "Edit" on a car rental listing. |
| 2 | System | Detects `status = active`. Loads the form with all existing data pre-filled. Shows: "This listing is live. Changes will be visible to guests immediately." |
| 3 | Provider | Navigates to the specific step they want to edit using step tabs. |
| 4 | Provider | Makes changes. Examples: |
| | | • Step 1: Updates odometer reading after a service (e.g. 34500 → 45000 km). |
| | | • Step 3: Changes price per day from 75.00 to 80.00. |
| | | • Step 3: Switches mileage policy from Unlimited to Limited (200 km/day, extra 0.20/km). |
| | | • Step 5: Adds delivery option. |
| | | • Step 6: Adds more exterior photos. |
| 5 | Provider | Taps "Save changes". |
| 6 | System | Validates changed fields. Applies changes. Elasticsearch updated. |
| 7 | Provider | Toast: "Changes saved." |

---

#### Alternative Flows

**A1 — Provider changes price with future confirmed bookings**
- Price change applies to new bookings only.
- Notice: "Your new daily rate (KES 80.00) applies to future bookings. Guests with existing confirmed bookings are charged at their original agreed rate."

**A2 — Provider updates odometer reading**
- No validation constraint other than ≥ 0. Odometer is informational only.
- Note shown: "Updated odometer readings are reflected on the guest-facing listing immediately."

**A3 — Provider changes fleet count (units) with future bookings**
- If reducing: checked against confirmed bookings on overlapping dates (same as UC-4.2 A5).
- If increasing: allowed freely.

**A4 — Provider switches mileage policy from Unlimited to Limited while bookings exist**
- System shows: "Changing to Limited mileage applies to new bookings only. Guests with existing confirmed bookings will retain their original Unlimited mileage terms." Provider confirms to proceed.

**A5 — Provider tries to edit a listing with status `pending_review`**
- Not applicable to car rentals (no review queue exists). This status never applies.

---

### UC-4.11 — Manage Fleet: Add or Remove Units from a Listing

**ID:** UC-4.11  
**Name:** Manage Fleet Unit Count on Car Rental Listing  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Medium  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider has an active car rental listing with `unit_count ≥ 1`.

#### Postconditions
- `listings.unit_count` updated.
- Booking engine availability logic uses the updated count for future reservation lock requests.

---

#### Main Success Scenario — Add Units

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Navigates to the listing edit form. Goes to Step 1 — Vehicle Identity. |
| 2 | Provider | Increases the fleet count stepper (e.g. from 3 to 5). |
| 3 | System | No conflict possible when adding units. Saves immediately on "Save changes". |
| 4 | System | Updates `unit_count = 5`. The booking engine now allows up to 5 concurrent bookings of this listing on any given date range. |
| 5 | Provider | Confirmation toast: "Fleet count updated to 5 vehicles." |

---

#### Main Success Scenario — Remove Units

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Reduces fleet count (e.g. from 5 to 3) on Step 1. |
| 2 | System | Checks for confirmed bookings with overlapping dates where the required unit count would exceed 3. |
| 3 | System | Conflict detected: 4 units are booked on dates [X to Y]. |
| 4 | System | Warns provider: "Reducing to 3 units conflicts with 4 confirmed bookings on [dates range]. Existing confirmed bookings will not be cancelled automatically. Your listing may show as overbooked for those dates. Do you wish to continue?" |
| 5 | Provider | Reviews the conflict details. Opts to "View affected bookings" — list of conflicting booking references shown. |
| 6 | Provider | Decides to proceed (e.g. will contact one guest manually to rearrange). Taps "Reduce to 3 anyway". |
| 7 | System | Updates `unit_count = 3`. Logs the conflict in provider's listing activity log. |
| 8 | Provider | Manually contacts the affected guest via in-app messaging (E17). |

---

#### Alternative Flows

**A1 — Provider reduces to 1 unit with no conflicts**
- No warning. Change saved directly.

**A2 — Provider wants to retire a specific vehicle from the fleet (individual unit identity)**
- The current data model treats all units in a listing as identical (no individual vehicle identity beyond the listing level).
- If the provider wants to retire one specific vehicle from a 5-unit fleet: they reduce `unit_count` to 4.
- If they want to track the specific plate of a retired vehicle, they should deactivate the listing and create a new one — or contact support for manual handling (V1 limitation; individual unit tracking is a Phase 2 feature).

---

### UC-4.12 — Provider Deactivates or Deletes a Car Rental Listing

**ID:** UC-4.12  
**Name:** Deactivate or Delete Car Rental Listing  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Medium  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in. Listing belongs to this provider.

#### Postconditions — Deactivate
- `listings.status` → `deactivated`. Removed from search. No new bookings.

#### Postconditions — Delete
- Draft: soft-deleted. Active listings: deactivation only.

---

#### Main Success Scenario — Deactivate

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps kebab menu on listing. Selects "Deactivate listing". |
| 2 | System | Modal: "Deactivating this vehicle listing will remove it from search immediately. Active reservation locks will be released and affected guests notified. Existing confirmed bookings remain active. Deactivate?" |
| 3 | Provider | Confirms. |
| 4 | System | Sets `listings.status = deactivated`. Cancels all active `reservation_locks` for this listing. Notifies guests with active locks: "This vehicle is no longer available. Your hold has been released." De-indexes from Elasticsearch. |
| 5 | Provider | Listing shows "Deactivated" with a "Reactivate" option. |

---

#### Main Success Scenario — Reactivate

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps "Reactivate" on a deactivated car listing. |
| 2 | System | Runs full auto-activation server-side validation (same as UC-4.9, step 4). |
| 3 | System | All checks pass (documents and photos still present). Sets `status = active`. Re-indexes. |
| 4 | Provider | "Your vehicle listing is live again." |

---

#### Alternative Flows

**A1 — Reactivation fails: insurance certificate has expired**
- System cannot automatically detect document expiry (no OCR in V1).
- Reactivation succeeds technically. However, if a guest or admin later reports an expired document, admin can suspend reactively.
- Phase 2: document expiry date field + automated expiry reminders to provider.

**A2 — Delete a draft car listing**
- Identical to UC-3.7 draft delete flow. Soft-delete, S3 cleanup via background job.

---

### UC-4.13 — Admin: Reactive Suspension of a Car Rental Listing

**ID:** UC-4.13  
**Name:** Admin Reactively Suspends an Active Car Rental Listing  
**Primary Actor:** Admin (Super Admin, Admin, Country Manager within scope)  
**Secondary Actors:** System, SendGrid  
**Priority:** High  
**Platform:** Web Admin Panel

#### Preconditions
- Car listing has `status = active`.
- Admin has grounds (complaint, invalid documents found, safety concern).

#### Postconditions
- `listings.status` → `suspended`.
- Listing removed from search. Active locks cancelled. Guests and provider notified.
- `audit_log` entry created.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Finds the listing in admin panel (search by listing name, provider, or reference). |
| 2 | Admin | Opens listing detail. Clicks "Suspend listing". |
| 3 | System | Displays suspension form: reason (required, free text, max 500 chars), notify provider toggle (default ON), internal note (not shared). |
| 4 | Admin | Enters reason (e.g. "Vehicle registration document found to be expired — provider notified to update"). Confirms. |
| 5 | System | Sets `listings.status = suspended`. Cancels all active `reservation_locks`. Notifies affected guests. |
| 6 | System | Sends suspension email to provider (if toggle ON). |
| 7 | System | Writes `audit_log` entry: `action = listing_suspended`, `admin_id`, `reason`, `timestamp`. |

---

#### Alternative Flows

**A1 — Admin reinstates a suspended car listing**
- Admin clicks "Reinstate listing".
- Mandatory reinstatement note required.
- Sets `status = active`. Re-indexes. Provider notified. `audit_log` entry.

**Note on Auto-Suspension:** If the listing was auto-suspended due to 2 consecutive negative reviews, `status = auto_suspended`. The reinstatement of auto-suspended car listings follows the agent unblock process in **E14** — it is a different workflow with SLAs and decision options. This UC (4.13) applies only to manual admin suspension (`status = suspended`).

---

## 3. Car Rental Listing Status State Machine

```
                ┌─────────────┐
   Create       │             │
────────────>   │    DRAFT    │
                │             │
                └──────┬──────┘
                       │
                       │ Submit & Auto-Activate (UC-4.9)
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
                       │
                       ▼
                PERMANENTLY_BANNED
               (Super Admin / Admin only)
```

---

## 4. Guest-Facing Listing Display Logic

The following shows what guests see on the car listing detail page, based on the stored data:

| Data Stored | Guest Sees |
|---|---|
| `unit_count = 1` | "1 vehicle available" |
| `unit_count = 5` | "Fleet: up to 5 vehicles available" |
| `mileage_policy = unlimited` | "Unlimited mileage included" |
| `mileage_policy = limited`, km=200, rate=0.15 | "200 km/day included. Extra: KES 0.15/km" |
| `fuel_policy = full_to_full` | "Fuel policy: Full-to-Full" |
| `bedrooms = 0` (not applicable for cars) | N/A |
| `licence_plate` | Hidden until booking confirmed |
| `cross_border_allowed = false` | "Cross-border travel: Not permitted" |
| `cross_border_allowed = true` | "Cross-border travel: Permitted" |
| `roadside_assistance = true` | "Roadside assistance included" |
| `airport_pickup = true` | "Airport pickup available" |
| `delivery_available = true`, radius=20, fee=500 | "Delivery available within 20 km — KES 500 fee" |
| `delivery_fee = 0` | "Free delivery within [X] km" |
| `min_driver_age = 25` | "Minimum driver age: 25 years" |
| `security_deposit = 500` | "Security deposit: KES 500 (collected at pickup)" |
| `insurance_type = comprehensive` | "Insurance: Comprehensive" |

---

## 5. Data Model — Epic 4 Additions

All car-rental-specific fields are added to the shared `listings` table. No new tables required beyond those introduced in E2.

```sql
-- Car-rental-specific columns on the listings table:
listings
  ...
  -- Vehicle identity (Step 1):
  make                        VARCHAR(60) NULL
  model                       VARCHAR(60) NULL
  year                        SMALLINT NULL CHECK (year >= 1990 AND year <= EXTRACT(YEAR FROM NOW()))
  vehicle_category            ENUM('economy','compact','suv','minivan','pickup',
                                   'luxury','electric','convertible') NULL
  colour                      VARCHAR(30) NULL
  licence_plate_encrypted     TEXT NULL  -- AES-256 encrypted; decrypted only post-booking
  odometer_km                 INTEGER NULL CHECK (odometer_km >= 0)

  -- Technical specs (Step 2):
  seats                       SMALLINT NULL CHECK (seats >= 1)
  doors                       SMALLINT NULL CHECK (doors IN (2,3,4,5))
  transmission                ENUM('manual','automatic','semi_auto') NULL
  fuel_type                   ENUM('petrol','diesel','hybrid','electric','lpg') NULL
  drive_type                  ENUM('2wd','4wd','awd') NULL
  engine_size_cc              INTEGER NULL CHECK (engine_size_cc > 0)
  air_conditioning            BOOLEAN NULL

  -- Rental terms (Step 3):
  price_per_day               DECIMAL(10,2) NULL CHECK (price_per_day > 0)
  min_rental_days             SMALLINT NULL DEFAULT 1 CHECK (min_rental_days >= 1)
  min_driver_age              SMALLINT NULL DEFAULT 21 CHECK (min_driver_age >= 18)
  mileage_policy              ENUM('unlimited','limited') NULL
  km_per_day                  INTEGER NULL CHECK (km_per_day >= 1)
  extra_km_rate               DECIMAL(10,4) NULL CHECK (extra_km_rate > 0)
  fuel_policy                 ENUM('full_to_full','full_to_empty','pre_purchase') NULL
  security_deposit            DECIMAL(10,2) NULL CHECK (security_deposit >= 0)

  -- Insurance (Step 4):
  insurance_type              ENUM('basic_third_party','comprehensive','premium_zero_excess') NULL
  roadside_assistance         BOOLEAN NOT NULL DEFAULT FALSE
  cross_border_allowed        BOOLEAN NOT NULL DEFAULT FALSE

  -- Pickup & return (Step 5):
  pickup_address              TEXT NULL
  pickup_lat                  DECIMAL(9,6) NULL
  pickup_lng                  DECIMAL(9,6) NULL
  pickup_town                 VARCHAR(100) NULL
  return_same_location        BOOLEAN NOT NULL DEFAULT TRUE
  return_address              TEXT NULL
  return_lat                  DECIMAL(9,6) NULL
  return_lng                  DECIMAL(9,6) NULL
  airport_pickup              BOOLEAN NOT NULL DEFAULT FALSE
  delivery_available          BOOLEAN NOT NULL DEFAULT FALSE
  delivery_radius_km          INTEGER NULL CHECK (delivery_radius_km >= 1)
  delivery_fee                DECIMAL(10,2) NULL CHECK (delivery_fee >= 0)
  pickup_hours_from           TIME NULL
  pickup_hours_to             TIME NULL
  ...

-- listing_documents (from E2) — reused with car-specific document_type values:
-- document_type ENUM extended to include:
--   'vehicle_registration', 'insurance_cert', 'roadworthiness_cert'
--   (in addition to E2's: 'business_licence', 'operating_permit', 'tourism_certificate')
```

---

## 6. API Endpoint Summary — Epic 4

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/listings` | Provider | Create draft car listing |
| GET | `/listings/{id}` | Provider | Load listing for editing/review |
| PATCH | `/listings/{id}` | Provider | Save any listing field (any step) |
| POST | `/listings/{id}/activate` | Provider | Auto-activation server-side validation + publish |
| POST | `/listings/{id}/deactivate` | Provider | Deactivate a live listing |
| POST | `/listings/{id}/reactivate` | Provider | Reactivate a deactivated listing |
| DELETE | `/listings/{id}` | Provider | Soft-delete a draft listing |
| POST | `/listings/{id}/photos` | Provider | Upload vehicle photos |
| PATCH | `/listings/{id}/photos/reorder` | Provider | Reorder photos / set cover |
| DELETE | `/listings/{id}/photos/{photo_id}` | Provider | Remove a photo |
| POST | `/listings/{id}/documents` | Provider | Upload vehicle document (registration, insurance, roadworthiness) |
| DELETE | `/listings/{id}/documents/{doc_id}` | Provider | Remove a document |
| POST | `/admin/listings/{id}/suspend` | Admin | Admin suspends an active listing |
| POST | `/admin/listings/{id}/reinstate` | Admin | Admin reinstates a suspended listing |

---

## 7. Acceptance Criteria

### AC-4.1 — Auto-Activation Validation
- [ ] A listing with all required fields, both required documents, and at least 1 photo activates immediately without admin intervention.
- [ ] A listing with `mileage_policy = limited` but missing `km_per_day` or `extra_km_rate` is rejected at activation with a specific field-level error.
- [ ] A listing without vehicle registration document cannot activate.
- [ ] A listing without insurance certificate cannot activate.
- [ ] `licence_plate` is not returned in any public API response (search results, listing detail pre-booking). It is only revealed in the confirmed booking record.

### AC-4.2 — Vehicle Identity
- [ ] Year validation rejects values below 1990 and above the current year.
- [ ] Make field provides autocomplete suggestions but allows free-text entry.
- [ ] Fleet count ≥ 1 enforced at submission.
- [ ] Reducing fleet count below existing concurrent confirmed bookings triggers a conflict warning — not a hard block.

### AC-4.3 — Mileage Policy
- [ ] Selecting "Unlimited" hides and clears km/day and extra km rate fields.
- [ ] Selecting "Limited" makes km/day and extra km rate required before the step can be saved.
- [ ] The guest-facing listing displays the mileage policy in plain language.

### AC-4.4 — Pickup & Return
- [ ] Pickup address must be geocoded (lat/lng present) before the listing can activate.
- [ ] Toggling "Return same location" to Off reveals and requires a separate return address (also geocoded).
- [ ] Enabling delivery makes radius and fee both required (fee may be 0).
- [ ] Pickup address coordinates are used as the source of truth for geo-radius guest searches.

### AC-4.5 — Fleet Availability
- [ ] A fleet of 3 units allows up to 3 simultaneous reservation locks on the same date range.
- [ ] A 4th lock attempt on the same dates for a 3-unit fleet is rejected with "This vehicle is not available for your selected dates."

### AC-4.6 — Status Transitions
- [ ] Deactivating a car listing cancels all active reservation locks and notifies affected guests within 5 seconds.
- [ ] `auto_suspended` (review-triggered) and `suspended` (admin-triggered) are distinct status values with different reinstatement paths.
- [ ] Reactivating a deactivated listing re-runs the full server-side auto-activation validation before setting status to `active`.

### AC-4.7 — Document Privacy
- [ ] Vehicle registration and insurance documents are stored in a non-public S3 prefix. No pre-signed URL is served to guests.
- [ ] Admin can view documents in the admin panel for reactive moderation.

---

*End of E4 — Listing Management: Car Rentals*  
*Next: E5 — Search & Discovery*
