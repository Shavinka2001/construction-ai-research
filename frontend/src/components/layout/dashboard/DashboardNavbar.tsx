"use client";

import { useRouter } from "next/navigation";
import { Menu, LogOut, ChevronRight } from "lucide-react";
import {
  clearAuthSession,
  getAuthSession,
  getDisplayName,
  type AuthUser,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

type DashboardNavbarProps = {
  onMenuOpen: () => void;
  user: AuthUser | null;
};

function getInitials(user: AuthUser | null): string {
  if (!user) return "U";
  const name = getDisplayName(user);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function DashboardNavbar({ onMenuOpen, user }: DashboardNavbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  return (
    <header
      className={cn(
        "fixed top-0 z-20 flex h-16 items-center justify-between border-b border-slate-100 bg-white px-4 sm:px-8",
        "left-0 right-0 lg:left-64"
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-charcoal transition-colors hover:border-gold hover:text-gold lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-slate-400">Dashboard</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
          <span className="font-semibold text-slate-800">Overview</span>
        </nav>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E1E24] text-xs font-bold text-gold">
            {getInitials(user)}
          </div>
          <span className="max-w-[140px] truncate text-sm font-medium text-slate-700">
            {user ? getDisplayName(user) : "User"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:border-gold/40 hover:bg-slate-50 hover:text-[#1E1E24] sm:px-4"
        >
          <LogOut className="h-4 w-4 text-gold" aria-hidden />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
