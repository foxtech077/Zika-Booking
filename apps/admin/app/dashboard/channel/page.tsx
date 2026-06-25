"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cable, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime, formatDate, truncate } from "@/lib/utils";
import type { IcalFeed } from "@/types/admin";
import { useAlert } from "@/hooks/useAlert";

const fetchFeeds = (params: Record<string, string>) =>
  listingApi.get(`/admin/ical-feeds?${new URLSearchParams(params)}`).then((r) => r.data.data ?? r.data);

export default function ChannelPage() {
  const qc = useQueryClient();
  const { showAlert } = useAlert();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isActive, setIsActive] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const params = { ...(isActive ? { isActive } : {}), page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-ical-feeds", params],
    queryFn: () => fetchFeeds(params),
  });

  const feeds: (IcalFeed & { listingName?: string; listingCategory?: string; listingCountry?: string })[] = data?.feeds ?? [];
  const total: number = data?.total ?? 0;

  const offset = (page - 1) * limit;
  const requestUrl = `/admin/ical-feeds?${new URLSearchParams(params)}`;
  const responseCount = data?.feeds?.length ?? 0;
  const renderedRows = feeds.length;
  console.log("ChannelPage Pagination Debug:", {
    page,
    limit,
    offset,
    params,
    queryKey: ["admin-ical-feeds", params],
    requestUrl,
    responseCount,
    renderedRows,
  });

  const syncMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/admin/ical-feeds/${id}/sync`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["admin-ical-feeds"] });
      setSyncingId(null);
      showAlert({ type: "success", title: "Feed Synced", message: "The iCal feed has been synchronised successfully." });
    },
    onError: () => {
      setSyncingId(null);
      showAlert({ type: "error", title: "Sync Failed", message: "Unable to sync iCal feed. Please try again." });
    },
    onMutate: (id) => setSyncingId(id),
  });

  const columns: Column<IcalFeed & { listingName?: string; listingCategory?: string; listingCountry?: string }>[] = [
    {
      key: "listing",
      label: "Listing",
      width: "200px",
      render: (f) => (
        <div>
          <p className="font-medium text-sm text-slate-900 truncate">{f.listingName ?? f.listingId}</p>
          <p className="text-xs text-slate-500 capitalize">{f.listingCategory} · {f.listingCountry}</p>
        </div>
      ),
    },
    {
      key: "platform",
      label: "Platform",
      render: (f) => (
        <span className="font-medium text-sm text-slate-700 capitalize">{f.platform}</span>
      ),
    },
    {
      key: "lastSync",
      label: "Last Synced",
      render: (f) => (
        f.lastSyncedAt ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-success flex-shrink-0" />
            <span className="text-xs text-slate-600">{formatRelativeTime(f.lastSyncedAt)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-xs text-slate-400">Never synced</span>
          </div>
        )
      ),
    },
    {
      key: "error",
      label: "Last Error",
      render: (f) => (
        f.lastError ? (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-danger flex-shrink-0" />
            <span className="text-xs text-danger-dark">{truncate(f.lastError, 40)}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (f) => (
        <Badge label={f.isActive ? "Active" : "Inactive"} status={f.isActive ? "active" : "deactivated"} />
      ),
    },
    {
      key: "feedUrl",
      label: "Feed URL",
      render: (f) => (
        <span className="font-mono text-xs text-slate-400 truncate max-w-[120px] inline-block" title={f.feedUrl}>
          {truncate(f.feedUrl, 30)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (f) => (
        <button
          onClick={(e) => { e.stopPropagation(); syncMut.mutate(f.id); }}
          disabled={syncingId === f.id}
          className="flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
          title="Manual sync"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncingId === f.id ? "animate-spin" : ""}`} />
          <span className="text-xs">Sync</span>
        </button>
      ),
    },
  ];

  const withErrors = feeds.filter((f) => f.lastError).length;
  const neverSynced = feeds.filter((f) => !f.lastSyncedAt).length;

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Channel Sync"
        description="Monitor iCal feed integrations across all listings"
        action={
          <div className="flex items-center gap-3 text-sm">
            {withErrors > 0 && (
              <div className="flex items-center gap-1.5 text-danger">
                <AlertCircle className="h-4 w-4" />
                <span>{withErrors} error{withErrors > 1 ? "s" : ""}</span>
              </div>
            )}
            {neverSynced > 0 && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="h-4 w-4" />
                <span>{neverSynced} never synced</span>
              </div>
            )}
          </div>
        }
      />

      <Card padding="none">
        <FilterBar
          filters={[
            {
              key: "isActive",
              label: "All Feeds",
              value: isActive,
              onChange: (v) => { setIsActive(v); setPage(1); },
              options: [
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={feeds}
          loading={isLoading}
          emptyTitle="No iCal feeds configured"
          emptyDescription="Listings will appear here when providers add iCal feeds."
          emptyIcon={<Cable className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
