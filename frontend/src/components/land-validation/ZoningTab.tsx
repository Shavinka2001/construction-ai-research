"use client";

import { useFeasibility } from "./FeasibilityContext";

const PERMITTED_USES = [
  ["Single-family dwelling", "Permitted"],
  ["Two / multi-unit dwelling", "Permitted (subject to coverage & parking)"],
  ["Home office / professional practice", "Permitted (accessory, < 25% floor area)"],
  ["Boutique retail / café", "Special approval — MC/UC/PS"],
  ["Light industrial / workshop", "Not permitted in residential zone"],
];

const PARKING = [
  ["Dwelling unit ≤ 140 m²", "1 car space"],
  ["Dwelling unit > 140 m²", "2 car spaces"],
  ["Visitor parking (multi-unit)", "1 per 4 units"],
  ["Retail / office", "1 per 45 m² GFA"],
];

export function ZoningTab() {
  const { boundary, feasibility } = useFeasibility();

  const dimStandards: [string, string][] = [
    ["Max plot coverage", `${boundary?.max_plot_coverage_pct ?? 65}%`],
    [
      "Lot area",
      boundary
        ? `${boundary.lot_area_perches.toFixed(2)} perches (${boundary.lot_area_sqm.toFixed(0)} m²)`
        : "Calibrate in Parcel Search",
    ],
    [
      "Buildable envelope",
      boundary
        ? `${boundary.build_zone_area_sqm.toFixed(0)} m² (${boundary.plot_coverage_pct}%)`
        : "—",
    ],
    ["Max building height", "2 storeys / ~10.7 m (35 ft)"],
    ["Min. street frontage", "6.0 m"],
    [
      "Terrain classification",
      feasibility ? `${feasibility.terrain.worldcover_class} — ${feasibility.terrain.suitability}` : "—",
    ],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Dimensional Standards
        </p>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {dimStandards.map(([k, v]) => (
              <tr key={k} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-4 text-slate-500">{k}</td>
                <td className="py-2 text-right font-medium text-slate-800">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Setback Table — UDA Gazette 2021
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-slate-400">
              <th className="py-1 text-left font-semibold">Edge</th>
              <th className="py-1 text-right font-semibold">Required</th>
            </tr>
          </thead>
          <tbody>
            {(boundary?.setbacks ?? [
              { edge: "Front (road / street line)", requirement_m: 3.0, basis: "~10 ft" },
              { edge: "Rear yard", requirement_m: 2.3, basis: "~7.5 ft" },
              { edge: "Side yard (each)", requirement_m: 1.5, basis: "~5 ft" },
            ]).map((s) => (
              <tr key={s.edge} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-4 text-slate-600">{s.edge}</td>
                <td className="py-2 text-right font-medium text-slate-800">
                  {s.requirement_m.toFixed(1)} m
                  <span className="ml-1 text-xs text-slate-400">({s.basis})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Permitted Uses
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {PERMITTED_USES.map(([use, status]) => (
            <li key={use} className="flex items-start justify-between gap-3">
              <span className="text-slate-600">{use}</span>
              <span className="shrink-0 text-right text-xs font-medium text-slate-500">
                {status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Parking Matrix
        </p>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {PARKING.map(([k, v]) => (
              <tr key={k} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-4 text-slate-500">{k}</td>
                <td className="py-2 text-right font-medium text-slate-800">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
