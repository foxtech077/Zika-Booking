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

// ── Activity Promotion Banner (non-dismissable, PRD §6.4) ──
interface ActivityPromoBannerProps {
  bannerTitle: string;
  bannerSubtitle?: string;
  labelText?: string;
  validUntil?: string;
}

export function ActivityPromoBanner({ bannerTitle, bannerSubtitle, labelText, validUntil }: ActivityPromoBannerProps) {
  const expiring = isExpiringSoon(validUntil);

  return (
    <>
      <style>{`
        @keyframes promo-shimmer {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        .promo-shimmer-bar {
          position: absolute;
          top: 0; bottom: 0;
          width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          animation: promo-shimmer 2.8s linear infinite;
        }
      `}</style>
      <div
        className={`relative w-full rounded-2xl overflow-hidden shadow-lg text-white ${expiring ? "animate-pulse" : ""}`}
        style={{ background: expiring ? "#A63A22" : "#C84B2F" }}
      >
        {!expiring && <div className="promo-shimmer-bar" />}
        <div className="relative px-5 py-4 flex items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl select-none">
            🔥
          </div>
          <div className="flex-1 min-w-0">
            {labelText && (
              <span className="inline-block bg-white/25 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-1.5">
                {labelText}
              </span>
            )}
            <p className="font-bold text-sm leading-snug">{bannerTitle}</p>
            {bannerSubtitle && (
              <p className="text-white/75 text-[11px] mt-0.5 line-clamp-1">{bannerSubtitle}</p>
            )}
            {expiring && validUntil && (
              <p className="text-amber-200 text-[10px] font-semibold mt-1">
                ⏰ Offer ends in {formatCountdown(validUntil)}
              </p>
            )}
          </div>
          {expiring && (
            <span className="shrink-0 bg-amber-400 text-amber-900 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
              Ending soon
            </span>
          )}
        </div>
      </div>
    </>
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
