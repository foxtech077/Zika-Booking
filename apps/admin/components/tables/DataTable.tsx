"use client";

import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/Avatar";
import { ChevronUp, ChevronDown } from "lucide-react";

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
  /** When provided, renders a page-size dropdown (10 / 20 / 30 / 40) */
  onLimitChange?: (limit: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40];

export function Pagination({ page, limit, total, onPageChange, onLimitChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  if (totalPages <= 1 && !onLimitChange) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500">
          Showing <span className="font-medium">{from}–{to}</span> of{" "}
          <span className="font-medium">{total.toLocaleString()}</span> results
        </p>
        {onLimitChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">·</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="py-1 pl-2 pr-6 text-xs bg-white border border-border rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary appearance-none cursor-pointer transition-colors"
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex gap-1">
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
      )}
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
}

export function FilterBar({
  search, onSearchChange, searchPlaceholder = "Search…", filters, actions, children
}: FilterBarProps) {
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
      {filters?.map((f) => (
        <select
          key={f.key}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="py-1.5 pl-3 pr-7 text-sm bg-white border border-border rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary appearance-none transition-colors"
          aria-label={f.label}
        >
          <option value="">{f.label}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}
      {children}
      {actions && <div className="ml-auto flex gap-2">{actions}</div>}
    </div>
  );
}
