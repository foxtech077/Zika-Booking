"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Clock, AlertTriangle, CheckCircle, XCircle, UserCheck, ChevronRight, Hotel, Car, Home } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ActionModal, ConfirmModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { ListingReviewTask } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";

function CategoryIcon({ category }: { category: string }) {
  if (category === "hotel") return <Hotel className="w-4 h-4 text-blue-500" />;
  if (category === "car") return <Car className="w-4 h-4 text-amber-500" />;
  return <Home className="w-4 h-4 text-emerald-500" />;
}

const REJECTION_REASONS = [
  "Insufficient documentation",
  "Operating permit expired",
  "Star rating unverifiable from submitted documents",
  "Document image quality too poor to verify",
  "Business name on documents does not match listing name",
  "Other",
];

const fetchQueue = (params: Record<string, string>) =>
  listingApi.get(`/admin/listings/review-queue?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

const fetchDetail = (id: string) =>
  listingApi.get(`/admin/listings/${id}/review`).then((r) => r.data.data ?? r.data);

function getSlaClass(deadline: string) {
  const hrs = (new Date(deadline).getTime() - Date.now()) / 3_600_000;
  if (hrs < 0) return "text-danger";
  if (hrs < 4) return "text-warning";
  return "text-success";
}

export default function AccreditationPage() {
  const { token } = useAuthStore();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [country, setCountry] = useState("");
  const [slaStatus, setSlaStatus] = useState("");
  const [selectedTask, setSelectedTask] = useState<ListingReviewTask | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [starRating, setStarRating] = useState("3");
  const [adminNote, setAdminNote] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [providerNote, setProviderNote] = useState("");

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<{ url: string; fileType: string } | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const params = { country, slaStatus, page: String(page), limit: "20" };
  const { data, isLoading } = useQuery({
    queryKey: ["accreditation-queue", params],
    queryFn: () => fetchQueue(params),
    enabled: !!token,
  });

  const tasks: ListingReviewTask[] = data?.tasks ?? [];
  const total: number = data?.total ?? 0;

  // Load full listing detail when task selected
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["listing-review-detail", selectedTask?.listingId],
    queryFn: () => fetchDetail(selectedTask!.listingId),
    enabled: !!selectedTask,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, rating, note }: { id: string; rating: number; note?: string }) =>
      listingApi.post(`/admin/listings/${id}/approve`, { starRating: rating, adminNote: note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accreditation-queue"] }); setSelectedTask(null); setShowApproveModal(false); },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reasons, providerNote, adminNote }: any) =>
      listingApi.post(`/admin/listings/${id}/reject`, { reasons, providerNote, adminNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accreditation-queue"] }); setSelectedTask(null); setShowRejectModal(false); },
  });

  const assignMut = useMutation({
    mutationFn: (taskId: string) => listingApi.patch(`/admin/listings/review-tasks/${taskId}/assign`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accreditation-queue"] }),
  });

  async function viewDocument(docId: string) {
    if (!selectedTask) return;
    if (activeDocId === docId && docUrl) return;
    
    setDocLoading(true);
    setDocError(null);
    try {
      const res = await listingApi.get<{ data: { url: string; fileType: string } }>(
        `/admin/listings/${selectedTask.listingId}/documents/${docId}`
      );
      setDocUrl(res.data.data);
      setActiveDocId(docId);
    } catch {
      setDocError("Could not load document.");
    } finally {
      setDocLoading(false);
    }
  }

  const handleCloseDrawer = () => {
    setSelectedTask(null);
    setActiveDocId(null);
    setDocUrl(null);
    setDocError(null);
  };

  const columns: Column<ListingReviewTask>[] = [
    {
      key: "listing",
      label: "Listing",
      width: "300px",
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
            {t.listing.photos?.[0]?.cdnUrl ? (
              <img src={t.listing.photos[0].cdnUrl} alt={t.listing.name ?? ""} className="w-full h-full object-cover" />
            ) : (
              <CategoryIcon category={t.listing.category} />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{t.listing.name ?? "(Untitled)"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CategoryIcon category={t.listing.category} />
              <span className="text-xs text-slate-500 capitalize">{t.listing.category}</span>
              {t.listing.town && <span className="text-xs text-slate-400">· {t.listing.town}, {t.listing.country}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "stars",
      label: "Claimed Stars",
      render: (t) => (
        <span className="text-sm text-slate-600">
          {"★".repeat(t.listing.claimedStarRating ?? 0)}{"☆".repeat(5 - (t.listing.claimedStarRating ?? 0))}
        </span>
      ),
    },
    {
      key: "submission",
      label: "Submission",
      render: (t) => (
        <span className="text-xs text-slate-500">#{t.submissionNumber} · {formatRelativeTime(t.listing.submittedAt ?? "")}</span>
      ),
    },
    {
      key: "sla",
      label: "SLA Deadline",
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <Clock className={`h-3.5 w-3.5 ${getSlaClass(t.slaDeadline)}`} />
          <span className={`text-xs font-medium ${getSlaClass(t.slaDeadline)}`}>
            {formatDate(t.slaDeadline, "MMM d, HH:mm")}
          </span>
        </div>
      ),
    },
    {
      key: "assigned",
      label: "Assigned",
      render: (t) => (
        <span className="text-xs text-slate-500">{t.assignedTo ?? "Unassigned"}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (t) => (
        <div className="flex justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!t.assignedTo && (
            <Button
              variant="ghost"
              size="sm"
              loading={assignMut.isPending}
              onClick={() => assignMut.mutate(t.id)}
            >
              <UserCheck className="h-3.5 w-3.5" /> Assign me
            </Button>
          )}
          <ChevronRight className="h-4 w-4 text-slate-300" />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Accreditation Queue"
        description={`${total} listings pending review`}
        action={
          <Badge label={`${total} Pending`} status="pending_review" size="md" />
        }
      />

      <Card padding="none">
        <FilterBar
          filters={[
            {
              key: "country",
              label: "All Countries",
              value: country,
              onChange: (v) => { setCountry(v); setPage(1); },
              options: ["MT", "US", "GB", "DE", "FR", "ES", "IT", "AE"].map((c) => ({ value: c, label: c })),
            },
            {
              key: "slaStatus",
              label: "SLA Status",
              value: slaStatus,
              onChange: (v) => { setSlaStatus(v); setPage(1); },
              options: [
                { value: "breached", label: "Breached" },
                { value: "approaching", label: "Approaching" },
                { value: "ok", label: "OK" },
              ],
            },
          ]}
        />
        <DataTable
          columns={columns}
          data={tasks}
          loading={isLoading}
          onRowClick={(t) => setSelectedTask(t)}
          emptyTitle="Queue is empty"
          emptyDescription="All listings have been reviewed."
          emptyIcon={<BadgeCheck className="h-10 w-10" />}
        />
        <Pagination page={page} limit={20} total={total} onPageChange={setPage} />
      </Card>

      {/* Review detail drawer */}
      <SlideDrawer
        open={!!selectedTask}
        onClose={handleCloseDrawer}
        title={selectedTask?.listing.name ?? "Review Listing"}
        description={`${selectedTask?.listing.town}, ${selectedTask?.listing.country} · Submission #${selectedTask?.submissionNumber}`}
        width="lg"
        footer={
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowRejectModal(true)}
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowApproveModal(true)}
              leftIcon={<CheckCircle className="h-4 w-4" />}
            >
              Approve
            </Button>
          </div>
        }
      >
        {loadingDetail ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-slate-200 rounded animate-shimmer" />
            ))}
          </div>
        ) : detail ? (
          <div className="space-y-5">
            {/* Basic info */}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Category", detail.category],
                ["Status", detail.status],
                ["Claimed Stars", detail.claimedStarRating ?? "—"],
                ["Address", detail.address ?? "—"],
                ["Price/Night", detail.pricePerNight ? `${detail.currency} ${detail.pricePerNight}` : "—"],
                ["Submitted", formatRelativeTime(detail.submittedAt)],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs text-slate-400 mb-0.5">{k}</dt>
                  <dd className="font-medium text-slate-900 capitalize text-sm">{String(v)}</dd>
                </div>
              ))}
            </dl>

            {/* Description */}
            {detail.description && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{detail.description}</p>
              </div>
            )}

            {/* Documents */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Documents ({detail.documents?.length ?? 0})</p>
              <div className="space-y-1.5">
                {detail.documents?.map((doc: any) => (
                  <button
                    key={doc.id}
                    onClick={() => viewDocument(doc.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition ${
                      activeDocId === doc.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "bg-surface-subtle border-border hover:border-gray-300 text-slate-700"
                    }`}
                  >
                    <span className="text-xs font-medium capitalize">{doc.documentType.replace(/_/g, " ")}</span>
                    <span className="text-xs uppercase opacity-70">{doc.fileType}</span>
                  </button>
                ))}
              </div>

              {docError && <p className="text-sm text-red-600 mt-2">{docError}</p>}
              
              {docLoading && <div className="flex justify-center py-4"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>}
              
              {docUrl && !docLoading && (
                <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                  {docUrl.fileType === "pdf" ? (
                    <iframe src={docUrl.url} className="w-full h-80" title="Document" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={docUrl.url} alt="Document" className="w-full object-contain max-h-80" />
                  )}
                  <div className="p-2 flex justify-end">
                    <a href={docUrl.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Open in new tab ↗</a>
                  </div>
                </div>
              )}
            </div>

            {/* Photos */}
            {detail.photos?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Photos ({detail.photos.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {detail.photos.slice(0, 4).map((p: any) => (
                    <div key={p.id} className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                      <img src={p.cdnUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SlideDrawer>

      {/* Approve modal */}
      <ActionModal
        open={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve listing"
        description="Confirm the verified star rating before approving."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={approveMut.isPending}
              onClick={() => selectedTask && approveMut.mutate({ id: selectedTask.listingId, rating: parseInt(starRating), note: adminNote })}
              leftIcon={<CheckCircle className="h-4 w-4" />}
            >
              Approve & Publish
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            id="star-rating"
            label="Verified Star Rating"
            value={starRating}
            onChange={(e) => setStarRating(e.target.value)}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} Star${n > 1 ? "s" : ""}` }))}
          />
          <Textarea
            id="admin-note"
            label="Internal Note (optional)"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Any notes for the audit trail…"
            rows={2}
          />
        </div>
      </ActionModal>

      {/* Reject modal */}
      <ActionModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject listing"
        description="Select rejection reasons and optionally add a note for the provider."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={rejectMut.isPending}
              onClick={() => selectedTask && rejectMut.mutate({ id: selectedTask.listingId, reasons, providerNote, adminNote })}
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Reject listing
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Rejection reasons</p>
            <div className="space-y-1.5">
              {REJECTION_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reasons.includes(r)}
                    onChange={(e) => setReasons((prev) => e.target.checked ? [...prev, r] : prev.filter((x) => x !== r))}
                    className="rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-slate-700">{r}</span>
                </label>
              ))}
            </div>
          </div>
          {reasons.includes("Other") && (
            <Textarea
              id="provider-note"
              label="Note for provider (required for 'Other')"
              value={providerNote}
              onChange={(e) => setProviderNote(e.target.value)}
              placeholder="Describe the reason…"
              rows={2}
              required
            />
          )}
        </div>
      </ActionModal>
    </div>
  );
}
