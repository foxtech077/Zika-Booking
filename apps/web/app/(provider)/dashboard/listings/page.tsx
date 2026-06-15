"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Eye, Edit3, Trash2, CheckCircle,
  XCircle, ArrowUpRight, Hotel, Car, Home,
} from "lucide-react";
import Link from "next/link";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { ConfirmModal, Modal } from "@/components/modals/Modals";
import { formatDate, formatCurrency, slugToLabel } from "@/lib/utils";
import type { Listing, ListingCategory } from "@/types/provider";
import { useAuthStore } from "@/stores/auth";

const TOKEN_KEY = "zika:access_token";

const getAuthToken = (storeToken: string | null) =>
  storeToken ??
  (typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null);

const getAuthConfig = (storeToken: string | null) => {
  const token = getAuthToken(storeToken);
  if (!token) throw new Error("AUTH_REQUIRED");
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
  return { headers: { Authorization: `Bearer ${token}` } };
};

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Session expired. Please sign in again.");
      const accessToken =
        body?.data?.tokens?.accessToken ??
        body?.tokens?.accessToken ??
        body?.data?.accessToken ??
        body?.accessToken;
      if (!accessToken) throw new Error("Refresh succeeded, but no access token was returned.");
      if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, accessToken);
      const { user, setSession } = useAuthStore.getState();
      if (user) setSession(accessToken, user);
      return accessToken as string;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const withTokenRefresh = async <T,>(
  request: (tokenOverride: string | null) => Promise<T>,
  currentToken: string | null,
) => {
  try {
    return await request(currentToken);
  } catch (err: any) {
    if (err?.response?.status !== 401) throw err;
    const freshToken = await refreshAccessToken();
    return request(freshToken);
  }
};

const fetchListings = (params: Record<string, string>, token: string | null) =>
  withTokenRefresh(
    (tokenOverride) =>
      listingApi
        .get(`/listings?${new URLSearchParams(Object.entries(params).filter(([, value]) => value))}`, getAuthConfig(tokenOverride))
        .then((r) => r.data.data ?? r.data),
    token,
  );

const getListingTitle = (listing: Listing | any) =>
  listing?.listingTitle ?? listing?.name ?? "";

const getPhotoUrl = (photo: any) =>
  photo?.cdnUrl ?? photo?.url ?? photo?.publicUrl ?? photo?.src ?? "";

const getListingId = (listing: Listing | any) =>
  listing?.id ?? listing?.listingId ?? listing?._id ?? "";

const unwrapListingId = (payload: any): string | null =>
  payload?.data?.id ??
  payload?.id ??
  payload?.data?.listing?.id ??
  payload?.listing?.id ??
  payload?.listingId ??
  null;

function CategoryIcon({ category }: { category: ListingCategory }) {
  if (category === "hotel")     return <Hotel className="w-4 h-4 text-blue-500" />;
  if (category === "car")       return <Car className="w-4 h-4 text-amber-500" />;
  return <Home className="w-4 h-4 text-emerald-500" />;
}

function canSubmit(listing: Listing) {
  return listing.category === "hotel" && ["draft", "rejected"].includes(listing.status);
}
function canActivate(listing: Listing) {
  return ["apartment", "car"].includes(listing.category) && ["draft", "deactivated"].includes(listing.status);
}
function canDeactivate(status: string) { return ["active", "approved"].includes(status); }
function canDelete(status: string)     { return status === "draft"; }
function actionForStatus(action: string, status: string) {
  return action === "activate" && status === "deactivated" ? "reactivate" : action;
}

function getActivationLabel(status: string) {
  return status === "deactivated" ? "Reactivate" : "Activate Live";
}

function getActivationTitle(status: string) {
  return status === "deactivated" ? "Reactivate listing?" : "Activate listing?";
}

function getActivationMessage(status: string) {
  return status === "deactivated"
    ? "This listing will go live again and be visible to guests."
    : "This listing will be activated and visible to guests.";
}

const getListingPrice = (listing: Listing | any) =>
  listing.category === "car"
    ? listing.pricePerDay ?? listing.dailyRate ?? listing.pricePerNight
    : listing.pricePerNight ?? listing.nightlyRate;

const getPriceLabel = (listing: Listing | any) =>
  listing.category === "car" ? "Price / Day" : "Price / Night";

