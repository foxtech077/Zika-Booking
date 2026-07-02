"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert, CheckCircle, XCircle, Hotel, Eye, X, ChevronLeft, ChevronRight,
  ShieldAlert as AlertIcon, RefreshCw, UserCheck, UserX, Clock, ArrowUpRight, Ban,
  Star, ShieldOff, ShieldCheck, Edit
} from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { api } from "@/lib/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ActionModal } from "@/components/modals/Modals";
import { formatRelativeTime, formatDate, slugToLabel, truncate } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import type { ListingReviewTask, ListingDetail, AdminRole } from "@/types/admin";
import { SYSTEM_COUNTRIES } from "@/lib/countries";
import { useRouter } from "next/navigation";

// ── API helpers ───────────────────────────────────────────────────────────────
const fetchQueue = (params: Record<string, string>) =>
  listingApi.get(`/admin/listings/review-queue?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

const fetchDetail = (id: string) =>
  listingApi.get(`/admin/listings/${id}/review`).then((r) => r.data.data ?? r.data);

const fetchDocUrl = (listingId: string, docId: string) =>
  listingApi.get(`/admin/listings/${listingId}/documents/${docId}`).then((r) => r.data.data ?? r.data);

function docLabel(type: string) {
  const map: Record<string, string> = {
    business_licence: "Business Registration",
    operating_permit: "Hotel Operating Permit",
    tourism_certificate: "Tourism Authority Certificate",
    classification_evidence: "Classification Evidence",
    vehicle_registration: "Vehicle Registration",
    insurance_certificate: "Insurance Certificate",
    roadworthiness_cert: "Roadworthiness Certificate",
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

// ── Photo gallery lightbox ────────────────────────────────────────────────────
function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onJump,
}: {
  photos: any[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
}) {
  const photo = photos[currentIndex];
  const total = photos.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 bg-black/60 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <p className="text-white/70 text-sm">
          Photo <span className="text-white font-semibold">{currentIndex + 1}</span> of <span className="text-white font-semibold">{total}</span>
        </p>
        <button onClick={onClose} className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative p-4" onClick={(e) => e.stopPropagation()}>
        {currentIndex > 0 && (
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/80 transition border border-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <img src={photo.cdnUrl} alt={`Photo ${currentIndex + 1}`} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />

        {currentIndex < total - 1 && (
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/80 transition border border-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex-shrink-0 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1.5 overflow-x-auto py-2 scrollbar-hide justify-center flex-wrap max-h-[90px]">
          {photos.map((p, i) => (
            <button
              key={p.id ?? i}
              onClick={() => onJump(i)}
              className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition ${i === currentIndex ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"}`}
            >
              <img src={p.cdnUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────────
export default function ModerationPage() {
  const router = useRouter();
  const { token, user, _hasHydrated } = useAuthStore();
  const role = user?.role as AdminRole | undefined;
  const isCM = role === "country_manager";
  const userCountryScope = user?.countryScope ?? [];
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedTask, setSelectedTask] = useState<ListingReviewTask | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  // Resolution modals state
  const [resolveType, setResolveType] = useState<"unblock_warning" | "unblock_no_warning" | "keep_suspended" | "ban" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [escalationModal, setEscalationModal] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");

  // Direct listing actions
  const [suspendModal, setSuspendModal] = useState<any | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [reinstateConfirm, setReinstateConfirm] = useState<any | null>(null);
  const [reinstateReason, setReinstateReason] = useState("");
  const [starModal, setStarModal] = useState<any | null>(null);
  const [newStar, setNewStar] = useState("3");
  const [starReason, setStarReason] = useState("");

  const [docViewer, setDocViewer] = useState<{ url: string; fileType: string; label: string } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [photoLightbox, setPhotoLightbox] = useState<{ photos: any[]; index: number } | null>(null);

  const openPhoto = useCallback((photos: any[], index: number) => {
    setPhotoLightbox({ photos, index });
  }, []);

  const prevPhoto = useCallback(() =>
    setPhotoLightbox((s) => {
      if (!s) return s;
      return s.index > 0 ? { ...s, index: s.index - 1 } : s;
    }), []);

  const nextPhoto = useCallback(() =>
    setPhotoLightbox((s) => {
      if (!s) return s;
      return s.index < s.photos.length - 1 ? { ...s, index: s.index + 1 } : s;
    }), []);

  const jumpPhoto = useCallback((idx: number) =>
    setPhotoLightbox((s) => {
      if (!s) return s;
      return { ...s, index: idx };
    }), []);

  // Filter queue params
  const [country, setCountry] = useState("");
  const [taskStatus, setTaskStatus] = useState<"" | "open" | "escalated">("");
  const [slaStatus, setSlaStatus] = useState<"" | "breached" | "approaching" | "ok">("");

  const params = {
    ...(country ? { country } : {}),
    ...(taskStatus ? { taskStatus } : {}),
    ...(slaStatus ? { slaStatus } : {}),
    page: String(page),
    limit: String(limit),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["moderation-queue", params],
    queryFn: () => fetchQueue(params),
    enabled: !!token && _hasHydrated,
  });

  const rawTasks: ListingReviewTask[] = data?.tasks ?? [];
  // Client-side category filtering to ensure only non-hotels (Apartments & Cars) are rendered
  const tasks = rawTasks.filter((t) => t.listing.category !== "hotel" && (!isCM || userCountryScope.includes(t.listing.country ?? "")));
  const total = data?.total ?? tasks.length;

  const { data: detail, isLoading: loadingDetail } = useQuery<ListingDetail>({
    queryKey: ["moderation-detail", selectedTask?.listing?.id],
    queryFn: () => fetchDetail(selectedTask!.listing.id),
    enabled: !!selectedTask,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const assignMut = useMutation({
    mutationFn: (taskId: string) => listingApi.patch(`/admin/listings/review-tasks/${taskId}/assign`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      if (selectedTask) {
        setSelectedTask((t) => t ? { ...t, assignedTo: user?.id ?? "" } : null);
      }
    },
  });

  const unassignMut = useMutation({
    mutationFn: (taskId: string) => listingApi.patch(`/admin/listings/review-tasks/${taskId}/unassign`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      if (selectedTask) {
        setSelectedTask((t) => t ? { ...t, assignedTo: null } : null);
      }
    },
  });

  const escalateMut = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason?: string }) =>
      listingApi.patch(`/admin/listings/review-tasks/${taskId}/escalate`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      setEscalationModal(false);
      setEscalationReason("");
      setSelectedTask(null);
    },
  });

  const resolveMut = useMutation({
    mutationFn: ({ taskId, decision, note }: { taskId: string; decision: string; note?: string }) =>
      listingApi.post(`/admin/listings/review-tasks/${taskId}/resolve`, { decision, adminNote: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      setSelectedTask(null);
      setResolveType(null);
      setAdminNote("");
    },
  });

  const directSuspendMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      listingApi.post(`/admin/listings/${id}/suspend`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      setSuspendModal(null);
      setSuspendReason("");
    },
  });

  const directReinstateMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      listingApi.post(`/admin/listings/${id}/reinstate`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      setReinstateConfirm(null);
      setReinstateReason("");
    },
  });

  const directStarMut = useMutation({
    mutationFn: ({ id, starRating, reason }: any) =>
      listingApi.patch(`/admin/listings/${id}/star-rating`, { starRating: parseInt(starRating), reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      setStarModal(null);
      setStarReason("");
    },
  });

  // Helper: dynamic color coding and timing text calculation for SLA deadlines
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

  async function openDoc(listingId: string, docId: string, type: string, fileType: string) {
    setLoadingDocId(docId);
    try {
      const res = await fetchDocUrl(listingId, docId);
      setDocViewer({ url: res.url, fileType: res.fileType ?? fileType, label: docLabel(type) });
    } finally {
      setLoadingDocId(null);
    }
  }

  const columns: Column<ListingReviewTask>[] = [
    {
      key: "listing",
      label: "Moderated Listing",
      width: "280px",
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 border border-orange-100 overflow-hidden">
            {t.listing.photos?.[0]?.cdnUrl ? (
              <img src={t.listing.photos[0].cdnUrl} alt={t.listing.name ?? ""} className="w-full h-full object-cover" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-orange-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{t.listing.name ?? `Listing ${t.listing.id.slice(0, 8)}`}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{t.listing.category} · {t.listing.town}, {t.listing.country}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Task Status",
      render: (t) => <Badge label={t.status} status={t.status} />,
    },
    {
      key: "sla",
      label: "SLA Tracker",
      render: (t) => {
        const sla = getSlaInfo(t.slaDeadline, t.status);
        return <Badge label={sla.text} status={sla.color} />;
      },
    },
    {
      key: "assignedTo",
      label: "Assignee",
      render: (t) => (
        <span className="text-xs font-mono text-slate-500">
          {t.assignedTo ? (t.assignedTo === user?.id ? "You" : t.assignedTo.slice(0, 12)) : "Unassigned"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (t) => (
        <div className="flex justify-end gap-2 items-center" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => router.push(`/dashboard/listings/${t.listing.id}`)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            title="Edit / Review"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          {t.listing.status === "approved" && (
            <button
              onClick={() => setStarModal(t.listing)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
              title="Update star rating"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          {["approved", "active"].includes(t.listing.status) && (
            <button
              onClick={() => setSuspendModal(t.listing)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-warning hover:bg-warning/5 transition-colors"
              title="Suspend"
            >
              <ShieldOff className="h-3.5 w-3.5" />
            </button>
          )}
          {["suspended", "auto_suspended"].includes(t.listing.status) && (
            <button
              onClick={() => setReinstateConfirm(t.listing)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-success hover:bg-success/5 transition-colors"
              title="Reinstate"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          )}
          {t.assignedTo ? (
            t.assignedTo === user?.id ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<UserX className="h-3.5 w-3.5" />}
                onClick={() => unassignMut.mutate(t.id)}
                loading={unassignMut.isPending}
              >
                Unassign
              </Button>
            ) : null
          ) : (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<UserCheck className="h-3.5 w-3.5" />}
              onClick={() => assignMut.mutate(t.id)}
              loading={assignMut.isPending}
            >
              Assign Me
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Moderation Queue"
        description="Review auto-suspensions triggered by consecutive negative reviews and compliance reports."
      />

      <Card padding="none">
        <FilterBar
          filters={[
            {
              key: "taskStatus",
              label: "All Statuses",
              value: taskStatus,
              onChange: (v) => { setTaskStatus(v as any); setPage(1); },
              options: [
                { value: "open", label: "Open" },
                { value: "escalated", label: "Escalated" },
              ],
            },
            {
              key: "slaStatus",
              label: "SLA Window",
              value: slaStatus,
              onChange: (v) => { setSlaStatus(v as any); setPage(1); },
              options: [
                { value: "breached", label: "Breached" },
                { value: "approaching", label: "Approaching (<4h)" },
                { value: "ok", label: "Safe" },
              ],
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={tasks}
          loading={isLoading}
          onRowClick={(t) => setSelectedTask(t)}
          emptyTitle="No moderation tasks open"
          emptyDescription="All car and apartment listings are in compliance."
          emptyIcon={<CheckCircle className="h-10 w-10 text-success" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Details Slide Drawer */}
      <SlideDrawer
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title="Listing Moderation Details"
        description={selectedTask ? `Task ID: ${selectedTask.id}` : ""}
        width="lg"
        footer={
          selectedTask && (
            <div className="flex flex-wrap gap-3 w-full justify-between items-center py-2 px-1">
              <div className="flex flex-wrap gap-2">
                {user?.role !== "super_admin" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-800 focus:ring-amber-500/20 whitespace-nowrap"
                    leftIcon={<ShieldAlert className="h-4 w-4 text-amber-600" />}
                    onClick={() => setEscalationModal(true)}
                  >
                    Escalate Task
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent focus:ring-emerald-500/20 whitespace-nowrap"
                  leftIcon={<ShieldCheck className="h-4 w-4" />}
                  onClick={() => setResolveType("unblock_warning")}
                >
                  Unblock (Warning)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 focus:ring-slate-500/20 whitespace-nowrap"
                  leftIcon={<CheckCircle className="h-4 w-4 text-slate-500" />}
                  onClick={() => setResolveType("unblock_no_warning")}
                >
                  Unblock (No Warning)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-800 focus:ring-rose-500/20 whitespace-nowrap"
                  leftIcon={<ShieldOff className="h-4 w-4 text-rose-600" />}
                  onClick={() => setResolveType("keep_suspended")}
                >
                  Keep Suspended
                </Button>
                {["admin", "super_admin"].includes(role ?? "") && (
                  <Button
                    variant="danger"
                    size="sm"
                    className="whitespace-nowrap"
                    leftIcon={<Ban className="h-4 w-4" />}
                    onClick={() => setResolveType("ban")}
                  >
                    Ban Listing
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {selectedTask && (
          <div className="space-y-6">
            {/* Listing Summary Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Listing Name</dt>
                <dd className="font-semibold text-slate-800">{selectedTask.listing.name ?? "(Untitled)"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Category / Type</dt>
                <dd className="font-semibold text-slate-800 capitalize">{selectedTask.listing.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Location</dt>
                <dd className="text-slate-600">{selectedTask.listing.town}, {selectedTask.listing.country}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Trigger Status</dt>
                <dd className="text-slate-600 capitalize">Auto-Suspended</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">SLA Timer</dt>
                <dd className="font-semibold text-slate-800">
                  {getSlaInfo(selectedTask.slaDeadline, selectedTask.status).text}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Owner User ID</dt>
                <dd className="font-mono text-xs text-slate-500">{selectedTask.listing.providerId}</dd>
              </div>
            </div>

            {/* Photos */}
            {selectedTask.listing.photos && selectedTask.listing.photos.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Listing Photos</h4>
                <div className="grid grid-cols-4 gap-2">
                  {(showAllPhotos ? selectedTask.listing.photos : selectedTask.listing.photos.slice(0, 4)).map((p: any, i: number) => (
                    <div
                      key={p.id}
                      onClick={() => openPhoto(selectedTask.listing.photos!, i)}
                      className="aspect-video rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <img src={p.cdnUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                {selectedTask.listing.photos.length > 4 && (
                  <button
                    onClick={() => setShowAllPhotos(!showAllPhotos)}
                    className="text-xs text-primary hover:underline font-semibold mt-2 block"
                  >
                    {showAllPhotos ? "Show Less" : `Show All ${selectedTask.listing.photos.length} Photos`}
                  </button>
                )}
              </div>
            )}

            {/* Documents */}
            {loadingDetail ? (
              <div className="h-20 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
              </div>
            ) : detail?.documents && detail.documents.length > 0 ? (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Compliance Documents</h4>
                <div className="space-y-2">
                  {detail.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{docLabel(doc.documentType)}</p>
                        <p className="text-xs text-slate-400 uppercase font-mono">{doc.fileType} · Uploaded {formatDate(doc.uploadedAt)}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={loadingDocId === doc.id}
                        onClick={() => openDoc(selectedTask.listing.id, doc.id, doc.documentType, doc.fileType)}
                      >
                        View Document
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Compliance Documents</h4>
                <p className="text-xs text-slate-400 italic">No verification documents uploaded for this listing.</p>
              </div>
            )}
          </div>
        )}
      </SlideDrawer>

      {/* Escalation Modal */}
      <ActionModal
        open={escalationModal}
        onClose={() => setEscalationModal(false)}
        title="Escalate Review Task"
        description="Flag this moderation task to senior admins for priority intervention."
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEscalationModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              loading={escalateMut.isPending}
              onClick={() => selectedTask && escalateMut.mutate({ taskId: selectedTask.id, reason: escalationReason })}
            >
              Escalate
            </Button>
          </>
        }
      >
        <Textarea
          id="esc-reason"
          label="Escalation Reason"
          placeholder="Explain why this task requires senior escalation..."
          value={escalationReason}
          onChange={(e) => setEscalationReason(e.target.value)}
          rows={3}
        />
      </ActionModal>

      {/* Decision Modal */}
      <ActionModal
        open={!!resolveType}
        onClose={() => setResolveType(null)}
        title={resolveType ? `Action: ${slugToLabel(resolveType)}` : ""}
        description={
          resolveType === "unblock_warning"
            ? "Reactivate the listing on the platform and issue a formal warning notification to the provider."
            : resolveType === "unblock_no_warning"
              ? "Reactivate the listing immediately. This overrides the suspension without warnings."
              : resolveType === "keep_suspended"
                ? "Maintain the active suspension status and request clarifications or fixes from the provider."
                : "Permanently ban this listing from the ZikaBooking platform. This action is irreversible."
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setResolveType(null)}>Cancel</Button>
            <Button
              variant={resolveType === "ban" ? "danger" : "primary"}
              size="sm"
              loading={resolveMut.isPending}
              disabled={(resolveType === "unblock_no_warning" || resolveType === "keep_suspended" || resolveType === "ban") && !adminNote.trim()}
              onClick={() =>
                selectedTask &&
                resolveMut.mutate({
                  taskId: selectedTask.id,
                  decision: resolveType!,
                  note: adminNote,
                })
              }
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {resolveType === "unblock_warning" && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-800">
              This will automatically reset the consecutive negative review counters for the listing back to 0.
            </div>
          )}

          {resolveType !== "unblock_warning" && (
            <Textarea
              id="resolve-note"
              label="Internal Note / Action Log"
              required
              placeholder={
                resolveType === "keep_suspended"
                  ? "Detail the suspension conditions and items requested from the provider..."
                  : "Detail the justification for this action..."
              }
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
            />
          )}
        </div>
      </ActionModal>

      {/* Lightbox photo viewer */}
      {photoLightbox && (
        <PhotoLightbox
          photos={photoLightbox.photos}
          currentIndex={photoLightbox.index}
          onClose={() => setPhotoLightbox(null)}
          onPrev={prevPhoto}
          onNext={nextPhoto}
          onJump={jumpPhoto}
        />
      )}

      {/* Doc viewer lightbox */}
      {docViewer && (
        <DocViewer
          url={docViewer.url}
          fileType={docViewer.fileType}
          label={docViewer.label}
          onClose={() => setDocViewer(null)}
        />
      )}

      {/* Suspend modal */}
      <ActionModal
        open={!!suspendModal}
        onClose={() => { setSuspendModal(null); setSuspendReason(""); }}
        title="Suspend listing"
        description={`Please provide a reason to suspend "${suspendModal?.name}".`}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setSuspendModal(null); setSuspendReason(""); }}>Cancel</Button>
            <Button variant="danger" disabled={!suspendReason.trim()} loading={directSuspendMut.isPending} onClick={() => suspendModal && directSuspendMut.mutate({ id: suspendModal.id, reason: suspendReason })}>Suspend</Button>
          </div>
        }
      >
        <textarea
          className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none mt-2 focus:outline-none"
          value={suspendReason}
          onChange={(e) => setSuspendReason(e.target.value)}
          placeholder="Describe the reason for suspension…"
          required
          rows={3}
        />
      </ActionModal>

      {/* Reinstate confirm */}
      <ActionModal
        open={!!reinstateConfirm}
        onClose={() => { setReinstateConfirm(null); setReinstateReason(""); }}
        title="Reinstate listing"
        description={`Provide a reason for reinstating "${reinstateConfirm?.name}"?`}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setReinstateConfirm(null); setReinstateReason(""); }}>Cancel</Button>
            <Button loading={directReinstateMut.isPending} onClick={() => reinstateConfirm && directReinstateMut.mutate({ id: reinstateConfirm.id, reason: reinstateReason })}>Reinstate</Button>
          </div>
        }
      >
        <textarea
          className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none mt-2 focus:outline-none"
          value={reinstateReason}
          onChange={(e) => setReinstateReason(e.target.value)}
          placeholder="Optional reason for reinstatement…"
          rows={3}
        />
      </ActionModal>

      {/* Star rating modal */}
      <ActionModal
        open={!!starModal}
        onClose={() => { setStarModal(null); setStarReason(""); }}
        title="Update star rating"
        description={`Update verified star rating for "${starModal?.name}"`}
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => { setStarModal(null); setStarReason(""); }}>Cancel</Button>
            <Button loading={directStarMut.isPending} onClick={() => starModal && directStarMut.mutate({ id: starModal.id, starRating: newStar, reason: starReason })}>Update</Button>
          </div>
        }
      >
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Star Rating</label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:outline-none"
              value={newStar}
              onChange={(e) => setNewStar(e.target.value)}
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <option key={s} value={s}>{s}★</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Reason / Context</label>
            <textarea
              className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none focus:outline-none"
              value={starReason}
              onChange={(e) => setStarReason(e.target.value)}
              placeholder="Provide a reason for the star rating update..."
              rows={3}
            />
          </div>
        </div>
      </ActionModal>
    </div>
  );
}
