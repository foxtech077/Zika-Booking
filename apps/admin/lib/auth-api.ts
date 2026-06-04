import axios from "axios";

export const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_URL ?? "",
  withCredentials: true,
  timeout: 15_000,
});

// Attach JWT from session storage if present
authApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("zika:admin_session");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
