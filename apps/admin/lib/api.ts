import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 15_000,
});

const TOKEN_KEY = "zika:admin_session";
const AUTH_FLOW_PATHS = [
  "/admin/auth/login",
  "/admin/auth/totp/setup",
  "/admin/auth/totp/confirm",
  "/admin/auth/totp/verify",
  "/admin/auth/webauthn/challenge",
  "/admin/auth/webauthn/verify",
];

function requestPath(url?: string) {
  if (!url) return "";
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url;
  }
}

function isAuthFlowRequest(url?: string) {
  const path = requestPath(url);
  return AUTH_FLOW_PATHS.some((authPath) => path.endsWith(authPath));
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function storeAdminToken(token: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}

export function clearRefreshTokenCookie() {
  if (typeof document === "undefined") return;

  for (const path of ["/", "/api", "/admin"]) {
    document.cookie = `refreshToken=; Max-Age=0; path=${path}; SameSite=Lax`;
  }
}

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token && !isAuthFlowRequest(config.url) && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const code   = error?.response?.data?.error?.code ?? "";
    const isAuthFlow = isAuthFlowRequest(error?.config?.url);

    const isAuthFailure =
      status === 401 ||
      (status === 403 && ["ACCOUNT_BANNED", "ACCOUNT_SUSPENDED", "ACCOUNT_INACTIVE", "FORBIDDEN"].includes(code));

    const isLoginPage = typeof window !== "undefined" && window.location.pathname.includes("/login");

    if (isAuthFailure && !isLoginPage && typeof window !== "undefined") {
      // Clear all admin session data then hard-navigate to login
      sessionStorage.removeItem("zika:admin_session");
      sessionStorage.removeItem("zika:admin_auth");
      if (!window.location.pathname.endsWith("/login")) {
        window.location.href = "/admin/login";
      }
    }

    return Promise.reject(error);
  }
);
