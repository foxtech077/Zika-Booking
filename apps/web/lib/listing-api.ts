import axios from "axios";

// Proxied via Next.js rewrites: /listing-api/* → listing-service
export const listingApi = axios.create({
  baseURL: "/listing-api",
  withCredentials: true,
  timeout: 30_000,
});

listingApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("zika:access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function uploadToS3(presignedUrl: string, file: File): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
}
