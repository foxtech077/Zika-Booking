"use client";
import React, { useEffect, useRef, useState } from "react";
import { useDestinationSuggestions, type DestinationSuggestion } from "@/hooks/useDestinationSuggestions";

export type { DestinationSuggestion };

interface DestinationDropdownProps {
  /** Current text in the input (controlled by the parent). */
  value: string;
  /** Fired on every keystroke — parent should update `value` and clear any
   *  previously selected destination, since the text no longer matches it. */
  onQueryChange: (text: string) => void;
  /** Fired when the visitor picks a suggestion (click, Enter, or keyboard nav). */
  onSelect: (destination: DestinationSuggestion) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  inputClassName?: string;
  wrapperClassName?: string;
  /** Wraps the icon/input/rightAdornment row — pass the host's field "box" styling here. */
  fieldClassName?: string;
  icon?: React.ReactNode;
  /** Rendered after the input inside the field row (e.g. a "clear" button). */
  rightAdornment?: React.ReactNode;
}

/**
 * Searchable destination combobox backed by `useDestinationSuggestions`.
 * Supports keyboard navigation (Up/Down/Enter/Escape), mouse selection, closes
 * on select, and shows "No destinations found" for queries with zero matches.
 */
export default function DestinationDropdown({
  value,
  onQueryChange,
  onSelect,
  placeholder = "Where to?",
  label,
  required,
  inputClassName = "flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-800 placeholder-slate-400 min-w-0",
  wrapperClassName = "",
  fieldClassName = "flex items-center gap-2",
  icon,
  rightAdornment,
}: DestinationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const { suggestions, searched } = useDestinationSuggestions(value);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHighlighted(-1);
  }, [suggestions]);

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  function selectSuggestion(s: DestinationSuggestion) {
    onSelect(s);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      const picked = highlighted >= 0 ? suggestions[highlighted] : undefined;
      if (picked) {
        e.preventDefault();
        selectSuggestion(picked);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    }
  }

  const showDropdown = open && value.trim().length >= 2;

  return (
    <div className={`relative ${wrapperClassName}`}>
      {label && (
        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </label>
      )}
      <div className={fieldClassName}>
        {icon}
        <input
          type="text"
          required={required}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onQueryChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 200); }}
          onKeyDown={handleKeyDown}
          className={inputClassName}
        />
        {rightAdornment}
      </div>

      {showDropdown && (
        suggestions.length > 0 ? (
          <div
            role="listbox"
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
          >
            {suggestions.map((s, i) => (
              <button
                key={`${s.lat}-${s.lng}-${i}`}
                type="button"
                role="option"
                aria-selected={highlighted === i}
                onMouseDown={() => selectSuggestion(s)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full px-4 py-2.5 text-left text-xs font-medium truncate transition-colors ${
                  highlighted === i ? "bg-[#0c2614] text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                📍 {s.displayName}
              </button>
            ))}
          </div>
        ) : searched ? (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs text-slate-400">
            No destinations found
          </div>
        ) : null
      )}
    </div>
  );
}
