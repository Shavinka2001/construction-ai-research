"use client";

import { useEffect, useState } from "react";
import { Loader2, FileDown, Save, FileText } from "lucide-react";
import {
  buildFeasibilityLedgerPdf,
  downloadBlob,
  LEDGER_FILENAME,
} from "@/lib/feasibility-pdf";
import { listLedgers, saveLedger, type SavedReport } from "@/lib/land-validation";
import { useFeasibility } from "./FeasibilityContext";

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-50 py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

export function ReportsTab() {
  const { ledger, activeProject, address, feasibility } = useFeasibility();
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) return;
    listLedgers(activeProject.id)
      .then(setSaved)
      .catch(() => setSaved([]));
  }, [activeProject]);

  const handleDownload = () => {
    if (!ledger) return;
    downloadBlob(
      buildFeasibilityLedgerPdf(ledger, activeProject?.name ?? "Untitled"),
      LEDGER_FILENAME
    );
  };

  const handleSave = async () => {
    if (!ledger || !activeProject) return;
    setBusy(true);
    setMsg(null);
    try {
      const rec = await saveLedger({
        project_id: activeProject.id,
        address: address ?? undefined,
        ledger,
      });
      setSaved((s) => [rec, ...s]);
      setMsg("Ledger saved to project.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (!ledger || !feasibility) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">
          Run an analysis first — the Site Feasibility Ledger compiles all 7
          modules once a Satellite Anchor is set.
        </p>
      </div>
    );
  }

  const b = ledger.boundary;
  const d = ledger.digitization;
  const a = ledger.audit;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-luxury">
        <header className="border-b-2 border-gold pb-3">
          <h2 className="text-xl font-bold text-slate-900">Site Feasibility Ledger</h2>
          <p className="text-xs text-slate-400">
            {activeProject?.name ?? "Untitled"} · {address || "custom coordinate"}
          </p>
        </header>

        <section className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            Module 5 — Buildability
          </h3>
          <LedgerRow
            label="Score"
            value={`${feasibility.buildability_score}/100 · ${feasibility.rating}`}
          />
          {feasibility.factors.map((f) => (
            <LedgerRow key={f.key} label={f.label} value={`${f.factor_score}/100`} />
          ))}
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            Site Conditions
          </h3>
          <LedgerRow label="Elevation" value={`${feasibility.topography.elevation_m.toFixed(1)} m`} />
          <LedgerRow label="Slope" value={`${feasibility.topography.slope_deg.toFixed(1)}°`} />
          <LedgerRow
            label="Terrain"
            value={`${feasibility.terrain.worldcover_class} — ${feasibility.terrain.suitability}`}
          />
          <LedgerRow
            label="Flood risk"
            value={`${feasibility.flood.risk_band} (${feasibility.flood.water_occurrence_pct.toFixed(0)}%)`}
          />
          <LedgerRow
            label="Weather"
            value={
              feasibility.weather.source === "open-meteo"
                ? `rain ${feasibility.weather.rainfall_exposure} · UV ${feasibility.weather.uv_index_max ?? "—"}`
                : "unavailable"
            }
          />
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            Module 1 &amp; 4 — Boundary
          </h3>
          {d ? (
            <LedgerRow label="Digitized area" value={`${d.area_perches.toFixed(2)} P (${d.method})`} />
          ) : (
            <LedgerRow label="Digitized area" value="not digitized" />
          )}
          {b ? (
            <>
              <LedgerRow label="Lot area" value={`${b.lot_area_perches.toFixed(2)} P`} />
              <LedgerRow label="Build zone" value={`${b.build_zone_area_sqm.toFixed(0)} m² (${b.plot_coverage_pct}%)`} />
              <LedgerRow label="Calibrated" value={b.calibrated ? "yes" : "no"} />
            </>
          ) : (
            <LedgerRow label="Boundary" value="not calibrated" />
          )}
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            Module 2 — Regulatory Audit
          </h3>
          {a ? (
            <>
              <LedgerRow label="Compliance" value={`${a.compliance_score}/100`} />
              {a.elements.map((el) => (
                <LedgerRow key={el.key} label={el.label} value={el.status} />
              ))}
            </>
          ) : (
            <LedgerRow label="Audit" value="not performed" />
          )}
        </section>

        <p className="mt-6 text-[11px] italic text-slate-400">
          Indicative only — not a substitute for a licensed surveyor or chartered
          engineer. Generated {new Date(ledger.generated_at).toLocaleString()}.
        </p>
      </article>

      <aside className="h-fit space-y-3">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-charcoal-light"
        >
          <FileDown className="h-4 w-4 text-gold" /> Download PDF
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy || !activeProject}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gold/40 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-gold/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-gold" />}
          Save to project
        </button>
        {!activeProject && (
          <p className="text-xs text-slate-400">
            Select a project in Portfolio to enable saving.
          </p>
        )}
        {msg && <p className="text-xs text-slate-500">{msg}</p>}

        {saved.length > 0 && (
          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Saved ledgers
            </p>
            <ul className="mt-2 space-y-1.5 text-xs">
              {saved.map((s) => (
                <li key={s.id} className="flex justify-between text-slate-600">
                  <span>#{s.id}</span>
                  <span className="text-slate-400">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
