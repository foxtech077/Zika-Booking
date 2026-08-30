export type AmenityCategory =
  | "Connectivity"
  | "Food & Drink"
  | "Wellness"
  | "Comfort"
  | "Services";

export interface AmenityItem {
  key: string;
  label: string;
  emoji: string;
}

export const AMENITY_CONFIG: Record<AmenityCategory, AmenityItem[]> = {
  Connectivity: [
    { key: "wifi",       label: "WiFi",       emoji: "📶" },
    { key: "smart_tv",   label: "Smart TV",   emoji: "📺" },
    { key: "work_desk",  label: "Work Desk",  emoji: "💼" },
    { key: "printer",    label: "Printer",    emoji: "🖨️" },
  ],
  "Food & Drink": [
    { key: "breakfast",      label: "Breakfast Included",  emoji: "🍳" },
    { key: "restaurant_on_site", label: "Restaurant On-Site",  emoji: "🍽️" },
    { key: "coffee_machine", label: "Coffee Machine",      emoji: "☕" },
    { key: "minibar",        label: "Minibar",             emoji: "🧊" },
    { key: "kitchen",        label: "Kitchen/Kitchenette", emoji: "🥘" },
  ],
  Wellness: [
    { key: "pool",    label: "Swimming Pool",  emoji: "🏊" },
    { key: "fitness_centre", label: "Fitness Centre", emoji: "🏋️" },
    { key: "spa",     label: "Spa",            emoji: "💆" },
    { key: "sauna",   label: "Sauna",          emoji: "🛁" },
    { key: "hot_tub", label: "Hot Tub",        emoji: "♨️" },
  ],
  Comfort: [
    { key: "ac",         label: "Air Conditioning", emoji: "❄️" },
    { key: "heating",    label: "Heating",          emoji: "🔥" },
    { key: "laundry",    label: "Laundry",          emoji: "👕" },
    { key: "parking",    label: "Parking",          emoji: "🅿️" },
    { key: "elevator",   label: "Elevator",         emoji: "🛗" },
    { key: "accessible", label: "Accessible",       emoji: "♿" },
  ],
  Services: [
    { key: "reception_24h",  label: "24h Reception",      emoji: "🔔" },
    { key: "housekeeping_daily", label: "Daily Housekeeping", emoji: "🧹" },
    { key: "airport_shuttle",label: "Airport Shuttle",    emoji: "✈️" },
    { key: "security_24h",   label: "24h Security",       emoji: "🔐" },
    { key: "shop_on_site",   label: "Shop On-Site",       emoji: "🏪" },
    { key: "pet_friendly",   label: "Pet-friendly",       emoji: "🐾" },
  ],
};

export const AMENITY_CATEGORIES = Object.keys(AMENITY_CONFIG) as AmenityCategory[];

/** Convert amenities grouped object to the format the backend expects */
export function toAmenitiesPayload(
  selected: Partial<Record<AmenityCategory, string[]>>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(selected).filter(([, v]) => (v as string[]).length > 0)
  );
}

/** Build empty amenities state (all categories, empty arrays) */
export function emptyAmenities(): Record<AmenityCategory, string[]> {
  return {
    Connectivity: [],
    "Food & Drink": [],
    Wellness: [],
    Comfort: [],
    Services: [],
  };
}

/** Toggle a single amenity key inside the grouped state */
export function toggleAmenity(
  current: Record<AmenityCategory, string[]>,
  cat: AmenityCategory,
  key: string
): Record<AmenityCategory, string[]> {
  const list = current[cat] ?? [];
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  return { ...current, [cat]: next };
}
