"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import {
  getDashboardNavItems,
  isDashboardNavActive,
} from "@/lib/dashboard-navigation";
import {
  getDisplayName,
  type AuthUser,
} from "@/lib/auth";
import { ROLE_DASHBOARD_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

type AuthoritySidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  user: AuthUser;
};

function SidebarLogo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="flex items-center"
      aria-label="ConstructAI — Authority dashboard"
    >
      <span className="text-lg font-bold tracking-tight text-white">
        Construct
      </span>
      <span className="ml-1.5 rounded border border-gold/25 bg-gold/10 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-gold">
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

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  index,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
          active
            ? "bg-white/[0.08] text-gold"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
        )}
      >
        {active && (
          <motion.span
            layoutId="authority-nav-active"
            className="absolute inset-0 rounded-xl border border-gold/20 bg-gold/[0.06]"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <Icon
          className={cn(
            "relative h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
            active && "text-gold"
          )}
        />
        <span className="relative">{label}</span>
      </Link>
    </motion.div>
  );
}

function SidebarContent({
  user,
  onNavigate,
}: {
  user: AuthUser;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems("AUTHORITY");

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-white/[0.08] px-5">
        <SidebarLogo onNavigate={onNavigate} />
      </div>

      <div className="px-4 pt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          {ROLE_DASHBOARD_LABELS.AUTHORITY}
        </p>
      </div>

      <nav className="flex flex-col gap-1 p-4 pb-28">
        {navItems.map((item, index) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isDashboardNavActive(pathname, item.href)}
            onNavigate={onNavigate}
            index={index}
          />
        ))}
      </nav>

      <div className="absolute bottom-6 left-4 right-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-gold/10 text-sm font-bold text-gold">
              {getInitials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {getDisplayName(user)}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                Approval Officer
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function AuthoritySidebar({
  mobileOpen,
  onMobileClose,
  user,
}: AuthoritySidebarProps) {
  return (
    <>
      {mobileOpen && (
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-charcoal/80 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-label="Close navigation"
        />
      )}

      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col border-r border-white/[0.06] bg-charcoal text-white lg:flex">
        <div className="relative flex h-full flex-col">
          <SidebarContent user={user} onNavigate={() => {}} />
        </div>
      </aside>

      <motion.aside
        initial={false}
        animate={{ x: mobileOpen ? 0 : "-100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-white/[0.06] bg-charcoal text-white shadow-2xl lg:hidden"
        aria-hidden={!mobileOpen}
      >
        <div className="relative flex h-full flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] px-5">
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
          <SidebarContent user={user} onNavigate={onMobileClose} />
        </div>
      </motion.aside>
    </>
  );
}
