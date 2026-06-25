"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertItem, AlertType } from "@/types/alert";

// ── Per-type visual config ────────────────────────────────────────────────────

const CONFIG: Record<
  AlertType,
  { icon: React.ComponentType<{ className?: string }>; bg: string; border: string; iconCls: string; titleCls: string; barCls: string }
> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-white dark:bg-slate-800",
    border: "border-emerald-200 dark:border-emerald-700",
    iconCls: "text-emerald-500",
    titleCls: "text-slate-900 dark:text-slate-100",
    barCls: "bg-emerald-500",
  },
  error: {
    icon: XCircle,
    bg: "bg-white dark:bg-slate-800",
    border: "border-red-200 dark:border-red-700",
    iconCls: "text-red-500",
    titleCls: "text-slate-900 dark:text-slate-100",
    barCls: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-white dark:bg-slate-800",
    border: "border-amber-200 dark:border-amber-700",
    iconCls: "text-amber-500",
    titleCls: "text-slate-900 dark:text-slate-100",
    barCls: "bg-amber-500",
  },
  info: {
    icon: Info,
    bg: "bg-white dark:bg-slate-800",
    border: "border-blue-200 dark:border-blue-700",
    iconCls: "text-blue-500",
    titleCls: "text-slate-900 dark:text-slate-100",
    barCls: "bg-blue-500",
  },
};

// ── AlertToast ────────────────────────────────────────────────────────────────

interface AlertToastProps {
  alert: AlertItem;
  onClose: (id: string) => void;
}

export function AlertToast({ alert, onClose }: AlertToastProps) {
  const cfg = CONFIG[alert.type];
  const Icon = cfg.icon;
  const duration = alert.duration ?? 4500;

  // Auto-dismiss
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onClose(alert.id), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alert.id, duration, onClose]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        "relative flex w-full max-w-sm items-start gap-3 rounded-xl border shadow-lg p-4 overflow-hidden",
        "animate-slide-in-right",
        cfg.bg,
        cfg.border
      )}
    >
      {/* Progress bar */}
      <span
        className={cn("absolute bottom-0 left-0 h-0.5 w-full origin-left", cfg.barCls)}
        style={{
          animation: `shrink-width ${duration}ms linear forwards`,
        }}
      />

      {/* Icon */}
      <div className={cn("flex-shrink-0 mt-0.5", cfg.iconCls)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold leading-snug", cfg.titleCls)}>{alert.title}</p>
        {alert.message && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {alert.message}
          </p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={() => onClose(alert.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        tabIndex={0}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
