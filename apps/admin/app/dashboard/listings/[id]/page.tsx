"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "@/lib/listing-api";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/auth";
import type { ListingReviewTask } from "@/types/admin";
import { formatDate } from "@/lib/utils";

const REJECTION_REASONS = [
  "Insufficient documentation",
  "Operating permit expired",
  "Star rating unverifiable from submitted documents",
  "Document image quality too poor to verify",
  "Business name on documents does not match listing name",
  "Other",
];

interface ListingDetail {
  id: string;
  name: string | null;
  category: string;
  status: string;
  roomType: string | null;
  unitCount: number | null;
  description: string | null;
  pricePerNight: number | null;
  pricePerDay?: number | null;
  currency: string | null;
  address: string | null;
  town: string | null;
  country: string | null;
  claimedStarRating: number | null;
  starRating: number | null;
  cancellationPolicy: string | null;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  submissionCount: number;
  submittedAt: string | null;
  // apartment-specific
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  longStayEnabled: boolean;
  longStayMinNights: number | null;
  longStayDiscountType: string | null;
  longStayDiscountValue: number | null;
  // car-specific
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  transmission: string | null;
  fuelType: string | null;
  seats: number | null;
  mileagePolicy: string | null;
  mileageLimitKm: number | null;
  photos: { id: string; cdnUrl: string; position: number }[];
  documents: { id: string; documentType: string; fileType: string }[];
  amenities?: Record<string, string[]> | { amenityKey: string }[] | null;
  customAmenities?: { label: string }[] | any[] | null;
  reviewTasks?: ListingReviewTask[];
}

