"use client";

import { transectStats } from "@/lib/feasibility-insights";

export function ElevationProfileChart({
  transect,
  slopeDeg,
  compact = false,
}: {
  transect: number[];
  slopeDeg?: number;
  compact?: boolean;
}) {
  if (!transect || transect.length === 0) return null;

  const stats = transectStats(transect)!;
  const w = 520;
  const h = compact ? 110 : 180;
  const padL = compact ? 24 : 40;
  const padB = compact ? 14 : 24;
  const padT = 12;
  const { min, max } = stats;
  const range = max - min || 1;

  // Smooth area path across the transect.
  const px = (i: number) => padL + (i * (w - padL - 6)) / (transect.length - 1);
  const py = (v: number) => h - padB - ((v - min) / range) * (h - padT - padB);
  const line = transect.map((v, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${px(transect.length - 1).toFixed(1)} ${h - padB} L ${padL} ${h - padB} Z`;

  const body = (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label={`${transect.length}-point west-to-east elevation profile`}
      preserveAspectRatio="none"
    >
      {[0, 0.5, 1].map((t) => {
        const y = padT + (h - padT - padB) * t;
        const val = max - range * t;
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={w - 4} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            {!compact && (
              <text x={4} y={y + 3} style={{ fontSize: 9 }} className="fill-slate-400">
                {val.toFixed(0)}
              </text>
            )}
          </g>
        );
      })}
      <path d={area} fill="#B8942E" fillOpacity={0.14} />
      <path d={line} fill="none" stroke="#B8942E" strokeWidth={compact ? 1.5 : 2} />
      <line x1={padL} y1={h - padB} x2={w - 4} y2={h - padB} stroke="#94a3b8" strokeWidth="1" />
      <text x={padL} y={h - 3} style={{ fontSize: 9 }} className="fill-slate-400">
        W
      </text>
      <text x={w - 12} y={h - 3} style={{ fontSize: 9 }} className="fill-slate-400">
        E
      </text>
    </svg>
  );

  if (compact) return body;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          E–W Elevation Transect
        </p>
        {slopeDeg != null && (
          <span className="text-xs text-slate-500">
            slope ≈{" "}
            <span className="font-semibold text-slate-700">
              {slopeDeg.toFixed(1)}°
            </span>
          </span>
        )}
      </div>
      <div className="mt-3">{body}</div>
      <p className="mt-1 text-[11px] text-slate-400">
        Elevation in metres across a ~200 m west-to-east section through the
        anchor · relief {stats.relief.toFixed(1)} m.
      </p>
    </div>
  );
}
