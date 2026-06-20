import axios from "axios";

export const paymentApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PAYMENT_API_URL || "https://api.kainook.com/payments/payments",
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
