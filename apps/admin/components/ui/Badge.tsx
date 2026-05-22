import { cn, getStatusColor, slugToLabel } from "@/lib/utils";

interface BadgeProps {
  label: string;
  status?: string;
  variant?: "default" | "outline" | "dot";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  label,
  status,
  variant = "default",
  size = "sm",
  className,
}: BadgeProps) {
  const colorClass = status ? getStatusColor(status) : "bg-slate-100 text-slate-600";
  const displayLabel = slugToLabel(label);

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span
          className={cn(
            "inline-block rounded-full",
            size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
            colorClass.split(" ")[0] // just bg color
          )}
        />
        <span className="text-sm text-slate-600">{displayLabel}</span>
      </span>
    );
  }

  if (variant === "outline") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border font-medium",
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
          "border-current opacity-80",
          colorClass,
          className
        )}
      >
        {displayLabel}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        colorClass,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
