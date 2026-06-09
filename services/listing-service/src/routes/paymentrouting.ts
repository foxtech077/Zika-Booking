// services/paymentRouting.service.ts
import { paymentRoutingConfig } from "../config/payment.config";

export type PaymentProvider = "stripe" | "tara";

export function getPaymentProvider(country: string): PaymentProvider {
  const normalized = country.toUpperCase();

  if (paymentRoutingConfig.taraCountries.has(normalized)) {
    return "tara";
  }

  return "stripe";
}