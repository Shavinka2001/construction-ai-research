"use client";

export function ElevationProfileChart({
  transect,
  slopeDeg,
}: {
  transect: number[];
  slopeDeg?: number;
}) {
  if (!transect || transect.length === 0) return null;

  const w = 520;
  const h = 180;
  const padL = 40;
  const padB = 24;
  const padT = 12;
  const min = Math.min(...transect);
  const max = Math.max(...transect);
  const range = max - min || 1;
  const barW = (w - padL - 8) / transect.length;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          E–W Elevation Transect
        </p>
        {slopeDeg != null && (
          <span className="text-xs text-slate-500">
            slope ≈ <span className="font-semibold text-slate-700">{slopeDeg.toFixed(1)}°</span>
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-3 w-full"
        role="img"
        aria-label="14-point west-to-east elevation profile"
      >
        {[0, 0.5, 1].map((t) => {
          const y = padT + (h - padT - padB) * t;
          const val = max - range * t;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - 4} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={4} y={y + 3} style={{ fontSize: 9 }} className="fill-slate-400">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {transect.map((v, i) => {
          const bh = ((v - min) / range) * (h - padT - padB);
          const x = padL + i * barW;
          const y = h - padB - bh;
          return (
            <rect
              key={i}
              x={x + 1}
              y={y}
              width={Math.max(barW - 2, 1)}
              height={Math.max(bh, 1)}
              rx="1.5"
              fill="#B8942E"
              opacity={0.85}
            />
          );
        })}
        <line x1={padL} y1={h - padB} x2={w - 4} y2={h - padB} stroke="#94a3b8" strokeWidth="1" />
        <text x={padL} y={h - 6} style={{ fontSize: 9 }} className="fill-slate-400">
          W
        </text>
        <text x={w - 12} y={h - 6} style={{ fontSize: 9 }} className="fill-slate-400">
          E
        </text>
      </svg>
      <p className="mt-1 text-[11px] text-slate-400">
        Elevation in metres across a ~200 m west-to-east section through the anchor.
      </p>
    </div>
  );
}
