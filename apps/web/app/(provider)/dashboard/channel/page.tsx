"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe2, RefreshCw, Plus, Trash2, CheckCircle, AlertCircle, Link2 } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal, ConfirmModal } from "@/components/modals/Modals";
import { Input, Select } from "@/components/ui/Input";
import { formatRelativeTime } from "@/lib/utils";
import type { Listing, IcalFeed } from "@/types/provider";

const fetchListings = () =>
  listingApi
    .get("/listings?status=active&limit=50")
    .then((r) => (r.data.data ?? r.data).listings ?? []);

const fetchFeeds = (listingId: string) =>
  listingApi
    .get(`/listings/${listingId}/ical-feeds`)
    .then((r) => r.data.data?.feeds ?? []);

const PLATFORMS = [
  { value: "airbnb",      label: "Airbnb" },
  { value: "booking.com", label: "Booking.com" },
  { value: "expedia",     label: "Expedia" },
  { value: "vrbo",        label: "VRBO" },
  { value: "other",       label: "Other" },
];

export default function ChannelPage() {
  const qc = useQueryClient();
  const [selectedListing, setSelectedListing] = useState<string>("");
  const [addModal, setAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ platform: "airbnb", feedUrl: "" });
  const [formErr, setFormErr] = useState<string | null>(null);

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["provider-channel-listings"],
    queryFn:  fetchListings,
  });

  const { data: feeds = [], isLoading: feedsLoading } = useQuery<IcalFeed[]>({
    queryKey: ["provider-ical-feeds", selectedListing],
    queryFn:  () => selectedListing ? fetchFeeds(selectedListing) : [],
    enabled:  !!selectedListing,
  });

  const addFeedMutation = useMutation({
    mutationFn: (payload: { platform: string; feedUrl: string }) =>
      listingApi.post(`/listings/${selectedListing}/ical-feeds`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-ical-feeds", selectedListing] });
      setAddModal(false);
      setForm({ platform: "airbnb", feedUrl: "" });
    },
    onError: (err: any) => {
      setFormErr(err?.response?.data?.error?.message ?? "Failed to add feed.");
    },
  });

  const deleteFeedMutation = useMutation({
    mutationFn: (feedId: string) =>
      listingApi.delete(`/listings/${selectedListing}/ical-feeds/${feedId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-ical-feeds", selectedListing] });
      setDeleteConfirm(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: (feedId: string) =>
      listingApi.post(`/listings/${selectedListing}/ical-feeds/${feedId}/sync`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-ical-feeds", selectedListing] });
    },
  });

  const columns: Column<IcalFeed>[] = [
    {
      key: "platform",
      label: "Platform",
      render: (f) => (
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900 capitalize">{f.platform}</span>
        </div>
      ),
    },
    {
      key: "url",
      label: "Feed URL",
      render: (f) => (
        <code className="text-xs text-slate-500 truncate max-w-[240px] block font-mono">{f.feedUrl}</code>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (f) => (
        f.isActive
          ? <span className="flex items-center gap-1 text-success text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" /> Active</span>
          : <span className="flex items-center gap-1 text-slate-400 text-xs font-medium"><AlertCircle className="w-3.5 h-3.5" /> Inactive</span>
      ),
    },
    {
      key: "synced",
      label: "Last Sync",
      render: (f) => (
        <div>
          <p className="text-xs text-slate-600">{f.lastSyncedAt ? formatRelativeTime(f.lastSyncedAt) : "Never"}</p>
          {f.lastError && <p className="text-xs text-danger mt-0.5 truncate max-w-[140px]">{f.lastError}</p>}
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (f) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            icon={<RefreshCw />}
            onClick={() => syncMutation.mutate(f.id)}
            loading={syncMutation.isPending}
          >
            Sync
          </Button>
          <button
            onClick={() => setDeleteConfirm(f.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-danger-light hover:text-danger transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Channel Manager"
        subtitle="Sync your availability from external booking platforms via iCal"
      />

      <Card className="bg-gradient-to-r from-primary-50 to-violet-50 border-primary-100">
        <div className="flex items-start gap-4">
          <Globe2 className="w-8 h-8 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-slate-900">Prevent Double Bookings</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Connect your Airbnb, Booking.com, or VRBO calendars. We sync blocked dates every 15 minutes
              automatically so you never get a double booking.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-sm">
            <Select
              label="Select Listing"
              value={selectedListing}
              onChange={(e) => setSelectedListing(e.target.value)}
              options={listings.map((l: Listing) => ({ value: l.id, label: l.name ?? l.id }))}
              placeholder="Choose a listing to manage…"
            />
          </div>
          {selectedListing && (
            <div className="mt-6">
              <Button
                variant="primary"
                icon={<Plus />}
                onClick={() => { setAddModal(true); setFormErr(null); }}
              >
                Add iCal Feed
              </Button>
            </div>
          )}
        </div>
      </Card>

      {selectedListing && (
        <Card padding="none">
          <div className="p-5 border-b border-border">
            <CardHeader
              title="Connected Feeds"
              subtitle="iCal feeds sync every 15 minutes automatically"
              icon={<RefreshCw />}
            />
          </div>
          <DataTable
            columns={columns}
            data={feeds}
            keyExtractor={(f) => f.id}
            loading={feedsLoading}
            emptyTitle="No feeds connected"
            emptyMessage="Add your first iCal feed from Airbnb, Booking.com, or VRBO."
          />
        </Card>
      )}

      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Add iCal Feed"
        subtitle="Paste the iCal URL from your external platform"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAddModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={addFeedMutation.isPending}
              disabled={!form.feedUrl.trim()}
              onClick={() => {
                if (!form.feedUrl.trim().startsWith("http")) {
                  setFormErr("Please enter a valid URL starting with http:// or https://");
                  return;
                }
                addFeedMutation.mutate(form);
              }}
            >
              Add Feed
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formErr && (
            <div className="bg-danger-light border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">
              {formErr}
            </div>
          )}
          <Select
            label="Platform"
            value={form.platform}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            options={PLATFORMS}
          />
          <Input
            label="iCal URL"
            type="url"
            value={form.feedUrl}
            onChange={(e) => setForm((f) => ({ ...f, feedUrl: e.target.value }))}
            placeholder="https://www.airbnb.com/calendar/ical/..."
            hint="Find this in your platform's calendar export settings"
          />
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteFeedMutation.mutate(deleteConfirm)}
        title="Remove iCal Feed?"
        message="This feed will stop syncing. Existing blocked dates from this feed will be removed."
        variant="danger"
        confirmLabel="Remove"
        loading={deleteFeedMutation.isPending}
      />
    </div>
  );
}
