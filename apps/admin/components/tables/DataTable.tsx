"use client";

import { ReactNode, CSSProperties, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/Avatar";
import { ChevronUp, ChevronDown, Search } from "lucide-react";

// ── Column definition ─────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
}

// ── DataTable ─────────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string, dir: "asc" | "desc") => void;
  stickyHeader?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  skeletonRows = 8,
  onRowClick,
  emptyTitle = "No results",
  emptyDescription = "Nothing to display yet.",
  emptyIcon,
  sortKey,
  sortDir,
  onSort,
  stickyHeader,
}: DataTableProps<T>) {
  const handleSort = (key: string) => {
    if (!onSort) return;
    if (sortKey === key) {
      onSort(key, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSort(key, "asc");
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-border bg-surface-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={cn(
                  "px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide",
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                  col.sortable && "cursor-pointer select-none hover:text-slate-700 transition-colors",
                  stickyHeader && "sticky top-0 bg-surface-subtle z-10"
                )}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === "asc"
                      ? <ChevronUp className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3.5">
                    <Skeleton className="h-4" style={{ width: `${60 + Math.random() * 40}%` }} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "group transition-colors duration-100",
                  onRowClick
                    ? "cursor-pointer hover:bg-primary/[0.02]"
                    : "hover:bg-slate-50/50"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3.5 text-sm text-slate-700",
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
export function Pagination({ page, limit, total, onPageChange, onLimitChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500">
          Showing <span className="font-medium">{from}–{to}</span> of{" "}
          <span className="font-medium">{total.toLocaleString()}</span> results
        </p>
      </div>
      <div className="flex gap-1 items-center">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let p: number;
          if (totalPages <= 7) {
            p = i + 1;
          } else if (page <= 4) {
            p = i + 1;
          } else if (page >= totalPages - 3) {
            p = totalPages - 6 + i;
          } else {
            p = page - 3 + i;
          }
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 w-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors",
                p === page
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ── Table Filters ─────────────────────────────────────────────────────────────

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: {
    key: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: FilterOption[];
  }[];
  actions?: ReactNode;
  children?: ReactNode;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  actions,
  children,
  limit,
  onLimitChange,
}: FilterBarProps) {
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [filterSearches, setFilterSearches] = useState<Record<string, string>>({});
  const [isLimitOpen, setIsLimitOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".filter-dropdown-container")) {
        setOpenFilterKey(null);
      }
      if (!target.closest(".limit-dropdown-container")) {
        setIsLimitOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
      {onSearchChange && (
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-3 py-1.5 text-sm bg-white border border-border rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary w-56 transition-colors"
          />
        </div>
      )}
      {filters?.map((f) => {
        const isOpen = openFilterKey === f.key;
        const searchVal = filterSearches[f.key] || "";
        const selectedOption = f.options.find((o) => o.value === f.value);
        
        // Filter options based on search query
        const filteredOptions = f.options.filter((o) =>
          o.label.toLowerCase().includes(searchVal.toLowerCase()) ||
          o.value.toLowerCase().includes(searchVal.toLowerCase())
        );

        // Show search bar if options list is long (more than 5 options)
        const showSearch = f.options.length > 5;

        return (
          <div key={f.key} className="relative filter-dropdown-container">
            <button
              type="button"
              onClick={() => {
                setOpenFilterKey(isOpen ? null : f.key);
                // Reset search when opening/closing
                setFilterSearches((prev) => ({ ...prev, [f.key]: "" }));
              }}
              className="py-1.5 pl-3 pr-8 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors flex items-center justify-between min-w-[140px] max-w-[200px] h-[38px] relative cursor-pointer"
            >
              <span className="truncate">
                {selectedOption ? selectedOption.label : f.label}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </button>

            {isOpen && (
              <div className="absolute left-0 mt-1 w-[260px] rounded-lg border border-border bg-white shadow-lg z-50 p-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                {showSearch && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchVal}
                      onChange={(e) =>
                        setFilterSearches((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <div className="overflow-y-auto max-h-[200px] space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      f.onChange("");
                      setOpenFilterKey(null);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition-colors",
                      !f.value ? "bg-primary/5 text-primary font-semibold" : "text-slate-700"
                    )}
                  >
                    {f.label}
                  </button>
                  {filteredOptions.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        f.onChange(o.value);
                        setOpenFilterKey(null);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 transition-colors flex items-center justify-between",
                        f.value === o.value ? "bg-primary/5 text-primary font-semibold" : "text-slate-700"
                      )}
                    >
                      <span className="truncate">{o.label}</span>
                      {f.key === "country" && (
                        <span className="text-slate-400 font-mono text-[10px] ml-1">{o.value}</span>
                      )}
                    </button>
                  ))}
                  {filteredOptions.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-2">No results found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {children}
      {(onLimitChange !== undefined || actions !== undefined) && (
        <div className="ml-auto flex items-center gap-3">
          {onLimitChange && limit !== undefined && (
            <div className="flex items-center gap-2 limit-dropdown-container relative">
              <span className="text-xs text-slate-500 font-medium">Rows:</span>
              <button
                type="button"
                onClick={() => setIsLimitOpen(!isLimitOpen)}
                className="py-1.5 pl-3 pr-8 text-xs bg-white border border-border rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors h-[32px] min-w-[64px] flex items-center justify-between cursor-pointer relative"
              >
                <span>{limit}</span>
                <ChevronDown className="h-3 w-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </button>

              {isLimitOpen && (
                <div className="absolute right-0 top-full mt-1 w-20 rounded-lg border border-border bg-white shadow-lg z-50 p-1 space-y-0.5 max-h-[200px] overflow-y-auto">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        onLimitChange(size);
                        setIsLimitOpen(false);
                      }}
                      className={cn(
                        "w-full text-center py-1 text-xs rounded hover:bg-slate-100 transition-colors block font-medium",
                        limit === size ? "bg-primary/5 text-primary font-bold" : "text-slate-600"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}


