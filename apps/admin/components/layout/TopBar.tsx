"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { Avatar } from "@/components/ui/Avatar";
import { slugToLabel } from "@/lib/utils";

function getBreadcrumb(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  // Convert e.g. ["dashboard", "accreditation"] → ["Dashboard", "Accreditation"]
  return parts.map((p) => slugToLabel(p));
}

export function TopBar() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const crumbs = getBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-30 h-[60px] bg-white border-b border-[#E8F7E8] flex items-center px-6 gap-4">
      {/* Breadcrumb */}
      <nav className="flex-1 flex items-center gap-1.5 text-sm min-w-0">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-slate-300">/</span>}
            <span
              className={
                i === crumbs.length - 1
                  ? "text-slate-900 font-semibold truncate"
                  : "text-slate-400 truncate"
              }
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notifications placeholder */}
        <button className="relative h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-[#E8F7E8] hover:text-primary transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#008A3A] border-2 border-white" />
        </button>

        {/* User chip */}
         {user && (
           <div className="flex items-center gap-2 pl-3 border-l border-[#E8F7E8]">
             <Avatar name={user.name} size="sm" className="ring-2 ring-primary/20" />
             <div className="hidden sm:block text-right">
               <p className="text-xs font-semibold text-slate-900 leading-none">{user.name}</p>
               <p className="text-[10px] text-slate-500 mt-0.5">{slugToLabel(user.role)}</p>
             </div>
           </div>
         )}
      </div>
    </header>
  );
}
