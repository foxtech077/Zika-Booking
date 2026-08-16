/**
 * Anonymous checkout session.
 *
 * A visitor without an account can still book and pay. The backend mints a
 * stateless token via POST /auth/anonymous-token (type "anonymous", sub anon_*)
 * which is accepted by the booking and payment endpoints but rejected by
 * anything account-scoped.
 *
 * The token is short-lived (30 min by default) and has no refresh path, so the
 * request is always sent with a stable `deviceId`. The backend derives the
 * anonymous subject from it — `anon_<sha256(deviceId)>` — meaning a re-mint
 * after expiry resumes the *same* anonymous identity. That matters because a
 * booking stores its creator's subject as `guestId`, and payment verifies
 * ownership by comparing the two: without a stable id, a token expiring
 * mid-checkout would strand the guest, unable to pay for the booking they
 * just created.
 */

import * as SecureStore from "expo-secure-store";

import { getAuthBaseUrl } from "./config";

const AUTH_BASE_URL = getAuthBaseUrl();

const ANON_TOKEN_KEY = "zika:anon_token";
const ANON_DEVICE_ID_KEY = "zika:anon_device_id";

let cachedToken: string | null = null;
// De-duplicates concurrent mints — several checkout requests can fire at once.
let inFlight: Promise<string | null> | null = null;

export async function getAnonymousToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(ANON_TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

/** Synchronous read for axios interceptors, which cannot await. */
export function getCachedAnonymousToken(): string | null {
  return cachedToken;
}

export async function clearAnonymousToken(): Promise<void> {
  cachedToken = null;
  try {
    await SecureStore.deleteItemAsync(ANON_TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * A stable per-install identifier. Persisted separately from the token so it
 * survives token expiry — that persistence is the whole point.
 */
async function getDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(ANON_DEVICE_ID_KEY);
    if (existing) return existing;
  } catch {
    // Fall through and generate a fresh one.
  }
  const generated = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    await SecureStore.setItemAsync(ANON_DEVICE_ID_KEY, generated);
  } catch {
    // Non-fatal: an unpersisted id still works for this session.
  }
  return generated;
}

/**
 * Returns the existing anonymous token or mints a fresh one. Best-effort: a
 * failure returns null and the caller surfaces its own error.
 */
export async function ensureAnonymousToken(): Promise<string | null> {
  const existing = await getAnonymousToken();
  if (existing) return existing;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${AUTH_BASE_URL}auth/anonymous-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      const token: string | undefined = body?.data?.accessToken ?? body?.accessToken;
      if (!token) return null;
      cachedToken = token;
      try {
        await SecureStore.setItemAsync(ANON_TOKEN_KEY, token);
      } catch {
        // In-memory token still carries this session.
      }
      return token;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Warms the in-memory cache at startup so interceptors can read it. */
export async function hydrateAnonymousToken(): Promise<void> {
  await getAnonymousToken();
}
