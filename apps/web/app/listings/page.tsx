"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";
import Link from "next/link";

export default function ListingsPage() {
  const queryClient = useQueryClient();
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const res = await listingApi.get<any>("/listings");
      // API may wrap data differently; ensure we return an array
      const data = (res.data && Array.isArray(res.data)) ? res.data : (res.data?.data ?? []);
      return data;
    },
  });

  async function handleDelete(id: string) {
    try {
      await listingApi.delete(`/listings/${id}`);
      queryClient.invalidateQueries(["listings"]);
    } catch (e) {
      console.error(e);
    }
  }

  if (isLoading) return <div className="p-8">Loading…</div>;

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">All Listings</h1>
      <Link
        href="/listings/new/hotel"
        className="inline-block mb-4 bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
      >
        Create New Listing
      </Link>
      <table className="w-full table-auto border-collapse bg-white shadow rounded">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Category</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {listings?.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="p-2">{l.id}</td>
              <td className="p-2">{l.name}</td>
              <td className="p-2">{l.category}</td>
                <td className="p-2 space-x-2">
                  <Link href={`/listings/${l.id}/edit`} className="text-primary hover:underline">Edit</Link>
                  <Link href={`/listings/${l.id}/public`} className="text-primary hover:underline">View</Link>
                  <button onClick={() => handleDelete(l.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
