"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  getDashboardNavItems,
  isDashboardNavActive,
} from "@/lib/dashboard-navigation";
import {
  getDisplayName,
  type AuthUser,
  type UserRole,
} from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  user: AuthUser | null;
  userLoading?: boolean;
};

function SidebarLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center"
      aria-label="Construction AI — Dashboard home"
    >
      <span className="text-lg font-bold tracking-tight text-white">
        Construction
      </span>
      <span className="ml-1.5 rounded border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-[#D4AF37]">
        AI
      </span>
    </Link>
  );
}

function getInitials(user: AuthUser): string {
  const name = getDisplayName(user);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getRoleDisplay(role: UserRole): string {
  return ROLE_DASHBOARD_LABELS[role] ?? role;
}

function SidebarUserFooter({
  user,
  loading,
}: {
  user: AuthUser | null;
  loading?: boolean;
}) {
  return (
    <div className="absolute bottom-6 left-4 right-4">
      <div className="mb-4 border-t border-slate-800/60 pt-4">
        {loading ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-10 shrink-0 rounded-full bg-white/5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="h-2.5 w-16 rounded bg-white/5" />
            </div>
          </div>
        ) : user ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-sm font-bold text-[#D4AF37]">
              {getInitials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {getDisplayName(user)}
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-400">
                {getRoleDisplay(user.role)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardSidebar({
  mobileOpen,
  onMobileClose,
  user,
  userLoading = false,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const role: UserRole = user?.role ?? "CLIENT";
  const navItems = getDashboardNavItems(role);

  const navLinks = (
    <nav className="flex flex-col gap-1 p-4 pb-28">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isDashboardNavActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onMobileClose}
            className={cn(
              "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "border-l-2 border-gold bg-white/5 text-gold"
                : "border-l-2 border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0", active && "text-gold")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const brandBlock = (
    <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
      <SidebarLogo onNavigate={onMobileClose} />
    </div>
  );

  const sidebarInner = (
    <>
      {brandBlock}
      <div className="flex-1 overflow-y-auto">{navLinks}</div>
      <SidebarUserFooter user={user} loading={userLoading} />
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#1E1E24]/80 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-label="Close navigation"
        />
      )}

      {/* Desktop fixed sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col bg-[#1E1E24] text-white lg:flex">
        <div className="relative flex h-full flex-col">{sidebarInner}</div>
      </aside>

      {/* Mobile slide-over drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 bg-[#1E1E24] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="relative flex h-full flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
            <SidebarLogo onNavigate={onMobileClose} />
            <button
              type="button"
              onClick={onMobileClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{navLinks}</div>
          <SidebarUserFooter user={user} loading={userLoading} />
        </div>
      </aside>
    </>
  );
}
