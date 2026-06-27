"use client";

import { useState, useEffect, useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm format
  onChange: (val: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  minDate?: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  maxDate?: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  className?: string;
  id?: string;
  showTime?: boolean;
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
  showTime = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [openAbove, setOpenAbove] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Split value into date and time parts
  let datePart = "";
  let hourPart = 0;
  let minutePart = 0;

  if (value) {
    if (value.includes("T")) {
      const parts = value.split("T");
      datePart = parts[0] || "";
      const timeStr = parts[1];
      if (timeStr) {
        const timeParts = timeStr.split(":");
        hourPart = parseInt(timeParts[0] || "0") || 0;
        minutePart = parseInt(timeParts[1] || "0") || 0;
      }
    } else {
      datePart = value;
    }
  }

  const [selectedHour, setSelectedHour] = useState(hourPart);
  const [selectedMinute, setSelectedMinute] = useState(minutePart);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync calendar view month and time selections when value changes
  useEffect(() => {
    if (value) {
      const dateOnlyStr = value.includes("T") ? (value.split("T")[0] || "") : value;
      const d = new Date(dateOnlyStr);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
      if (value.includes("T")) {
        const parts = value.split("T");
        const timeStr = parts[1];
        if (timeStr) {
          const timeParts = timeStr.split(":");
          setSelectedHour(parseInt(timeParts[0] || "0") || 0);
          setSelectedMinute(parseInt(timeParts[1] || "0") || 0);
        }
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

  // Determine if picker should open above the input and/or align to the right
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const neededHeight = showTime ? 385 : 325;
      const neededWidth = 300;

      // Helper to find the closest scrolling/overflow container
      const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
        if (!node) return null;
        const style = window.getComputedStyle(node);
        const hasOverflow = style.overflowX === "auto" || 
                            style.overflowX === "hidden" || 
                            style.overflowX === "scroll" ||
                            style.overflowY === "auto" ||
                            style.overflowY === "hidden" ||
                            style.overflowY === "scroll" ||
                            style.overflow === "auto" ||
                            style.overflow === "hidden" ||
                            style.overflow === "scroll";
        if (hasOverflow || node.classList.contains("overflow-hidden") || node.classList.contains("overflow-y-auto")) {
          return node;
        }
        return getScrollParent(node.parentElement);
      };

      const scrollParent = getScrollParent(containerRef.current);
      
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        
        // Vertical check relative to parent scroll boundary
        const spaceBelow = parentRect.bottom - rect.bottom;
        const spaceAbove = rect.top - parentRect.top;
        if (spaceBelow < neededHeight && spaceAbove > neededHeight) {
          setOpenAbove(true);
        } else {
          setOpenAbove(false);
        }

        // Horizontal check relative to parent scroll boundary
        const spaceRight = parentRect.right - rect.left;
        if (spaceRight < neededWidth) {
          setAlignRight(true);
        } else {
          setAlignRight(false);
        }
      } else {
        // Fallback to window space check
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < neededHeight && spaceAbove > neededHeight) {
          setOpenAbove(true);
        } else {
          setOpenAbove(false);
        }

        const spaceRight = window.innerWidth - rect.left;
        if (spaceRight < neededWidth) {
          setAlignRight(true);
        } else {
          setAlignRight(false);
        }
      }
    }
  }, [isOpen, showTime]);

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

  const toYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSelectDate = (date: Date) => {
    const dateStr = toYMD(date);
    if (showTime) {
      const hStr = String(selectedHour).padStart(2, "0");
      const mStr = String(selectedMinute).padStart(2, "0");
      onChange(`${dateStr}T${hStr}:${mStr}`);
    } else {
      onChange(dateStr);
      setIsOpen(false);
    }
  };

  const handleTimeChange = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    const currentDate = datePart || toYMD(new Date());
    const hStr = String(hour).padStart(2, "0");
    const mStr = String(minute).padStart(2, "0");
    onChange(`${currentDate}T${hStr}:${mStr}`);
  };

  const handleClear = () => {
    onChange("");
    setSelectedHour(0);
    setSelectedMinute(0);
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    if (!mounted) return dateStr.split("T")[0];
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      if (showTime && dateStr.includes("T")) {
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const isDateDisabled = (date: Date) => {
    const dateStr = toYMD(date);
    const minDateOnly = minDate && minDate.includes("T") ? minDate.split("T")[0] : minDate;
    const maxDateOnly = maxDate && maxDate.includes("T") ? maxDate.split("T")[0] : maxDate;

    if (minDateOnly && dateStr < minDateOnly) return true;
    if (maxDateOnly && dateStr > maxDateOnly) return true;
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
                  handleClear();
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
          <div
            className={cn(
              "absolute w-[300px] rounded-xl border border-border bg-white shadow-xl z-50 p-4 space-y-3",
              openAbove ? "bottom-full mb-1" : "top-full mt-1",
              alignRight ? "right-0" : "left-0"
            )}
          >
            {/* Header / Month & Year Jump Navigation */}
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(parseInt(e.target.value))}
                  style={{
                    color: "#334155",
                    backgroundColor: "#ffffff",
                    backgroundImage: "none",
                    paddingRight: "0.375rem",
                    paddingLeft: "0.375rem",
                    border: "1px solid #cbd5e1"
                  }}
                  className="appearance-none bg-none w-[75px] text-center text-xs font-semibold rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:bg-slate-50 px-1"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {new Date(2000, i, 1).toLocaleString("default", { month: "short" })}
                    </option>
                  ))}
                </select>
                
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(parseInt(e.target.value))}
                  style={{
                    color: "#334155",
                    backgroundColor: "#ffffff",
                    backgroundImage: "none",
                    paddingRight: "0.375rem",
                    paddingLeft: "0.375rem",
                    border: "1px solid #cbd5e1"
                  }}
                  className="appearance-none bg-none w-[65px] text-center text-xs font-semibold rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:bg-slate-50 px-1"
                >
                  {Array.from({ length: 21 }, (_, i) => {
                    const y = today.getFullYear() - 10 + i;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
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
                const isSelected = datePart === ds;
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

            {/* Time Selection */}
            {showTime && (
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Time
                  </span>
                  <input
                    type="time"
                    value={`${String(selectedHour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const parts = val.split(":");
                        handleTimeChange(parseInt(parts[0] || "0"), parseInt(parts[1] || "0"));
                      }
                    }}
                    style={{
                      color: "#334155",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1"
                    }}
                    className="text-xs font-medium rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer w-28 text-center"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-center bg-primary text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-primary-dark transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

