# Hotel Room Types API Changes

## Overview

This document describes the API changes for supporting multiple room types under a single hotel listing. Each room type has its own pricing, availability (unit count), and description.

---

## Architecture

```
Listing (Hotel Property)
├── name, location, starRating, amenities, policies, photos, iCal feeds
├── hasRoomTypes: true
│
└── HotelRoomType[] (Bookable Options)
     ├── Standard Room  →  $80/night, 10 units
     ├── Deluxe Room    →  $120/night, 5 units
     └── Suite          →  $200/night, 2 units
```

- **Listing** = Property-level entity (hotel name, address, star rating, amenities, policies)
- **HotelRoomType** = Bookable room category (name, price, unit count, description)
- **iCal blocks** = Block entire hotel (all room types) for those dates

---

## New Endpoints

### POST /listings/:id/room-types

Create a new room type for a hotel listing.

**Auth:** Provider (must own the listing)

**Request:**
```json
{
  "name": "Deluxe Room",
  "roomType": "deluxe",
  "description": "Spacious room with premium amenities",
  "pricePerNight": 120.00,
  "unitCount": 5,
  "maxGuests": 3,
  "sortOrder": 0
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Display name (e.g., "Standard Room", "Ocean View Deluxe") |
| `roomType` | enum | ✅ | One of: `standard`, `superior`, `deluxe`, `suite`, `junior_suite`, `studio`, `family_room`, `presidential_suite` |
| `description` | string | ❌ | Room type description (max 2000 chars) |
| `pricePerNight` | number | ✅ | Price per night (positive) |
| `unitCount` | integer | ❌ | Number of rooms of this type (default: 1, min: 1) |
| `maxGuests` | integer | ❌ | Maximum guests for this room type |
| `sortOrder` | integer | ❌ | Display order (default: 0) |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "rt-uuid-1",
    "listingId": "listing-uuid",
    "name": "Deluxe Room",
    "roomType": "deluxe",
    "description": "Spacious room with premium amenities",
    "pricePerNight": 120.00,
    "unitCount": 5,
    "maxGuests": 3,
    "sortOrder": 0,
    "isActive": true,
    "hasRoomTypes": true
  }
}
```

**Notes:**
- First room type creation automatically sets `hasRoomTypes = true` on the listing
- Only hotel listings can have room types
- Provider must own the listing

---

### GET /listings/:id/room-types

List all room types for a hotel listing.

**Auth:** Provider (must own the listing)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "rt-uuid-1",
      "name": "Standard Room",
      "roomType": "standard",
      "description": "Comfortable room with city view",
      "pricePerNight": 80.00,
      "unitCount": 10,
      "maxGuests": 2,
      "sortOrder": 0,
      "isActive": true
    },
    {
      "id": "rt-uuid-2",
      "name": "Deluxe Room",
      "roomType": "deluxe",
      "pricePerNight": 120.00,
      "unitCount": 5,
      "maxGuests": 3,
      "sortOrder": 1,
      "isActive": true
    }
  ]
}
```

---

### GET /listings/:id/room-types/:rtId

Get details of a specific room type.

**Auth:** Provider (must own the listing)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "rt-uuid-2",
    "listingId": "listing-uuid",
    "name": "Deluxe Room",
    "roomType": "deluxe",
    "description": "Spacious room with premium amenities",
    "pricePerNight": 120.00,
    "unitCount": 5,
    "maxGuests": 3,
    "sortOrder": 1,
    "isActive": true,
    "createdAt": "2026-07-13T12:00:00Z",
    "updatedAt": "2026-07-13T12:00:00Z"
  }
}
```

---

### PATCH /listings/:id/room-types/:rtId

Update a room type.

**Auth:** Provider (must own the listing)

**Request:**
```json
{
  "name": "Premium Deluxe Room",
  "pricePerNight": 130.00,
  "unitCount": 4
}
```

**All fields optional** (partial update).

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "rt-uuid-2",
    "name": "Premium Deluxe Room",
    "pricePerNight": 130.00,
    "unitCount": 4,
    "updatedAt": "2026-07-13T12:05:00Z"
  }
}
```

---

### DELETE /listings/:id/room-types/:rtId

Deactivate a room type (soft delete).

**Auth:** Provider (must own the listing)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Room type deactivated successfully."
  }
}
```

**Notes:**
- Sets `isActive = false` (does not physically delete)
- Existing bookings for this room type are unaffected
- Prevents new bookings for this room type
- At least one active room type must remain for the listing to be submittable

---

## Modified Endpoints

### PATCH /listings/:id

**Removed fields** (moved to room types):
- `roomType` — now per room type
- `unitCount` — now per room type
- `pricePerNight` — now per room type

**New field:**
- `hasRoomTypes` — automatically managed (set to `true` when first room type is created)

**Remaining hotel-level fields:**
```json
{
  "listingTitle": "Safari Hotel",
  "claimedStarRating": 4,
  "description": "Beautiful hotel in Nairobi",
  "checkinTime": "14:00",
  "checkoutTime": "11:00",
  "cancellationPolicy": "flexible",
  "smokingAllowed": false,
  "petsAllowed": false
}
```

---

### GET /search

**New query parameter:**
- `room_type` — filter hotels that have at least one active room type of this type

