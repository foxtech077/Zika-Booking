// Currency display helpers shared by generated documents (email + PDF).
//
// Symbols are always rendered together with the ISO 4217 code so currencies
// that share a symbol (e.g. FCFA XAF vs XOF) cannot be confused.

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  KES: "KSh",
  NGN: "₦",
  XAF: "FCFA",
  XOF: "CFA",
  ZAR: "R",
  INR: "₹",
  GHS: "GH₵",
  UGX: "USh",
  TZS: "TSh",
  RWF: "R₣",
  CDF: "FC",
};

export function currencySymbol(currency: string): string {
  const code = (currency ?? "").toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? code;
}

/** Format a number with thousands separators and 0 fraction digits. */
export function fmtMoney(n: number): string {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Render an amount as "ISO amount", e.g. "EUR 45" or "XAF 25,000". */
export function money(amount: number, currency: string): string {
  const code = (currency ?? "").toUpperCase() || "USD";
  return `${code} ${fmtMoney(amount)}`;
}
