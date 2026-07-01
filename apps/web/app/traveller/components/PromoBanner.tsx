"use client";
import React from "react";

function isExpiringSoon(validUntil?: string): boolean {
  if (!validUntil) return false;
  const diffMs = new Date(validUntil).getTime() - Date.now();
  return diffMs > 0 && diffMs / (1000 * 60 * 60) <= 48;
}

function formatCountdown(validUntil: string): string {
  const diffMs = new Date(validUntil).getTime() - Date.now();
  if (diffMs <= 0) return "0m";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

import { isPromotionValid, type ActivePromotion } from "../utils/promo-utils";

interface ActivityPromoBannerProps {
  activePromotion: ActivePromotion | null | undefined;
}

export function ActivityPromoBanner({ activePromotion }: ActivityPromoBannerProps) {
  if (!activePromotion || !isPromotionValid(activePromotion)) {
    return null;
  }

  const {
    bannerTitle,
    bannerSubtitle,
    labelText,
    labelColour,
    discountType,
    discountValue,
  } = activePromotion;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 sm:p-8 rounded-2xl bg-[#0c2614] text-white shadow-md border border-[#1d8d2b]/20 relative overflow-hidden">
      <div className="flex-1 min-w-0">
        {labelText && (
          <span
            style={{
              backgroundColor: labelColour ? `${labelColour}22` : "rgba(29, 141, 43, 0.2)",
              borderColor: labelColour ? `${labelColour}44` : "rgba(29, 141, 43, 0.3)",
              color: labelColour || "#4ade80",
            }}
            className="inline-block text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border mb-2.5"
          >
            {labelText}
          </span>
        )}
        {bannerTitle && (
          <h3 className="text-xl font-bold sm:text-2xl text-white tracking-tight leading-tight">
            {bannerTitle}
          </h3>
        )}
        {bannerSubtitle && (
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl font-normal leading-relaxed">
            {bannerSubtitle}
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-center sm:ml-4">
        <div className="w-24 h-24 rounded-full border border-emerald-700/50 flex flex-col justify-center items-center gap-0.5 relative">
          <span className="text-2xl font-bold text-emerald-400">
            {discountType === "percentage" ? `${discountValue}%` : `${discountValue}`}
          </span>
          <span className="text-[8px] font-bold tracking-widest text-emerald-500/80 uppercase">
            AUTO-APPLIED
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Personal Voucher Banner (dismissable, 4 states, PRD §6.2) ──
interface VoucherItem {
  id: string;
  code: string;
  title?: string;
  description?: string;
  discountAmount: number;
  validUntil?: string;
}

interface PersonalVoucherBannerProps {
  vouchers: VoucherItem[];
  voucherApplied: boolean;
  voucherDiscount: number;
  currency: string;
  dismissed: boolean;
  pendingCode: string;
  onDismiss: () => void;
  onApply: (code: string) => void;
}

export function PersonalVoucherBanner({
  vouchers, voucherApplied, voucherDiscount, currency, dismissed, pendingCode, onDismiss, onApply,
}: PersonalVoucherBannerProps) {
  if (vouchers.length === 0 || dismissed) return null;

  const best = vouchers[0];
  if (!best) return null;
  const expiring = isExpiringSoon(best.validUntil);
  const label = best.title || best.description || `${best.code} voucher`;

  // State 3: Applied
  if (voucherApplied && voucherDiscount > 0) {
    return (
      <div className="w-full rounded-2xl bg-[#024622] text-white shadow-md overflow-hidden">
        <div className="px-4 py-3.5 flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base select-none">✓</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Offer applied!</p>
            <p className="text-white/75 text-[11px]">Saving {currency} {voucherDiscount.toLocaleString()} on this booking</p>
          </div>
          <button onClick={onDismiss} className="shrink-0 p-1 text-white/50 hover:text-white transition" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Queued state (pending code stored, waiting for listing selection)
  if (pendingCode && !voucherApplied) {
    return (
      <div className="w-full rounded-2xl bg-[#024622]/90 border border-[#1D8D2B]/40 text-white shadow-md overflow-hidden">
        <div className="px-4 py-3.5 flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base select-none">🎟️</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Voucher queued</p>
            <p className="text-white/70 text-[11px]">Will be applied automatically at checkout</p>
          </div>
          <button onClick={onDismiss} className="shrink-0 p-1 text-white/50 hover:text-white transition" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // State 2: Expiring soon (amber pulse)
  if (expiring) {
    return (
      <div className="w-full rounded-2xl overflow-hidden shadow-md animate-pulse" style={{ background: "#B45309" }}>
        <div className="px-4 py-3.5 flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base select-none">⏰</span>
          <div className="flex-1 min-w-0">
            <p className="text-amber-100 font-bold text-sm">Offer expires soon!</p>
            <p className="text-amber-200/80 text-[11px] truncate">{label} — Tap to apply before it's gone</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onApply(best.code)}
              className="bg-amber-400 text-amber-900 text-[10px] font-bold px-3 py-1.5 rounded-xl hover:bg-amber-300 transition"
            >
              Apply
            </button>
            <button onClick={onDismiss} className="p-1 text-amber-200/60 hover:text-amber-100 transition" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 1: Active (shimmer, dark-green)
  return (
    <>
      <style>{`
        @keyframes voucher-shimmer {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        .voucher-shimmer-bar {
          position: absolute;
          top: 0; bottom: 0;
          width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
          animation: voucher-shimmer 2.8s linear infinite;
        }
      `}</style>
      <div className="relative w-full rounded-2xl overflow-hidden shadow-md bg-[#024622] text-white">
        <div className="voucher-shimmer-bar" />
        <div className="relative px-4 py-3.5 flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base select-none">🎟️</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{best.title ?? "You have a voucher!"}</p>
            <p className="text-white/65 text-[11px] truncate">
              {best.description ?? `Save ${currency} ${best.discountAmount.toLocaleString()} on your next booking`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onApply(best.code)}
              className="bg-white text-[#024622] text-[10px] font-bold px-3 py-1.5 rounded-xl hover:bg-green-50 transition whitespace-nowrap"
            >
              Tap to apply
            </button>
            <button onClick={onDismiss} className="p-1 text-white/50 hover:text-white transition" aria-label="Dismiss">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
