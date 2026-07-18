"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#eef8f1]">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar onToggleSidebar={() => setMobileOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