**New response fields:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "listing-uuid",
        "title": "Safari Hotel",
        "nightlyRate": 80.00,
        "currency": "USD",
        "hasRoomTypes": true,
        "roomType": null,
        "starRating": 4,
        "roomTypes": [
          {
            "id": "rt-uuid-1",
            "name": "Standard Room",
            "roomType": "standard",
            "pricePerNight": 80.00,
            "unitCount": 10,
            "maxGuests": 2
          },
          {
            "id": "rt-uuid-2",
            "name": "Deluxe Room",
            "roomType": "deluxe",
            "pricePerNight": 120.00,
            "unitCount": 5,
            "maxGuests": 3
          }
        ]
      }
    ]
  }
}
```

**Notes:**
- `nightlyRate` shows the **cheapest** active room type price
- `roomType` is `null` when `hasRoomTypes = true` (use `roomTypes[]` instead)
- Price filtering uses the minimum room type price

---

### GET /listings/:id/availability

**New response format:**
```json
{
  "success": true,
  "data": {
    "roomTypeAvailability": [
      {
        "roomTypeId": "rt-uuid-1",
        "roomType": "standard",
        "name": "Standard Room",
        "unitCount": 10,
        "unavailableRanges": [
          { "start": "2026-07-15", "end": "2026-07-20" }
        ]
      },
      {
        "roomTypeId": "rt-uuid-2",
        "roomType": "deluxe",
        "name": "Deluxe Room",
        "unitCount": 5,
        "unavailableRanges": []
      }
    ]
  }
}
```

**Notes:**
- Returns per-room-type availability
- iCal blocks affect ALL room types (entire hotel unavailable)
- A day is unavailable when `bookingCount + iCalBlockCount >= unitCount`

---

### POST /bookings/initiate

**New required field for hotels:**
```json
{
  "listingId": "listing-uuid",
  "roomTypeId": "rt-uuid-2",
  "checkIn": "2026-07-15",
  "checkOut": "2026-07-20",
  "guests": 2
}
```

**New response field:**
```json
{
  "success": true,
  "data": {
    "lockToken": "uuid-token",
    "expiresAt": "2026-07-13T12:05:00Z",
    "pricingPreview": {
      "units": 5,
      "baseAmount": 600.00,
      "nightlyRate": 120.00,
      "roomType": "deluxe",
      "roomTypeName": "Deluxe Room",
      "serviceFee": 30.00,
      "taxAmount": 96.00,
      "totalAmount": 726.00,
      "currency": "USD"
    }
  }
}
```

**Notes:**
- `roomTypeId` is required for hotel listings with `hasRoomTypes = true`
- Pricing uses the room type's `pricePerNight`
- Redis lock key includes room type: `rlk:{listingId}:{roomTypeId}:{checkIn}:{checkOut}`
- Allows concurrent bookings of different room types at the same hotel

---

### POST /bookings

**New required field for hotels:**
```json
{
  "lockToken": "uuid-token",
  "listingId": "listing-uuid",
  "roomTypeId": "rt-uuid-2",
  "checkIn": "2026-07-15",
  "checkOut": "2026-07-20",
  "guestFirstName": "John",
  "guestLastName": "Doe",
  "guestEmail": "john@example.com",
  "adults": 2
}
```

**New response fields:**
```json
{
  "success": true,
  "data": {
    "bookingId": "booking-uuid",
    "bookingReference": "KAINOOK-001001-KE",
    "roomTypeId": "rt-uuid-2",
    "roomType": "deluxe",
    "roomTypeName": "Deluxe Room",
    "nightlyRate": 120.00,
    "totalAmount": 726.00,
    "currency": "USD",
    "status": "pending_payment"
  }
}
```

---

### GET /booking/quote

**New query parameter:**
- `roomTypeId` — use specific room type's price

**Request:**
```
GET /booking/quote?listingId=listing-uuid&roomTypeId=rt-uuid-2&currency=USD
```

**Response:**
```json
{
  "success": true,
  "data": {
    "basePrice": 120.00,
    "convertedPrice": 120.00,
    "fromCurrency": "USD",
    "toCurrency": "USD",
    "roomType": "deluxe",
    "roomTypeName": "Deluxe Room",
    "country": "KE",
    "paymentProvider": "stripe"
  }
}
```

---

## Backward Compatibility

### Old Fields Kept as Fallback

The following fields remain on the `Listing` model but are **ignored** when `hasRoomTypes = true`:
- `roomType` — for apartments/cars that don't use room types
- `unitCount` — for apartments/cars
- `pricePerNight` — for apartments/cars

### Migration

Existing hotel listings with `roomType`/`pricePerNight`/`unitCount` are automatically migrated:
1. A `HotelRoomType` record is created from the existing fields
2. `hasRoomTypes` is set to `true`
3. Old fields remain for backward compatibility

---

## iCal Integration

External calendar blocks continue to work at the **listing level**:
- iCal feeds are linked to `listingId` (not room type)
- Any iCal block makes ALL room types unavailable for those dates
- This matches external platform behavior (Airbnb, Booking.com block entire property)

---

## Error Codes

| Code | Description |
|------|-------------|
| `NO_ROOM_TYPES` | At least one active room type required for submission |
| `ROOM_TYPE_NOT_FOUND` | Room type not found or doesn't belong to listing |
| `INVALID_ROOM_TYPE` | Invalid room type enum value |
| `LISTING_NOT_HOTEL` | Only hotel listings can have room types |
| `ROOM_TYPE_REQUIRED` | `roomTypeId` required for hotel bookings |