const formatListingPrice = (listing: Listing | any) => {
  const price = getListingPrice(listing);
  return price ? formatCurrency(Number(price), listing.currency ?? "USD") : "—";
};

const formatReviewRating = (listing: Listing | any) =>
  listing.starRating ? `⭐ ${listing.starRating}★` : "No reviews yet";

export default function ListingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(5);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; listing: Listing } | null>(null);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (token && typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
  }, [token]);

  const hasClientFilters = Boolean(search.trim() || category);
  const limit = hasClientFilters ? 50 : pageSize;
  const page = Math.floor(offset / limit) + 1;
  const params = { status, page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["provider-listings", params, Boolean(getAuthToken(token))],
    queryFn:  () => fetchListings(params, token),
  });

  const { data: fullSelectedQuery, isLoading: isLoadingFull } = useQuery({
    queryKey: ["provider-listing", selected?.id, Boolean(getAuthToken(token))],
    queryFn: () => withTokenRefresh(
      (tokenOverride) => listingApi.get(`/listings/${selected?.id}`, getAuthConfig(tokenOverride)).then(r => r.data.data ?? r.data),
      token
    ),
    enabled: !!selected?.id,
  });

  const fullSelected = fullSelectedQuery || selected;

  const listings: Listing[] = data?.listings ?? [];
  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesCategory = !category || listing.category === category;
      const name = (getListingTitle(listing) || "").toLowerCase();
      const matchesSearch = !q || name.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [category, listings, search]);
  const total: number = hasClientFilters ? filteredListings.length : data?.total ?? 0;
  const resetToFirstPage = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setOffset(0);
  };

  const actionMutation = useMutation({
    mutationFn: ({ action, id }: { action: string; id: string }) =>
      withTokenRefresh(
        (tokenOverride) => listingApi.post(`/listings/${id}/${action}`, undefined, getAuthConfig(tokenOverride)),
        token,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      qc.invalidateQueries({ queryKey: ["provider-dashboard"] });
      setConfirm(null);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      withTokenRefresh(
        (tokenOverride) => listingApi.delete(`/listings/${id}`, getAuthConfig(tokenOverride)),
        token,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      setConfirm(null);
      setSelected(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (cat: ListingCategory) =>
      withTokenRefresh(
        (tokenOverride) =>
          listingApi.post("/listings", { category: cat }, getAuthConfig(tokenOverride)).then((r) => r.data),
        token,
      ),
    onSuccess: (data) => {
      const id = unwrapListingId(data);
      if (!id) {
        setCreateError("Listing was created, but the server did not return a listing id. Please refresh the listings page.");
        return;
      }
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      router.push(`/dashboard/listings/${id}/edit`);
    },
    onError: (err: any) => {
      if (err.message === "AUTH_REQUIRED") {
        setCreateError("Authentication required. Please sign in again as a provider.");
        router.replace("/auth/login");
        return;
      }
      setCreateError(err.response?.data?.error?.message ?? "Failed to create listing. Please try again.");
    },
  });

  const columns: Column<Listing>[] = [
    {
      key: "listing",
      label: "Listing",
      width: "300px",
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
            {getPhotoUrl(l.photos?.[0]) ? (
              <img src={getPhotoUrl(l.photos?.[0])} alt={getListingTitle(l)} className="w-full h-full object-cover" />
            ) : (
              <CategoryIcon category={l.category} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{getListingTitle(l) || "(Untitled)"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CategoryIcon category={l.category} />
              <span className="text-xs text-slate-500 capitalize">{l.category}</span>
              {l.town && <span className="text-xs text-slate-400">· {l.town}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (l) => <Badge label={l.status} status={l.status} dot />,
    },
    {
      key: "price",
      label: "Price",
      render: (l) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">{formatListingPrice(l)}</p>
          <p className="text-[11px] text-slate-400">{l.category === "car" ? "per day" : "per night"}</p>
        </div>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      render: (l) => (
        <span className="text-sm text-slate-600">
          {formatReviewRating(l)}
        </span>
      ),
    },
    {
      key: "updated",
      label: "Updated",
      render: (l) => <span className="text-xs text-slate-400">{formatDate(l.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (l) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelected(l)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface-muted hover:text-slate-700 transition-all"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {l.status !== "pending_review" && (
            <Link href={`/dashboard/listings/${getListingId(l)}/edit`}>
              <button
                disabled={!getListingId(l)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface-muted hover:text-slate-700 transition-all"
                title="Edit Listing"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </Link>
          )}
          {canDelete(l.status) && (
            <button
              onClick={() => setConfirm({ action: "delete", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-danger-light hover:text-danger transition-all"
              title="Delete Draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canActivate(l) && (
            <button
              onClick={() => setConfirm({ action: "activate", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-success-light hover:text-success transition-all"
              title={getActivationLabel(l.status)}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {canDeactivate(l.status) && (
            <button
              onClick={() => setConfirm({ action: "deactivate", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-warning-light hover:text-warning transition-all"
              title="Deactivate"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {canSubmit(l) && (
            <button
              onClick={() => setConfirm({ action: "submit", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-primary-50 hover:text-primary transition-all"
              title="Submit for review"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const isActing = actionMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="My Listings"
        subtitle={`${total} listing${total !== 1 ? "s" : ""} in your portfolio`}
        action={
          <div className="flex gap-2">
            {(["hotel", "apartment", "car"] as ListingCategory[]).map((cat) => (
              <Button
                key={cat}
                variant="outline"
                size="sm"
                onClick={() => { setCreateError(""); createMutation.mutate(cat); }}
                loading={createMutation.isPending}
                icon={<Plus />}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ))}
          </div>
        }
      />

      {createError && (
        <div className="rounded-xl border border-danger/20 bg-danger-50 px-4 py-3 text-sm text-danger-dark">
          {createError}
        </div>
      )}

      <Card padding="none">
        <div className="p-4 border-b border-border">
          <FilterBar
            search={search}
            onSearch={resetToFirstPage(setSearch)}
            searchPlaceholder="Search listings…"
            filters={[
              {
                key: "status",
                value: status,
                onChange: resetToFirstPage(setStatus),
                placeholder: "All statuses",
                options: [
                  { value: "draft",          label: "Draft" },
                  { value: "pending_review", label: "Pending Review" },
                  { value: "approved",       label: "Approved" },
                  { value: "active",         label: "Active" },
                  { value: "deactivated",    label: "Deactivated" },
                  { value: "rejected",       label: "Rejected" },
                  { value: "suspended",      label: "Suspended" },
                ],
              },
              {
                key: "category",
                value: category,
                onChange: resetToFirstPage(setCategory),
                placeholder: "All categories",
                options: [
                  { value: "hotel",     label: "Hotel" },
                  { value: "apartment", label: "Apartment" },
                  { value: "car",       label: "Car" },
                ],
              },
            ]}
            actions={
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Per page</label>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setOffset(0); }}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  {[5,10,15,20,25,30].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            }
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredListings}
          keyExtractor={(l) => getListingId(l)}
          loading={isLoading}
          emptyTitle="No listings yet"
          emptyMessage={hasClientFilters ? "No listings match the selected filters." : "Create your first listing using the buttons above."}
        />

        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onOffsetChange={setOffset}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? getListingTitle(selected) || "Listing Details" : "Listing Details"}
        subtitle={selected ? `${slugToLabel(selected.category)} · ${slugToLabel(selected.status)}` : undefined}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            {selected && canSubmit(selected) && (
              <Button variant="primary" onClick={() => setConfirm({ action: "submit", listing: selected })}>
                Submit for Review
              </Button>
            )}
            {selected && canActivate(selected) && (
              <Button variant="success" onClick={() => setConfirm({ action: "activate", listing: selected })}>
                {getActivationLabel(selected.status)}
              </Button>
            )}
            {selected && canDeactivate(selected.status) && (
              <Button variant="secondary" onClick={() => setConfirm({ action: "deactivate", listing: selected })}>
                Deactivate
              </Button>
            )}
            {selected && canDelete(selected.status) && (
              <Button variant="danger" onClick={() => setConfirm({ action: "delete", listing: selected })}>
                Delete Draft
              </Button>
            )}
          </div>
        }
      >
        {selected && (
          <div className="space-y-6">
            {getPhotoUrl(selected.photos?.[0]) && (
              <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-slate-100 shadow-sm border border-border">
                <img
                  src={getPhotoUrl(selected.photos?.[0])}
                  alt={getListingTitle(selected)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <Badge label={selected.status} status={selected.status} dot />
                  <Badge label={selected.category} />
                </div>
              </div>
            )}
            
            {isLoadingFull && !fullSelectedQuery ? (
               <div className="py-8 text-center text-sm text-slate-500 animate-pulse">Loading full details...</div>
            ) : fullSelected ? (
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4 bg-slate-50 p-5 rounded-2xl border border-border/60">
                 {[
                   { label: getPriceLabel(fullSelected), value: formatListingPrice(fullSelected) },
                   { label: "Location",     value: [fullSelected.town, fullSelected.country].filter(Boolean).join(", ") || "—" },
                   { label: "Min Stay",     value: fullSelected.minStayNights ? `${fullSelected.minStayNights} night(s)` : "—" },
                   { label: "Cancellation", value: fullSelected.cancellationPolicy ? slugToLabel(fullSelected.cancellationPolicy) : "—" },
                   
                   ...(fullSelected.category === "hotel" ? [
                      { label: "Unit Count", value: fullSelected.unitCount || "—" },
                      { label: "Room Type", value: fullSelected.roomType ? slugToLabel(fullSelected.roomType) : "—" },
                   ] : []),
                   
                   ...(fullSelected.category === "car" ? [
                      { label: "Make & Model", value: fullSelected.carMake ? `${fullSelected.carMake} ${fullSelected.carModel || ""}` : "—" },
                      { label: "Year", value: fullSelected.carYear || "—" },
                      { label: "Transmission", value: fullSelected.transmission ? slugToLabel(fullSelected.transmission) : "—" },
                   ] : []),
                   
                   ...(fullSelected.category === "apartment" ? [
                      { label: "Max Guests", value: fullSelected.maxGuests || "—" },
                      { label: "Bed / Bath", value: `${fullSelected.bedrooms ?? "-"} Bed / ${fullSelected.bathrooms ?? "-"} Bath` },
                      { label: "Apt Type", value: fullSelected.apartmentType ? slugToLabel(fullSelected.apartmentType) : "—" },
                   ] : []),
                   
                   { label: "Created",      value: formatDate(fullSelected.createdAt) },
                   { label: "Updated",      value: formatDate(fullSelected.updatedAt) },
                 ].map((d, idx) => (
                   <div key={idx}>
                     <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{d.label}</p>
                     <p className="text-sm text-slate-900 font-medium">{d.value}</p>
                   </div>
                 ))}
               </div>
            ) : null}

            {fullSelected?.description && (
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{fullSelected.description}</p>
              </div>
            )}

            {fullSelected?.rejectionReasons?.length > 0 && (
              <div className="bg-danger-light border border-danger/20 rounded-xl p-4 mt-4">
                <p className="text-sm font-semibold text-danger mb-1">Rejection Reasons</p>
                <ul className="list-disc pl-4 space-y-1">
                  {fullSelected.rejectionReasons.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-danger-dark">{r}</li>
                  ))}
                </ul>
                {fullSelected.rejectionNote && (
                  <p className="text-xs text-danger-dark mt-2 border-t border-danger/20 pt-2">
                    {fullSelected.rejectionNote}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.action === "delete") {
            deleteMutation.mutate(confirm.listing.id);
          } else {
            actionMutation.mutate({
              action: actionForStatus(confirm.action, confirm.listing.status),
              id: confirm.listing.id,
            });
          }
        }}
        title={
          confirm?.action === "delete"     ? "Delete listing?" :
          confirm?.action === "submit"     ? "Submit for review?" :
          confirm?.action === "activate"   ? getActivationTitle(confirm.listing.status) :
          "Deactivate listing?"
        }
        message={
          confirm?.action === "delete"
            ? `"${getListingTitle(confirm.listing) || "This draft"}" will be permanently deleted.`
            : confirm?.action === "submit"
            ? "Your listing will be sent to our team for review. This may take up to 48 hours."
            : confirm?.action === "activate"
            ? getActivationMessage(confirm.listing.status)
            : "This listing will be hidden from guests."
        }
        variant={confirm?.action === "delete" || confirm?.action === "deactivate" ? "danger" : "primary"}
        confirmLabel={
          confirm?.action === "delete"     ? "Delete" :
          confirm?.action === "submit"     ? "Submit" :
          confirm?.action === "activate"   ? getActivationLabel(confirm.listing.status) :
          "Deactivate"
        }
        loading={isActing}
      />
    </div>
  );
}

