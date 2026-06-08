import { initStripe } from "@stripe/stripe-react-native";

const MERCHANT_IDENTIFIER = "merchant.com.zikabooking.app";

export function getEnvStripePublishableKey(): string {
  return (process.env["EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ?? "").trim();
}

function isValidPublishableKey(key: string): boolean {
  return key.startsWith("pk_");
}

/** Prefer API key when valid; ignore secret/invalid keys from the server. */
export function resolveStripePublishableKey(apiKey?: string | null): string {
  const fromApi = apiKey?.trim() ?? "";
  if (fromApi && isValidPublishableKey(fromApi)) return fromApi;
  return getEnvStripePublishableKey();
}

export function validateStripePublishableKey(key: string): string | null {
  if (!key) {
    return "Stripe is not configured. Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env file and restart the app.";
  }
  if (key.startsWith("sk_")) {
    return "Invalid Stripe key: a secret key (sk_) was provided instead of a publishable key (pk_). Check your environment configuration.";
  }
  if (!key.startsWith("pk_")) {
    return "Invalid Stripe publishable key. It must start with pk_test_ or pk_live_.";
  }
  return null;
}

export async function initializeStripe(publishableKey?: string | null): Promise<string | null> {
  const key = resolveStripePublishableKey(publishableKey);
  const validationError = validateStripePublishableKey(key);
  if (validationError) return validationError;

  await initStripe({
    publishableKey: key,
    merchantIdentifier: MERCHANT_IDENTIFIER,
  });
  return null;
}
