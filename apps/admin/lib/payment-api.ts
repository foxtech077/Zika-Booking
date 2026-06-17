import axios from "axios";

export const paymentApi = axios.create({
  baseURL: "/payment-api",
  withCredentials: true,
  timeout: 30_000,
});

paymentApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("zika:admin_session");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
