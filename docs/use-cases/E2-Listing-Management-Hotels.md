# Epic 2 — Listing Management: Hotels

**Epic ID:** E2  
**PRD Reference:** §3.1, §3.4, §3.5, §8.2  
**Version:** 1.0  
**Date:** 2026-04-25  
**Status:** Ready for Review

---

## 1. Epic Summary

### Goal
Enable hotel providers to create, manage, and submit their property listings through a structured multi-step form, and enable admin staff to review accreditation documents, assign verified star ratings, and approve or reject listings before they go live on the platform.

### Actors

| Actor | Description |
|---|---|
| Provider | A hotel operator with an active, verified ZikaBooking provider account |
| Admin | Admin panel user with hotel approval permissions (Super Admin, Admin, Country Manager within scope) |
| System | Automated platform processes (geocoding calls, status transitions, notifications) |
| Google Maps Platform | External geocoding, Places Autocomplete, and embedded map service |
| SendGrid | External email delivery for status notifications |

### Scope — IN
- Hotel listing creation and editing (all required and optional fields)
- Google Places Autocomplete with live geocoding and draggable map pin
- Photo upload and management (up to 30 images)
- Services and amenities selection (grid + custom)
- Accreditation document upload
- Listing submission for admin review (draft → pending_review)
- Admin review queue: view, approve, reject
- Star rating assignment by admin
- Provider notification of approval or rejection
- Rejected listing resubmission flow
- Listing deactivation and deletion by provider
- Admin suspension of a live hotel listing

### Scope — OUT
- Apartment listing management (E3)
- Car rental listing management (E4)
- Channel manager / iCal sync (E13)
- Provider calendar and date-range availability (E12)
- Booking engine (E6)
- Voucher / promotion attachment to listings (E15)
- Review display on listing (E14)

### Key Business Rules

| ID | Rule |
|---|---|
| BR-2.1 | Hotels require manual admin approval before appearing in search. Status workflow: `draft` → `pending_review` → `approved` / `rejected`. |
| BR-2.2 | Only listings with `status = approved` appear in guest search results. |
| BR-2.3 | Star rating (1★–5★) is assigned exclusively by admin. Providers may indicate a claimed/self-assessed rating, but it is not used publicly until confirmed by admin. |
| BR-2.4 | Accreditation documents are mandatory for admin approval: business licence, hotel operating permit, tourism authority certificate. All must be uploaded before submission. |
| BR-2.5 | Photos: maximum 30 images. Each must be JPEG, PNG, or WEBP format and ≤ 5 MB. The first photo is the cover image. |
| BR-2.6 | Description: free text, maximum 1,000 characters. |
| BR-2.7 | Address is set via Google Places Autocomplete. Geocoding API call extracts `lat`, `lng`, `locality` (→ town), and `country`. These fields auto-populate and can be edited. |
| BR-2.8 | If the provider drags the map pin manually, `lat`/`lng` update but the text address fields are not changed. |
| BR-2.9 | The `lat`/`lng` pair is the source of truth for all geo-radius search queries. |
| BR-2.10 | Number of units must be an integer ≥ 1. |
| BR-2.11 | Price per night must be a positive decimal value. |
| BR-2.12 | Cancellation policy options: Flexible, Moderate, Strict. |
| BR-2.13 | Room type options: Standard, Superior, Deluxe, Suite, Junior Suite, Studio, Family Room, Presidential Suite. |
| BR-2.14 | A rejected listing can be edited and resubmitted. Each resubmission creates a new review task in the admin queue. |
| BR-2.15 | A provider may have multiple hotel listings. Each is independently submitted and reviewed. |
| BR-2.16 | Admin rejection requires a reason selection from a predefined list plus optional free-text. Reason is included in the provider notification email. |
| BR-2.17 | Approved hotel listings appear in search within 5 minutes of approval (cache TTL). |
| BR-2.18 | Custom amenities entered via free-text appear as chips on the guest-facing listing detail page. |
| BR-2.19 | Minimum stay must be a positive integer (nights). Default is 1. |
| BR-2.20 | Every review action (approve, reject, star rating assignment) is written to the immutable `audit_log`. |

---

## 2. Use Cases

---

### UC-2.1 — Create Hotel Listing (Start Draft)

**ID:** UC-2.1  
**Name:** Create Hotel Listing — Start New Draft  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in with `status = active` and `user_type = provider`.
- Provider navigates to "My Listings" and taps "Add new listing".
- Provider selects "Hotel" as the listing category.

#### Postconditions (Success)
- A new listing record is created in the `listings` table with `status = draft`, `category = hotel`, and `provider_id` set to the current user.
- Provider is taken into the multi-step listing creation form.
- Draft is auto-saved at each step so partial progress is not lost.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps "Add new listing" from the Provider Dashboard or "My Listings" screen. |
| 2 | System | Displays listing category selection screen: Hotel / Apartment / Car Rental with icons and brief descriptions. |
| 3 | Provider | Selects **Hotel**. |
| 4 | System | Creates a new listing record: `status = draft`, `category = hotel`, `provider_id = current_user`. Returns the listing `id`. |
| 5 | System | Opens the multi-step hotel listing form. Displays a step progress indicator (e.g. Step 1 of 6). |
| 6 | Provider | Proceeds through each step of the form (covered in UC-2.2 through UC-2.6). |
| 7 | System | Auto-saves progress after each step is completed (PATCH `/listings/{id}`). |
| 8 | Provider | Can exit and return later — draft is preserved. |

---

#### Alternative Flows

**A1 — Provider has reached a maximum listing count**
- If a platform-level limit exists per provider (configurable), system displays: "You have reached the maximum number of listings. Please contact support to increase your limit."
- Button disabled.

