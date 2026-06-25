// ── Alert / Toast Types ───────────────────────────────────────────────────────

export type AlertType = "success" | "error" | "warning" | "info";

export interface AlertPayload {
  type: AlertType;
  title: string;
  message?: string;
  /** Duration in ms before auto-dismiss. Defaults to 4500. */
  duration?: number;
}

export interface AlertItem extends AlertPayload {
  id: string;
}
