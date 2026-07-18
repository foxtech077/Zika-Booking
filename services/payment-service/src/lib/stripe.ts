import Stripe from "stripe";

// Use a dummy key if not configured — real API calls will fail gracefully at runtime
const key = process.env["STRIPE_SECRET_KEY"] ?? "";
export const stripe = new Stripe(key || "sk_test_placeholder_not_configured", {
  apiVersion: "2024-12-18.acacia" as any,
});

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW",
  "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function toStripeAmount(amount: number, currency: string): number {
  const ccy = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(ccy)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}
