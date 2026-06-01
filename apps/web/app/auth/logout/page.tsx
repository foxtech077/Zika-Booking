"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export default function LogoutPage() {
  const router = useRouter();
  const { clearSession } = useAuthStore();

  useEffect(() => {
    api.post("/auth/logout").catch(() => {});
    clearToken();
    clearSession();
    router.replace("/auth/login");
  }, [router, clearSession]);


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <p className="text-lg font-semibold text-slate-800">Logging out…</p>
    </div>
  );
}
