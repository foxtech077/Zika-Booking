"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { listingApi } from "@/lib/listing-api";

export default function NewApartmentDetailsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await listingApi.post("/listings", {
        category: "apartment",
        name,
        description,
      });
      const newId = res.data.id;
      router.push(`/listings/${newId}/edit`);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to create listing. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Add Apartment Details</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium mb-1" htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-medium mb-1" htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={4}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Apartment Listing"}
        </button>
      </form>
    </div>
  );
}
