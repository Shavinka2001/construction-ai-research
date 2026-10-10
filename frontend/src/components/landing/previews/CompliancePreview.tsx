/**
 * Component 3 preview — the four-stage approval roadmap with the live stage
 * carrying its ML verdict, plus the window-to-floor ratio gauge.
 */

const STAGES = [
  { label: "Geospatial zone", state: "done" },
  { label: "Authority mapping", state: "done" },
  { label: "Document verification", state: "active" },
  { label: "Approval roadmap", state: "pending" },
] as const;

export function CompliancePreview() {
  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <ol className="space-y-2">
        {STAGES.map((stage, index) => {
          const isDone = stage.state === "done";
          const isActive = stage.state === "active";

          return (
            <li key={stage.label} className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={[
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.5625rem] font-bold",
                  isDone
                    ? "border-emerald-brand/50 bg-emerald-brand/20 text-emerald-brand"
                    : isActive
                      ? "border-gold/60 bg-gold/20 text-gold"
                      : "border-slate-300 bg-white text-slate-400",
                ].join(" ")}
              >
                {isDone ? "✓" : index + 1}
              </span>

              <span
                className={[
                  "flex-1 truncate text-[0.6875rem] font-semibold",
                  isActive ? "text-ink" : isDone ? "text-slate-600" : "text-slate-400",
                ].join(" ")}
              >
                {stage.label}
              </span>

              {isActive ? (
                <span className="shrink-0 rounded-md bg-gold/15 px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wide text-gold-dark">
                  Minor violation
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Window-to-floor ratio audit against the 10% statutory minimum. */}
      <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-slate-500">
            Window-to-floor ratio
          </p>
          <p className="text-sm font-bold tabular-nums text-emerald-brand">
            12.4%
          </p>
        </div>

        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-brand"
            style={{ width: "62%" }}
          />
          {/* Statutory minimum marker at 10% of a 20% scale. */}
          <div
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-ink"
            style={{ left: "50%" }}
          />
        </div>

        <p className="mt-1.5 text-[0.5625rem] font-medium text-slate-500">
          Minimum 10% &mdash; natural daylight provision satisfied
        </p>
      </div>
    </div>
  );
}
