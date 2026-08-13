"use client";
import React, { useEffect, useState } from "react";

interface PriceRangeFieldsProps {
  /** Currency the bounds are expressed in — matches the card price labels. */
  currency: string;
  /** Cheapest/priciest result currently on screen; null before results arrive. */
  bounds: { lo: number; hi: number } | null;
  /** 0 means "no lower bound". */
  min: number;
  /** `noCap` means "no upper bound". */
  max: number;
  noCap: number;
  onChange: (next: { min: number; max: number }) => void;
}

const FIELD =
  "w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold " +
  "text-slate-800 tabular-nums shadow-sm focus:outline-none focus:border-[#1D8D2B] " +
  "focus:ring-2 focus:ring-[#1D8D2B]/15 transition placeholder:font-normal placeholder:text-slate-300 " +
  // Number inputs render a stepper that overlaps the right edge of the value,
  // clipping long figures like "5,117,109".
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none " +
  "[&::-webkit-inner-spin-button]:appearance-none";

/**
 * Min/max price inputs.
 *
 * Values are held as local drafts and only committed on blur or Enter. Two
 * reasons: committing per keystroke fires a search for every intermediate
 * value (typing "100" queries 1, then 10, then 100), and it makes the range
 * transiently invalid — a half-typed "1" is below a min of 10, which would
 * clamp the field out from under the person typing it.
 */
export default function PriceRangeFields({
  currency, bounds, min, max, noCap, onChange,
}: PriceRangeFieldsProps) {
  const committedMin = min > 0 ? String(min) : "";
  const committedMax = max < noCap ? String(max) : "";
  const [minDraft, setMinDraft] = useState(committedMin);
  const [maxDraft, setMaxDraft] = useState(committedMax);

  // Re-sync when the values change elsewhere (reset button, URL, back nav).
  useEffect(() => { setMinDraft(committedMin); }, [committedMin]);
  useEffect(() => { setMaxDraft(committedMax); }, [committedMax]);

  function commit(which: "min" | "max", raw: string) {
    const parsed = raw.trim() === "" ? null : Math.max(0, Number(raw));
    if (parsed !== null && !Number.isFinite(parsed)) return;

    let nextMin = which === "min" ? (parsed ?? 0) : min;
    let nextMax = which === "max" ? (parsed ?? noCap) : max;

    // Keep the range ordered. Clamp the field just edited against the other
    // one rather than swapping them, so the result is predictable.
    if (nextMin > 0 && nextMax < noCap && nextMin > nextMax) {
      if (which === "min") nextMin = nextMax;
      else nextMax = nextMin;
    }

    setMinDraft(nextMin > 0 ? String(nextMin) : "");
    setMaxDraft(nextMax < noCap ? String(nextMax) : "");
    if (nextMin !== min || nextMax !== max) onChange({ min: nextMin, max: nextMax });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-semibold text-slate-700">Price Range</label>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{currency}</span>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="price-min" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Min</label>
          <input
            id="price-min"
            type="number"
            inputMode="decimal"
            min={0}
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            onBlur={(e) => commit("min", e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={bounds ? bounds.lo.toLocaleString() : "Any"}
            className={FIELD}
          />
        </div>
        <span className="pb-2.5 text-slate-300 text-sm shrink-0">–</span>
        <div className="flex-1">
          <label htmlFor="price-max" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Max</label>
          <input
            id="price-max"
            type="number"
            inputMode="decimal"
            min={0}
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onBlur={(e) => commit("max", e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={bounds ? bounds.hi.toLocaleString() : "Any"}
            className={FIELD}
          />
        </div>
      </div>

      {bounds && (
        <p className="text-[10px] text-slate-400">
          Results range {currency} {bounds.lo.toLocaleString()} – {bounds.hi.toLocaleString()}
        </p>
      )}
    </div>
  );
}
