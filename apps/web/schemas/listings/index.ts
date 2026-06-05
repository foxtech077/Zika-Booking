import { z } from "zod";

// ── Basic info (all categories) ───────────────────────────────────────────────

export const basicInfoSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(200),
  description: z.string().max(1000).optional().nullable(),
  address: z.string().optional().nullable(),
  town: z.string().max(100).optional().nullable(),
  country: z
    .string()
    .length(2, "Must be a 2-letter ISO code (e.g. US, DE, GB)")
    .toUpperCase()
    .optional()
    .nullable(),
  claimedStarRating: z.number().int().min(1).max(5).optional().nullable(),
});

// ── Pricing & policies (all categories) ───────────────────────────────────────

export const pricingSchema = z.object({
  pricePerNight: z
    .number({ required_error: "Price is required", invalid_type_error: "Price must be a number" })
    .positive("Price must be greater than 0"),
  currency: z.string().length(3, "Must be a 3-letter currency code"),
  minStayNights: z.number().int().min(1).default(1),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict"], {
    required_error: "Please select a cancellation policy",
  }),
  checkinTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be in HH:MM format")
    .optional()
    .nullable(),
  checkoutTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be in HH:MM format")
    .optional()
    .nullable(),
  smokingAllowed: z.boolean().default(false),
  petsAllowed: z.boolean().default(false),
});

// ── Hotel-specific specs ──────────────────────────────────────────────────────

export const hotelSpecsSchema = z.object({
  roomType: z
    .enum([
      "standard",
      "superior",
      "deluxe",
      "suite",
      "junior_suite",
      "studio",
      "family_room",
      "presidential_suite",
    ])
    .optional(),
  unitCount: z
    .number({ required_error: "Unit count is required" })
    .int()
    .min(1, "At least 1 unit required"),
});

// ── Apartment-specific specs ───────────────────────────────────────────────────

export const apartmentSpecsSchema = z.object({
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().int().min(0).optional().nullable(),
  maxGuests: z
    .number({ required_error: "Max guests is required" })
    .int()
    .min(1, "At least 1 guest required"),
  longStayEnabled: z.boolean().default(false),
  longStayMinNights: z.number().int().min(1).optional().nullable(),
  longStayDiscountType: z.enum(["percentage", "fixed"]).optional().nullable(),
  longStayDiscountValue: z.number().positive().optional().nullable(),
});

// ── Car-specific specs ────────────────────────────────────────────────────────

export const carSpecsSchema = z.object({
  carMake: z.string().min(1, "Vehicle make is required"),
  carModel: z.string().min(1, "Vehicle model is required"),
  carYear: z
    .number({ required_error: "Year is required" })
    .int()
    .min(1990, "Year must be 1990 or later")
    .max(2100),
  carCategory: z.enum(["Economy", "Compact", "SUV", "Minivan", "Pickup", "Luxury", "Electric", "Convertible"], {
    required_error: "Vehicle category is required",
  }),
  driveType: z.enum(["FWD", "RWD", "AWD", "FOUR_WD"], {
    required_error: "Drive type is required",
  }),
  transmission: z.enum(["manual", "automatic", "semi_auto"], {
    required_error: "Transmission type is required",
  }),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "lpg"], {
    required_error: "Fuel type is required",
  }),
  seats: z
    .number({ required_error: "Number of seats is required" })
    .int()
    .min(1),
  doors: z.number().int().min(2).optional().nullable(),
  mileagePolicy: z.enum(["unlimited", "limited"]).optional().nullable(),
  mileageLimitKm: z.number().int().min(1).optional().nullable(),
});

// ── Amenities ─────────────────────────────────────────────────────────────────

export const amenitiesSchema = z.object({
  amenities: z.array(z.string().max(100)),
  customAmenities: z.array(z.string().max(60)),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type BasicInfoValues = z.infer<typeof basicInfoSchema>;
export type PricingValues = z.infer<typeof pricingSchema>;
export type HotelSpecsValues = z.infer<typeof hotelSpecsSchema>;
export type ApartmentSpecsValues = z.infer<typeof apartmentSpecsSchema>;
export type CarSpecsValues = z.infer<typeof carSpecsSchema>;
export type AmenitiesValues = z.infer<typeof amenitiesSchema>;
