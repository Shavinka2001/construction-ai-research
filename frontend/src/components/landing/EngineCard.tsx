"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/landing/primitives/Badge";
import type { Engine } from "@/components/landing/types";
import { ClashPreview } from "@/components/landing/previews/ClashPreview";
import { CompliancePreview } from "@/components/landing/previews/CompliancePreview";
import { CostPreview } from "@/components/landing/previews/CostPreview";
import { TerrainPreview } from "@/components/landing/previews/TerrainPreview";

const PREVIEWS: Record<string, () => JSX.Element> = {
  "site-intelligence": TerrainPreview,
  "architectural-validation": ClashPreview,
  "regulatory-compliance": CompliancePreview,
  "cost-lifecycle": CostPreview,
};

/** Capabilities shown before the visitor asks for the rest. */
const COLLAPSED_CAPABILITY_COUNT = 3;

export function EngineCard({ engine }: { engine: Engine }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const Icon = engine.icon;
  const Preview = PREVIEWS[engine.id];
  const isGold = engine.accent === "gold";

  const hiddenCount = engine.capabilities.length - COLLAPSED_CAPABILITY_COUNT;
  const visibleCapabilities = isExpanded
    ? engine.capabilities
    : engine.capabilities.slice(0, COLLAPSED_CAPABILITY_COUNT);

  return (
    <article
      className={cn(
        "lp-glass-light lp-hairline-gold group relative flex h-full flex-col overflow-hidden rounded-2xl p-5 shadow-luxury transition-shadow duration-300 sm:p-6",
        isGold ? "hover:shadow-glow-gold" : "hover:shadow-glow-emerald"
      )}
    >
      {/* Accent wash that warms on hover. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl transition-opacity duration-500",
          isGold ? "bg-gold/10" : "bg-emerald-brand/10",
          "opacity-60 group-hover:opacity-100"
        )}
      />

      <header className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
              isGold
                ? "border-gold/25 bg-gold/10 text-gold-dark"
                : "border-emerald-brand/25 bg-emerald-brand-muted text-emerald-brand-dark"
            )}
          >
            <Icon className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-slate-400">
              Component {engine.index}
            </p>
            <h3 className="mt-0.5 font-display text-base font-bold leading-tight tracking-tight text-ink sm:text-lg">
              {engine.title}
            </h3>
          </div>
        </div>

        <Badge
          variant={engine.maturity === "live" ? "emerald" : "gold"}
          withDot
          className="shrink-0"
        >
          {engine.maturity === "live" ? "Live engine" : "Prototype"}
        </Badge>
      </header>

      <p className="relative mt-4 text-sm leading-relaxed text-slate-600">
        {engine.tagline}
      </p>

      {/* Visual read-out. */}
      {Preview ? (
        <div className="relative mt-5 h-[9.5rem] overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-100/80 to-white p-3">
          <Preview />
        </div>
      ) : null}

      {/* Metrics. */}
      <dl className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {engine.metrics.map((metric) => (
          <div key={metric.label}>
            <dd className="font-display text-lg font-bold tabular-nums leading-none tracking-tight text-ink">
              {metric.value}
              {metric.unit ? (
                <span className="ml-0.5 text-[0.625rem] font-semibold text-slate-500">
                  {metric.unit}
                </span>
              ) : null}
            </dd>
            <dt className="mt-1 text-[0.625rem] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-400">
              {metric.label}
            </dt>
          </div>
        ))}
      </dl>

      {/* Capabilities. */}
      <ul className="relative mt-5 space-y-2.5 border-t border-slate-200/80 pt-5">
        {visibleCapabilities.map((capability) => (
          <li key={capability.label} className="flex gap-2.5">
            <span
              aria-hidden
              className={cn(
                "mt-[0.4375rem] h-1.5 w-1.5 shrink-0 rounded-full",
                isGold ? "bg-gold" : "bg-emerald-brand"
              )}
            />
            <p className="text-[0.8125rem] leading-snug text-slate-600">
              <span className="font-semibold text-ink">{capability.label}</span>
              <span className="text-slate-400"> &mdash; </span>
              {capability.detail}
            </p>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
          className="lp-focus relative mt-3 inline-flex min-h-touch items-center gap-1.5 self-start rounded-lg px-1 text-[0.8125rem] font-semibold text-slate-500 transition-colors hover:text-ink ring-offset-white"
        >
          {isExpanded
            ? "Show fewer capabilities"
            : `Show ${hiddenCount} more ${hiddenCount === 1 ? "capability" : "capabilities"}`}
          <ChevronDown
            aria-hidden
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      ) : null}

      {/* Stack + deep link. */}
      <footer className="relative mt-auto pt-5">
        <ul className="flex flex-wrap gap-1.5">
          {engine.stack.map((item) => (
            <li
              key={item}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.625rem] font-semibold text-slate-500"
            >
              {item}
            </li>
          ))}
        </ul>

        <Link
          href={engine.href}
          className={cn(
            "lp-focus mt-4 inline-flex min-h-touch items-center gap-1.5 rounded-lg text-[0.8125rem] font-bold transition-colors ring-offset-white",
            isGold
              ? "text-gold-dark hover:text-ink"
              : "text-emerald-brand-dark hover:text-ink"
          )}
        >
          Open in platform
          <ArrowUpRight aria-hidden className="h-4 w-4" />
          <span className="sr-only">
            {` — ${engine.academicName} (requires sign-in)`}
          </span>
        </Link>
      </footer>
    </article>
  );
}
