import { cn, slugToLabel } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple" | "orange";

interface BadgeProps {
  label: string;
  status?: string;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

function getVariantFromStatus(status: string): BadgeVariant {
  const s = status.toLowerCase();
  // ── Payout-specific statuses (backend: scheduled, processing, paid, failed, cancelled) ──
  if (["paid"].includes(s)) return "success";
  if (["scheduled", "processing"].includes(s)) return "warning";
  if (["cancelled"].includes(s)) return "danger";
  // ── Generic booking / user statuses ──
  if (["active", "approved", "confirmed", "completed", "success"].includes(s))   return "success";
  if (["pending", "pending_review", "pending_payment", "awaiting"].some(k => s.includes(k))) return "warning";
  if (["suspended", "rejected", "banned", "danger", "failed"].some(k => s.includes(k))) return "danger";
  if (["draft", "deactivated", "info"].includes(s)) return "info";
  if (["auto_suspended"].includes(s)) return "orange";
  return "default";
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  danger:  "bg-red-50 text-red-600 ring-1 ring-red-200",
  info:    "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  purple:  "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  orange:  "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
};

export function Badge({ label, status, variant, dot, className }: BadgeProps) {
  const resolved = variant ?? (status ? getVariantFromStatus(status) : "default");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        VARIANT_CLASSES[resolved],
        className
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full bg-current")} />
      )}
      {slugToLabel(label)}
    </span>
  );
}
