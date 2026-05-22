import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "../store/auth";

const getListingBaseUrl = () => {
  // Prefer the Expo dev server host (auto-detected from the QR code) so any
  // phone on the same Wi-Fi can reach the API without hardcoded IP addresses.
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  const isIP = host && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  if (isIP && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:3003`;
  }
  const envUrl = process.env["EXPO_PUBLIC_LISTING_API_URL"];
  if (envUrl) return envUrl;
  return "http://localhost:3003";
};

const LISTING_BASE_URL = getListingBaseUrl();

export const listingApi = axios.create({
  baseURL: LISTING_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
});

listingApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Upload a file directly to S3 using a presigned URL
export async function uploadToS3(presignedUrl: string, fileUri: string, contentType: string): Promise<void> {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const upload = await fetch(presignedUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });
  if (!upload.ok) throw new Error(`S3 upload failed: ${upload.status}`);
}
