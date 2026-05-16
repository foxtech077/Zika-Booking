"use client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";

const CATEGORIES = [
  { key: "hotel", title: "Hotel", description: "Rooms and suites in a hotel property", icon: "🏨" },
  { key: "apartment", title: "Apartment", description: "Self-contained units, studios, and apartments", icon: "🏠" },
  { key: "car", title: "Car Rental", description: "Vehicles available for daily or weekly hire", icon: "🚗" },
];

export default function NewListingPage() {
  const router = useRouter();

  const createMutation = useMutation({
    mutationFn: async (category: string) => {
      const res = await listingApi.post<{ data: { id: string } }>("/listings", { category });
      return res.data.data;
    },
    onSuccess: (data) => router.push(`/listings/${data.id}/edit`),
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">What type of listing?</h1>
        <p className="text-sm text-gray-500 mb-8">Choose the category that best describes your property or vehicle.</p>

        <div className="space-y-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => createMutation.mutate(cat.key)}
              disabled={createMutation.isPending}
              className="w-full bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 hover:border-primary hover:bg-primary/5 transition text-left disabled:opacity-60"
            >
              <span className="text-3xl">{cat.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{cat.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>
              </div>
              <span className="text-gray-400 text-xl">›</span>
            </button>
          ))}
        </div>

        {createMutation.isError && (
          <p className="mt-4 text-sm text-red-600 text-center">Failed to create listing. Please try again.</p>
        )}
      </div>
    </div>
  );
}
