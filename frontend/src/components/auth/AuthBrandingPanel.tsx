"use client";

import { cn } from "@/lib/utils";
import { AUTH_STATS } from "@/lib/roles";

function BlueprintArt() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full opacity-30"
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="40" y="40" width="320" height="320" stroke="#D4AF37" strokeWidth="0.75" />
      <rect x="80" y="80" width="240" height="240" stroke="#D4AF37" strokeWidth="0.5" strokeDasharray="4 4" />
      <line x1="40" y1="200" x2="360" y2="200" stroke="#D4AF37" strokeWidth="0.5" />
      <line x1="200" y1="40" x2="200" y2="360" stroke="#D4AF37" strokeWidth="0.5" />
      <path d="M120 280 L200 120 L280 280 Z" stroke="#D4AF37" strokeWidth="1" />
      <circle cx="200" cy="200" r="60" stroke="#D4AF37" strokeWidth="0.75" />
      <path d="M60 340 L140 260 M260 140 L340 60" stroke="#D4AF37" strokeWidth="0.5" />
      <path d="M60 60 L140 140 M260 260 L340 340" stroke="#D4AF37" strokeWidth="0.5" />
    </svg>
  );
}

export function AuthBrandingPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-brand-primary lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
      <div className="absolute inset-0">
        <BlueprintArt />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-16">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-px w-8 bg-gold" />
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
            Construction AI
          </span>
        </div>
        <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
          Precision Pre-Construction Engineering
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
          Construction AI: Intelligent feasibility analysis, regulatory
          compliance, and cost intelligence — engineered for modern teams.
        </p>
      </div>

      <div className="relative z-10 border-t border-white/10 px-12 py-10 xl:px-16">
        <div className="grid grid-cols-3 gap-6">
          {AUTH_STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-xl font-bold text-gold">{stat.value}</p>
              <p className="mt-1 text-xs leading-snug text-slate-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthMobileBrand() {
  return (
    <div className="mb-8 text-center lg:hidden">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        Construction AI
      </p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">
        Precision Pre-Construction Engineering
      </h2>
    </div>
  );
}
