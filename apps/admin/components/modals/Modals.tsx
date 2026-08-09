"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

// ── Confirm Modal ─────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
  children?: ReactNode;
}

export function ConfirmModal({
  open, onClose, onConfirm, title, description,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  variant = "danger", loading, children,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const ICON = variant === "danger" ? AlertTriangle : variant === "warning" ? AlertTriangle : CheckCircle;
  const iconColor = variant === "danger" ? "text-danger bg-danger/10" : variant === "warning" ? "text-warning bg-warning/10" : "text-info bg-info/10";

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4",
          "pointer-events-none"
        )}
      >
        <div className="pointer-events-auto w-full max-w-md flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-card-lg animate-slide-in-up overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
            <div className="flex gap-4">
              <div className={cn("flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full", iconColor)}>
                <ICON className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
                {children && <div className="mt-4">{children}</div>}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-surface-subtle">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Action Modal ──────────────────────────────────────────────────────────────

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function ActionModal({
  open, onClose, title, description, children, footer, size = "md"
}: ActionModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const MAX_W = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
        <div className={cn("pointer-events-auto w-full flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-card-lg animate-slide-in-up overflow-hidden", MAX_W[size])}>
          <div className="flex-shrink-0 flex items-start justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 border-b border-border">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-slate-900 leading-snug">{title}</h3>
              {description && <p className="mt-0.5 text-xs sm:text-sm text-slate-500 leading-normal">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 scrollbar-thin">{children}</div>
          {footer && (
            <div className="flex-shrink-0 flex flex-wrap items-center justify-end gap-2 sm:gap-3 px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-surface-subtle">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