**A2 — Provider navigates away before completing Step 1**
- Draft record already created at step 4. Next time provider opens "My Listings", the incomplete draft appears with a "Continue" button and a "Discard draft" option.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | INSERT | `provider_id`, `category = hotel`, `status = draft`, `created_at` |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/listings` | Create a new draft listing |

---

### UC-2.2 — Complete Hotel Listing Details (Step-by-Step Form)

**ID:** UC-2.2  
**Name:** Complete Hotel Listing Details  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- A draft listing exists for this provider (`status = draft`, `category = hotel`).
- Provider is on the listing form (continuing from UC-2.1 or returning to a saved draft).

#### Postconditions (Success)
- All required fields are populated and valid.
- Draft is saved with all entered data.
- Provider is able to proceed to submission (UC-2.7).

#### Form Steps

The hotel listing form is divided into logical steps. Each step auto-saves on "Next". Provider can navigate back to any previous step.

---

#### Step 1 — Basic Information

**Fields:**

| Field | Type | Required | Validation |
|---|---|---|---|
| Listing name (Property name) | Text | Yes | Max 200 chars |
| Room type | Single select | Yes | One of: Standard, Superior, Deluxe, Suite, Junior Suite, Studio, Family Room, Presidential Suite |
| Number of units | Integer input | Yes | Integer ≥ 1 |
| Claimed star rating | Single select (1–5★) | No | Provider's self-assessment — not displayed publicly until admin assigns verified rating |
| Description | Textarea | No | Max 1,000 characters. Character counter shown. |

**Main Success Scenario — Step 1:**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Enters property name (e.g. "Grand Nairobi Hotel"). |
| 2 | Provider | Selects room type from dropdown (e.g. "Deluxe"). |
| 3 | Provider | Enters number of units (e.g. 45). |
| 4 | Provider | Optionally selects their claimed star rating (e.g. 4★). |
| 5 | Provider | Optionally enters description. Character count decrements in real time. |
| 6 | Provider | Taps "Next". |
| 7 | System | Validates: name not empty, room type selected, units ≥ 1. |
| 8 | System | Saves step 1 data via `PATCH /listings/{id}`. Advances to Step 2. |

**Alternative Flows — Step 1:**

**A1 — Description exceeds 1,000 characters**
- Character counter turns red at 1,000. "Next" remains enabled but the description field shows inline error: "Description cannot exceed 1,000 characters." Provider must trim before saving.

**A2 — Units entered as 0 or negative**
- Inline error: "Number of units must be at least 1."

**A3 — Units entered as a decimal**
- Input field is integer-only (numeric keyboard on mobile). Web form rejects decimals with inline error: "Please enter a whole number."

---

#### Step 2 — Location & Address (Geocoding)

*(Detailed separately in UC-2.3)*

---

#### Step 3 — Pricing & Policies

**Fields:**

| Field | Type | Required | Validation |
|---|---|---|---|
| Price per night | Decimal input | Yes | Positive decimal, max 2 d.p. |
| Currency | Select | Yes | Defaults to provider's account locale currency. Full ISO 4217 list. |
| Minimum stay (nights) | Integer | No | Default 1. Must be ≥ 1 if entered. |
| Check-in time | Time picker | No | Format HH:MM (24h) |
| Check-out time | Time picker | No | Format HH:MM (24h) |
| Cancellation policy | Single select | Yes | Flexible / Moderate / Strict |
| Smoking allowed | Toggle | No | Default: Off |
| Pets allowed | Toggle | No | Default: Off |

**Main Success Scenario — Step 3:**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Enters price per night (e.g. 120.00). |
| 2 | Provider | Selects or confirms currency (e.g. KES). |
| 3 | Provider | Optionally sets minimum stay, check-in/out times. |
| 4 | Provider | Selects cancellation policy. |
| 5 | Provider | Toggles smoking/pets as applicable. |
| 6 | Provider | Taps "Next". System validates and saves. |

**Alternative Flows — Step 3:**

**A1 — Price entered as 0 or negative**
- Inline error: "Price must be greater than 0."

**A2 — Check-out time is before or equal to check-in time**
- Inline error: "Check-out time must be after check-in time."

**A3 — Currency changed after price entry**
- Price value is retained; only the currency label changes. A reminder tooltip shows: "Ensure your price reflects the selected currency."

---

#### Step 4 — Services & Amenities

*(Detailed separately in UC-2.4)*

---

#### Step 5 — Photos

*(Detailed separately in UC-2.5)*

---

#### Step 6 — Accreditation Documents

**Fields:**

| Document | Type | Required |
|---|---|---|
| Business licence | PDF or image (JPEG/PNG/WEBP) | Yes — for approval |
| Hotel operating permit | PDF or image | Yes — for approval |
| Tourism authority certificate | PDF or image | Yes — for approval |

**Main Success Scenario — Step 6:**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps "Upload" next to each document type. |
| 2 | System | Opens device file picker (camera roll, file system, or camera). |
| 3 | Provider | Selects document file. |
| 4 | System | Validates file type (PDF, JPEG, PNG, WEBP) and size (max 10 MB per document). |
| 5 | System | Uploads file to S3. Returns a secure internal document URL stored against the listing. |
| 6 | System | Shows a thumbnail or filename with a green checkmark confirming upload. |
| 7 | Provider | Repeats for each of the three required documents. |
| 8 | Provider | Taps "Save & Review" to proceed to the submission review screen (UC-2.7). |

**Alternative Flows — Step 6:**

**A1 — Unsupported file type**
- System rejects and displays: "Only PDF, JPEG, PNG, and WEBP files are accepted."

**A2 — File exceeds 10 MB**
- System rejects and displays: "This file is too large. Maximum size is 10 MB."

**A3 — Provider attempts to submit without uploading all three documents**
- "Submit for Review" button is disabled. A checklist shows which documents are missing with red indicators.

**A4 — Provider replaces an already-uploaded document**
- Tapping "Replace" on an uploaded document opens the file picker again. Old S3 object is deleted after new upload succeeds.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | PATCH (each step save) | Step-specific fields (name, room_type, unit_count, price, currency, address, lat, lng, etc.) |
| `listing_documents` | INSERT | `listing_id`, `document_type`, `s3_url`, `uploaded_at` |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/listings/{id}` | Auto-save listing draft data for any step |
| POST | `/listings/{id}/documents` | Upload an accreditation document |
| DELETE | `/listings/{id}/documents/{doc_id}` | Remove a document before submission |

---

### UC-2.3 — Set Address with Google Places Autocomplete and Live Map Pin

**ID:** UC-2.3  
**Name:** Set Hotel Address via Geocoding and Draggable Map Pin  
**Primary Actor:** Provider  
**Secondary Actors:** System, Google Maps Platform  
**Priority:** Critical  
**Platform:** Mobile App (Google Maps SDK), Web PWA (Google Maps JS API)

#### Preconditions
- Provider is on Step 2 of the hotel listing form.
- Google Places Autocomplete and Geocoding API are configured and reachable.
- The listing draft record exists.

#### Postconditions (Success)
- `listings.address` — full formatted address string stored.
- `listings.lat` and `listings.lng` — geocoded coordinates stored.
- `listings.town` — auto-filled from geocoding `locality` component.
- `listings.country` — auto-filled from geocoding `country` component (ISO 3166-1 alpha-2).
- An embedded map displays a pin at the geocoded location.
- All coordinate data is saved to the draft via `PATCH /listings/{id}`.

---

#### Main Success Scenario — Autocomplete Path

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps the "Address" field on Step 2. |
| 2 | System | Activates Google Places Autocomplete. A dropdown suggestion list appears as the provider types. |
| 3 | Provider | Types the beginning of their address (e.g. "Upper Hill, Nairo"). |
| 4 | System | Google Places API returns autocomplete suggestions in a dropdown list below the field. |
| 5 | Provider | Selects the correct address from the suggestions list. |
| 6 | System | Calls Google Geocoding API with the selected `place_id`. Receives: `formatted_address`, `lat`, `lng`, `locality` (town), `administrative_area`, `country` (ISO code). |
| 7 | System | Populates fields: Address = `formatted_address`, Town/City = `locality`, Country = `country` (read-only display). |
| 8 | System | Drops a pin on the embedded Google Map at `lat`, `lng`. Map auto-centers and zooms to the pin. |
| 9 | Provider | Reviews the auto-filled address and map pin position. |
| 10 | Provider | Confirms details are accurate. Taps "Next". System saves `lat`, `lng`, `address`, `town`, `country` to draft. |

---

#### Alternative Flow A1 — Provider Drags the Map Pin Manually

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | After autocomplete places the pin (step 8 above), provider notices the pin is slightly off (e.g. it landed on the road, not the building entrance). |
| 2 | Provider | Presses and holds the map pin, then drags it to the correct position. |
| 3 | System | As the provider drags, the pin moves in real time. |
| 4 | System | On pin release: performs reverse geocoding call with the new `lat`/`lng`. Updates `lat` and `lng` only. The text address fields (`address`, `town`, `country`) are NOT changed — they retain the autocomplete values (BR-2.8). |
| 5 | System | Displays a subtle notice: "Map pin position updated. The displayed address was not changed." |
| 6 | Provider | Satisfied with pin position. Proceeds. |