export default function ListingReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<{ url: string; fileType: string } | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  // Approve state
  const [showApprove, setShowApprove] = useState(false);
  const [assignedStar, setAssignedStar] = useState(0);
  const [adminNote, setAdminNote] = useState("");

  // Reject state
  const [showReject, setShowReject] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [providerNote, setProviderNote] = useState("");
  const [rejectAdminNote, setRejectAdminNote] = useState("");

  // Star rating update state (for approved listings)
  const [showStarUpdate, setShowStarUpdate] = useState(false);
  const [newStar, setNewStar] = useState(0);
  const [starReason, setStarReason] = useState("");

  // Suspend state
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  // Escalate state
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscateReason] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);

  const { token, user } = useAuthStore();

  const { data: listing, isLoading } = useQuery<ListingDetail>({
    queryKey: ["listing-review", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ListingDetail }>(`/admin/listings/${id}/review`);
      return res.data.data;
    },
  });

  async function viewDocument(docId: string) {
    if (activeDocId === docId && docUrl) return;
    setDocLoading(true);
    try {
      const res = await listingApi.get<{ data: { url: string; fileType: string } }>(
        `/admin/listings/${id}/documents/${docId}`
      );
      setDocUrl(res.data.data);
      setActiveDocId(docId);
    } catch {
      setActionError("Could not load document.");
    } finally {
      setDocLoading(false);
    }
  }

  const approveMutation = useMutation({
    mutationFn: () => listingApi.post(`/admin/listings/${id}/approve`, { starRating: assignedStar, adminNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["review-queue"] }); router.replace("/dashboard/listings"); },
    onError: (e: any) => setActionError(e?.response?.data?.error?.message ?? "Approval failed."),
  });

  const rejectMutation = useMutation({
    mutationFn: () => listingApi.post(`/admin/listings/${id}/reject`, {
      reasons: selectedReasons, providerNote, adminNote: rejectAdminNote,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["review-queue"] }); router.replace("/dashboard/listings"); },
    onError: (e: any) => setActionError(e?.response?.data?.error?.message ?? "Rejection failed."),
  });

  const starUpdateMutation = useMutation({
    mutationFn: () => listingApi.patch(`/admin/listings/${id}/star-rating`, { starRating: newStar, reason: starReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listing-review", id] }); setShowStarUpdate(false); },
    onError: (e: any) => setActionError(e?.response?.data?.error?.message ?? "Update failed."),
  });

  const suspendMutation = useMutation({
    mutationFn: () => listingApi.post(`/admin/listings/${id}/suspend`, { reason: suspendReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listing-review", id] }); setShowSuspend(false); },
    onError: (e: any) => setActionError(e?.response?.data?.error?.message ?? "Suspension failed."),
  });

  const reinstateMutation = useMutation({
    mutationFn: () => listingApi.post(`/admin/listings/${id}/reinstate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listing-review", id] }),
    onError: (e: any) => setActionError(e?.response?.data?.error?.message ?? "Reinstatement failed."),
  });

  const assignMutation = useMutation({
    mutationFn: (taskId: string) => listingApi.patch(`/admin/listings/review-tasks/${taskId}/assign`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing-review", id] });
    },
    onError: (e: any) => setActionError(e?.response?.data?.error?.message ?? "Assignment failed."),
  });

  const unassignMutation = useMutation({
    mutationFn: (taskId: string) => listingApi.patch(`/admin/listings/review-tasks/${taskId}/unassign`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing-review", id] });
    },
    onError: (e: any) => setActionError(e?.response?.data?.error?.message ?? "Unassignment failed."),
  });

  const escalateMutation = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason?: string }) =>
      listingApi.patch(`/admin/listings/review-tasks/${taskId}/escalate`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing-review", id] });
      setShowEscalate(false);
      setEscateReason("");
    },
    onError: (e: any) => setActionError(e?.response?.data?.error?.message ?? "Escalation failed."),
  });

  const getSlaInfo = (deadlineStr: string, taskState: string) => {
    if (taskState === "resolved") return { text: "Resolved", color: "active" };
    const diffMs = new Date(deadlineStr).getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
      return { text: `Breached (${Math.abs(Math.round(diffHours))}h overdue)`, color: "danger" };
    }
    if (diffHours < 4) {
      const mins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return { text: `Approaching (${Math.floor(diffHours)}h ${mins}m)`, color: "suspended" };
    }
    return { text: `${Math.round(diffHours)}h remaining`, color: "active" };
  };

  const activeTask = listing?.reviewTasks?.find(
    (t) => t.status === "open" || t.status === "escalated"
  );

  const allAmenities: string[] = [];
  if (listing?.amenities && typeof listing.amenities === "object" && !Array.isArray(listing.amenities)) {
    Object.values(listing.amenities).forEach((list) => {
      if (Array.isArray(list)) {
        allAmenities.push(...list);
      }
    });
  } else if (Array.isArray(listing?.amenities)) {
    allAmenities.push(...listing.amenities.map((a: any) => typeof a === "string" ? a : a.amenityKey));
  }

  const allCustomAmenities: string[] = [];
  if (Array.isArray(listing?.customAmenities)) {
    allCustomAmenities.push(...listing.customAmenities.map((a: any) => typeof a === "string" ? a : a.label));
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }
  if (!listing) return <div className="p-8 text-gray-500">Listing not found.</div>;

  const docTypeLabel: Record<string, string> = {
    business_licence: "Business Licence",
    operating_permit: "Operating Permit",
    tourism_certificate: "Tourism Certificate",
  };

  const isPendingReview = listing.status === "pending_review";
  const isApproved = listing.status === "approved";
  const isActive = listing.status === "active";
  const isSuspended = listing.status === "suspended" || listing.status === "auto_suspended";
  const canSuspend = isApproved || isActive;

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/listings" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">← Back to queue</Link>
          <h1 className="text-xl font-bold text-gray-900">{listing.name ?? "Untitled listing"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {listing.category} · {[listing.town, listing.country].filter(Boolean).join(", ")}
            {" · "}Submission #{listing.submissionCount}
            {" · "}
            <span className={`font-medium ${isPendingReview ? "text-amber-600" : (isApproved || isActive) ? "text-green-600" : isSuspended ? "text-orange-600" : "text-gray-600"}`}>
              {listing.status.replace(/_/g, " ")}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          {isPendingReview && (
            <>
              <Button variant="danger" onClick={() => { setShowReject(true); setActionError(null); }}>Reject</Button>
              <Button onClick={() => { setShowApprove(true); setActionError(null); }}>Approve & Publish</Button>
            </>
          )}
          {isApproved && (
            <Button variant="secondary" onClick={() => { setShowStarUpdate(true); setNewStar(listing.starRating ?? 0); setActionError(null); }}>Edit star rating</Button>
          )}
          {canSuspend && (
            <Button variant="danger" onClick={() => { setShowSuspend(true); setActionError(null); }}>Suspend listing</Button>
          )}
          {isSuspended && (
            <Button onClick={() => reinstateMutation.mutate()} loading={reinstateMutation.isPending}>Reinstate listing</Button>
          )}
        </div>
      </div>

      {actionError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5">{actionError}</p>}

      {activeTask && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Review Task</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                activeTask.status === "escalated" 
                  ? "bg-red-50 text-red-700 border-red-200" 
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}>
                {activeTask.status}
              </span>
            </div>
            <div className="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
              <span>Task ID: <code className="font-mono text-xs text-slate-700">{activeTask.id}</code></span>
              <span>Deadline: <span className="font-medium text-slate-800">{formatDate(activeTask.slaDeadline)}</span></span>
              <span>
                SLA Tracker:{" "}
                <span className={`font-semibold ${
                  getSlaInfo(activeTask.slaDeadline, activeTask.status).color === "danger"
                    ? "text-red-600"
                    : getSlaInfo(activeTask.slaDeadline, activeTask.status).color === "suspended"
                    ? "text-amber-600"
                    : "text-green-600"
                }`}>
                  {getSlaInfo(activeTask.slaDeadline, activeTask.status).text}
                </span>
              </span>
            </div>
            <div className="text-sm text-slate-600">
              Assignee:{" "}
              <span className="font-medium text-slate-800">
                {activeTask.assignedTo ? (activeTask.assignedTo === user?.id ? "You (Self-assigned)" : activeTask.assignedTo) : "Unassigned"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!activeTask.assignedTo ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => assignMutation.mutate(activeTask.id)}
                loading={assignMutation.isPending}
              >
                Assign Me
              </Button>
            ) : activeTask.assignedTo === user?.id ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => unassignMutation.mutate(activeTask.id)}
                loading={unassignMutation.isPending}
              >
                Unassign
              </Button>
            ) : null}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowEscalate(true);
                setActionError(null);
              }}
            >
              Escalate Task
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT — Listing details */}
        <div className="space-y-5">
          {/* Basic info */}
          <Section title="Basic Information">
            <Row label="Price" value={(listing.pricePerNight ?? listing.pricePerDay) ? `${listing.currency} ${listing.pricePerNight ?? listing.pricePerDay}/${listing.category === "car" ? "day" : "night"}` : "—"} />
            <Row label="Cancellation policy" value={listing.cancellationPolicy ?? "—"} />

            {listing.category === "hotel" && (
              <>
                <Row label="Room type" value={listing.roomType ?? "—"} />
                <Row label="Units" value={listing.unitCount?.toString() ?? "—"} />
                <Row label="Smoking" value={listing.smokingAllowed ? "Yes" : "No"} />
                <Row label="Pets" value={listing.petsAllowed ? "Yes" : "No"} />
                {listing.claimedStarRating != null && <Row label="Claimed rating" value={`${listing.claimedStarRating}★ (self-assessed)`} />}
                {listing.starRating != null && <Row label="Verified rating" value={`${listing.starRating}★ (admin-assigned)`} />}
              </>
            )}

            {listing.category === "apartment" && (
              <>
                <Row label="Bedrooms" value={listing.bedrooms === 0 ? "Studio" : (listing.bedrooms?.toString() ?? "—")} />
                <Row label="Bathrooms" value={listing.bathrooms?.toString() ?? "—"} />
                <Row label="Max guests" value={listing.maxGuests?.toString() ?? "—"} />
                <Row label="Smoking" value={listing.smokingAllowed ? "Yes" : "No"} />
                <Row label="Pets" value={listing.petsAllowed ? "Yes" : "No"} />
                {listing.longStayEnabled && (
                  <Row label="Long-stay discount" value={`${listing.longStayDiscountValue}${listing.longStayDiscountType === "percentage" ? "%" : ""} on ${listing.longStayMinNights}+ nights`} />
                )}
              </>
            )}

            {listing.category === "car" && (
              <>
                <Row label="Vehicle" value={[listing.carMake, listing.carModel, listing.carYear?.toString()].filter(Boolean).join(" ") || "—"} />
                <Row label="Transmission" value={listing.transmission ?? "—"} />
                <Row label="Fuel type" value={listing.fuelType ?? "—"} />
                <Row label="Seats" value={listing.seats?.toString() ?? "—"} />
                <Row label="Mileage policy" value={listing.mileagePolicy === "limited" ? `Limited — ${listing.mileageLimitKm} km/day` : (listing.mileagePolicy ?? "—")} />
              </>
            )}

            {listing.description && (
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700">{listing.description}</p>
              </div>
            )}
          </Section>

          {/* Photos */}
          <Section title={`Photos (${(listing.photos ?? []).length})`}>
            {(!listing.photos || listing.photos.length === 0) ? <p className="text-sm text-gray-400">No photos uploaded.</p> : (
              <div className="grid grid-cols-3 gap-2">
                {listing.photos.map((p, i) => (
                  <div key={p.id} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
                    {i === 0 && <span className="absolute top-1 left-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full z-10">Cover</span>}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.cdnUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Amenities */}
          <Section title="Amenities">
            <div className="flex flex-wrap gap-1.5">
              {allAmenities.map((amenity) => (
                <span key={amenity} className="bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs capitalize">
                  {amenity.replace(/_/g, " ")}
                </span>
              ))}
              {allCustomAmenities.map((label) => (
                <span key={label} className="bg-blue-50 text-blue-700 rounded-full px-3 py-1 text-xs capitalize">
                  {label}
                </span>
              ))}
              {!allAmenities.length && !allCustomAmenities.length && (
                <p className="text-sm text-gray-400">None listed.</p>
              )}
            </div>
          </Section>
        </div>

        {/* RIGHT — Documents (hotels only) */}
        <div className="space-y-5">
          <Section title={listing.category === "hotel" ? "Accreditation Documents" : "Documents"}>
            {listing.category !== "hotel" ? (
              <p className="text-sm text-gray-400">Not required for {listing.category} listings.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {(listing.documents ?? []).map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => viewDocument(doc.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm transition ${activeDocId === doc.id ? "border-primary bg-primary/5 text-primary" : "border-gray-200 hover:border-gray-300 text-gray-700"}`}
                  >
                    <span className="font-medium">{docTypeLabel[doc.documentType] ?? doc.documentType}</span>
                    <span className="text-xs text-gray-400 uppercase">{doc.fileType}</span>
                  </button>
                ))}
                {!(listing.documents ?? []).length && <p className="text-sm text-gray-400">No documents uploaded.</p>}
              </div>
            )}

            {listing.category === "hotel" && docLoading && <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>}

            {listing.category === "hotel" && docUrl && !docLoading && (
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                {docUrl.fileType === "pdf" ? (
                  <iframe src={docUrl.url} className="w-full h-96" title="Document" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={docUrl.url} alt="Document" className="w-full object-contain max-h-96" />
                )}
                <div className="p-2 flex justify-end">
                  <a href={docUrl.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open in new tab ↗</a>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ── Approve modal ─────────────────────────────────────────────────── */}
      {showApprove && (
        <Modal title="Approve & Publish Listing" onClose={() => setShowApprove(false)}>
          <p className="text-sm text-gray-600 mb-4">Assign a verified star rating to publish this listing on Kainook.</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Verified star rating *</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button"
                  onClick={() => setAssignedStar(s)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition ${assignedStar === s ? "bg-primary text-white border-primary" : "border-gray-300 hover:border-primary text-gray-700"}`}
                >{s}★</button>
              ))}
            </div>
            {listing.claimedStarRating && assignedStar && assignedStar !== listing.claimedStarRating && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                Provider claimed {listing.claimedStarRating}★. You are assigning {assignedStar}★. A note will be included in the approval email.
              </p>
            )}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal note (optional)</label>
            <textarea className={textarea} rows={3} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} maxLength={500} placeholder="Internal notes — not shared with provider." />
          </div>
          {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowApprove(false)}>Cancel</Button>
            <Button
              onClick={() => approveMutation.mutate()}
              loading={approveMutation.isPending}
              disabled={!assignedStar}
            >
              Confirm Approval
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Reject modal ──────────────────────────────────────────────────── */}
      {showReject && (
        <Modal title="Reject Listing" onClose={() => setShowReject(false)}>
          <p className="text-sm text-gray-600 mb-4">Select at least one rejection reason. The provider note will be sent to the provider.</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rejection reason(s) *</label>
            <div className="space-y-2">
              {REJECTION_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={selectedReasons.includes(reason)}
                    onChange={(e) => setSelectedReasons((r) => e.target.checked ? [...r, reason] : r.filter((x) => x !== reason))}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note to provider {selectedReasons.includes("Other") ? "*" : "(optional)"}
            </label>
            <textarea className={textarea} rows={3} value={providerNote} onChange={(e) => setProviderNote(e.target.value)} maxLength={500} placeholder="Explain what the provider needs to fix…" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal note (not sent to provider)</label>
            <textarea className={textarea} rows={2} value={rejectAdminNote} onChange={(e) => setRejectAdminNote(e.target.value)} maxLength={500} />
          </div>
          {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button variant="danger"
              onClick={() => rejectMutation.mutate()}
              loading={rejectMutation.isPending}
              disabled={!selectedReasons.length || (selectedReasons.includes("Other") && !providerNote.trim())}
            >
              Confirm Rejection
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Star rating update modal ──────────────────────────────────────── */}
      {showStarUpdate && (
        <Modal title="Update Star Rating" onClose={() => setShowStarUpdate(false)}>
          <p className="text-sm text-gray-600 mb-4">Current rating: <strong>{listing.starRating}★</strong></p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">New star rating *</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setNewStar(s)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition ${newStar === s ? "bg-primary text-white border-primary" : "border-gray-300 hover:border-primary text-gray-700"}`}
                >{s}★</button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea className={textarea} rows={2} value={starReason} onChange={(e) => setStarReason(e.target.value)} maxLength={200} placeholder="e.g. Re-classification following updated documentation." />
          </div>
          {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowStarUpdate(false)}>Cancel</Button>
            <Button onClick={() => starUpdateMutation.mutate()} loading={starUpdateMutation.isPending} disabled={!newStar || !starReason.trim()}>
              Update Rating
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Suspend modal ─────────────────────────────────────────────────── */}
      {showSuspend && (
        <Modal title="Suspend Listing" onClose={() => setShowSuspend(false)}>
          <p className="text-sm text-gray-600 mb-4">This will immediately remove the listing from search. Active reservation locks will be cancelled.</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea className={textarea} rows={3} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} maxLength={500} placeholder="e.g. Policy violation — awaiting investigation." />
          </div>
          {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowSuspend(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => suspendMutation.mutate()} loading={suspendMutation.isPending} disabled={!suspendReason.trim()}>
              Suspend Listing
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Escalate modal ─────────────────────────────────────────────────── */}
      {showEscalate && activeTask && (
        <Modal title="Escalate Review Task" onClose={() => setShowEscalate(false)}>
          <p className="text-sm text-gray-600 mb-4">Flag this review/moderation task to senior admins for priority intervention.</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea className={textarea} rows={3} value={escalateReason} onChange={(e) => setEscateReason(e.target.value)} maxLength={500} placeholder="Describe why this task requires senior escalation…" />
          </div>
          {actionError && <p className="text-sm text-red-600 mb-3">{actionError}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowEscalate(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => escalateMutation.mutate({ taskId: activeTask.id, reason: escalateReason })} loading={escalateMutation.isPending}>
              Escalate Task
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const textarea = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none";
