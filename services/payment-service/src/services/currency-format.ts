// Currency display helpers shared by generated documents (email + PDF).
//
// Symbols are always rendered together with the ISO 4217 code so currencies
// that share a symbol (e.g. FCFA XAF vs XOF) cannot be confused.

import { ZERO_DECIMAL_CURRENCIES as ZERO_DEC } from "@zika/types";

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

/**
 * Format a number with thousands separators and the currency's natural
 * precision (2 decimals for most currencies, 0 for zero-decimal ones). A
 * missing currency keeps the historical whole-number behaviour.
 */
export function fmtMoney(n: number, currency?: string): string {
  const zeroDecimal = currency != null && ZERO_DEC.has(currency.toUpperCase());
  const fractionDigits = zeroDecimal ? 0 : 2;
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Render an amount as "ISO amount", e.g. "EUR 45.00" or "XAF 25,000". */
export function money(amount: number, currency: string): string {
  const code = (currency ?? "").toUpperCase() || "USD";
  return `${code} ${fmtMoney(amount, code)}`;
}
