"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

interface HeaderProps {
  user?: { firstName: string; lastName: string } | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, activeTab, setActiveTab, onLogout }) => {
  const [scrolled, setScrolled] = useState(false);
  const isHero = activeTab === "home";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const transparent = isHero && !scrolled;

  return (
    <header
      className={`sticky top-0 z-40 px-8 py-4 flex items-center justify-between transition-all duration-300 ${
        transparent
          ? "bg-transparent"
          : "bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm"
      }`}
    >
      <Link href="/traveller" className="flex items-center">
        <span
          className={`text-xl font-serif font-bold tracking-tight transition-colors duration-300 ${
            transparent ? "text-white" : "text-[#0c2614]"
          }`}
        >
          Kainook
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        <button
          onClick={() => setActiveTab("home")}
          className={`text-sm font-medium tracking-wide transition-colors ${
            activeTab === "home"
              ? transparent ? "text-white font-semibold" : "text-[#0c2614] font-semibold"
              : transparent ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-[#0c2614]"
          }`}
        >
          Destinations
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`text-sm font-medium tracking-wide transition-colors ${
            activeTab === "search"
              ? transparent ? "text-white font-semibold" : "text-[#0c2614] font-semibold"
              : transparent ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-[#0c2614]"
          }`}
        >
          Hotels
        </button>
        <button
          className={`text-sm font-medium tracking-wide transition-colors ${
            transparent ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-[#0c2614]"
          }`}
        >
          Villas
        </button>
        <button
          className={`text-sm font-medium tracking-wide transition-colors ${
            transparent ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-[#0c2614]"
          }`}
        >
          Car Rentals
        </button>
        {user && (
          <button
            onClick={() => setActiveTab("bookings")}
            className={`text-sm font-medium tracking-wide transition-colors ${
              activeTab === "bookings"
                ? transparent ? "text-white font-semibold" : "text-[#0c2614] font-semibold"
                : transparent ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-[#0c2614]"
            }`}
          >
            My Reservations
          </button>
        )}
      </nav>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div
              className={`flex items-center gap-2 rounded-full py-1.5 px-3 transition-all ${
                transparent
                  ? "bg-white/10 border border-white/25"
                  : "bg-slate-50 border border-slate-200 shadow-sm"
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-[#0c2614] text-white flex items-center justify-center font-bold uppercase text-[10px]">
                {user.firstName[0]}
              </div>
              <span
                className={`hidden sm:block text-xs font-semibold transition-colors ${
                  transparent ? "text-white" : "text-slate-700"
                }`}
              >
                {user.firstName}
              </span>
            </div>
            <button
              onClick={onLogout}
              className={`text-xs font-medium transition-colors ${
                transparent ? "text-white/50 hover:text-white" : "text-slate-400 hover:text-red-500"
              }`}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              href="/auth/login"
              className={`hidden sm:block text-sm font-medium transition-colors ${
                transparent ? "text-white/80 hover:text-white" : "text-slate-500 hover:text-[#0c2614]"
              }`}
            >
              Sign In
            </Link>
            <Link
              href="/auth/login"
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all shadow-sm ${
                transparent
                  ? "border border-white/40 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm"
                  : "bg-[#0c2614] hover:bg-[#081b0d] text-white"
              }`}
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
