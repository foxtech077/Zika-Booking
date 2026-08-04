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
 * Returns an existing anonymous token, or mints a fresh one. Best-effort:
 * a failure returns null and the caller falls back to its normal auth flow.
 */
export async function ensureAnonymousToken(): Promise<string | null> {
  const existing = getAnonymousToken();
  if (existing) return existing;

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
