"use client";

import { useState, type ReactNode } from "react";
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

// ── Column definition ─────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render: (row: T, index: number) => ReactNode;
}

// ── DataTable ─────────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyTitle = "No data found",
  emptyMessage = "Nothing here yet.",
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn("space-y-2 p-4", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {columns.map((_, j) => (
              <Skeleton key={j} className="h-10 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn("text-center py-16", className)}>
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Search className="w-5 h-5 text-slate-400" />
        </div>
        <p className="font-semibold text-slate-700">{emptyTitle}</p>
        <p className="text-sm text-slate-400 mt-1">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row, i) => (
            <tr
              key={keyExtractor(row)}
              className="hover:bg-surface-subtle transition-colors group"
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 align-middle">
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

interface FilterBarProps {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    key: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
  }>;
  actions?: ReactNode;
}

export function FilterBar({ search, onSearch, searchPlaceholder, filters, actions }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {onSearch !== undefined && (
        <div className="flex-1 min-w-[200px] max-w-xs">
          <Input
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder ?? "Search…"}
            leftIcon={<Search />}
          />
        </div>
      )}
      {filters?.map((f) => (
        <select
          key={f.key}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        >
          {f.placeholder && <option value="">{f.placeholder}</option>}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, onOffsetChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border mt-0">
      <p className="text-xs text-slate-500">
        Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronLeft />}
          disabled={currentPage === 1}
          onClick={() => onOffsetChange(offset - limit)}
        >
          Prev
        </Button>
        <span className="px-3 text-sm font-medium text-slate-700">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onOffsetChange(offset + limit)}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
