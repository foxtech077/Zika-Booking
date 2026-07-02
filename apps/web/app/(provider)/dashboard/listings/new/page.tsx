"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Building2, Car, Home, ArrowRight, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { listingsService } from "@/services/listings";
import { cn } from "@/lib/utils";
import type { ListingCategory } from "@/types/provider";
import { useAuthStore } from "@/stores/auth";
import BookingModeSelector from "../[id]/edit/_forms/shared/BookingModeSelector";

const TOKEN_KEY = "zika:access_token";

const unwrapListingId = (payload: any): string | null =>
  payload?.data?.id ??
  payload?.id ??
  payload?.data?.listing?.id ??
  payload?.listing?.id ??
  payload?.listingId ??
  null;

const getAuthConfig = (storeToken: string | null) => {
  const token =
    storeToken ??
    (typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null);
  if (!token) throw new Error("AUTH_REQUIRED");
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
  return { headers: { Authorization: `Bearer ${token}` } };
};

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Session expired. Please sign in again.");
      const accessToken =
        body?.data?.tokens?.accessToken ??
        body?.tokens?.accessToken ??
        body?.data?.accessToken ??
        body?.accessToken;
      if (!accessToken) throw new Error("Refresh succeeded, but no access token was returned.");
      if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, accessToken);
      const { user, setSession } = useAuthStore.getState();
      if (user) setSession(accessToken, user);
      return accessToken as string;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const withTokenRefresh = async <T,>(
  request: (tokenOverride: string | null) => Promise<T>,
  currentToken: string | null,
) => {
  try {
    return await request(currentToken);
  } catch (err: any) {
    if (err?.response?.status !== 401) throw err;
    const freshToken = await refreshAccessToken();
    return request(freshToken);
  }
};

const CATEGORIES: Array<{
  value: ListingCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
}> = [
  {
    value: "hotel",
    label: "Hotel / Lodge",
    description: "Register a hotel, resort, lodge or B&B with room inventory management.",
    icon: <Building2 className="w-8 h-8" />,
    color: "from-green-500 to-emerald-600",
    features: ["Room management", "Review-based ratings", "Admin review required", "Document uploads"],
  },
  {
    value: "apartment",
    label: "Apartment / Home",
    description: "List a self-catering apartment, villa, or entire home.",
    icon: <Home className="w-8 h-8" />,
    color: "from-emerald-500 to-teal-600",
    features: ["Instant activation", "Long-stay discounts", "iCal sync", "Self-managed"],
  },
  {
    value: "car",
    label: "Car Rental",
    description: "List a vehicle for short or long-term rental.",
    icon: <Car className="w-8 h-8" />,
    color: "from-amber-500 to-orange-600",
    features: ["Instant activation", "Delivery option", "Daily pricing", "Mileage policies"],
  },
];

export default function NewListingPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [selected, setSelected] = useState<ListingCategory | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const createMutation = useMutation({
    mutationFn: (category: ListingCategory) =>
      withTokenRefresh(
        () => listingsService.create(category),
        token,
      ),
    onSuccess: (data) => {
      const id = unwrapListingId(data);
      if (!id) {
        setErrorMsg("Listing was created, but the server did not return a listing id. Please refresh the listings page.");
        return;
      }
      router.push(`/dashboard/listings/${id}/edit`);
    },
    onError: (err: any) => {
      if (err.message === "AUTH_REQUIRED") {
        setErrorMsg("Authentication required. Please sign in again as a provider.");
        router.replace("/auth/login");
        return;
      }
      setErrorMsg(err.response?.data?.error?.message ?? "Failed to create listing. Please try again.");
    },
  });

  const handleCreate = () => {
    if (!selected || createMutation.isPending) return;
    setErrorMsg("");
    createMutation.mutate(selected);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 text-primary text-xs font-semibold mb-4">
          <Zap className="w-3.5 h-3.5" />
          New Listing
        </div>
        <h1 className="text-2xl font-bold text-slate-900">What are you listing?</h1>
        <p className="text-slate-500 mt-1">Choose a category to get started. You can edit all details afterwards.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            disabled={createMutation.isPending}
            onClick={() => setSelected(cat.value)}
            className={cn(
              "text-left p-5 rounded-2xl border-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed",
              selected === cat.value
                ? "border-primary bg-primary-50 shadow-glow-primary"
                : "border-border bg-white hover:border-primary-300 hover:shadow-card-md"
            )}
          >
            <div className="flex items-start gap-4">
              <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shrink-0", cat.color)}>
                {cat.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-base">{cat.label}</h3>
                  {selected === cat.value && (
                    <span className="text-xs font-semibold text-primary bg-primary-50 px-2 py-0.5 rounded-full border border-primary/20">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{cat.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {cat.features.map((f) => (
                    <span key={f} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <BookingModeSelector onChange={(v) => {
          try { localStorage.setItem("zika:listing-new-booking-mode", v); } catch {}
        }} />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => router.push("/dashboard/listings")}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={!selected}
          loading={createMutation.isPending}
          onClick={handleCreate}
          className="flex items-center gap-2"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {createMutation.isError && (
        <p className="mt-4 text-sm text-danger">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
