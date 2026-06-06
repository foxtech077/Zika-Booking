export const AMENITY_OPTIONS = [
  { value: "wifi",      label: "High-Speed Wi-Fi" },
  { value: "pool",      label: "Swimming Pool" },
  { value: "gym",       label: "Fitness Center" },
  { value: "parking",   label: "Free Parking" },
  { value: "ac",        label: "Air Conditioning" },
  { value: "kitchen",   label: "Fully Equipped Kitchen" },
  { value: "workspace", label: "Dedicated Workspace" },
  { value: "breakfast", label: "Complimentary Breakfast" },
] as const;

const CATEGORY_MAP: Record<string, string> = {
  wifi:      "Connectivity",
  pool:      "Wellness",
  gym:       "Wellness",
  parking:   "Comfort",
  ac:        "Comfort",
  kitchen:   "Food & Drink",
  workspace: "Connectivity",
  breakfast: "Food & Drink",
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
