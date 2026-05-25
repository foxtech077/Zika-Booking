"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number; // percentage
  icon?: ReactNode;
  color?: "blue" | "emerald" | "amber" | "violet" | "rose" | "cyan";
  loading?: boolean;
}

const COLOR_MAP = {
  blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    value: "text-blue-700" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", value: "text-emerald-700" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   value: "text-amber-700" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  value: "text-violet-700" },
  rose:    { bg: "bg-rose-50",    icon: "text-rose-600",    value: "text-rose-700" },
  cyan:    { bg: "bg-cyan-50",    icon: "text-cyan-600",    value: "text-cyan-700" },
};

export function StatCard({ title, value, subtitle, trend, icon, color = "blue", loading }: StatCardProps) {
  const colors = COLOR_MAP[color];
  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-5 card-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-slate-100 rounded-lg mt-1.5 animate-shimmer" />
          ) : (
            <p className={cn("text-2xl font-bold mt-1 tabular-nums", colors.value)}>
              {value}
            </p>
          )}
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-xs font-medium",
              trend > 0 ? "text-success" : trend < 0 ? "text-danger" : "text-slate-400"
            )}>
              {trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : trend < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              {Math.abs(trend)}% vs last month
            </div>
          )}
        </div>
        {icon && (
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 shrink-0", colors.bg, colors.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Revenue Area Chart ─────────────────────────────────────────────────────────

interface RevenueData {
  month: string;
  revenue: number;
  bookings?: number;
}

interface RevenueAreaChartProps {
  data: RevenueData[];
  currency?: string;
  height?: number;
}

export function RevenueAreaChart({ data, currency = "USD", height = 220 }: RevenueAreaChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatMonthLabel(d.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#0284c7" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
          formatter={(v: any) => [formatCurrency(Number(v ?? 0), currency), "Revenue"]}
        />
        <Area type="monotone" dataKey="revenue" stroke="#0284c7" strokeWidth={2.5}
          fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: "#0284c7" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

interface RevenueBarChartProps {
  data: Array<{ label: string; revenue: number; bookings?: number }>;
  currency?: string;
  height?: number;
}

export function RevenueBarChart({ data, currency = "USD", height = 200 }: RevenueBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
          formatter={(v: any) => [formatCurrency(Number(v ?? 0), currency), "Revenue"]}
        />
        <Bar dataKey="revenue" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
}

export function DonutChart({ data, height = 200 }: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={78}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ fontSize: 11, color: "#64748b" }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Rating Stars ──────────────────────────────────────────────────────────────

export function RatingStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-3.5 h-3.5" : "w-4.5 h-4.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={cn(sz, s <= Math.round(rating) ? "text-amber-400" : "text-slate-200")} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.449a1 1 0 00-1.175 0l-3.37 2.449c-.785.57-1.84-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.381-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </div>
  );
}
