"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, Building2, ShieldOff, ShieldCheck, ChevronRight, Star, Hotel, Car, Home, Edit } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { SlideDrawer } from "@/components/drawers/SlideDrawer";
import { ActionModal, ConfirmModal } from "@/components/modals/Modals";
import { formatDate, formatRelativeTime, formatCurrency, cn } from "@/lib/utils";
import type { Listing } from "@/types/admin";
import { useAuthStore } from "@/stores/auth";
import { SYSTEM_COUNTRIES, getCountryFlag } from "@/lib/countries";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

function CategoryIcon({ category }: { category: string }) {
  if (category === "hotel") return <Hotel className="w-4 h-4 text-blue-500" />;
  if (category === "car") return <Car className="w-4 h-4 text-amber-500" />;
  return <Home className="w-4 h-4 text-emerald-500" />;
}

const fetchListings = (params: Record<string, string>) =>
  listingApi.get("/admin/listings", { params }).then((r) => r.data.data ?? r.data);

export default function ListingsPage() {
  const { token, user, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const isCountryManager = user?.role === "country_manager";
  const scopedCountries = isCountryManager ? (user?.countryScope ?? []) : [];
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");

  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".listings-country-dropdown")) {
        setIsCountryOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const filteredCountries = isCountryManager
    ? scopedCountries.map((code) => {
        const found = SYSTEM_COUNTRIES.find((sc) => sc.code.toUpperCase() === code.toUpperCase());
        if (found) return found;
        const name = countries.getName(code, "en") || code;
        return {
          code: code.toUpperCase(),
          name,
          flag: getCountryFlag(code),
        };
      })
    : SYSTEM_COUNTRIES;

  const [selected, setSelected] = useState<Listing | null>(null);
  const [suspendModal, setSuspendModal] = useState<Listing | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [reinstateConfirm, setReinstateConfirm] = useState<Listing | null>(null);
  const [reinstateReason, setReinstateReason] = useState("");
  const [starModal, setStarModal] = useState<Listing | null>(null);
  const [newStar, setNewStar] = useState("3");
  const [starReason, setStarReason] = useState("");
 
  const params = { q, status, category, country, page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-listings", page, limit, q, status, category, country],
    queryFn: () => fetchListings(params),
    enabled: !!token && _hasHydrated,
  });

  const rawListings: Listing[] = data?.listings ?? [];
  const listings = isCountryManager && scopedCountries.length > 0
    ? rawListings.filter((l) => {
        const listingCountry = l.country?.toUpperCase();
        return listingCountry ? scopedCountries.some((sc) => sc.toUpperCase() === listingCountry) : false;
      })
    : rawListings;
  const total: number = data?.total ?? 0;

  const offset = (page - 1) * limit;
  const requestUrl = `/admin/listings?${new URLSearchParams(params)}`;
  const responseCount = data?.listings?.length ?? 0;
  const renderedRows = listings.length;
  console.log("ListingsPage Pagination Debug:", {
    page,
    limit,
    offset,
    params,
    queryKey: ["admin-listings", page, limit, q, status, category, country],
    requestUrl,
    responseCount,
    renderedRows,
  });

  const suspendMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      listingApi.post(`/admin/listings/${id}/suspend`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); setSuspendModal(null); setSuspendReason(""); },
  });

  const reinstateMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      listingApi.post(`/admin/listings/${id}/reinstate`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); setReinstateConfirm(null); setReinstateReason(""); },
  });

  const starMut = useMutation({
    mutationFn: ({ id, starRating, reason }: any) =>
      listingApi.patch(`/admin/listings/${id}/star-rating`, { starRating: parseInt(starRating), reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); setStarModal(null); setStarReason(""); },
  });

  const columns: Column<Listing>[] = [
    {
      key: "name",
      label: "Listing",
      width: "300px",
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
            {l.photos?.[0]?.cdnUrl ? (
              <img src={l.photos[0].cdnUrl} alt={l.name ?? ""} className="w-full h-full object-cover" />
            ) : (
              <CategoryIcon category={l.category} />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{l.name ?? "(Untitled)"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CategoryIcon category={l.category} />
              <span className="text-xs text-slate-500 capitalize">{l.category}</span>
              {l.town && <span className="text-xs text-slate-400">· {l.town}, {l.country}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (l) => <Badge label={l.status} status={l.status} />,
    },
    {
      key: "stars",
      label: "Stars",
      render: (l) => (
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          <span className="text-sm text-slate-700">{l.starRating ?? l.claimedStarRating ?? "—"}</span>
          {l.starRating !== l.claimedStarRating && l.claimedStarRating && (
            <span className="text-xs text-slate-400">(claimed: {l.claimedStarRating})</span>
          )}
        </div>
      ),
    },
    {
      key: "price",
      label: "Price",
      align: "right",
      render: (l) => {
        const price = l.pricePerNight ?? l.pricePerDay;
        const suffix = l.category === "car" ? "/day" : "/night";
        return (
          <span className="text-sm tabular">
            {price ? `${formatCurrency(Number(price), l.currency ?? "USD")}${suffix}` : "—"}
          </span>
        );
      },
    },
    {
      key: "approved",
      label: "Approved",
      render: (l) => <span className="text-xs text-slate-500">{formatDate(l.approvedAt)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: "120px",
      render: (l) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => router.push(`/dashboard/listings/${l.id}`)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            title="Edit / Review"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          {l.category === "hotel" && l.status === "approved" && (
            <button
              onClick={() => setStarModal(l)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
              title="Update star rating"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          {["approved", "active"].includes(l.status) && (
            <button
              onClick={() => setSuspendModal(l)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-warning hover:bg-warning/5 transition-colors"
              title="Suspend"
            >
              <ShieldOff className="h-3.5 w-3.5" />
            </button>
          )}
          {l.status === "suspended" && (
            <button
              onClick={() => setReinstateConfirm(l)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-success hover:bg-success/5 transition-colors"
              title="Reinstate"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 max-w-screen-xl">
      <SectionHeader
        title="Listings"
        description={`${total.toLocaleString()} total listings`}
      />

      <Card padding="none">
        <FilterBar
          search={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Search name or town…"
          filters={[
            {
              key: "status",
              label: "All Statuses",
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: "pending_review", label: "Pending Review" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "active", label: "Active" },
                { value: "suspended", label: "Suspended" },
                { value: "auto_suspended", label: "Auto-Suspended" },
              ],
            },
            {
              key: "category",
              label: "All Categories",
              value: category,
              onChange: (v) => { setCategory(v); setPage(1); },
              options: [
                { value: "hotel", label: "Hotel" },
                { value: "apartment", label: "Apartment" },
                { value: "car", label: "Car" },
              ],
            },
            {
              key: "country",
              label: "All Countries",
              value: country,
              onChange: (v) => { setCountry(v); setPage(1); },
              options: filteredCountries.map((c) => ({
                value: c.code,
                label: `${c.flag} ${c.name}`,
              })),
            },
          ]}
          limit={limit}
          onLimitChange={(newL) => { setLimit(newL); setPage(1); }}
        />
        <DataTable
          columns={columns}
          data={listings}
          loading={isLoading}
          onRowClick={(l) => setSelected(l)}
          emptyTitle="No listings found"
          emptyDescription="Try adjusting your search or filters."
          emptyIcon={<Building2 className="h-10 w-10" />}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </Card>

      {/* Detail drawer */}
      <SlideDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? "Listing"}
        width="sm"
        footer={
          selected && (
            <div className="flex justify-end w-full">
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push(`/dashboard/listings/${selected.id}`)}
              >
                Edit / Review Details
              </Button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            {selected.photos?.[0]?.cdnUrl && (
              <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                <img
                  src={selected.photos[0].cdnUrl}
                  alt={selected.name ?? ""}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <dl className="space-y-3 text-sm">
              {[
                ["ID", selected.id],
                ["Category", selected.category],
              ["Status", selected.status],
              ["Country", selected.country ?? "—"],
              ["Town", selected.town ?? "—"],
              ["Star Rating", selected.starRating ?? "—"],
              ["Claimed Stars", selected.claimedStarRating ?? "—"],
              ["Price/Night", selected.pricePerNight ? formatCurrency(Number(selected.pricePerNight), selected.currency ?? "USD") : "—"],
              ["Submissions", selected.submissionCount],
              ["Provider ID", selected.providerId],
              ["Approved", formatDate(selected.approvedAt)],
              ["Rejected", formatDate(selected.rejectedAt)],
              ["Suspended", formatDate(selected.suspendedAt)],
              ["Created", formatDate(selected.createdAt)],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4">
                <dt className="text-slate-500 flex-shrink-0">{k}</dt>
                <dd className="text-slate-900 font-medium text-right truncate">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      </SlideDrawer>

      {/* Suspend modal */}
      <ActionModal
        open={!!suspendModal}
        onClose={() => { setSuspendModal(null); setSuspendReason(""); }}
        title="Suspend listing"
        description={`Suspend "${suspendModal?.name}"? This will remove it from search.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSuspendModal(null)}>Cancel</Button>
            <Button
              variant="danger" size="sm"
              loading={suspendMut.isPending}
              onClick={() => suspendModal && suspendMut.mutate({ id: suspendModal.id, reason: suspendReason })}
            >
              Suspend
            </Button>
          </>
        }
      >
        <Textarea
          id="suspend-reason"
          label="Suspension reason"
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
            <Button loading={reinstateMut.isPending} onClick={() => reinstateConfirm && reinstateMut.mutate({ id: reinstateConfirm.id, reason: reinstateReason })}>Reinstate</Button>
          </div>
        }
      >
        <textarea
          className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none mt-2"
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
          <>
            <Button variant="secondary" size="sm" onClick={() => setStarModal(null)}>Cancel</Button>
            <Button
              variant="primary" size="sm"
              loading={starMut.isPending}
              onClick={() => starModal && starMut.mutate({ id: starModal.id, starRating: newStar, reason: starReason })}
            >
              Update Rating
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            id="new-star"
            label="New Star Rating"
            value={newStar}
            onChange={(e) => setNewStar(e.target.value)}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} ★` }))}
          />
          <Textarea
            id="star-reason"
            label="Reason for change"
            value={starReason}
            onChange={(e) => setStarReason(e.target.value)}
            placeholder="e.g. Re-inspection confirmed downgrade…"
            required
          />
        </div>
      </ActionModal>
    </div>
  );
}
