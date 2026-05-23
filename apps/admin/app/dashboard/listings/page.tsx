"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";

interface ReviewTask {
  id: string;
  submissionNumber: number;
  assignedTo: string | null;
  slaDeadline: string;
  listing: {
    id: string;
    name: string | null;
    country: string | null;
    town: string | null;
    claimedStarRating: number | null;
    submissionCount: number;
    submittedAt: string | null;
    providerId: string;
  };
}

function slaClass(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  const hours = ms / 3_600_000;
  if (hours < 0) return "bg-red-100 text-red-700";
  if (hours < 4) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

function slaLabel(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return "SLA breached";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

export default function ListingReviewQueuePage() {
  const qc = useQueryClient();
  const [country, setCountry] = useState("");
  const [slaStatus, setSlaStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["review-queue", country, slaStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (country) params.set("country", country);
      if (slaStatus) params.set("slaStatus", slaStatus);
      const res = await listingApi.get<{ data: { tasks: ReviewTask[]; total: number } }>(
        `/admin/listings/review-queue?${params}`
      );
      return res.data.data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: (taskId: string) => listingApi.patch(`/admin/listings/review-tasks/${taskId}/assign`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review-queue"] }),
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Hotel Review Queue</h1>
      <p className="text-sm text-gray-500 mb-6">Review and approve hotel listings submitted by providers.</p>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Country (e.g. KE)"
          value={country}
          maxLength={2}
          onChange={(e) => { setCountry(e.target.value.toUpperCase()); setPage(1); }}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={slaStatus}
          onChange={(e) => { setSlaStatus(e.target.value); setPage(1); }}
        >
          <option value="">All SLA statuses</option>
          <option value="ok">Within SLA</option>
          <option value="approaching">Approaching (≤4h)</option>
          <option value="breached">Breached</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Listing</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Submission</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SLA</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Assigned</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : !data?.tasks.length ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No listings pending review.</td></tr>
            ) : data.tasks.map((task) => (
              <tr key={task.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{task.listing.name ?? "Untitled"}</p>
                  {task.listing.claimedStarRating && (
                    <p className="text-xs text-gray-500">Claimed: {task.listing.claimedStarRating}★</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {[task.listing.town, task.listing.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-900">#{task.submissionNumber} submission</p>
                  <p className="text-xs text-gray-500">
                    {task.listing.submittedAt ? new Date(task.listing.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${slaClass(task.slaDeadline)}`}>
                    {slaLabel(task.slaDeadline)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {task.assignedTo ? `Admin ${task.assignedTo.slice(-4)}` : (
                    <button
                      onClick={() => assignMutation.mutate(task.id)}
                      disabled={assignMutation.isPending}
                      className="text-primary hover:underline text-xs"
                    >
                      Assign to me
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/listings/${task.listing.id}`}
                    className="inline-block px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {totalPages} · {data?.total} total</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
