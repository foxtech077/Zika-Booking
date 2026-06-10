export const AMENITY_OPTIONS = [
  { value: "wifi",               label: "High-Speed Wi-Fi" },
  { value: "smart_tv",           label: "Smart TV" },
  { value: "work_desk",          label: "Work Desk" },
  { value: "printer",            label: "Printer" },
  { value: "breakfast",          label: "Breakfast Included" },
  { value: "restaurant_on_site", label: "Restaurant On‑Site" },
  { value: "coffee_machine",     label: "Coffee Machine" },
  { value: "minibar",            label: "Minibar" },
  { value: "kitchen",            label: "Kitchen / Kitchenette" },
  { value: "pool",               label: "Swimming Pool" },
  { value: "gym",                label: "Fitness Centre" },
  { value: "spa",                label: "Spa" },
  { value: "sauna",              label: "Sauna" },
  { value: "hot_tub",            label: "Hot Tub" },
  { value: "fitness_centre",      label: "Fitness Centre" },
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
  { value: "shop_on_site",       label: "Shop On‑Site" },
  { value: "pet_friendly",       label: "Pet‑Friendly" },
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
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const known = new Set<string>(AMENITY_OPTIONS.map((o) => o.value));
  return (Object.values(raw) as string[][]).flat().filter((k) => known.has(k));
}
