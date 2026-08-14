/**
 * Centralized API Domain Configuration for Zika-Booking Mobile App.
 *
 * To point the app to a different backend host environment (e.g. dev vs production),
 * update DEFAULT_DOMAIN below, or provide EXPO_PUBLIC_* environment variables.
 */
export const DEFAULT_DOMAIN = "https://dev.api.kainook.com";

/** Base URL for Auth Service */
export const getAuthBaseUrl = (): string => {
  const envUrl = process.env["EXPO_PUBLIC_API_URL"] || process.env["EXPO_PUBLIC_AUTH_API_URL"];
  const base = envUrl ?? `${DEFAULT_DOMAIN}/auth`;
  return base.endsWith("/") ? base : `${base}/`;
};

/** Base URL for Listing Service */
export const getListingBaseUrl = (): string => {
  const envUrl = process.env["EXPO_PUBLIC_LISTING_API_URL"];
  const base = envUrl ?? `${DEFAULT_DOMAIN}/listings`;
  return base.endsWith("/") ? base : `${base}/`;
};

/** Base URL for Payment Service */
export const getPaymentBaseUrl = (): string => {
  const envUrl = process.env["EXPO_PUBLIC_PAYMENT_API_URL"];
  const base = envUrl ?? `${DEFAULT_DOMAIN}/payments`;
  return base.endsWith("/") ? base : `${base}/`;
};