---

#### Alternative Flow A2 — Provider Manually Types a Full Address (No Autocomplete Selection)

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Types a full address but does not select a suggestion from the autocomplete dropdown (e.g. presses Enter or dismisses the keyboard). |
| 2 | System | Autocomplete selection not made. Geocoding cannot run without a `place_id` or a confirmed address. |
| 3 | System | Displays inline warning on the map: "Please select an address from the suggestions to confirm your location." Map pin is not placed. |
| 4 | Provider | Must either select from autocomplete or use manual pin placement (A3). |

---

#### Alternative Flow A3 — Provider Places Pin Without Autocomplete (Remote / Unmapped Location)

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Taps "Place pin manually" option (available for locations not found in Google Places, e.g. rural areas). |
| 2 | System | Opens full-screen map view with crosshair. Provider navigates the map and taps to place the pin. |
| 3 | System | Performs reverse geocoding with the tapped coordinates. Populates `town` and `country` if results are available. Populates `lat` and `lng`. |
| 4 | Provider | Manually types or confirms the address text field. |
| 5 | System | Saves all fields. Shows warning badge: "This address was entered manually. Please ensure the location is accurate." |

---

#### Alternative Flow A4 — Town/City Auto-Fill is Incorrect

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Reviews auto-filled Town/City field after geocoding (step 7). Notices it is incorrect or too generic (e.g. populated with district rather than city name). |
| 2 | Provider | Taps the Town/City field and edits it manually. |
| 3 | System | Accepts the manual override. Town is now the provider-entered value. `lat`/`lng` and Country remain from geocoding. |

---

#### Exception Flows

**E1 — Google Places API unreachable**
- At step 4: API call fails.
- Autocomplete dropdown does not appear.
- System displays: "Address suggestions are currently unavailable. Please try again shortly or enter your address manually." Manual address text entry is still permitted; provider must place pin manually (A3).

**E2 — Geocoding returns no results**
- At step 6: Geocoding API returns zero results for the selected place.
- Map pin is not placed. System displays: "We couldn't find this location. Please try a different address or place your pin manually."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | PATCH | `address`, `lat`, `lng`, `town`, `country` |

#### API Endpoints

| Method | Endpoint | Notes |
|---|---|---|
| GET | Google Places Autocomplete API | Called client-side with provider API key; restricted to Places type |
| GET | Google Geocoding API | Called server-side via backend proxy to protect API key |
| PATCH | `/listings/{id}` | Saves geocoded address data to draft |

---

### UC-2.4 — Select Services and Amenities

**ID:** UC-2.4  
**Name:** Select Services and Amenities for Hotel Listing  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is on Step 4 of the hotel listing form.
- The amenity grid is loaded from a static configuration (not fetched dynamically per request).

#### Postconditions (Success)
- Selected standard amenities stored against the listing (many-to-many join or JSON array).
- Any custom amenities stored as free-text strings.
- Data saved to draft.

---

#### Amenity Grid — Full Reference

| Category | Amenities |
|---|---|
| Connectivity | WiFi, Smart TV, Work desk, Printer |
| Food & drink | Breakfast included, Restaurant on-site, Coffee machine, Minibar, Kitchen / kitchenette |
| Wellness | Swimming pool, Fitness centre, Spa, Sauna, Hot tub |
| Comfort | Air conditioning, Heating, Laundry, Parking, Elevator, Accessible |
| Services | 24h reception, Daily housekeeping, Airport shuttle, 24h security, Shop on-site, Pet-friendly |

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 4 — Services & Amenities. |
| 2 | System | Displays the amenity grid organised by category with checkboxes. No amenity is pre-selected. |
| 3 | Provider | Scrolls through the grid. Taps/clicks each applicable amenity checkbox (e.g. WiFi, Air conditioning, Swimming pool, 24h reception). |
| 4 | System | Selected amenities are highlighted (checked state). A running count shows: "X amenities selected". |
| 5 | Provider | Scrolls to the bottom of the grid. Sees a "Add a custom service" free-text field. |
| 6 | Provider | Optionally types a custom amenity (e.g. "Rooftop bar"). Taps "Add". |
| 7 | System | Validates custom amenity text: not empty, max 60 characters, not a duplicate of an existing custom entry. |
| 8 | System | Adds the custom amenity as a chip below the grid. A delete (×) icon appears on the chip. |
| 9 | Provider | Repeats steps 6–8 for additional custom amenities (if any). |
| 10 | Provider | Taps "Next". System saves selected amenities and custom entries. |

---

#### Alternative Flows

**A1 — Provider selects no amenities**
- No amenities are required. Provider can proceed with zero selections. Step 4 has no mandatory amenities.
- System saves an empty amenity list. Guest-facing listing shows "No amenities listed."

**A2 — Custom amenity exceeds 60 characters**
- The "Add" button remains disabled. Character counter shows remaining chars. Inline note: "Custom amenity name cannot exceed 60 characters."

**A3 — Duplicate custom amenity**
- Provider types a custom amenity identical to one already added.
- System shows inline: "This amenity has already been added."

**A4 — Provider removes a custom amenity chip**
- Taps the × on a chip. Chip is removed from the list. No confirmation required.

**A5 — Provider deselects a previously selected amenity**
- Taps a checked amenity. Checkbox returns to unchecked state. Running count decrements.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listing_amenities` | INSERT / DELETE | `listing_id`, `amenity_key` (standard) or `custom_text` (custom) |

*(Alternatively stored as `amenities TEXT[]` and `custom_amenities TEXT[]` columns on the `listings` table — implementation choice.)*

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/listings/{id}` | Save amenity selections and custom entries |

---

### UC-2.5 — Upload and Manage Listing Photos

**ID:** UC-2.5  
**Name:** Upload and Manage Hotel Listing Photos  
**Primary Actor:** Provider  
**Secondary Actors:** System, AWS S3  
**Priority:** Critical  
**Platform:** Mobile App (camera + gallery), Web PWA (file picker)

#### Preconditions
- Provider is on Step 5 of the hotel listing form.
- Provider has at least 1 photo ready to upload (≥ 3 photos required before submission — implied by best practice; minimum enforced at submission time).

#### Postconditions (Success)
- At least 1 photo uploaded and saved.
- Photos stored in S3. Public CDN URLs stored against the listing.
- First photo in the ordered list is designated as the cover image.
- Cover image is previewed prominently on the form.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Arrives at Step 5 — Photos. Sees an upload area with instructions: "Add up to 30 photos. First photo will be your cover image. JPEG, PNG, or WEBP. Max 5 MB each." |
| 2 | Provider | Taps "Add photos" or drags and drops files (web only). |
| 3 | System | Opens device file picker (mobile: gallery/camera selection sheet; web: OS file browser, multi-select enabled). |
| 4 | Provider | Selects one or more photos. |
| 5 | System | For each selected file: validates type (JPEG/PNG/WEBP), validates size (≤ 5 MB), checks total count will not exceed 30. |
| 6 | System | Displays upload progress indicators for each photo. |
| 7 | System | Uploads each valid photo to S3 asynchronously. On success: stores CDN URL, generates a thumbnail, and renders the photo in the listing photo grid. |
| 8 | System | The first uploaded photo is automatically marked as the cover image and shown with a "Cover" badge. |
| 9 | Provider | Sees the photo grid with all uploaded photos. |

