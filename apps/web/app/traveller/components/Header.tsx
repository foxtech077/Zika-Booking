"use client";
import React from "react";
import Link from "next/link";

interface HeaderProps {
  user?: { firstName: string; lastName: string } | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, activeTab, setActiveTab, onLogout }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-sm">
      <Link href="/traveller" className="text-2xl font-bold text-[#0B1E3F] tracking-tight font-serif flex items-center gap-2">
        <span className="bg-[#0B1E3F] text-white px-2.5 py-1 rounded-xl">Zika</span>Booking
      </Link>

      <nav className="hidden md:flex items-center gap-6">
        {["home", "search", "bookings"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-sm font-semibold capitalize transition hover:text-[#0B1E3F] ${
              activeTab === tab ? "text-[#0B1E3F] border-b-2 border-[#0B1E3F] pb-1" : "text-slate-500"
            }`}
          >
            {tab === "bookings" ? "My Bookings" : tab}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-sm font-semibold text-slate-700 hidden sm:block">
              {user.firstName} {user.lastName}
            </span>
            <button
              onClick={onLogout}
              className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 transition"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="rounded-full bg-[#0B1E3F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#07152B] transition"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
};

export default Header;
