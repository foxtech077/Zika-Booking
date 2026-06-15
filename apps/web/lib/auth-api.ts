import axios from "axios";

const AUTH_BASE = `${process.env.NEXT_PUBLIC_AUTH_API_URL ?? "https://api.kainook.com/auth"}/`;

export const authApi = axios.create({
  baseURL: AUTH_BASE,
  withCredentials: true,
  timeout: 30_000,
});

// Interceptor to attach access token if present
authApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("zika:access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

authApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      sessionStorage.removeItem("zika:access_token");
    }
    return Promise.reject(err);
  }
);

/** Register a new guest */
export async function registerGuest(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  userType: "guest";
  businessName?: string;
  country: string;
}) {
  return authApi.post("auth/register", payload);
}

/** Verify email token */
export async function verifyEmail(token: string) {
  return authApi.get(`auth/verify?token=${encodeURIComponent(token)}`);
}

/** Resend verification email */
export async function resendVerification(email: string) {
  return authApi.post("auth/resend-verification", { email });
}

/** Login */
export async function loginGuest(payload: { email: string; password: string }) {
  return authApi.post("auth/login", payload);
}

/** Logout current session */
export async function logout() {
  return authApi.post("auth/logout");
}

/** Logout from all devices */
export async function logoutAll() {
  return authApi.post("auth/logout-all");
}

/** Refresh token */
export async function refreshToken() {
  return authApi.post("auth/refresh");
}

/** Forgot password */
export async function forgotPassword(email: string) {
  return authApi.post("auth/forgot-password", { email });
}

/** Reset password */
export async function resetPassword(payload: { token: string; password: string; confirmPassword: string }) {
  return authApi.post("auth/reset-password", payload);
}

/** OAuth login (Google) */
export async function loginWithGoogle() {
  // Trigger backend OAuth flow; just navigate to the endpoint
  window.location.href = `${AUTH_BASE}auth/oauth/google`;
}

/** OAuth login (Apple) */
export async function loginWithApple() {
  window.location.href = `${AUTH_BASE}auth/oauth/apple`;
}