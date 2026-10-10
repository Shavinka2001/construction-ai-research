"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

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

/**
 * One research component, as a full-width editorial row.
 *
 * The preview alternates sides down the page so the four components do not
 * read as four instances of the same card. Capabilities are set as prose in
 * two columns rather than as a bulleted feature list, which keeps the density
 * closer to a technical write-up than to a pricing page.
 */
export function EngineRow({
  engine,
  flip,
}: {
  engine: Engine;
  /** Put the preview on the left — alternated by the caller. */
  flip: boolean;
}) {
  const Icon = engine.icon;
  const Preview = PREVIEWS[engine.id];

  return (
    <article className="grid gap-10 border-t border-slate-200 py-14 sm:py-16 lg:grid-cols-12 lg:gap-12 lg:py-20">
      {/* Index rail. */}
      <div className="lg:col-span-1">
        <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-4">
          <span className="font-display text-4xl font-bold leading-none tracking-display text-slate-200 lg:text-5xl">
            {String(engine.index).padStart(2, "0")}
          </span>
          <Icon
            aria-hidden
            className="h-5 w-5 shrink-0 text-gold lg:h-6 lg:w-6"
          />
        </div>
      </div>

      {/* Copy. */}
      <div
        className={cn(
          "lg:col-span-6",
          flip ? "lg:order-last lg:col-start-7" : undefined
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-xl font-bold leading-tight tracking-heading text-ink sm:text-2xl">
            {engine.title}
          </h3>
          <span
            className={cn(
              "lp-label",
              engine.maturity === "live"
                ? "text-emerald-brand-dark"
                : "text-slate-400"
            )}
          >
            {engine.maturity === "live" ? "running" : "prototype"}
          </span>
        </div>

        <p className="mt-1.5 font-mono text-label leading-relaxed text-slate-400">
          {engine.academicName}
        </p>

        <p className="mt-5 max-w-xl text-lead leading-[1.6] text-slate-600 sm:text-lg">
          {engine.tagline}
        </p>

        {/* Capabilities as prose, two columns on wide screens. */}
        <dl className="mt-8 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {engine.capabilities.map((capability) => (
            <div key={capability.label}>
              <dt className="text-caption font-semibold leading-snug text-ink">
                {capability.label}
              </dt>
              <dd className="mt-1 text-caption leading-relaxed text-slate-500">
                {capability.detail}
              </dd>
            </div>
          ))}
        </dl>

        <Link
          href={engine.href}
          className="lp-focus group mt-9 inline-flex min-h-touch items-center gap-2 border-b border-ink/20 text-body font-semibold text-ink transition-colors hover:border-gold ring-offset-white"
        >
          Open in the platform
          <ArrowRight
            aria-hidden
            className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1"
          />
          <span className="sr-only"> (sign-in required)</span>
        </Link>
      </div>

      {/* Preview, metrics and stack. */}
      <div
        className={cn(
          "lg:col-span-5",
          flip ? "lg:order-first lg:col-start-2 lg:row-start-1" : undefined
        )}
      >
        {Preview ? (
          <div className="overflow-hidden border border-slate-200 bg-slate-50/80 p-4">
            <div className="h-[10.5rem]">
              <Preview />
            </div>
          </div>
        ) : null}

        <dl className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
          {engine.metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <dt className="text-micro text-slate-500">{metric.label}</dt>
              <dd className="font-mono text-caption font-medium tabular-nums text-ink">
                {metric.value}
                {metric.unit ? (
                  <span className="ml-1 text-slate-400">{metric.unit}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 font-mono text-label leading-relaxed text-slate-400">
          {engine.stack.join("  ·  ")}
        </p>
      </div>
    </article>
  );
}
