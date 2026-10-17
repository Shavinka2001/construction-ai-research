"use client";

import type { ScoreFactor } from "@/lib/land-validation";
import {
  IMPACT_LABEL,
  bandColor,
  cleanReason,
  factorImpact,
  type Impact,
} from "@/lib/feasibility-insights";

const IMPACT_STYLE: Record<Impact, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  neutral: "bg-amber-50 text-amber-700 ring-amber-600/20",
  negative: "bg-orange-50 text-orange-700 ring-orange-600/20",
};

function ScoreArc({ score, color }: { score: number; color: string }) {
  // 240° sweep, opening at the bottom.
  const clamped = Math.max(0, Math.min(100, score));
  const start = 150;
  const sweep = 240;
  const r = 80;
  const cx = 100;
  const cy = 100;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (deg: number) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
  const [x0, y0] = pt(start);
  const [x1, y1] = pt(start + sweep);
  const [xv, yv] = pt(start + (sweep * clamped) / 100);
  const large = sweep > 180 ? 1 : 0;
  const valLarge = (sweep * clamped) / 100 > 180 ? 1 : 0;

  return (
    <svg viewBox="0 0 200 180" className="w-full max-w-[240px]" aria-hidden>
      <path
        d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {clamped > 0 && (
        <path
          d={`M ${x0} ${y0} A ${r} ${r} 0 ${valLarge} 1 ${xv} ${yv}`}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
        />
      )}
      <text
        x={cx}
        y={cy + 2}
        textAnchor="middle"
        className="fill-slate-900"
        style={{ fontSize: 44, fontWeight: 800 }}
      >
        {clamped}
      </text>
      <text
        x={cx}
        y={cy + 24}
        textAnchor="middle"
        className="fill-slate-400"
        style={{ fontSize: 12, letterSpacing: 1 }}
      >
        / 100
      </text>
    </svg>
  );
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
  const color = bandColor(clamped);
  // The mid gold band (#B8942E) fails AA as small text on its own tint — use a
  // darkened gold for the label only.
  const textColor = clamped >= 55 && clamped < 70 ? "#6b5518" : color;
  const list = factors ?? [];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Explainable Buildability Score
        </p>
      </div>

      <div className="mt-2 flex flex-col items-center">
        <ScoreArc score={clamped} color={color} />
        <span
          className="-mt-2 rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: `${color}1f`, color: textColor }}
        >
          {rating}
        </span>
        {list.length > 0 && (
          <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
            Weighted across {list.length} site factors from the GIS, flood,
            terrain and weather analysis.
          </p>
        )}
      </div>

      {list.length > 0 && (
        <div className="mt-4">
          <div className="grid grid-cols-[1fr_3rem_2.5rem] items-center gap-x-3 border-b border-slate-100 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Factor</span>
            <span className="text-right">Weight</span>
            <span className="text-right">Score</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {list.map((f) => {
              const impact = factorImpact(f.reason);
              return (
                <li key={f.key} className="py-2.5">
                  <div className="grid grid-cols-[1fr_3rem_2.5rem] items-center gap-x-3">
                    <span className="text-xs font-semibold text-slate-700">
                      {f.label}
                    </span>
                    <span className="text-right font-mono text-xs text-slate-500">
                      {f.weight_pct}%
                    </span>
                    <span className="text-right font-mono text-xs font-semibold text-slate-700">
                      {f.factor_score}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${f.factor_score}%`,
                          backgroundColor: bandColor(f.factor_score),
                        }}
                      />
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${IMPACT_STYLE[impact]}`}
                    >
                      {IMPACT_LABEL[impact]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">
                    {cleanReason(f.reason)}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t-2 border-slate-200 pt-2 text-xs font-bold text-slate-800">
            <span>Weighted total</span>
            <span className="font-mono">{clamped} / 100</span>
          </div>
        </div>
      )}
    </div>
  );
}
