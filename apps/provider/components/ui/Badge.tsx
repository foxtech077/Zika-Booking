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
  if (["active", "approved", "confirmed", "completed", "success"].includes(s))   return "success";
  if (["pending", "pending_review", "pending_payment", "awaiting"].some(k => s.includes(k))) return "warning";
  if (["suspended", "rejected", "banned", "cancelled", "danger", "failed"].some(k => s.includes(k))) return "danger";
  if (["draft", "deactivated", "info"].includes(s)) return "info";
  if (["auto_suspended"].includes(s)) return "orange";
  return "default";
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-success-light text-success-dark",
  warning: "bg-warning-light text-warning-dark",
  danger:  "bg-danger-light text-danger-dark",
  info:    "bg-info-light text-info-dark",
  purple:  "bg-violet-100 text-violet-700",
  orange:  "bg-orange-100 text-orange-700",
};

export function Badge({ label, status, variant, dot, className }: BadgeProps) {
  const resolved = variant ?? (status ? getVariantFromStatus(status) : "default");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
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
