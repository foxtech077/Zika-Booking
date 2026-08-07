"use client";
import React, { useState, useEffect, useRef } from "react";

const CAL_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CAL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (y !== undefined && m !== undefined && d !== undefined && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function calcNights(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  try {
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const [ey, em, ed] = endStr.split("-").map(Number);
    if (
      sy !== undefined && sm !== undefined && sd !== undefined &&
      ey !== undefined && em !== undefined && ed !== undefined &&
      !isNaN(sy) && !isNaN(sm) && !isNaN(sd) &&
      !isNaN(ey) && !isNaN(em) && !isNaN(ed)
    ) {
      const s = new Date(sy, sm - 1, sd).getTime();
      const e = new Date(ey, em - 1, ed).getTime();
      const diff = Math.round((e - s) / 86400000);
      return Math.max(1, diff);
    }
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    const diff = Math.round((e - s) / 86400000);
    return Math.max(1, diff);
  } catch {
    return 0;
  }
}

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  label?: string;
  placeholder?: string;
  isCar?: boolean;
  minDate?: string;
  className?: string;
  variant?: "default" | "searchBar" | "minimal";
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  label = "Dates",
  placeholder = "Add dates",
  isCar = false,
  minDate = getTodayString(),
  className = "",
  variant = "default",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [selStart, setSelStart] = useState<string>(startDate || "");
  const [selEnd, setSelEnd] = useState<string>(endDate || "");

  useEffect(() => {
    setSelStart(startDate || "");
    setSelEnd(endDate || "");
    if (startDate) {
      const parts = startDate.split("-");
      if (parts.length === 3) {
        setViewYear(Number(parts[0]));
        setViewMonth(Number(parts[1]) - 1);
      }
    }
  }, [startDate, endDate]);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDayClick(d: Date) {
    const ds = calToStr(d);
    if (!selStart || (selStart && selEnd)) {
      setSelStart(ds);
      setSelEnd("");
    } else {
      if (ds <= selStart) {
        setSelStart(ds);
        setSelEnd("");
      } else {
        setSelEnd(ds);
      }
    }
  }

  function handleApply() {
    if (selStart && selEnd) {
      onChange(selStart, selEnd);
      setIsOpen(false);
    }
  }

  function handleClear() {
    setSelStart("");
    setSelEnd("");
    onChange("", "");
    setIsOpen(false);
  }

  // Build grid
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysArray: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) daysArray.push(null);
  for (let d = 1; d <= daysInMonth; d++) daysArray.push(new Date(viewYear, viewMonth, d));

  const isFilled = !!(startDate && endDate);
  const displayNights = isFilled ? calcNights(startDate, endDate) : (selStart && selEnd ? calcNights(selStart, selEnd) : 0);

  const displayText = isFilled
    ? `${fmtDisplayDate(startDate)} – ${fmtDisplayDate(endDate)} (${displayNights} ${isCar ? (displayNights !== 1 ? "days" : "day") : (displayNights !== 1 ? "nights" : "night")})`
    : placeholder;

  const isSearchBar = variant === "searchBar" || variant === "minimal";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {isSearchBar ? (
        /* Frameless searchBar trigger button — no outlined box, no chevron icon */
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center gap-2 text-left focus:outline-none group cursor-pointer"
        >
          <svg
            className="w-4 h-4 text-slate-400 group-hover:text-[#1D8D2B] transition-colors shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div className="flex-1 min-w-0">
            {label && (
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                {label}
              </p>
            )}
            <p
              className={`text-sm font-semibold truncate ${
                isFilled ? "text-slate-800 font-bold" : "text-slate-400 font-normal"
              }`}
            >
              {displayText}
            </p>
          </div>
        </button>
      ) : (
        /* Standard form trigger button with label */
        <>
          {label && (
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {label}
            </label>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 flex items-center justify-between text-left hover:border-slate-400 focus:border-[#0B1E3F] focus:outline-none transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <svg
                className="w-4 h-4 text-slate-400 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span
                className={`text-xs font-bold truncate ${
                  isFilled ? "text-slate-800" : "text-slate-400 font-normal"
                }`}
              >
                {displayText}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </>
      )}

      {/* Popover Calendar */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto md:left-1/2 md:-translate-x-1/2 lg:left-0 lg:translate-x-0 mt-3 z-[100] w-[320px] sm:w-[340px] bg-white border border-slate-200/80 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] p-5 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Month Nav */}
          <div className="flex items-center justify-between mb-4 px-1">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors font-bold text-sm"
            >
              ←
            </button>
            <span className="text-sm font-serif font-bold text-slate-900 tracking-wide">
              {CAL_MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors font-bold text-sm"
            >
              →
            </button>
          </div>

          {/* Weekday Header */}
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            {CAL_WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {daysArray.map((d, idx) => {
              if (!d) return <div key={`empty-${idx}`} className="h-9" />;

              const ds = calToStr(d);
              const isDisabled = ds < minDate;
              const isStart = ds === selStart;
              const isEnd = ds === selEnd;
              const isInRange = selStart && selEnd && ds > selStart && ds < selEnd;

              let cellStyle = "hover:bg-slate-100 text-slate-700 font-medium";
              if (isDisabled) {
                cellStyle = "text-slate-300 cursor-not-allowed";
              } else if (isStart || isEnd) {
                cellStyle = "bg-[#0c2614] text-white font-bold rounded-xl shadow-md";
              } else if (isInRange) {
                cellStyle = "bg-[#E8F5E9] text-[#1D8D2B] font-semibold rounded-lg";
              }

              return (
                <button
                  key={ds}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDayClick(d)}
                  className={`h-9 flex items-center justify-center text-xs transition-all ${cellStyle}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Selected info badge */}
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            {!selStart && (
              <p className="text-[11px] text-slate-400 font-medium">
                Select {isCar ? "pickup" : "check-in"} date
              </p>
            )}
            {selStart && !selEnd && (
              <p className="text-[11px] text-slate-400 font-medium">
                Select {isCar ? "return" : "check-out"} date
              </p>
            )}
            {selStart && selEnd && (
              <p className="text-xs font-bold text-[#1D8D2B] bg-[#E8F5E9]/60 py-1.5 px-3 rounded-full inline-block">
                {fmtDisplayDate(selStart)} – {fmtDisplayDate(selEnd)} ·{" "}
                {calcNights(selStart, selEnd)}{" "}
                {isCar
                  ? calcNights(selStart, selEnd) !== 1
                    ? "days"
                    : "day"
                  : calcNights(selStart, selEnd) !== 1
                  ? "nights"
                  : "night"}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!selStart || !selEnd}
              onClick={handleApply}
              className="flex-1 py-2.5 text-xs font-bold bg-[#0c2614] hover:bg-[#081b0d] disabled:opacity-40 text-white rounded-xl transition shadow-sm"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
