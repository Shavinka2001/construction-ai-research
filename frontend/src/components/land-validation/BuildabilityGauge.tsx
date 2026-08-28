"use client";

import type { ScoreFactor } from "@/lib/land-validation";

function bandColor(score: number): string {
  if (score >= 85) return "#15803d";
  if (score >= 70) return "#4d7c0f";
  if (score >= 55) return "#B8942E";
  if (score >= 40) return "#c2410c";
  return "#b91c1c";
}

export function BuildabilityGauge({
  score,
  rating,
  factors,
}: {
  score: number;
  rating: string;
  factors?: ScoreFactor[];
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 80;
  const circumference = Math.PI * radius; // half circle
  const dash = (clamped / 100) * circumference;
  const color = bandColor(clamped);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        Explainable Buildability Score
      </p>
      <div className="mt-3 flex flex-col items-center">
        <svg viewBox="0 0 200 110" className="w-full max-w-[260px]" aria-hidden>
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
          <text
            x="100"
            y="86"
            textAnchor="middle"
            className="fill-slate-900"
            style={{ fontSize: 34, fontWeight: 700 }}
          >
            {clamped}
          </text>
          <text
            x="100"
            y="104"
            textAnchor="middle"
            className="fill-slate-500"
            style={{ fontSize: 11, letterSpacing: 1 }}
          >
            / 100
          </text>
        </svg>
        <span
          className="mt-1 rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {rating}
        </span>
      </div>

      {factors && factors.length > 0 && (
        <ul className="mt-4 space-y-2">
          {factors.map((f) => (
            <li key={f.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  {f.label}
                  <span className="ml-1 text-slate-400">({f.weight_pct}%)</span>
                </span>
                <span className="font-mono text-slate-500">{f.factor_score}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${f.factor_score}%`,
                    backgroundColor: bandColor(f.factor_score),
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                {f.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
