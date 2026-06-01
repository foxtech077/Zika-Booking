import { format, formatDistanceToNow, parseISO } from "date-fns";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    const d = typeof value === "string" ? parseISO(value) : value;
    return format(d, "d MMM yyyy");
  } catch {
    return "—";
  }
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    const d = typeof value === "string" ? parseISO(value) : value;
    return format(d, "d MMM yyyy, HH:mm");
  } catch {
    return "—";
  }
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    const d = typeof value === "string" ? parseISO(value) : value;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "—";
  }
}

export const COUNTRY_CURRENCY_MAP: Record<string, { code: string; symbol: string }> = {
  IN: { code: "INR", symbol: "₹" },
  US: { code: "USD", symbol: "$" },
  GB: { code: "GBP", symbol: "£" },
  AE: { code: "AED", symbol: "د.إ" },
  EU: { code: "EUR", symbol: "€" },
};

export function getCurrencyForCountry(countryCode?: string | null): { code: string; symbol: string } {
  if (!countryCode) return { code: "USD", symbol: "$" };
  const upper = countryCode.toUpperCase();
  return COUNTRY_CURRENCY_MAP[upper] ?? { code: "USD", symbol: "$" };
}

export function formatCurrency(
  amount: number | null | undefined,
  currency = "USD",
): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const symbol = COUNTRY_CURRENCY_MAP[currency.toUpperCase()]?.symbol ?? currency;
    return `${symbol}${Number(amount).toLocaleString()}`;
  }
}

export function slugToLabel(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function truncate(s: string, max = 60): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function formatMonthLabel(yyyyMM: string): string {
  try {
    const [y, m] = yyyyMM.split("-").map(Number);
    return new Date(y!, (m! - 1)).toLocaleString("default", { month: "short", year: "numeric" });
  } catch {
    return yyyyMM;
  }
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
