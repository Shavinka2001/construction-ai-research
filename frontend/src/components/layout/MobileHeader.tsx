"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { brand } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:h-16 lg:hidden">
      <Link href="/" className="flex flex-col">
        <span className="text-base font-bold text-slate-900">{brand.name}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gold">
          Portal
        </span>
      </Link>
      <button
        type="button"
        onClick={onMenuOpen}
        className="flex min-h-touch min-w-touch items-center justify-center rounded-xl border border-slate-200 bg-white text-charcoal transition-colors hover:border-gold hover:text-gold"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
    </header>
  );
}
