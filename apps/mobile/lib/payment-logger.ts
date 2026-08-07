// In-memory diagnostic log for the current payment session.
// Cleared when the pay screen mounts, captured until success or failure.
// Used to generate a copy-able report for the backend team.

export type LogLevel = "info" | "success" | "error" | "warn";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: string;
}

const _entries: LogEntry[] = [];
const MAX_ENTRIES = 150;

export function clearPaymentLogs(): void {
  _entries.length = 0;
}

export function payLog(
  level: LogLevel,
  tag: string,
  message: string,
  data?: unknown,
): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    tag,
    message,
    data: data !== undefined ? JSON.stringify(data, null, 2) : undefined,
  };
  _entries.push(entry);
  if (_entries.length > MAX_ENTRIES) _entries.shift();
}

export function getPaymentLogs(): LogEntry[] {
  return [..._entries];
}

export function formatLogsForSharing(
  bookingId: string,
  paymentId?: string,
): string {
  const icon = (l: LogLevel) =>
    l === "success" ? "✅" : l === "error" ? "❌" : l === "warn" ? "⚠️" : "ℹ️";

  const lines: string[] = [
    "══════════════════════════════════════",
    "  KAINOOK MOBILE — PAYMENT DIAGNOSTIC",
    "══════════════════════════════════════",
    `Generated : ${new Date().toISOString()}`,
    `Booking ID: ${bookingId}`,
    `Payment ID: ${paymentId ?? "not captured"}`,
    "──────────────────────────────────────",
    "",
    ..._entries.map((e) => {
      const header = `${icon(e.level)} ${e.ts.slice(11, 23)} [${e.tag}] ${e.message}`;
      if (!e.data) return header;
      const indented = e.data
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n");
      return `${header}\n${indented}`;
    }),
    "",
    "══════════════════════════════════════",
    "  END OF LOG",
    "══════════════════════════════════════",
  ];

  return lines.join("\n");
}
