"use client";

import { useState, useEffect, useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD format
  onChange: (val: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  className?: string;
  id?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  required,
  error,
  hint,
  placeholder = "Select date...",
  minDate,
  maxDate,
  className,
  id,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // Sync calendar view month to selected value when value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Handle click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const prevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  const monthLabel = firstDay.toLocaleString("default", { month: "long", year: "numeric" });

  const toYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSelectDate = (date: Date) => {
    onChange(toYMD(date));
    setIsOpen(false);
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const isDateDisabled = (date: Date) => {
    const dateStr = toYMD(date);
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  return (
    <div className={cn("space-y-1 relative", className)} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors duration-150 h-[38px] cursor-pointer",
            error
              ? "border-danger focus:border-danger focus:ring-danger/25"
              : "border-border hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
          )}
        >
          <span className={cn("truncate", !value && "text-slate-400")}>
            {value ? formatDateLabel(value) : placeholder}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400">
            {value && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
                title="Clear date"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <CalendarDays className="h-4 w-4" />
          </div>
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1 w-[280px] rounded-xl border border-border bg-white shadow-xl z-50 p-4 space-y-3">
            {/* Header / Month Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-slate-800">{monthLabel}</span>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="text-[10px] font-semibold text-slate-400 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((date, idx) => {
                if (!date) return <div key={`pad-${idx}`} />;
                const ds = toYMD(date);
                const isSelected = value === ds;
                const isDisabled = isDateDisabled(date);

                return (
                  <button
                    key={ds}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectDate(date)}
                    className={cn(
                      "flex items-center justify-center h-8 text-xs font-medium rounded-lg transition-all select-none cursor-pointer",
                      isSelected
                        ? "bg-primary text-white font-bold ring-2 ring-primary/40"
                        : isDisabled
                        ? "text-slate-200 cursor-not-allowed"
                        : "text-slate-700 hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
