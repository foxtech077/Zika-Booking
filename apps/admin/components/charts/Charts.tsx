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
    <div className="bg-white rounded-xl border border-[#008A3A]/10 hover:border-[#4CCB2A]/40 transition-all duration-200 p-5 card-hover">
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
          tick={{ fontSize: 11, fill: "#4B6B41" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#4B6B41" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(v, currency, { maximumFractionDigits: 0, notation: "compact" })}
          width={60}
        />
        <Tooltip
          contentStyle={{
            border: "1px solid #D1F0D1",
            borderRadius: "8px",
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
          }}
        formatter={(value, name) => [
            typeof value === "number" && name === "revenue" ? formatCurrency(value, currency) : (value ?? 0),
            name === "revenue" ? "Revenue" : "Bookings",
          ]}
        />
        <Bar dataKey="revenue" fill="#008A3A" radius={[4, 4, 0, 0]} />
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

export function DonutChart({ data, height = 220, innerLabel, innerValue }: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            border: "1px solid #D1F0D1",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(v) => [typeof v === "number" ? formatNumber(v) : String(v ?? ""), ""]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
