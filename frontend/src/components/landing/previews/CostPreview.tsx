/**
 * Component 4 preview — a critical-path Gantt band alongside the 30-year OPEX
 * degradation curve, matching the quantity-surveyor workspace.
 */

type Activity = {
  label: string;
  /** Start and span as percentages of the programme width. */
  start: number;
  span: number;
  critical: boolean;
};

const ACTIVITIES: readonly Activity[] = [
  { label: "Substructure", start: 0, span: 26, critical: true },
  { label: "Frame", start: 22, span: 30, critical: true },
  { label: "Envelope", start: 46, span: 24, critical: false },
  { label: "Services", start: 52, span: 28, critical: true },
  { label: "Finishes", start: 72, span: 26, critical: false },
];

export function CostPreview() {
  return (
    <div className="grid h-full gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      {/* Critical path programme. */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-slate-500">
            Critical path programme
          </p>
          <p className="text-[0.5625rem] font-semibold text-gold-dark">
            18 months
          </p>
        </div>

        {ACTIVITIES.map((activity) => (
          <div key={activity.label} className="flex items-center gap-2">
            <span className="w-[4.5rem] shrink-0 truncate text-[0.5625rem] font-semibold text-slate-500">
              {activity.label}
            </span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/70">
              <span
                className={[
                  "absolute inset-y-0 rounded-full",
                  activity.critical
                    ? "bg-gradient-to-r from-gold to-gold-dark"
                    : "bg-slate-400/60",
                ].join(" ")}
                style={{
                  left: `${activity.start}%`,
                  width: `${activity.span}%`,
                }}
              />
            </span>
          </div>
        ))}

        <p className="pt-1 text-[0.5625rem] font-medium text-slate-500">
          <span className="font-bold text-gold-dark">Gold</span> marks the
          driving path &mdash; zero float
        </p>
      </div>

      {/* CAPEX chip + 30-year OPEX curve. */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 p-3">
        <div>
          <p className="text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-slate-500">
            Day-one CAPEX
          </p>
          <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink">
            LKR 15.6
            <span className="text-[0.625rem] font-semibold text-slate-500">
              {" "}
              M
            </span>
          </p>
        </div>

        <div>
          <p className="text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-slate-500">
            30-year OPEX
          </p>
          <svg
            viewBox="0 0 120 34"
            className="mt-1 h-8 w-full"
            role="img"
            aria-label="Projected maintenance cost rising over a thirty-year horizon."
          >
            <defs>
              <linearGradient id="opexPreviewFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 32 L0 27 C 24 25, 40 22, 58 17 S 92 9, 120 3 L120 34 L0 34 Z"
              fill="url(#opexPreviewFill)"
            />
            <path
              d="M0 27 C 24 25, 40 22, 58 17 S 92 9, 120 3"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