---

#### Alternative Flows

**A1 — Provider sets a different cover photo**

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Sees the photo grid. The first photo has a "Cover" badge. |
| 2 | Provider | Taps and holds (mobile) or right-clicks (web) a different photo. Menu appears: "Set as cover". |
| 3 | Provider | Selects "Set as cover". |
| 4 | System | Updates the photo order: selected photo moves to position 1. Previous cover photo moves to position 2. "Cover" badge transfers. |
| 5 | System | Saves the updated photo order via `PATCH /listings/{id}/photos/reorder`. |

**A2 — Provider reorders photos (drag and drop)**
- On web: provider drags photos within the grid to reorder them. On release, system saves the new order.
- On mobile: long-press activates drag mode. Provider drags to new position.
- The photo in position 1 always becomes the cover.

**A3 — Provider deletes a photo**
- Provider taps the × icon on a photo thumbnail.
- Confirmation: "Remove this photo?" with Confirm / Cancel.
- On confirm: photo removed from grid and soft-deleted from S3 (S3 deletion occurs after listing is approved or after a cleanup job).
- If deleted photo was the cover, the next photo in the list automatically becomes the cover.

**A4 — Total count would exceed 30**
- At step 5: system rejects files that would push the count above 30.
- UI shows: "You can upload a maximum of 30 photos. Remove some photos before adding more." Files that fit within the limit are still uploaded; excess files are rejected individually.

**A5 — File type not supported**
- At step 5: invalid file type detected.
- Per-file error: "Photo '[filename]' is not a supported format. Please use JPEG, PNG, or WEBP." That file is skipped; other valid files in the batch proceed.

**A6 — File size exceeds 5 MB**
- At step 5: file size check fails.
- Per-file error: "Photo '[filename]' exceeds the 5 MB size limit and was not uploaded."

**A7 — Network interruption during upload**
- At step 7: S3 upload fails mid-transfer.
- The affected photo shows a red error state with a "Retry" button.
- Other photos in the batch that completed successfully are unaffected.
- Provider taps "Retry" to re-attempt the failed upload.

**A8 — Provider uploads from camera (mobile)**
- At step 3: provider selects "Take photo" from the sheet.
- Camera opens. Provider takes the photo.
- Photo flows directly into the upload pipeline at step 5.

---

#### Exception Flows

**E1 — S3 service unavailable**
- All uploads fail. System shows: "Photo uploads are currently unavailable. Please try again shortly." Progress is preserved for photos already uploaded in previous sessions.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listing_photos` | INSERT | `listing_id`, `s3_url`, `cdn_url`, `position`, `is_cover`, `uploaded_at` |
| `listing_photos` | UPDATE | `position`, `is_cover` (on reorder or cover change) |
| `listing_photos` | DELETE (soft) | `deleted_at` (on photo removal) |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/listings/{id}/photos` | Upload one or more photos |
| PATCH | `/listings/{id}/photos/reorder` | Update photo display order |
| DELETE | `/listings/{id}/photos/{photo_id}` | Remove a photo from the listing |

---

### UC-2.6 — Edit an Existing Hotel Listing (Draft or Approved)

**ID:** UC-2.6  
**Name:** Edit Hotel Listing  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in.
- The target listing exists and belongs to the provider (`provider_id = current_user`).
- Listing status is `draft`, `approved`, or `rejected` (cannot edit a `pending_review` listing).

#### Postconditions (Success)
- Listing data is updated.
- If the listing was `approved`: it remains `approved` after edits to non-critical fields (name, description, photos, amenities, pricing). If accreditation documents are replaced, the listing may require re-review (see Alternative Flows).
- If the listing was `rejected`: edits reset status to `draft`, enabling resubmission.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Navigates to "My Listings". Sees a list of their hotel listings with status badges. |
| 2 | Provider | Taps "Edit" on the target listing. |
| 3 | System | Checks listing status. Status is `approved`. Loads the listing into the edit form, pre-populated with all existing values. Displays a notice: "This listing is live. Changes will be applied immediately." |
| 4 | Provider | Navigates to the relevant step using the step tabs. Makes desired changes (e.g. updates price, adds a photo, adjusts amenities). |
| 5 | Provider | Taps "Save changes". |
| 6 | System | Validates all edited fields. |
| 7 | System | Applies changes via `PATCH /listings/{id}`. Returns HTTP 200. |
| 8 | System | Changes reflected on the live guest-facing listing within 5 minutes (cache TTL). |
| 9 | Provider | Sees confirmation toast: "Your listing has been updated." |

---

#### Alternative Flows

**A1 — Listing status is `pending_review`**
- At step 3: system detects `status = pending_review`.
- Edit is blocked. System displays: "Your listing is currently under admin review and cannot be edited. You will be notified once the review is complete."
- Provider can view (read-only) but not modify.

**A2 — Listing status is `rejected`**
- At step 3: system displays: "This listing was rejected. Review the feedback below and make the required changes, then resubmit for review."
- Rejection reason and admin notes are shown prominently at the top of the form.
- Provider makes edits. On save, listing status automatically resets to `draft`.
- "Submit for Review" button appears (leads to UC-2.7).

