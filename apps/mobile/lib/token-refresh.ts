/**
 * Shared token-refresh module — the mobile counterpart of the web app's
 * lib/token-refresh.ts.
 *
 * Why this exists: api.ts, listing-api.ts and payment-api.ts each used to hold
 * their OWN module-level `refreshing` promise, so a 401 arriving on two clients
 * at once fired two POST /auth/refresh calls. The endpoint ROTATES the refresh
 * token — it revokes the presented session before issuing a new one — so the
 * second call presents a token the first has already revoked, gets 401
 * INVALID_TOKEN, and its failure path called clearAuth(). The user was logged
 * out even though the first refresh had just succeeded. Worse, the server also
 * clears the refresh cookie on that path, discarding the freshly issued one.
 *
 * Concurrent 401s across all three clients now await a single in-flight
 * promise, exactly as the web app has always done — which is why refresh has
 * been reliable there and not here.
 */

import axios from "axios";
import type { PublicUser } from "@zika/types";
import { getAuthBaseUrl } from "./config";
import { useAuthStore } from "../store/auth";

const AUTH_BASE_URL = getAuthBaseUrl();

interface RefreshBody {
  data?: {
    tokens?: { accessToken?: string };
    user?: PublicUser;
  };
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Only a definitive rejection means the session is genuinely gone. A dropped
 * connection, a timeout or a 5xx says nothing about the refresh cookie, and on
 * mobile networks those are routine — clearing the session on them logged
 * people out for riding a lift.
 */
function isDefinitiveRejection(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}

/**
 * Refreshes the access token, returning the new one, or null when the refresh
 * could not be completed. Concurrent callers share one in-flight request.
 * Clears the session only when the server definitively rejects the credential.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      // AUTH_BASE_URL ends with "/" — a leading slash here produced
      // ".../auth//auth/refresh", which the gateway 404s.
      const res = await axios.post(
        `${AUTH_BASE_URL}auth/refresh`,
        {},
        { withCredentials: true },
      );

      const body = (res.data as RefreshBody)?.data;
      const token = body?.tokens?.accessToken;
      if (!token) return null;

      // Prefer the user object the refresh returns; reusing the cached one
      // keeps server-side changes (hostStatus above all) out of the store.
      const nextUser = body?.user ?? useAuthStore.getState().user;
      if (nextUser) await useAuthStore.getState().setAuth(nextUser, token);

      return token;
    } catch (error) {
      if (isDefinitiveRejection(error)) {
        await useAuthStore.getState().clearAuth();
      }
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}
