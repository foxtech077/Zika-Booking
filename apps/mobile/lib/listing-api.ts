import axios from "axios";
import { useAuthStore } from "../store/auth";

const LISTING_BASE_URL = process.env["EXPO_PUBLIC_LISTING_API_URL"] ?? "http://localhost:3003";

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
