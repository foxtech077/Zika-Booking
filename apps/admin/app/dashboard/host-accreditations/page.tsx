"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, Eye, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ConfirmModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import type { HostAccreditation } from "@/types/admin";

type AccStatus = "pending" | "approved" | "rejected";

interface AccreditationWithUser extends HostAccreditation {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    country: string | null;
    phone: string | null;
    status: string;
    createdAt: string;
  };
}

const fetchAccreditations = (params: Record<string, string>) =>
  api.get("/admin/accreditations", { params }).then((r) => r.data.data ?? r.data);

export default function HostAccreditationsPage() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<AccreditationWithUser | null>(null);
  const [confirm, setConfirm] = useState<{ action: "approve" | "reject"; acc: AccreditationWithUser } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const params: Record<string, string> = {
    ...(status ? { status } : {}),
    page: String(page),
    limit: String(limit),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-host-accreditations", page, limit, status],
    queryFn: () => fetchAccreditations(params),
  });

  const accreditations: AccreditationWithUser[] = data?.accreditations ?? [];
  const total: number = data?.total ?? 0;

  const mutate = useMutation({
    mutationFn: ({ action, id }: { action: "approve" | "reject"; id: string }) => {
      return api.patch(`/admin/accreditations/${id}/${action}`, action === "reject" ? { reason: rejectReason } : undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-host-accreditations"] });
      setConfirm(null);
      setRejectReason("");
    },
  });

  const columns: Column<AccreditationWithUser>[] = [
    {
      key: "business",
      label: "Applicant",
      width: "280px",
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 text-sm truncate">
              {a.businessName ?? "—"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {a.user?.firstName} {a.user?.lastName} · {a.user?.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (a) => <Badge label={a.status ?? "—"} status={a.status === "pending" ? "pending_verification" : (a.status ?? undefined)} />,
    },
    {
      key: "submitted",
      label: "Submitted",
      render: (a) => <span className="text-xs text-slate-500">{formatDate(a.submittedAt)}</span>,
    },
    {
      key: "docs",
      label: "Documents",
      render: (a) =>
        a.documentsUrl ? (
          <a href={a.documentsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-medium hover:underline">
            View
          </a>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "actions",
      label: "",
      width: "160px",
      align: "right",
      render: (a) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelected(a)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            title="View"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {a.status === "pending" && (
            <>
              <button
                onClick={() => setConfirm({ action: "approve", acc: a })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-success hover:bg-success/5 transition-colors"
                title="Approve"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setConfirm({ action: "reject", acc: a })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
                title="Reject"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Host Applications"
        description={`${total.toLocaleString()} host applications`}
        action={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <BadgeCheck className="h-4 w-4" />
            <span>Host Accreditation</span>
          </div>
        }
      />

      <Card padding="none">
        <FilterBar
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ],
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={accreditations}
          loading={isLoading}
          onRowClick={(a) => setSelected(a)}
          emptyTitle="No host applications"
          emptyDescription="Applications appear here when users submit their host profile."
          emptyIcon={<BadgeCheck className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Detail drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.businessName ?? "Host application"}
        description={selected?.user?.email}
        width="sm"
        footer={
          selected?.status === "pending" && (
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                onClick={() => { setConfirm({ action: "approve", acc: selected }); setSelected(null); }}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<XCircle className="h-3.5 w-3.5" />}
                onClick={() => { setConfirm({ action: "reject", acc: selected }); setSelected(null); }}
              >
                Reject
              </Button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{selected.businessName}</p>
                <p className="text-sm text-slate-500">
                  {selected.user?.firstName} {selected.user?.lastName} · {selected.user?.email}
                </p>
                <div className="flex gap-2 mt-1.5">
                  <Badge label={selected.status ?? "—"} status={selected.status === "pending" ? "pending_verification" : (selected.status ?? undefined)} />
                </div>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                ["Registration number", selected.registrationNo ?? "—"],
                ["Tax ID", selected.taxId ?? "—"],
                ["Country", selected.user?.country ?? "—"],
                ["Phone", selected.user?.phone ?? "—"],
                ["Submitted", formatDate(selected.submittedAt, "MMM d, yyyy")],
                ["Reviewed", selected.reviewedAt ? formatRelativeTime(selected.reviewedAt) : "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4">
                  <dt className="text-slate-500 flex-shrink-0">{k}</dt>
                  <dd className="text-slate-900 font-medium text-right truncate">{v}</dd>
                </div>
              ))}
              {selected.rejectionReason && (
                <div className="rounded-lg bg-danger/5 border border-danger/20 p-3 text-danger text-xs">
                  <strong>Rejection reason:</strong> {selected.rejectionReason}
                </div>
              )}
              {selected.documentsUrl && (
                <a href={selected.documentsUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-medium text-sm hover:underline">
                  View submitted documents →
                </a>
              )}
            </dl>
          </div>
        )}
      </SlideDrawer>

      {/* Confirm action modal */}
      {(() => {
        if (!confirm) return null;
        const isReject = confirm.action === "reject";
        const canConfirm = !isReject || rejectReason.trim().length > 0;
        return (
          <ConfirmModal
            open
            onClose={() => { setConfirm(null); setRejectReason(""); }}
            onConfirm={() => confirm && canConfirm && mutate.mutate({ action: confirm.action, id: confirm.acc.id })}
            loading={mutate.isPending}
            title={isReject ? "Reject host application" : "Approve host application"}
            description={
              isReject
                ? `Reject ${confirm.acc.businessName ?? "this applicant"}'s host application? They will not be able to create listings.`
                : `Approve ${confirm.acc.businessName ?? "this applicant"}'s host application? They will be able to create listings.`
            }
            variant={isReject ? "danger" : "info"}
            confirmLabel={isReject ? "Reject application" : "Approve application"}
          >
            {isReject && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason <span className="text-danger">*</span>
                </label>
                <Textarea
                  className="w-full"
                  rows={3}
                  placeholder="Explain why the application was not approved…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  autoFocus
                />
                {!rejectReason.trim() && (
                  <p className="mt-1 text-xs text-danger">A reason is required to reject.</p>
                )}
              </div>
            )}
          </ConfirmModal>
        );
      })()}
    </div>
  );
}
