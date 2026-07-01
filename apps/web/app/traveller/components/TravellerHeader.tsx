"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, CreditCard, Heart, LogOut, Menu, MessageSquare, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthStore } from "@/stores/auth";
import { fetchUnreadConversationCount } from "@/services/traveller";

const TRAVELLER_ROUTES = {
  destinations: "/traveller",
  hotels: "/traveller/hotels",
  apartments: "/traveller/apartments",
  cars: "/traveller/cars",
  bookings: "/traveller?tab=bookings",
  wishlist: "/traveller/wishlist",
  messages: "/traveller/messages",
  reviews: "/traveller/reviews",
  profile: "/traveller/profile",
  paymentMethods: "/traveller/payment-methods",
} as const;

interface TravellerHeaderProps {
  // Whether an auth token exists (even without a loaded user)
  hasAuthToken?: boolean;
  // Checkout lock mode
  isLocked?: boolean;
  lockSecondsLeft?: number | null;
  onExitLock?: () => void;
}

export function TravellerHeader({
  hasAuthToken = false,
  isLocked = false,
  lockSecondsLeft = null,
  onExitLock,
}: TravellerHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, clearSession } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchSignature = searchParams.toString();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["traveller-unread-count"],
    queryFn: fetchUnreadConversationCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: !!user,
  });

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname, searchSignature]);

  const handleLogout = () => {
    setMenuOpen(false);
    clearSession();
    router.replace("/auth/login");
  };

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "Traveller";

  const isDestinationsActive = pathname === TRAVELLER_ROUTES.destinations && searchParams.get("tab") !== "bookings";
  const isHotelsActive = pathname === TRAVELLER_ROUTES.hotels;
  const isApartmentsActive = pathname === TRAVELLER_ROUTES.apartments;
  const isCarsActive = pathname === TRAVELLER_ROUTES.cars;
  const isBookingsActive = pathname === TRAVELLER_ROUTES.destinations && searchParams.get("tab") === "bookings";
  const isMessagesActive = pathname?.startsWith(TRAVELLER_ROUTES.messages);
  const isReviewsActive = pathname?.startsWith(TRAVELLER_ROUTES.reviews);
  const isWishlistActive = pathname?.startsWith(TRAVELLER_ROUTES.wishlist);
  const isProfileActive = pathname?.startsWith(TRAVELLER_ROUTES.profile);
  const isPaymentMethodsActive = pathname?.startsWith(TRAVELLER_ROUTES.paymentMethods);

  const lockTimer =
    lockSecondsLeft != null
      ? `${Math.floor(lockSecondsLeft / 60).toString().padStart(2, "0")}:${(lockSecondsLeft % 60).toString().padStart(2, "0")}`
      : "05:00";

  function navBtn(label: string, href: string, isActive: boolean) {
    const cls = cn(
      "text-sm font-medium tracking-wide transition-colors",
      isActive ? "text-[#0c2614] font-semibold" : "text-slate-500 hover:text-[#0c2614]",
    );
    return (
      <Link key={label} href={href} aria-current={isActive ? "page" : undefined} className={cls}>
        {label}
      </Link>
    );
  }

  function mobileNavBtn(label: string, href: string, isActive: boolean) {
    return (
      <Link
        key={label}
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
          isActive
            ? "border-[#0c2614] bg-[#0c2614] text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-[#1D8D2B] hover:text-[#0c2614]",
        )}
        onClick={() => setMobileMenuOpen(false)}
      >
        {label}
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      {isLocked ? (
        /* Checkout / lock mode — minimal countdown header */
        <div className="flex items-center justify-between px-8 py-4">
          <button
            type="button"
            onClick={onExitLock}
            className="flex items-center gap-2.5 hover:opacity-80 transition"
          >
            <Image
              src="/images/kainook-logo.jpeg"
              alt="Kainook"
              width={32}
              height={32}
              className="rounded-xl object-cover"
            />
            <span className="text-xl font-serif font-bold text-[#0c2614] tracking-tight">Kainook</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 font-mono text-xs tracking-wider text-[#0c2614]">
              <svg className="h-3.5 w-3.5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {lockTimer}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-medium text-slate-400 transition hover:text-red-500"
            >
              Logout
            </button>
          </div>
        </div>
      ) : (
        /* Normal header */
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          {/* ── Left: Logo + content nav ── */}
          <div className="flex items-center gap-10">
            <Link
              href={TRAVELLER_ROUTES.destinations}
              className="shrink-0 flex items-center gap-2.5"
            >
              <Image
                src="/images/kainook-logo.jpeg"
                alt="Kainook"
                width={36}
                height={36}
                className="rounded-xl object-cover"
              />
              <span className="text-xl font-serif font-bold tracking-tight text-[#0c2614]">Kainook</span>
            </Link>

            <nav className="hidden items-center gap-8 md:flex">
              {navBtn(
                "Destinations",
                TRAVELLER_ROUTES.destinations,
                isDestinationsActive,
              )}
              {navBtn(
                "Hotels",
                TRAVELLER_ROUTES.hotels,
                isHotelsActive,
              )}
              {navBtn(
                "Apartments",
                TRAVELLER_ROUTES.apartments,
                isApartmentsActive,
              )}
              {navBtn(
                "Car Rentals",
                TRAVELLER_ROUTES.cars,
                isCarsActive,
              )}
              {user &&
                navBtn(
                  "My Reservations",
                  TRAVELLER_ROUTES.bookings,
                  isBookingsActive,
              )}
            </nav>
          </div>

          {/* ── Right: workspace links + avatar dropdown ── */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition hover:bg-slate-50 md:hidden"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5 text-slate-700" />
            </button>

            {/* Unauthenticated */}
            {!user && !hasAuthToken && (
              <>
                <Link
                  href="/auth/login"
                  className="hidden text-sm font-medium text-slate-500 transition hover:text-[#0c2614] sm:block"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/login"
                  className="rounded-full bg-[#0c2614] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#081b0d]"
                >
                  Sign Up
                </Link>
              </>
            )}

            {/* Authenticated */}
            {user && (
              <>
                {/* Messages */}
                <Link
                  href={TRAVELLER_ROUTES.messages}
                  className={cn(
                    "hidden items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all md:flex",
                    isMessagesActive
                      ? "border-[#0c2614] bg-[#0c2614] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#1D8D2B] hover:text-[#0c2614]",
                  )}
                >
                  <MessageSquare
                    className={cn("h-3.5 w-3.5", !isMessagesActive && "text-[#1D8D2B]")}
                  />
                  Messages
                  {unreadCount > 0 && (
                    <span
                      className={cn(
                        "inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        isMessagesActive ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700",
                      )}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Wishlist */}
                <Link
                  href={TRAVELLER_ROUTES.wishlist}
                  className={cn(
                    "hidden items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all md:flex",
                    isWishlistActive
                      ? "border-[#0c2614] bg-[#0c2614] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#1D8D2B] hover:text-[#0c2614]",
                  )}
                >
                  <Heart
                    className={cn("h-3.5 w-3.5", !isWishlistActive && "text-[#1D8D2B]")}
                  />
                  Wishlist
                </Link>

                {/* My Reviews */}
                <Link
                  href={TRAVELLER_ROUTES.reviews}
                  className={cn(
                    "hidden items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all md:flex",
                    isReviewsActive
                      ? "border-[#0c2614] bg-[#0c2614] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#1D8D2B] hover:text-[#0c2614]",
                  )}
                >
                  <Star className={cn("h-3.5 w-3.5", !isReviewsActive && "text-[#1D8D2B]")} />
                  My Reviews
                </Link>

                {/* Avatar dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border px-2 py-1.5 font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500/30",
                      menuOpen
                        ? "border-[#0c2614] bg-[#0c2614] text-white shadow-sm"
                        : isProfileActive
                          ? "border-[#0c2614] bg-[#0c2614] text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#1D8D2B] hover:text-[#0c2614]",
                    )}
                  >
                    <Avatar name={fullName} size="sm" />
                    <div className="hidden text-left sm:block">
                      <p
                        className={cn(
                          "max-w-[100px] truncate text-xs font-semibold leading-none",
                          menuOpen ? "text-white" : "text-slate-800",
                        )}
                      >
                        {fullName}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 max-w-[100px] truncate text-[10px]",
                          menuOpen ? "text-green-200/80" : "text-slate-400",
                        )}
                      >
                        {user.email}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        menuOpen ? "rotate-180 text-white/70" : "text-slate-400",
                      )}
                    />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-52 animate-slide-in-up rounded-2xl border border-slate-100 bg-white py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.1)]">
                      <div className="mb-1 border-b border-slate-100 px-4 py-2.5">
                        <p className="truncate text-sm font-semibold text-slate-800">{fullName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{user.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push(TRAVELLER_ROUTES.profile);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all",
                          isProfileActive ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        )}
                      >
                        <User className="h-4 w-4 text-green-600" />
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push(TRAVELLER_ROUTES.paymentMethods);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all",
                          isPaymentMethodsActive ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        )}
                      >
                        <CreditCard className="h-4 w-4 text-green-600" />
                        Payment Methods
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-600 transition-all hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-slate-100 bg-white px-4 py-4 sm:px-6 lg:px-8 md:hidden">
              <div className="space-y-4">
                <div className="grid gap-2">
                  {mobileNavBtn("Destinations", TRAVELLER_ROUTES.destinations, isDestinationsActive)}
                  {mobileNavBtn("Hotels", TRAVELLER_ROUTES.hotels, isHotelsActive)}
                  {mobileNavBtn("Apartments", TRAVELLER_ROUTES.apartments, isApartmentsActive)}
                  {mobileNavBtn("Car Rentals", TRAVELLER_ROUTES.cars, isCarsActive)}
                  {user && mobileNavBtn("My Reservations", TRAVELLER_ROUTES.bookings, isBookingsActive)}
                </div>

                {user ? (
                  <div className="grid gap-2">
                    {mobileNavBtn("Messages", TRAVELLER_ROUTES.messages, isMessagesActive)}
                    {mobileNavBtn("Wishlist", TRAVELLER_ROUTES.wishlist, isWishlistActive)}
                    {mobileNavBtn("My Reviews", TRAVELLER_ROUTES.reviews, isReviewsActive)}
                    {mobileNavBtn("Profile", TRAVELLER_ROUTES.profile, isProfileActive)}
                    {mobileNavBtn("Payment Methods", TRAVELLER_ROUTES.paymentMethods, isPaymentMethodsActive)}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:bg-red-100"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/auth/login"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-[#1D8D2B] hover:text-[#0c2614]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth/login"
                      className="rounded-xl bg-[#0c2614] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#081b0d]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
