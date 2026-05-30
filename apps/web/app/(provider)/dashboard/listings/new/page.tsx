"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Building2, Car, Home, ArrowRight, Zap } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ListingCategory } from "@/types/provider";

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
    color: "from-blue-500 to-indigo-600",
    features: ["Room management", "Star rating", "Admin review required", "Document uploads"],
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
  const [selected, setSelected] = useState<ListingCategory | null>(null);

  const createMutation = useMutation({
    mutationFn: (category: ListingCategory) =>
      listingApi.post("/listings", { category }).then((r) => r.data.data ?? r.data),
    onSuccess: (data) => {
      router.push(`/dashboard/listings/${data.id}/edit`);
    },
  });

  const handleCreate = () => {
    if (!selected) return;
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
            onClick={() => setSelected(cat.value)}
            className={cn(
              "text-left p-5 rounded-2xl border-2 transition-all duration-200",
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
          Failed to create listing. Please try again.
        </p>
      )}
    </div>
  );
}
