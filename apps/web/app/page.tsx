"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem("zika:access_token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    // Decode the JWT payload (base64) to get userType without an extra API call
    try {
      const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
      router.replace(payload.type === "provider" ? "/dashboard" : "/traveller");
    } catch {
      router.replace("/auth/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

