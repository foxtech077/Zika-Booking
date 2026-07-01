"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { ReactNode } from "react";

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  iconBg?: string;
  loading?: boolean;
  currency?: string;
}

export function StatCard({
  title, value, subValue, change, changeLabel = "vs last period",
  icon, iconBg = "bg-primary/10", loading, currency,
}: StatCardProps) {
  const isPositive = (change ?? 0) >= 0;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border p-5 animate-shimmer">
        <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
        <div className="h-8 bg-slate-200 rounded w-32 mb-2" />
        <div className="h-3 bg-slate-200 rounded w-16" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5 card-hover">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {icon && (
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconBg)}>
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular animate-count-up">
        {currency ? formatCurrency(Number(value), currency) : formatNumber(Number(value), true)}
      </p>
      {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
      {change !== undefined && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center text-xs font-semibold rounded-full px-1.5 py-0.5",
              isPositive ? "text-success-dark bg-success-light" : "text-danger-dark bg-danger-light"
            )}
          >
            {isPositive ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-xs text-slate-400">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── Revenue Bar Chart ─────────────────────────────────────────────────────────

interface RevenueDataPoint {
  label: string;
  revenue: number;
  bookings: number;
}

interface RevenueBarChartProps {
  data: RevenueDataPoint[];
  currency?: string;
  height?: number;
}

export function RevenueBarChart({ data, currency = "USD", height = 220 }: RevenueBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barSize={20} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(v, currency, { maximumFractionDigits: 0, notation: "compact" })}
          width={60}
        />
        <Tooltip
          contentStyle={{
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
          }}
        formatter={(value, name) => [
            typeof value === "number" && name === "revenue" ? formatCurrency(value, currency) : (value ?? 0),
            name === "revenue" ? "Revenue" : "Bookings",
          ]}
        />
        <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

interface DonutDataPoint {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDataPoint[];
  height?: number;
  innerLabel?: string;
  innerValue?: string;
}

export function DonutChart({ data, height = 180 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center justify-between gap-4 w-full">
      {/* Left side: Pie Chart */}
      <div className="flex-shrink-0 w-[130px]" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={52}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: 11,
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
              }}
              formatter={(v) => [typeof v === "number" ? formatNumber(v) : String(v ?? ""), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Right side: Premium Custom Legend */}
      <div className="flex-1 min-w-0 space-y-1.5 pr-2">
        {data.map((entry, index) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          return (
            <div key={index} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="font-medium text-slate-600 truncate">{entry.name}</span>
              </div>
              <div className="flex items-center gap-1.5 text-right flex-shrink-0">
                <span className="font-semibold text-slate-800 tabular">{entry.value}</span>
                <span className="text-slate-400 font-medium text-[10px] tabular">({pct.toFixed(0)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
