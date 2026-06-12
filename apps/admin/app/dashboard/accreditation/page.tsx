"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle, XCircle, Hotel, Eye, X } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea, Select } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ActionModal } from "@/components/modals/Modals";
import { formatRelativeTime } from "@/lib/utils";
import { api } from "@/lib/api";
import type { ListingReviewTask, PlatformUser } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";

// ── Spec-defined rejection reasons ────────────────────────────────────────────
const REJECTION_REASONS = [
  "Insufficient documentation",
  "Operating permit expired",
  "Star rating unverifiable",
  "Other",
];

// ── API helpers ───────────────────────────────────────────────────────────────
const fetchQueue = (params: Record<string, string>) =>
  listingApi.get("/admin/listings/review-queue", { params }).then((r) => r.data.data ?? r.data);

const fetchDetail = (id: string) =>
  listingApi.get(`/admin/listings/${id}/review`).then((r) => r.data.data ?? r.data);

const fetchDocUrl = (listingId: string, docId: string) =>
  listingApi.get(`/admin/listings/${listingId}/documents/${docId}`).then((r) => r.data.data ?? r.data);

// ── Helpers ───────────────────────────────────────────────────────────────────
function docLabel(type: string) {
  const map: Record<string, string> = {
    business_licence: "Business Registration",
    operating_permit: "Hotel Operating Permit",
    tourism_certificate: "Tourism Authority Certificate",
    classification_evidence: "Classification Evidence",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

// ── Document lightbox ─────────────────────────────────────────────────────────
function DocViewer({ url, fileType, label, onClose }: { url: string; fileType: string; label: string; onClose: () => void }) {
  const isPdf = fileType?.toLowerCase() === "pdf";
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 bg-black/50 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-medium capitalize text-sm">{label}</p>
        <button onClick={onClose} className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
        {isPdf ? (
          <iframe src={url} className="w-full max-w-4xl h-full min-h-[70vh] rounded-lg border border-white/10" title={label} />
        ) : (
          <img src={url} alt={label} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        )}
      </div>
      <div className="flex justify-center pb-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/50 hover:text-white/80 transition underline">
          Open in new tab
        </a>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AccreditationPage() {
  const { token, user, _hasHydrated } = useAuthStore();
  const isCountryManager = user?.role === "country_manager";
  const userCountryScope = user?.countryScope ?? [];
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<ListingReviewTask | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [starRating, setStarRating] = useState("3");
  const [adminNote, setAdminNote] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [providerNote, setProviderNote] = useState("");
  const [docViewer, setDocViewer] = useState<{ url: string; fileType: string; label: string } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  // const params = { page: String(page), limit: "20" };

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<{ url: string; fileType: string } | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Only super_admin and admin see the country filter dropdown; country managers have a fixed scope
  const canShowCountryFilter = user?.role === "super_admin" || user?.role === "admin";
  const countryOptions = userCountryScope.length > 0
    ? userCountryScope.map((c) => ({ value: c, label: c }))
    : [
        "MT", "US", "GB", "DE", "FR", "ES", "IT", "AE", "AU", "CA", "JP", "SG", "NL", "BE", "SE", "IN"
      ].map((c) => ({ value: c, label: c }));

  const [country, setCountry] = useState(() => userCountryScope[0] ?? "");

  // Sync country selection after auth store hydration
  useEffect(() => {
    if (userCountryScope.length > 0 && !country) {
      setCountry(userCountryScope[0] ?? "");
    }
  }, [userCountryScope, country]);

  // For country managers, always send their first scoped country as the filter.
  // Previously this was set to "" which caused the API to return all countries.
  const effectiveCountry = isCountryManager ? (country || userCountryScope[0] || "") : country;
  const params = Object.fromEntries(
    Object.entries({
      page: String(page),
      limit: "20",
      country: effectiveCountry,
    }).filter(([, v]) => v !== "")
  );
  const { data, isLoading } = useQuery({
    queryKey: ["accreditation-queue", page, effectiveCountry],
    queryFn: () => fetchQueue(params),
    // Wait for auth store to rehydrate so userCountryScope/effectiveCountry are correct
    enabled: !!token && _hasHydrated,
  });

  const { data: providersData } = useQuery({
    queryKey: ["admin-providers-list"],
    queryFn: () =>
      api
        .get("/admin/users", { params: { userType: "provider", limit: "1000" } })
        .then((r) => r.data.data ?? r.data),
    enabled: !!token && _hasHydrated,
  });

  const providers: PlatformUser[] = providersData?.users ?? [];
  const providerMap = new Map<string, string>();
  for (const p of providers) {
    const name = p.businessName || `${p.firstName} ${p.lastName}`.trim() || p.email;
    providerMap.set(p.id, name);
  }

  // Country managers: client-side filter as safety net (in case API doesn't filter)
  const rawTasks: ListingReviewTask[] = data?.tasks ?? [];

  const tasks = isCountryManager && userCountryScope.length > 0
    ? rawTasks.filter((t) => {
        const listingCountry = t.listing?.country?.toUpperCase();
        const selectedCountry = country?.toUpperCase();
        const inScope = listingCountry
          ? userCountryScope.some((sc) => sc.toUpperCase() === listingCountry)
          : false;

        return inScope && (!selectedCountry || selectedCountry === listingCountry);
      })
    : rawTasks;
  const total: number = data?.total ?? tasks.length;

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["listing-review-detail", selectedTask?.listing?.id],
    queryFn: () => fetchDetail(selectedTask!.listing.id),
    enabled: !!selectedTask,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: ({ id, rating, note }: { id: string; rating: number; note?: string }) =>
      listingApi.post(`/admin/listings/${id}/approve`, { starRating: rating, adminNote: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accreditation-queue"] });
      setSelectedTask(null);
      setShowApproveModal(false);
      setAdminNote("");
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reasons, providerNote, adminNote }: any) =>
      listingApi.post(`/admin/listings/${id}/reject`, { reasons, providerNote, adminNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accreditation-queue"] });
      setSelectedTask(null);
      setShowRejectModal(false);
      setReasons([]);
      setProviderNote("");
      setAdminNote("");
    },
  });

  // ── Document viewer ────────────────────────────────────────────────────────
  async function openDoc(listingId: string, docId: string, type: string, fileType: string) {
    setLoadingDocId(docId);
    try {
      const res = await fetchDocUrl(listingId, docId);
      setDocViewer({ url: res.url, fileType: res.fileType ?? fileType, label: docLabel(type) });
    } finally {
      setLoadingDocId(null);
    }
  }

  // ── Queue columns (spec: provider name, submission date, claimed star rating) ─
  const columns: Column<ListingReviewTask>[] = [
    {
      key: "listing",
      label: "Hotel Listing",
      width: "280px",
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100 overflow-hidden">
            {t.listing.photos?.[0]?.cdnUrl
              ? <img src={t.listing.photos[0].cdnUrl} alt={t.listing.name ?? ""} className="w-full h-full object-cover" />
              : <Hotel className="w-4 h-4 text-blue-500" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{t.listing.name ?? "(Untitled)"}</p>
            <p className="text-xs text-slate-400 truncate">{t.listing.town}, {t.listing.country}</p>
          </div>
        </div>
      ),
    },
    {
      key: "provider",
      label: "Provider",
      render: (t) => {
        const name = providerMap.get(t.listing.providerId);
        return name ? (
          <span className="text-xs text-slate-700 font-medium">{name}</span>
        ) : (
          <span className="text-xs text-slate-500 font-mono">{t.listing.providerId?.slice(0, 10)}…</span>
        );
      },
    },
    {
      key: "stars",
      label: "Claimed Stars",
      render: (t) => (
        <span className="text-sm">
          <span className="text-amber-400">{"★".repeat(t.listing.claimedStarRating ?? 0)}</span>
          <span className="text-slate-200">{"★".repeat(5 - (t.listing.claimedStarRating ?? 0))}</span>
        </span>
      ),
    },
    {
      key: "submitted",
      label: "Submission Date",
      render: (t) => (
        <div>
          <p className="text-xs text-slate-600">#{t.listing.submissionCount}</p>
          <p className="text-xs text-slate-400">{t.listing.submittedAt ? formatRelativeTime(t.listing.submittedAt) : "—"}</p>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-screen-xl">
      {/* Document lightbox */}
      {docViewer && (
        <DocViewer url={docViewer.url} fileType={docViewer.fileType} label={docViewer.label} onClose={() => setDocViewer(null)} />
      )}

      <SectionHeader
        title="Hotel Accreditation Queue"
        description={`${total} hotel listings pending review`}
        action={<Badge label={`${total} Pending`} status="pending_review" size="md" />}
      />

      <Card padding="none">
      {canShowCountryFilter && (
          <FilterBar
            filters={[
              {
                key: "country",
                label: "All Countries",
                value: country,
                onChange: (v: string) => {
                  setCountry(v);
                  setPage(1);
                },
                options: countryOptions,
              },
            ]}
          />
        )}
        <DataTable
          columns={columns}
          data={tasks}
          loading={isLoading}
          onRowClick={(t) => { setSelectedTask(t); setStarRating(String(t.listing.claimedStarRating ?? 3)); }}
          emptyTitle="Queue is empty"
          emptyDescription="All hotel listings have been reviewed."
          emptyIcon={<BadgeCheck className="h-10 w-10" />}
        />
        <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
      </Card>

      {/* ── Review detail drawer ─────────────────────────────────────────── */}
      <SlideDrawer
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask?.listing.name ?? "Review Hotel Listing"}
        description={`${selectedTask?.listing.town}, ${selectedTask?.listing.country} · Submission #${selectedTask?.listing?.submissionCount ?? "?"}`}
        width="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => setShowRejectModal(true)} leftIcon={<XCircle className="h-4 w-4" />}>
              Reject
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowApproveModal(true)} leftIcon={<CheckCircle className="h-4 w-4" />}>
              Approve & Publish
            </Button>
          </div>
        }
      >
        {loadingDetail ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : detail ? (
          <div className="space-y-6">

            {/* Submission summary */}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Provider", selectedTask?.listing?.providerId ? (providerMap.get(selectedTask.listing.providerId) ?? selectedTask.listing.providerId) : "—"],
                ["Submission Date", selectedTask?.listing?.submittedAt ? formatRelativeTime(selectedTask.listing.submittedAt) : "—"],
                ["Claimed Stars", selectedTask?.listing?.claimedStarRating
                  ? `${"★".repeat(selectedTask.listing.claimedStarRating)} (${selectedTask.listing.claimedStarRating}★)`
                  : "—"],
                ["Submission #", `#${selectedTask?.listing?.submissionCount ?? "?"}`],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-slate-400 mb-0.5">{k}</dt>
                  <dd className="font-medium text-slate-800 text-sm">{String(v)}</dd>
                </div>
              ))}
            </dl>

            {/* Uploaded documents */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Uploaded Documents ({detail.documents?.length ?? 0})
              </p>
              {!detail.documents?.length ? (
                <p className="text-xs text-danger italic">No documents uploaded — cannot approve.</p>
              ) : (
                <div className="space-y-2">
                  {detail.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{docLabel(doc.documentType)}</p>
                        <p className="text-xs text-slate-400 uppercase mt-0.5">{doc.fileType}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={loadingDocId === doc.id}
                        onClick={() => openDoc(detail.id, doc.id, doc.documentType, doc.fileType)}
                        leftIcon={<Eye className="h-3.5 w-3.5" />}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Document checklist */}
              {detail.docChecklist?.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {detail.docChecklist.map((item: any) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${item.satisfied ? "bg-success" : "bg-danger"}`}>
                        {item.satisfied ? "✓" : "✗"}
                      </span>
                      <span className={`text-xs ${item.satisfied ? "text-slate-600" : "text-danger font-medium"}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Photos */}
            {detail.photos?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Listing Photos ({detail.photos.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {detail.photos.slice(0, 6).map((p: any) => (
                    <div key={p.id} className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                      <img src={p.cdnUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {detail.description && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{detail.description}</p>
              </div>
            )}
          </div>
        ) : null}
      </SlideDrawer>

      {/* ── Approve modal ────────────────────────────────────────────────── */}
      <ActionModal
        open={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve & Publish"
        description="Assign the verified star rating. If documents support a different rating than claimed, set the correct one below."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={approveMut.isPending}
              onClick={() => selectedTask && approveMut.mutate({ id: selectedTask.listing.id, rating: parseInt(starRating), note: adminNote })}
              leftIcon={<CheckCircle className="h-4 w-4" />}
            >
              Approve & Publish
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {selectedTask?.listing.claimedStarRating && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-xs text-amber-700">Provider claimed:</span>
              <span className="text-sm font-semibold text-amber-800">
                {"★".repeat(selectedTask.listing.claimedStarRating)} ({selectedTask.listing.claimedStarRating}★)
              </span>
            </div>
          )}
          <Select
            id="star-rating"
            label="Verified Star Rating (admin-assigned)"
            value={starRating}
            onChange={(e) => setStarRating(e.target.value)}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} Star${n > 1 ? "s" : ""}` }))}
          />
          <Textarea
            id="admin-note"
            label="Internal note (optional — logged in audit trail)"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="e.g. Documents support 4★ despite 5★ claim…"
            rows={2}
          />
        </div>
      </ActionModal>

      {/* ── Reject modal ─────────────────────────────────────────────────── */}
      <ActionModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Listing"
        description="Select the rejection reason(s). The provider will be notified with resubmission instructions."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={rejectMut.isPending}
              disabled={reasons.length === 0}
              onClick={() => selectedTask && rejectMut.mutate({ id: selectedTask.listing.id, reasons, providerNote, adminNote })}
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Reject listing
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Rejection reason(s) <span className="text-danger">*</span></p>
            <div className="space-y-2">
              {REJECTION_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={reasons.includes(r)}
                    onChange={(e) => setReasons((prev) => e.target.checked ? [...prev, r] : prev.filter((x) => x !== r))}
                    className="rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-slate-900">{r}</span>
                </label>
              ))}
            </div>
          </div>
          <Textarea
            id="provider-note"
            label={`Note for provider${reasons.includes("Other") ? " (required)" : " (optional)"}`}
            value={providerNote}
            onChange={(e) => setProviderNote(e.target.value)}
            placeholder="Provide resubmission instructions for the provider…"
            rows={3}
            required={reasons.includes("Other")}
          />
        </div>
      </ActionModal>
    </div>
  );
}
