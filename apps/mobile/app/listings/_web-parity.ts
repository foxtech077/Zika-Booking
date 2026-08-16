/**
 * Verbatim ports from the provider web app's listing forms
 * (`apps/web/.../listings/[id]/edit/_forms/`). The mobile wizards mirror the
 * web wizards step for step and field for field; every constant and helper
 * here must stay byte-compatible with its web counterpart, because both
 * clients read and write the same listing records.
 */

// ── Amenities — port of web `_forms/shared/amenities.ts` ────────────────────
//
// The keys are the canonical stored values. Mobile previously used its own
// keys (`restaurant`, `gym`, `24h_reception`, …); web filters unknown keys on
// load, so amenities saved from mobile silently disappeared when the listing
// was opened on web. LEGACY_AMENITY_MAP rescues those old values on read.

export const AMENITY_OPTIONS = [
  { value: "wifi",               label: "High-Speed Wi-Fi" },
  { value: "smart_tv",           label: "Smart TV" },
  { value: "work_desk",          label: "Work Desk" },
  { value: "printer",            label: "Printer" },
  { value: "breakfast",          label: "Breakfast Included" },
  { value: "restaurant_on_site", label: "Restaurant On-Site" },
  { value: "coffee_machine",     label: "Coffee Machine" },
  { value: "minibar",            label: "Minibar" },
  { value: "kitchen",            label: "Kitchen / Kitchenette" },
  { value: "pool",               label: "Swimming Pool" },
  { value: "spa",                label: "Spa" },
  { value: "sauna",              label: "Sauna" },
  { value: "hot_tub",            label: "Hot Tub" },
  { value: "fitness_centre",     label: "Fitness Centre" },
  { value: "ac",                 label: "Air Conditioning" },
  { value: "heating",            label: "Heating" },
  { value: "laundry",            label: "Laundry" },
  { value: "parking",            label: "Parking" },
  { value: "elevator",           label: "Elevator" },
  { value: "accessible",         label: "Accessible" },
  { value: "reception_24h",      label: "24h Reception" },
  { value: "housekeeping_daily", label: "Daily Housekeeping" },
  { value: "airport_shuttle",    label: "Airport Shuttle" },
  { value: "security_24h",       label: "24h Security" },
  { value: "shop_on_site",       label: "Shop On-Site" },
  { value: "pet_friendly",       label: "Pet-Friendly" },
] as const;

export const CATEGORY_MAP: Record<string, string> = {
  wifi:               "Connectivity",
  smart_tv:           "Connectivity",
  work_desk:          "Connectivity",
  printer:            "Connectivity",
  breakfast:          "Food & Drink",
  restaurant_on_site: "Food & Drink",
  coffee_machine:     "Food & Drink",
  minibar:            "Food & Drink",
  kitchen:            "Food & Drink",
  pool:               "Wellness",
  gym:                "Wellness",
  spa:                "Wellness",
  sauna:              "Wellness",
  hot_tub:            "Wellness",
  fitness_centre:     "Wellness",
  ac:                 "Comfort",
  heating:            "Comfort",
  laundry:            "Comfort",
  parking:            "Comfort",
  elevator:           "Comfort",
  accessible:         "Comfort",
  reception_24h:      "Services",
  housekeeping_daily: "Services",
  airport_shuttle:    "Services",
  security_24h:       "Services",
  shop_on_site:       "Services",
  pet_friendly:       "Services",
  workspace:          "Connectivity",
};

/** Old mobile-only keys → the canonical web keys (read-time rescue). */
const LEGACY_AMENITY_MAP: Record<string, string> = {
  restaurant:      "restaurant_on_site",
  gym:             "fitness_centre",
  "24h_reception": "reception_24h",
  housekeeping:    "housekeeping_daily",
  security:        "security_24h",
  shop:            "shop_on_site",
};

export function groupAmenities(keys: string[]): Record<string, string[]> {
  const g: Record<string, string[]> = {
    Connectivity: [],
    "Food & Drink": [],
    Wellness: [],
    Comfort: [],
    Services: [],
  };
  for (const key of keys) {
    const cat = CATEGORY_MAP[key] ?? "Services";
    (g[cat] ??= []).push(key);
  }
  return g;
}

export function flattenGroupedAmenities(raw: unknown): string[] {
  const known = new Set<string>(AMENITY_OPTIONS.map((o) => o.value));
  const rescue = (k: string) => LEGACY_AMENITY_MAP[k] ?? k;

  // Web stores grouped objects; very old listings may hold flat arrays of
  // strings or `{ amenityKey }` rows. Accept all three.
  let values: string[] = [];
  if (Array.isArray(raw)) {
    values = raw.map((a: any) =>
      typeof a === "string" ? a : (a?.amenityKey ?? a?.key ?? "")
    );
  } else if (raw && typeof raw === "object") {
    values = (Object.values(raw) as string[][]).flat();
  }
  return values
    .map((k) => rescue(String(k).includes(":") ? String(k).split(":").pop()! : String(k)))
    .filter((k) => known.has(k));
}

// ── Option lists — ports of the web forms' constants ────────────────────────

export const ROOM_TYPES = [
  { value: "standard", label: "Standard Room" },
  { value: "superior", label: "Superior Room" },
  { value: "deluxe", label: "Deluxe Room" },
  { value: "suite", label: "Suite" },
  { value: "junior_suite", label: "Junior Suite" },
  { value: "studio", label: "Studio" },
  { value: "family_room", label: "Family Room" },
  { value: "presidential_suite", label: "Presidential Suite" },
];

export const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible – free cancellation up to 24 h" },
  { value: "moderate", label: "Moderate – free cancellation up to 5 days" },
  { value: "strict", label: "Strict – no refund within 14 days" },
];

// ── Payload helpers — port of web `buildPayload` normalisers ────────────────

export const toNullableNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const toNullableInt = (v: unknown): number | null => {
  const n = toNullableNumber(v);
  return n === null ? null : Math.trunc(n);
};

export const trimOrNull = (v: string): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

export const countryOrNull = (v: string): string | null => {
  const country = v?.trim().toUpperCase();
  return country && country.length === 2 ? country : null;
};

// ── API error extraction — port of the web forms' `apiErr` ─────────────────

export function apiErrorMessage(e: any): string {
  const err = e?.response?.data?.error;
  if (err?.details && typeof err.details === "object") {
    const details = Object.entries(err.details)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    return `${err.message ?? "Validation failed."}\n${details}`;
  }
  return err?.message ?? e?.message ?? "Something went wrong. Please try again.";
}
