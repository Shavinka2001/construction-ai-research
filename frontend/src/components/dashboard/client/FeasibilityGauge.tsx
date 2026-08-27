"use client";

type FeasibilityGaugeProps = {
  score?: number;
  max?: number;
};

export function FeasibilityGauge({ score = 84, max = 100 }: FeasibilityGaugeProps) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / max, 1);
  const offset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center">
      <svg
        viewBox="0 0 200 200"
        className="h-44 w-44 sm:h-52 sm:w-52"
        role="img"
        aria-label={`Feasibility score ${score} out of ${max}`}
      >
        <defs>
          <linearGradient id="feasibilityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1E24" />
            <stop offset="55%" stopColor="#2A2A32" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="14"
        />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="url(#feasibilityGradient)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
          className="transition-all duration-1000 ease-out"
        />
        <text
          x="100"
          y="96"
          textAnchor="middle"
          className="fill-slate-900 text-4xl font-bold"
          fontSize="36"
          fontWeight="700"
        >
          {score}
        </text>
        <text
          x="100"
          y="118"
          textAnchor="middle"
          className="fill-slate-500"
          fontSize="13"
        >
          / {max}
        </text>
      </svg>
    </div>
  );
}

const MICRO_INDICATORS = [
  { label: "Site Suitability", value: 92 },
  { label: "Zoning Compliance", value: 80 },
  { label: "Structural Integrity", value: 88 },
] as const;

export function FeasibilityMicroIndicators() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-3">
      {MICRO_INDICATORS.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition-colors hover:border-gold/20"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {item.label}
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">{item.value}%</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-primary to-gold transition-all duration-700"
              style={{ width: `${item.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
