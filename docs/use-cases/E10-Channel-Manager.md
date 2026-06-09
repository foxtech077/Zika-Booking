# E10: Channel Manager & Calendar Synchronization

## 1. Description
The Channel Manager prevents double-bookings across ZikaBooking, Airbnb, Booking.com, and other platforms using the iCal protocol (RFC 5545) as the universal synchronization standard (Phase 1). It allows hosts to manage their availability across multiple channels from a single dashboard.

## 2. Actors
* **Host:** Configures channel URLs, views sync status, and manages manual calendar overrides.
* **System (Background Worker):** Polls OTA feeds, parses iCal files, updates local availability, and manages exponential backoff for failed syncs.

## 3. Pre-conditions
* Host must have an active listing on ZikaBooking.
* Host must have corresponding listings on external OTAs (e.g., Airbnb, Booking.com) that support iCal import/export.

## 4. Main Flow (Host Setup)
1. **Export from ZikaBooking:** Host copies the secure ZikaBooking export URL (`zikabooking.com/cal/{listing-id}/{secure-token}.ics`).
2. **Import to OTA:** Host pastes the ZikaBooking URL into the "Import calendar" field on Airbnb/Booking.com.
3. **Export from OTA:** Host copies the export URLs from Airbnb and Booking.com.
4. **Import to ZikaBooking:** Host pastes the OTA export URLs into ZikaBooking's channel manager settings.
5. **Validation:** The system immediately fetches the feed to verify HTTP 200 OK and basic RFC 5545 compliance.
6. **Save:** Configuration is saved, and the background worker begins the polling cycle.

## 5. Technical Requirements & Workflows

### 5.1 Protocol Compliance (RFC 5545)
* Parse and emit `VEVENT`, `DTSTART`, `DTEND`, `SUMMARY`, `UID`, and `STATUS`.
* **Timestamp Handling:** Normalize all timestamps to UTC internally. The parser must respect and correctly convert local `TZID` parameters found in imported feeds.

### 5.2 Synchronization Logic
* **Idempotency:** The `UID` field acts as the idempotency key. Re-importing the same feed must never create duplicate blocks.
* **Updates:** If a `UID` exists but `DTSTART` or `DTEND` has changed, the system updates the existing block.
* **Check-in/Check-out Boundary:** A block with `DTSTART: 20260610` and `DTEND: 20260615` implies checkout is on the 15th. The system must leave the 15th available for new check-ins, rather than blocking the entire day.
* **Recurring Events:** If an `RRULE` (recurring rule) is encountered (rare for OTAs, but possible for manual Google Calendars), the system must expand and flatten it into individual event blocks up to the 2-year limit.
* **Export Composition:** ZikaBooking export feeds must include *all* blocked dates (Direct Bookings, Manual Overrides, and blocks imported from *other* channels).

### 5.3 Cancellations & Deletions
* **Explicit:** Parse `STATUS:CANCELLED` to unblock dates.
* **Implicit (Ghosting):** If a previously synced future event from a specific channel is absent from a new fetch, the system must assume it was cancelled on the OTA and remove the block in ZikaBooking.

### 5.4 Polling & Error Handling
* **Polling Frequency:** 15 minutes per connected channel feed.
* **Exponential Backoff:** On failure: 1 min → 5 min → 15 min.
* **Alerting:** Alert host after 3 consecutive sync failures.

## 6. Edge Cases & Conflict Resolution
* **Double Bookings:** If an imported block overlaps with an existing ZikaBooking direct reservation, the system must prioritize the direct booking and trigger an immediate "Double Booking Conflict" alert (Email/Push/Dashboard) to the host for manual resolution.
* **Concurrency (Race Conditions):** If two channel syncs (e.g. Airbnb and Booking.com) trigger simultaneously and attempt to claim the exact same dates, a database-level lock or unique constraint per `listing_id` + `date` must resolve the race condition.
* **Multi-Unit Limitations:** iCal does not support inventory "quantity". Therefore, for Multi-Unit properties (like Hotels), each specific room (e.g., Room 101, Room 102) must have its own unique iCal import/export URL rather than one URL for the whole hotel.
* **Missing Timezones:** Default to UTC or the property's local timezone if `TZID` is malformed.
* **Date Bounding:** Only parse events from `[Current Date - 30 days]` to `[Current Date + 2 years]` to optimize processing.

## 7. Security Considerations
* **Secure Export URLs:** Export URLs must use a cryptographically secure, unguessable token (`.../{listing-id}/{secure-token}.ics`).
* **Token Regeneration:** Hosts must have the ability to regenerate the token (invalidating the old URL) if compromised.
* **Data Privacy (GDPR/PII):** OTA iCals sometimes include guest names or phone numbers in the `SUMMARY` or `DESCRIPTION` fields. The parser must sanitize or securely encrypt these fields rather than storing them in plain text logs to prevent PII leakage.
* **Payload Limits:** Enforce maximum file size (e.g., 2MB) and fetch timeout (e.g., 10-15 seconds) for imports to prevent DoS attacks.

## 8. User Interface (Host Dashboard)
* **Status View:** Display connected OTAs, status (synced/error/pending), last sync timestamp, and blocked dates count.
* **Source Attribution:** Visually distinguish calendar blocks by source (color-coded for Airbnb, Booking.com, Manual, Direct).
* **Manual Overrides:** Hosts can block/unblock date ranges for personal use/maintenance.
* **Read-Only Channel Blocks:** Hosts cannot manually unblock dates imported from OTAs within ZikaBooking.
* **Manual Sync:** A "Sync Now" button to bypass the 15-minute poller.

## 9. Future-Proofing (Phase 2)
* **Logging:** 90-day retention of all sync events.
* **Database Schema:** Store `channel_name`, `external_uid`, and a nullable `channel_booking_id`.
* **Direct API:** Architecture must support Airbnb Connect API + Booking.com Connectivity API (push-based webhooks). The schema and core logic must allow the poller to swap to a webhook receiver seamlessly.

## 10. Car Rental Applicability
* The same system applies per vehicle, provided the target car rental platforms (e.g., Turo) fully support iCal synchronization. Platforms requiring direct API connections will be deferred to Phase 2.
