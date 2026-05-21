import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "../store/auth";

const getBaseUrl = () => {
  const envUrl = process.env["EXPO_PUBLIC_API_URL"];
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1") && !envUrl.includes("10.249.75.161")) {
    return envUrl;
  }
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) {
    return `http://${host}:3001`;
  }
  return "http://localhost:3001";
};

const BASE_URL = getBaseUrl();

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15_000,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try to refresh, then retry once
let refreshing: Promise<void> | null = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as (typeof error.config) & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const res = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
            const token = (res.data as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken;
            const { user } = useAuthStore.getState();
            if (user) await useAuthStore.getState().setAuth(user, token);
          } catch {
            await useAuthStore.getState().clearAuth();
          } finally {
            refreshing = null;
          }
        })();
      }
      await refreshing;
      return api(original);
    }
    return Promise.reject(error);
  },
);
