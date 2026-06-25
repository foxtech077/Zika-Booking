"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { AlertItem, AlertPayload } from "@/types/alert";
import { AlertToast } from "@/components/ui/AlertToast";

// ── Context ───────────────────────────────────────────────────────────────────

interface AlertContextValue {
  showAlert: (payload: AlertPayload) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function newId() {
  _idCounter += 1;
  return `alert-${Date.now()}-${_idCounter}`;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const showAlert = useCallback((payload: AlertPayload) => {
    const item: AlertItem = { ...payload, id: newId() };
    setAlerts((prev) => {
      // Cap at 5 concurrent toasts; drop the oldest if needed
      const next = [...prev, item];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Convenience helpers ────────────────────────────────────────────────────
  const showSuccess = useCallback(
    (message: string, title = "Success") =>
      showAlert({ type: "success", title, message }),
    [showAlert]
  );
  const showError = useCallback(
    (message: string, title = "Error") =>
      showAlert({ type: "error", title, message }),
    [showAlert]
  );
  const showWarning = useCallback(
    (message: string, title = "Warning") =>
      showAlert({ type: "warning", title, message }),
    [showAlert]
  );
  const showInfo = useCallback(
    (message: string, title = "Info") =>
      showAlert({ type: "info", title, message }),
    [showAlert]
  );

  return (
    <AlertContext.Provider value={{ showAlert, showSuccess, showError, showWarning, showInfo }}>
      {children}
      {/* Toast container — rendered into a portal so it floats above everything */}
      <AlertContainer alerts={alerts} onClose={removeAlert} />
    </AlertContext.Provider>
  );
}

// ── Container (top-right fixed overlay) ──────────────────────────────────────

function AlertContainer({
  alerts,
  onClose,
}: {
  alerts: AlertItem[];
  onClose: (id: string) => void;
}) {
  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
    >
      {alerts.map((alert) => (
        <div key={alert.id} className="pointer-events-auto">
          <AlertToast alert={alert} onClose={onClose} />
        </div>
      ))}
    </div>,
    document.body
  );
}

// ── Internal hook (exported from useAlert.ts below) ───────────────────────────

export function useAlertContext(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useAlert must be used inside <AlertProvider>");
  }
  return ctx;
}
