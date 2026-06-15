import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  timeout: 15_000,
});

const TOKEN_KEY = "zika:admin_session";

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

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const code   = error?.response?.data?.error?.code ?? "";

    const isAuthFailure =
      status === 401 ||
      (status === 403 && ["ACCOUNT_BANNED", "ACCOUNT_SUSPENDED", "ACCOUNT_INACTIVE", "FORBIDDEN"].includes(code));

    const isLoginPage = typeof window !== "undefined" && window.location.pathname.includes("/login");

    if (isAuthFailure && !isLoginPage && typeof window !== "undefined") {
      // Clear all admin session data then hard-navigate to login
      sessionStorage.removeItem("zika:admin_session");
      sessionStorage.removeItem("zika:admin_auth");
      window.location.href = "/admin/login";
    }

    return Promise.reject(error);
  }
);
