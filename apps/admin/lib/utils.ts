import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";

// ── Tailwind class merger ─────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency formatting ───────────────────────────────────────────────────────
export function formatCurrency(
  amount: number | string,
  currency = "USD",
  opts: Intl.NumberFormatOptions = {}
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...opts,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

// ── Number formatting ─────────────────────────────────────────────────────────
export function formatNumber(n: number, compact = false): string {
  if (compact && n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (compact && n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US").format(n);
}

// ── Date formatting ───────────────────────────────────────────────────────────
export function formatDate(
  date: string | Date | null | undefined,
  fmt = "MMM d, yyyy"
): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, fmt);
  } catch {
    return "—";
  }
}

export function formatDateTime(
  date: string | Date | null | undefined
): string {
  return formatDate(date, "MMM d, yyyy 'at' h:mm a");
}

export function formatRelativeTime(
  date: string | Date | null | undefined
): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "—";
  }
}

// ── String helpers ────────────────────────────────────────────────────────────
export function capitalize(s?: string | null): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function slugToLabel(s?: string | null): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncate(s?: string | null, max: number = 30): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function getInitials(name?: string | null): string {
  if (!name) return "A";
  const cleaned = name.trim();
  if (!cleaned) return "A";
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase() || "A";
}

// ── URL / query helpers ───────────────────────────────────────────────────────
export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── Status helpers ────────────────────────────────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  // Listing statuses
  draft:              "bg-slate-100 text-slate-600",
  pending_review:     "bg-amber-100 text-amber-700",
  approved:           "bg-success-light text-success-dark",
  rejected:           "bg-danger-light text-danger-dark",
  active:             "bg-success-light text-success-dark",
  deactivated:        "bg-slate-100 text-slate-600",
  suspended:          "bg-orange-100 text-orange-700",
  auto_suspended:     "bg-orange-100 text-orange-700",
  permanently_banned: "bg-danger-light text-danger-dark",
  // Booking statuses
  pending_payment:    "bg-amber-100 text-amber-700",
  confirmed:          "bg-info-light text-info-dark",
  completed:          "bg-success-light text-success-dark",
  cancelled_by_guest: "bg-slate-100 text-slate-600",
  cancelled_by_provider: "bg-orange-100 text-orange-700",
  cancelled_by_system: "bg-danger-light text-danger-dark",
  // User statuses
  pending_verification: "bg-amber-100 text-amber-700",
  banned:             "bg-danger-light text-danger-dark",
  // Voucher
  active_voucher:     "bg-success-light text-success-dark",
  inactive_voucher:   "bg-slate-100 text-slate-600",
  // Admin roles
  super_admin:        "bg-purple-100 text-purple-700",
  admin:              "bg-blue-100 text-blue-700",
  country_manager:    "bg-teal-100 text-teal-700",
  sales:              "bg-green-100 text-green-700",
  support:            "bg-orange-100 text-orange-700",
  finance:            "bg-indigo-100 text-indigo-700",
  // Promotion statuses
  scheduled:          "bg-blue-100 text-blue-700",
  paused:             "bg-amber-100 text-amber-700",
  expired:            "bg-danger-light text-danger-dark",
  superseded:         "bg-purple-100 text-purple-700",
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600";
}

// ── Percent change ────────────────────────────────────────────────────────────
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
