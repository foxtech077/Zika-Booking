/**
 * Anonymous checkout session.
 *
 * A visitor without an account can still book and pay. The backend mints a
 * short-lived stateless token via POST /auth/anonymous-token (type "anonymous",
 * sub anon_*). It has no refresh token, so it lives in sessionStorage only and
 * is never sent through the refresh path.
 */

const ANON_TOKEN_KEY = "zika:anon_token";
const ANON_DEVICE_ID_KEY = "zika:anon_device_id";

export function getAnonymousToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ANON_TOKEN_KEY);
}

/**
 * Returns a stable device id so re-minted anonymous tokens keep the same sub.
 * The auth service derives the anonymous sub from this id
 * (anon_<sha256(deviceId)>), so a fresh token after expiry / a cleared
 * sessionStorage still maps to the same booking guestId. Persisted in
 * localStorage so it survives tab closes and browser restarts.
 */
function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(ANON_DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function setAnonymousToken(token: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(ANON_TOKEN_KEY, token);
  }
}

export function clearAnonymousToken() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ANON_TOKEN_KEY);
  }
}

/**
 * The anonymous token is short-lived (JWT exp) with no refresh path, so a
 * stored token can be dead while still present. Re-mint whenever it is
 * missing, expired, or expiring within the skew window. The anon sub is
 * derived from the stable deviceId, so re-minting keeps the same guestId and
 * any in-flight anonymous booking stays linked.
 */
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

const ANON_TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

function isAnonymousTokenExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(base64UrlDecode(payload));
    if (typeof decoded?.exp !== "number") return true;
    return decoded.exp * 1000 - ANON_TOKEN_EXPIRY_SKEW_MS <= Date.now();
  } catch {
    // Any decode failure is treated as expired so a stale token is never reused.
    return true;
  }
}

/**
 * Returns a valid anonymous token (re-minting when missing or expired), or
 * null on failure. Best-effort: a failure returns null and the caller falls
 * back to its normal auth flow.
 */
export async function ensureAnonymousToken(): Promise<string | null> {
  const existing = getAnonymousToken();
  if (existing && !isAnonymousTokenExpired(existing)) return existing;

  // A stored token here is expired/stale — drop it before minting so a failed
  // mint never leaves a dead token for the request interceptor to keep
  // attaching.
  if (existing) clearAnonymousToken();

  try {
    const AUTH_BASE = process.env.NEXT_PUBLIC_API_URL;
    const deviceId = getOrCreateDeviceId();
    const res = await fetch(`${AUTH_BASE}/auth/anonymous-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deviceId ? { deviceId } : {}),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const token: string | undefined =
      body?.data?.accessToken ?? body?.accessToken;
    if (!token) return null;
    setAnonymousToken(token);
    return token;
  } catch {
    return null;
  }
}
