"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft, X } from "lucide-react";
import { navItems, brand } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navContent = (
    <>
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-charcoal-light px-4",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link href="/" className="flex flex-col gap-0.5" onClick={onMobileClose}>
            <span className="text-lg font-bold tracking-tight text-white">
              {brand.name}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-gold/80">
              {brand.tagline}
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="hidden min-h-touch min-w-touch items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-charcoal-light hover:text-gold lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={onMobileClose}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-charcoal-light hover:text-gold lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex min-h-touch items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
                active
                  ? "border-l-2 border-gold bg-charcoal-light text-gold"
                  : "border-l-2 border-transparent text-slate-400 hover:bg-charcoal-light hover:text-white",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn("h-5 w-5 shrink-0", active && "text-gold")}
                aria-hidden
              />
              {!collapsed && (
                <span className="min-w-0 truncate">
                  <span className="block">{item.label}</span>
                  {item.description && (
                    <span className="block text-xs font-normal text-slate-500">
                      {item.description}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-charcoal-light p-4">
          <p className="text-xs text-slate-500">
            Premium feasibility intelligence for modern construction teams.
          </p>
        </div>
      )}
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-charcoal/70 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={cn(
          "hidden h-screen flex-col bg-charcoal transition-all duration-300 lg:flex",
          collapsed ? "w-[72px]" : "w-72"
        )}
      >
        {navContent}
      </aside>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-charcoal shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        {navContent}
      </aside>
    </>
  );
}