**A3 — Listing status is `draft`**
- Edit opens the form as normal. No notice shown (it's already a draft).

**A4 — Provider replaces an accreditation document on an approved listing**
- At step 4: provider navigates to the documents step and replaces a document.
- System displays warning: "Replacing an accreditation document will trigger a re-review of your listing. Your listing will remain live during the review, but may be taken down if the new document is rejected."
- Provider confirms. Document is updated. A re-review task is created in the admin queue. Listing status remains `approved` pending review outcome.

---

#### Exception Flows

**E1 — Another user has concurrently edited the same listing**
- System uses optimistic locking (ETag or `updated_at` timestamp check).
- On save: if `updated_at` in DB > `updated_at` sent in request, system returns HTTP 409: "This listing was updated elsewhere. Please reload and apply your changes again."

---

#### Data Entities

| Entity | Operation | Notes |
|---|---|---|
| `listings` | PATCH | Any non-immutable field |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/listings/{id}` | Load listing data for editing |
| PATCH | `/listings/{id}` | Save partial or full listing updates |

---

### UC-2.7 — Submit Hotel Listing for Admin Review

**ID:** UC-2.7  
**Name:** Submit Hotel Listing for Admin Review  
**Primary Actor:** Provider  
**Secondary Actors:** System, SendGrid  
**Priority:** Critical  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Listing exists with `status = draft` or `status = rejected` (resubmission).
- All required fields are populated and valid:
  - Name, room type, units, price, currency, address (geocoded), cancellation policy.
  - At least 1 photo uploaded (minimum enforced here; admin will review quality).
  - All 3 accreditation documents uploaded.

#### Postconditions (Success)
- `listings.status` → `pending_review`.
- A review task is created in the admin hotel accreditation queue.
- Provider receives a confirmation notification.
- Listing does NOT appear in guest search (BR-2.2).

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Completes all steps of the listing form. Arrives at the "Review & Submit" summary screen. |
| 2 | System | Displays a summary of all entered information: name, room type, units, address with map preview, pricing, cancellation policy, amenity count, photo count (cover shown), document upload status (✓ or ✗ per document). |
| 3 | System | Performs pre-submission validation. Checks: all required fields populated, all 3 accreditation documents uploaded, at least 1 photo uploaded. |
| 4 | System | All checks pass. "Submit for Review" button is enabled. |
| 5 | Provider | Reviews the summary. Taps "Submit for Review". |
| 6 | System | Displays confirmation modal: "Once submitted, you won't be able to edit this listing until the review is complete. Submit now?" |
| 7 | Provider | Taps "Confirm". |
| 8 | System | Atomic transaction: updates `listings.status = pending_review`, `listings.submitted_at = now`. Creates a record in `listing_review_tasks` for the admin queue. Increments submission count. |
| 9 | System | Sends confirmation email to provider via SendGrid: Subject: "Your listing '[Name]' is under review." Body: submission details, expected review timeframe, what happens next. |
| 10 | System | Returns HTTP 200. UI shows: "Your listing has been submitted for review. We'll notify you of the outcome." |
| 11 | Provider | "My Listings" now shows the listing with status badge: "Under Review". Edit button is disabled. |

---

#### Alternative Flows

**A1 — Required fields missing at submission time**
- At step 3: pre-submission validation finds missing required fields.
- "Submit for Review" button is disabled.
- Each failing requirement shown in a checklist with red indicators:
  - ✗ Address not geocoded
  - ✗ Business licence not uploaded
  - ✗ Hotel operating permit not uploaded
  - ✗ Tourism authority certificate not uploaded
  - ✗ No photos uploaded
- Links beside each failure navigate directly to the relevant step.

**A2 — Resubmission of a previously rejected listing**
- Flow is identical. At step 8: a new review task is created (independent of the previous rejection). Admin sees it as a fresh submission in the queue, with the rejection history visible in the review panel.
- `listings.submission_count` increments. Logged to `audit_log`.

**A3 — Provider navigates away from "Review & Submit" without submitting**
- No status change. Listing remains in `draft`. Draft is saved. Provider can return later.

---

#### Exception Flows

**E1 — Database error during status transition**
- Transaction rolls back. `status` remains `draft`. No review task created.
- UI shows: "Submission failed due to a technical error. Please try again."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = pending_review`, `submitted_at`, `submission_count++` |
| `listing_review_tasks` | INSERT | `listing_id`, `submission_number`, `assigned_to = NULL`, `created_at`, `sla_deadline = now + 48h` |
| `email_log` | INSERT | `type = listing_submitted`, provider email |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/listings/{id}/submit` | Submit listing for admin review |

---

### UC-2.8 — Admin: View Hotel Review Queue

**ID:** UC-2.8  
**Name:** Admin Views the Hotel Accreditation Queue  
**Primary Actor:** Admin (Super Admin, Admin, Country Manager within scope)  
**Secondary Actors:** System  
**Priority:** Critical  
**Platform:** Web Admin Panel only

#### Preconditions
- Admin is signed in to the admin panel with 2FA complete.
- At least one listing exists with `status = pending_review`.

#### Postconditions
- Admin has a clear view of all pending hotel listings awaiting review, sorted by submission date (oldest first).

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Navigates to "Hotel Accreditation" section in the admin panel sidebar. |
| 2 | System | Displays the review queue table. Each row represents one pending listing. |
| 3 | System | Columns shown: Listing name · Provider business name · Submission date · Submission number (1st, 2nd, etc.) · Claimed star rating · Country · SLA deadline (48h from submission) · Assigned reviewer (if any). |
| 4 | System | Country Manager sees only listings in their assigned country scope (API-level filter). Admin and Super Admin see all countries. |
| 5 | Admin | Can filter queue by: Country, Submission date range, Claimed star rating, SLA status (within SLA / approaching / breached). |
| 6 | Admin | Can sort by: Submission date (default: oldest first), SLA deadline, Country. |
| 7 | Admin | Taps "Review" on a listing row to open the full review panel (UC-2.9). |

---

#### Alternative Flows

**A1 — Queue is empty**
- System shows: "No hotel listings are currently pending review." No action available.

**A2 — SLA deadline approaching or breached**
- Rows with SLA ≤ 4 hours remaining are highlighted amber.
- Rows with SLA breached (deadline passed) are highlighted red and trigger auto-escalation (Support → Country Manager → Admin → Super Admin).

**A3 — Admin self-assigns a listing**
- Admin taps "Assign to me" on a queue row.
- `listing_review_tasks.assigned_to = admin_id`. Row shows admin's name as reviewer.
- Prevents two admins reviewing the same listing simultaneously.

---

#### Data Entities

| Entity | Operation | Notes |
|---|---|---|
| `listing_review_tasks` | SELECT | Filtered by `status = open` and country scope |
| `listings` | SELECT (JOIN) | Name, claimed star rating, country |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/listings/review-queue` | Fetch pending review listings (scoped by role) |
| PATCH | `/admin/listings/review-tasks/{task_id}/assign` | Self-assign a review task |

---

### UC-2.9 — Admin: Review and Approve Hotel Listing

**ID:** UC-2.9  
**Name:** Admin Reviews Hotel Listing and Approves  
**Primary Actor:** Admin (Super Admin, Admin, Country Manager within scope)  
**Secondary Actors:** System, SendGrid  
**Priority:** Critical  
**Platform:** Web Admin Panel only

#### Preconditions
- Admin is signed in to the admin panel.
- A listing with `status = pending_review` exists.
- Admin has opened the review panel for this listing (from UC-2.8).

#### Postconditions (Success)
- `listings.status` → `approved`.
- `listings.star_rating` → admin-assigned value (immutable from provider side thereafter).
- `listing_review_tasks.status` → `resolved`.
- Provider notified by email.
- Listing appears in guest search results within 5 minutes (BR-2.17).
- Action logged to `audit_log`.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Opens the hotel review panel. |
| 2 | System | Displays a two-panel layout: Left panel — listing summary (name, location, room type, units, price, photos, amenities, claimed star rating). Right panel — document viewer. |
| 3 | System | Document viewer loads the three accreditation documents. Each is viewable in-browser (PDF viewer for PDFs; image viewer for JPEG/PNG/WEBP). Tabs: "Business Licence" / "Operating Permit" / "Tourism Authority Certificate". |
| 4 | Admin | Reviews each document tab. Checks: document appears valid, not expired, matches the listing name/address, and supports the claimed star rating. |
| 5 | Admin | Reviews listing photos (thumbnail strip). Reviews listing name, address, room type, pricing. |
| 6 | Admin | Selects the **verified star rating** using the admin-only star rating control (1★–5★). |
| 7 | System | If admin-assigned rating differs from provider's claimed rating, system shows a yellow notice: "Provider claimed [X]★. You are assigning [Y]★. A note will be included in the approval notification." |
| 8 | Admin | Optionally adds an internal note (max 500 chars — stored in `listing_review_tasks.admin_note`, not visible to provider). |
| 9 | Admin | Clicks "Approve & Publish". |
| 10 | System | Displays confirmation: "Approve this listing and make it live on ZikaBooking?" with the assigned star rating shown. Admin clicks "Confirm". |
| 11 | System | Atomic transaction: sets `listings.status = approved`, `listings.star_rating = assigned_rating`, `listings.approved_at = now`, `listings.approved_by = admin_id`. Marks `listing_review_tasks.status = resolved`. |
| 12 | System | Writes to `audit_log`: `action = listing_approved`, `target_id = listing_id`, `admin_id`, `old_value = pending_review`, `new_value = approved`, `star_rating`, `ip_address`, `timestamp`. |
| 13 | System | Sends provider notification email via SendGrid: Subject: "Your listing '[Name]' has been approved!" Body: listing name, verified star rating, note if rating differs from claimed, link to view listing on platform. |
| 14 | System | Listing becomes searchable within 5 minutes as search cache revalidates. |
| 15 | Admin | Sees success confirmation in the review panel. Listing removed from the pending queue. |

---

#### Alternative Flows

**A1 — Admin assigns a different star rating than claimed (no rejection needed)**
- Covered in step 7 above. The listing is still approved with the corrected rating. Provider receives the corrected rating in the approval email.

**A2 — Admin wants to request additional information before deciding**
- Admin clicks "Request more information" instead of Approve/Reject.
- Enters a message to the provider (max 500 chars). Sends.
- System sends the message via the in-app messaging tool (E17) and by email.
- Listing remains in `pending_review`. Review task status → `awaiting_provider_response` with a 72-hour provider response window.
- Task appears with a "Waiting for response" badge in the queue.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = approved`, `star_rating`, `approved_at`, `approved_by` |
| `listing_review_tasks` | UPDATE | `status = resolved`, `resolved_at`, `admin_note` |
| `audit_log` | INSERT | Full approval entry |
| `email_log` | INSERT | Approval notification to provider |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/listings/{id}/review` | Load full listing data + documents for review |
| POST | `/admin/listings/{id}/approve` | Approve listing with star rating |
| GET | `/admin/listings/{id}/documents/{doc_id}` | Stream accreditation document for in-browser viewing |

---

### UC-2.10 — Admin: Reject Hotel Listing

**ID:** UC-2.10  
**Name:** Admin Reviews Hotel Listing and Rejects  
**Primary Actor:** Admin (Super Admin, Admin, Country Manager within scope)  
**Secondary Actors:** System, SendGrid  
**Priority:** Critical  
**Platform:** Web Admin Panel only

#### Preconditions
- Admin has opened the review panel for a `pending_review` listing (from UC-2.8).

#### Postconditions
- `listings.status` → `rejected`.
- `listing_review_tasks.status` → `resolved` (with outcome = rejected).
- Provider notified with rejection reason and resubmission instructions.
- Listing does NOT appear in guest search.
- `audit_log` entry created.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Reviews the listing (same steps 1–5 as UC-2.9). Determines the listing cannot be approved as submitted. |
| 2 | Admin | Clicks "Reject". |
| 3 | System | Displays the rejection form. Admin must select at least one rejection reason from the predefined list. |
| 4 | Admin | Selects rejection reason(s): |
| | | • Insufficient documentation |
| | | • Operating permit expired |
| | | • Star rating unverifiable from submitted documents |
| | | • Document image quality too poor to verify |
| | | • Business name on documents does not match listing name |
| | | • Other (requires free-text explanation) |
| 5 | Admin | Optionally adds a free-text note to the provider (max 500 chars). This is shared with the provider in the rejection email. |
| 6 | Admin | Optionally adds an internal note (not shared with provider, max 500 chars). |
| 7 | Admin | Clicks "Confirm Rejection". |
| 8 | System | Atomic transaction: sets `listings.status = rejected`, `listings.rejected_at = now`, `listings.rejected_by = admin_id`, `listings.rejection_reasons = [selected_reasons]`, `listings.rejection_note = provider_note`. |
| 9 | System | Marks `listing_review_tasks.status = resolved` (outcome = rejected). |
| 10 | System | Writes to `audit_log`. |
| 11 | System | Sends rejection email to provider via SendGrid: Subject: "Action required — your listing '[Name]' was not approved." Body: rejection reason(s), provider note, resubmission instructions, link to edit listing. |
| 12 | Admin | Rejection confirmed. Listing removed from the pending queue. |

---

#### Alternative Flows

**A1 — Admin selects "Other" without providing free-text**
- The "Confirm Rejection" button is disabled until the free-text field (shown when "Other" is selected) has content.
- Inline: "Please describe the reason for rejection."

**A2 — Admin rejects a resubmission (2nd or subsequent attempt)**
- Same flow. `listing_review_tasks` gets a new record for this resubmission. Admin can see the history of previous submissions and their rejection reasons in the review panel.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = rejected`, `rejected_at`, `rejected_by`, `rejection_reasons`, `rejection_note` |
| `listing_review_tasks` | UPDATE | `status = resolved`, outcome = rejected |
| `audit_log` | INSERT | Rejection entry |
| `email_log` | INSERT | Rejection notification |

#### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/listings/{id}/reject` | Reject listing with reasons and notes |

---

### UC-2.11 — Provider: Resubmit Rejected Hotel Listing

**ID:** UC-2.11  
**Name:** Resubmit Rejected Hotel Listing for Review  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** High  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider's listing has `status = rejected`.
- Provider has received the rejection email and understands the required changes.

#### Postconditions
- Provider has made the required corrections.
- Listing resubmitted: `status = pending_review`.
- A new, independent review task created in the admin queue.
- `submission_count` incremented.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | Opens "My Listings". Sees listing with "Rejected" status badge and a "View Feedback & Resubmit" button. |
| 2 | Provider | Taps "View Feedback & Resubmit". |
| 3 | System | Opens the listing edit form. At the top: a highlighted feedback panel showing rejection reasons and any provider note from the admin. |
| 4 | Provider | Reviews the rejection feedback. Navigates to the relevant steps to make corrections (e.g. replaces expired operating permit in Step 6, updates listing name in Step 1). |
| 5 | Provider | Saves changes. Listing status reverts to `draft` automatically once an edit is made. |
| 6 | Provider | Navigates to the "Review & Submit" screen. |
| 7 | System | Pre-submission validation runs again. All checks must pass. |
| 8 | Provider | Taps "Resubmit for Review". |
| 9 | System | Identical to UC-2.7 steps 6–11. A new `listing_review_tasks` record is created. `submission_count` increments. |
| 10 | Provider | Sees: "Your listing has been resubmitted. The admin team will review your updated submission." |

---

#### Alternative Flows

**A1 — Provider resubmits without making any changes**
- System does not block this (cannot detect intent). A new review task is still created.
- Admin sees the same listing again. If rejection reasons are unaddressed, admin will reject again.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = pending_review`, `submission_count++`, `submitted_at = now` |
| `listing_review_tasks` | INSERT | New task for the resubmission |

---

### UC-2.12 — Admin: Update Star Rating on an Approved Listing

**ID:** UC-2.12  
**Name:** Admin Updates Star Rating on an Already-Approved Hotel  
**Primary Actor:** Admin (Super Admin, Admin, Country Manager within scope)  
**Secondary Actors:** System, SendGrid  
**Priority:** Medium  
**Platform:** Web Admin Panel

#### Preconditions
- Listing has `status = approved` with an existing admin-assigned star rating.
- Admin has navigated to the listing in the admin panel.

#### Postconditions
- `listings.star_rating` updated to new admin-assigned value.
- Change logged to `audit_log`.
- Provider notified of the rating change.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Searches for the listing in admin panel (by name, reference, or provider). Opens listing detail. |
| 2 | System | Displays listing with current admin-assigned star rating. An "Edit star rating" button visible to eligible roles. |
| 3 | Admin | Clicks "Edit star rating". |
| 4 | System | Opens inline edit: star selector (1★–5★) pre-populated with current rating, and a required reason field (max 200 chars). |
| 5 | Admin | Selects new rating. Enters reason (e.g. "Re-classification following updated tourism authority certificate"). |
| 6 | Admin | Clicks "Update rating". |
| 7 | System | Confirmation: "Change star rating for '[Name]' from [X]★ to [Y]★?" |
| 8 | Admin | Confirms. |
| 9 | System | Updates `listings.star_rating`. Writes to `audit_log`. Sends provider email: "Your listing's star rating has been updated from [X]★ to [Y]★." with the admin's reason. |

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `star_rating` |
| `audit_log` | INSERT | `action = star_rating_updated` |

---

### UC-2.13 — Provider: Deactivate or Delete a Hotel Listing

**ID:** UC-2.13  
**Name:** Provider Deactivates or Deletes a Hotel Listing  
**Primary Actor:** Provider  
**Secondary Actors:** System  
**Priority:** Medium  
**Platform:** Mobile App, Web PWA

#### Preconditions
- Provider is signed in.
- The listing belongs to this provider.

#### Postconditions — Deactivate
- `listings.status` → `deactivated`.
- Listing removed from guest search results immediately.
- Existing confirmed bookings are NOT cancelled automatically (provider must handle manually).

#### Postconditions — Delete (Draft only)
- Listing record soft-deleted.
- Draft listings (never submitted) can be fully deleted.
- Approved/pending listings can be deactivated but not hard-deleted (booking history must be preserved).

---

#### Main Success Scenario — Deactivate

| Step | Actor | Action |
|---|---|---|
| 1 | Provider | On "My Listings", taps the kebab menu (⋮) on a listing. Selects "Deactivate listing". |
| 2 | System | Displays modal: "Deactivating this listing will remove it from search immediately. Any future bookings will not be possible, but existing confirmed bookings will remain active. Deactivate?" |
| 3 | Provider | Confirms. |
| 4 | System | Sets `listings.status = deactivated`. Listing removed from Elasticsearch index within 5 minutes. |
| 5 | Provider | Listing shows "Deactivated" badge. A "Reactivate" button appears. |

---

#### Alternative Flows

**A1 — Provider reactivates a deactivated listing**
- Provider taps "Reactivate" on a deactivated listing.
- If listing was previously `approved`: status returns directly to `approved`. No new admin review needed.
- If listing was previously `rejected`: status returns to `draft`.

**A2 — Delete a draft listing**
- Provider selects "Delete" on a `draft` listing.
- Confirmation: "Delete this draft? This cannot be undone."
- On confirm: listing soft-deleted (`deleted_at = now`). Removed from provider's listing view.

**A3 — Provider tries to delete an approved or pending listing**
- System prevents hard delete: "This listing cannot be deleted as it has been submitted for review or has booking history. You can deactivate it instead."

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = deactivated` or `deleted_at = now` |

---

### UC-2.14 — Admin: Suspend a Live Hotel Listing

**ID:** UC-2.14  
**Name:** Admin Suspends an Approved Hotel Listing  
**Primary Actor:** Admin (Super Admin, Admin, Country Manager within scope)  
**Secondary Actors:** System, SendGrid  
**Priority:** High  
**Platform:** Web Admin Panel

#### Preconditions
- Listing has `status = approved`.
- Admin has legitimate grounds for suspension (policy violation, complaint, safety concern).

#### Postconditions
- `listings.status` → `suspended`.
- Listing immediately removed from guest search.
- Active reservation locks for this listing cancelled. Affected guests notified.
- Provider notified.
- `audit_log` entry created.

---

#### Main Success Scenario

| Step | Actor | Action |
|---|---|---|
| 1 | Admin | Navigates to listing in admin panel. Clicks "Suspend listing". |
| 2 | System | Displays suspension form: reason (free text, required, max 500 chars), option to notify provider (toggle, default ON). |
| 3 | Admin | Enters reason. Confirms. |
| 4 | System | Sets `listings.status = suspended`. Cancels all active `reservation_locks` for this listing (status → cancelled). Notifies guests with active locks: "Unfortunately, this property is no longer available. Your reservation hold has been released and no charge has been made." |
| 5 | System | Sends suspension notification to provider if toggle was ON. |
| 6 | System | Writes to `audit_log`. |

---

#### Alternative Flows

**A1 — Admin unsuspends a listing**
- Admin clicks "Reinstate listing" on a suspended hotel.
- Requires confirmation and an internal note.
- Sets `listings.status = approved`. Listing returns to search within 5 minutes.
- Provider notified. `audit_log` entry created.

---

#### Data Entities

| Entity | Operation | Fields Set |
|---|---|---|
| `listings` | UPDATE | `status = suspended` |
| `reservation_locks` | UPDATE | `status = cancelled` (for all active locks on this listing) |
| `audit_log` | INSERT | Suspension entry |

---

## 3. Listing Status State Machine

```
                  ┌─────────────┐
     Create       │             │
  ────────────>   │    DRAFT    │
                  │             │
                  └──────┬──────┘
                         │ Submit (UC-2.7)
                         ▼
                  ┌─────────────┐
                  │  PENDING_   │  <──── Resubmit (UC-2.11)
                  │   REVIEW    │
                  └──────┬──────┘
                   Admin │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
       ┌─────────────┐       ┌─────────────┐
       │  APPROVED   │       │  REJECTED   │ ──> Provider edits
       │  (live)     │       │             │     → back to DRAFT
       └──────┬──────┘       └─────────────┘
              │
     ┌────────┼────────┐
     │        │        │
     ▼        ▼        ▼
DEACTIVATED SUSPENDED PERMANENTLY
(provider) (admin)    BANNED
                     (admin)
```

---

## 4. Data Model — Epic 2 Entities

```sql
listings
  id                      UUID PRIMARY KEY
  provider_id             UUID NOT NULL REFERENCES users(id)
  category                ENUM('hotel','apartment','car') NOT NULL
  name                    VARCHAR(200) NOT NULL
  room_type               ENUM('standard','superior','deluxe','suite','junior_suite',
                               'studio','family_room','presidential_suite') NULL
  unit_count              INTEGER CHECK (unit_count >= 1)
  description             TEXT CHECK (char_length(description) <= 1000)
  price_per_night         DECIMAL(10,2) CHECK (price_per_night > 0)
  currency                CHAR(3) NOT NULL  -- ISO 4217
  min_stay_nights         INTEGER DEFAULT 1 CHECK (min_stay_nights >= 1)
  checkin_time            TIME NULL
  checkout_time           TIME NULL
  cancellation_policy     ENUM('flexible','moderate','strict') NULL
  smoking_allowed         BOOLEAN NOT NULL DEFAULT FALSE
  pets_allowed            BOOLEAN NOT NULL DEFAULT FALSE
  address                 TEXT NULL
  lat                     DECIMAL(9,6) NULL
  lng                     DECIMAL(9,6) NULL
  town                    VARCHAR(100) NULL
  country                 CHAR(2) NULL  -- ISO 3166-1 alpha-2
  claimed_star_rating     SMALLINT CHECK (claimed_star_rating BETWEEN 1 AND 5) NULL
  star_rating             SMALLINT CHECK (star_rating BETWEEN 1 AND 5) NULL  -- admin-assigned only
  status                  ENUM('draft','pending_review','approved','rejected',
                               'deactivated','suspended','permanently_banned') NOT NULL DEFAULT 'draft'
  submission_count        INTEGER NOT NULL DEFAULT 0
  submitted_at            TIMESTAMPTZ NULL
  approved_at             TIMESTAMPTZ NULL
  approved_by             UUID NULL REFERENCES admin_users(id)
  rejected_at             TIMESTAMPTZ NULL
  rejected_by             UUID NULL REFERENCES admin_users(id)
  rejection_reasons       TEXT[] NULL
  rejection_note          TEXT NULL     -- shared with provider
  consecutive_negative_count INTEGER NOT NULL DEFAULT 0
  auto_suspension_count   INTEGER NOT NULL DEFAULT 0
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  deleted_at              TIMESTAMPTZ NULL  -- soft delete

listing_review_tasks
  id                      UUID PRIMARY KEY
  listing_id              UUID NOT NULL REFERENCES listings(id)
  submission_number       INTEGER NOT NULL  -- 1st, 2nd, 3rd submission
  assigned_to             UUID NULL REFERENCES admin_users(id)
  status                  ENUM('open','awaiting_provider_response','resolved','escalated') DEFAULT 'open'
  outcome                 ENUM('approved','rejected') NULL
  admin_note              TEXT NULL    -- internal only
  sla_deadline            TIMESTAMPTZ NOT NULL  -- created_at + 48h
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  resolved_at             TIMESTAMPTZ NULL

listing_photos
  id                      UUID PRIMARY KEY
  listing_id              UUID NOT NULL REFERENCES listings(id)
  s3_key                  VARCHAR(500) NOT NULL
  cdn_url                 VARCHAR(500) NOT NULL
  position                SMALLINT NOT NULL  -- 1 = cover
  is_cover                BOOLEAN GENERATED ALWAYS AS (position = 1) STORED
  uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  deleted_at              TIMESTAMPTZ NULL

listing_documents
  id                      UUID PRIMARY KEY
  listing_id              UUID NOT NULL REFERENCES listings(id)
  document_type           ENUM('business_licence','operating_permit','tourism_certificate') NOT NULL
  s3_key                  VARCHAR(500) NOT NULL
  file_type               VARCHAR(10) NOT NULL  -- pdf, jpeg, png, webp
  uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  replaced_at             TIMESTAMPTZ NULL  -- set when a new version is uploaded

listing_amenities
  listing_id              UUID NOT NULL REFERENCES listings(id)
  amenity_key             VARCHAR(100) NOT NULL  -- predefined key e.g. 'wifi', 'pool'
  PRIMARY KEY (listing_id, amenity_key)

listing_custom_amenities
  id                      UUID PRIMARY KEY
  listing_id              UUID NOT NULL REFERENCES listings(id)
  label                   VARCHAR(60) NOT NULL
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

---

## 5. API Endpoint Summary — Epic 2

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/listings` | Provider | Create new draft listing |
| GET | `/listings/{id}` | Provider / Admin | Get listing detail |
| PATCH | `/listings/{id}` | Provider | Update draft or approved listing fields |
| POST | `/listings/{id}/submit` | Provider | Submit for admin review |
| GET | `/listings/{id}/photos` | Provider | List photos for a listing |
| POST | `/listings/{id}/photos` | Provider | Upload photos |
| PATCH | `/listings/{id}/photos/reorder` | Provider | Update photo order / cover |
| DELETE | `/listings/{id}/photos/{photo_id}` | Provider | Remove a photo |
| POST | `/listings/{id}/documents` | Provider | Upload accreditation document |
| DELETE | `/listings/{id}/documents/{doc_id}` | Provider | Remove a document |
| POST | `/listings/{id}/deactivate` | Provider | Deactivate an approved listing |
| POST | `/listings/{id}/reactivate` | Provider | Reactivate a deactivated listing |
| DELETE | `/listings/{id}` | Provider | Soft-delete a draft listing |
| GET | `/admin/listings/review-queue` | Admin | Get pending review queue |
| GET | `/admin/listings/{id}/review` | Admin | Open full listing review panel |
| GET | `/admin/listings/{id}/documents/{doc_id}` | Admin | Stream document for in-browser viewing |
| PATCH | `/admin/listings/review-tasks/{task_id}/assign` | Admin | Self-assign a review task |
| POST | `/admin/listings/{id}/approve` | Admin | Approve listing with star rating |
| POST | `/admin/listings/{id}/reject` | Admin | Reject listing with reasons |
| PATCH | `/admin/listings/{id}/star-rating` | Admin | Update star rating on approved listing |
| POST | `/admin/listings/{id}/suspend` | Admin | Suspend a live listing |
| POST | `/admin/listings/{id}/reinstate` | Admin | Reinstate a suspended listing |

---

## 6. Acceptance Criteria

### AC-2.1 — Listing Creation
- [ ] Provider can create a hotel draft without completing all fields.
- [ ] Draft is auto-saved at each step. Returning to the app recovers the draft.
- [ ] Room type dropdown contains exactly the 8 specified types.
- [ ] Number of units rejects values less than 1 and decimals.

### AC-2.2 — Geocoding & Map
- [ ] Typing in the address field triggers Google Places Autocomplete suggestions within 300ms.
- [ ] Selecting a suggestion populates town and country fields automatically.
- [ ] Dragging the map pin updates `lat`/`lng` but does not change the address text fields.
- [ ] If Google Places API is unavailable, a fallback manual entry option is presented.
- [ ] `lat`/`lng` are stored with 6 decimal places of precision.

### AC-2.3 — Photos
- [ ] Up to 30 photos can be uploaded; the 31st is rejected with an appropriate error.
- [ ] Files over 5 MB are rejected per file with an inline error.
- [ ] Non-JPEG/PNG/WEBP files are rejected with an inline error.
- [ ] The first photo in the list is marked as the cover image.
- [ ] Reordering photos (drag) updates the cover to whichever photo is in position 1.

### AC-2.4 — Documents
- [ ] The "Submit for Review" button is disabled unless all 3 accreditation documents are uploaded.
- [ ] Uploaded documents are viewable in-browser in the admin review panel.
- [ ] Replacing a document on an approved listing triggers a re-review task.

### AC-2.5 — Admin Review
- [ ] Admin review queue is scoped by country for Country Managers.
- [ ] Listing approved by admin appears in guest search within 5 minutes.
- [ ] Star rating can only be set by admin — provider's claimed rating field has no effect on the live listing.
- [ ] Every approval, rejection, and star rating change is written to `audit_log` with admin ID, timestamp, and IP address.
- [ ] Rejection email includes the selected rejection reason(s) and provider note.

### AC-2.6 — Resubmission
- [ ] A rejected listing can be edited and resubmitted.
- [ ] Each resubmission creates a new review task — previous rejection history visible to admin.
- [ ] `submission_count` increments on each submission.

### AC-2.7 — Status
- [ ] Only listings with `status = approved` appear in guest search results.
- [ ] A deactivated listing can be reactivated without requiring a new admin review (if previously approved).
- [ ] Suspending a listing cancels all active reservation locks for that listing within 5 seconds.

---

*End of E2 — Listing Management: Hotels*  
*Next: E3 — Listing Management: Apartments*
