import { jsPDF } from "jspdf";
import type { LedgerReport } from "@/lib/land-validation";

const GOLD: [number, number, number] = [184, 148, 46];
const INK: [number, number, number] = [15, 23, 42];
const MUTE: [number, number, number] = [100, 116, 139];

export const LEDGER_FILENAME = "Site_Feasibility_Ledger.pdf";

export function buildFeasibilityLedgerPdf(
  ledger: LedgerReport,
  projectName: string
): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const ensure = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const heading = (text: string) => {
    ensure(28);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(text.toUpperCase(), margin, y);
    y += 14;
  };
  const row = (label: string, value: string) => {
    ensure(16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTE);
    doc.text(label, margin, y);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(value, pageW - margin * 2 - 160), margin + 160, y);
    y += 16;
  };
  const para = (text: string) => {
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    ensure(lines.length * 12 + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTE);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 4;
  };

  // --- header --------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("Site Feasibility Ledger", margin, y);
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("PRE-CONSTRUCTION FEASIBILITY ANALYZER", pageW - margin, y, {
    align: "right",
  });
  y += 12;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2);
  doc.line(margin, y, pageW - margin, y);
  y += 22;

  row("Project", projectName || "Untitled");
  row("Address", ledger.address || "—");
  row("Anchor (lat, lon)", `${ledger.anchor.lat.toFixed(6)}, ${ledger.anchor.lon.toFixed(6)}`);
  row("Generated", new Date(ledger.generated_at).toLocaleString());

  // --- Module 5: buildability --------------------------------------------
  const f = ledger.feasibility;
  heading("1 · Buildability Score");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  ensure(34);
  doc.text(`${f.buildability_score}/100`, margin, y + 8);
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(f.rating, margin + 120, y + 8);
  y += 26;
  f.factors.forEach((fac) => {
    row(`${fac.label} (${fac.weight_pct}%)`, `${fac.factor_score}/100 — ${fac.reason}`);
  });

  // --- Module 5: site conditions ---------------------------------------
  heading("2 · GIS Topography, Terrain, Flood & Weather");
  row("Elevation", `${f.topography.elevation_m.toFixed(1)} m (${f.topography.source})`);
  row("Slope", `${f.topography.slope_deg.toFixed(1)}°`);
  row("Terrain class", `${f.terrain.worldcover_class} — ${f.terrain.suitability}`);
  row(
    "Flood risk",
    `${f.flood.risk_band} (${f.flood.water_occurrence_pct.toFixed(0)}% historical water occurrence)`
  );
  row(
    "Weather",
    f.weather.source === "open-meteo"
      ? `${f.weather.temperature_2m ?? "—"}°C, ${f.weather.relative_humidity_2m ?? "—"}% RH, rainfall ${f.weather.rainfall_exposure}, UV ${f.weather.uv_index_max ?? "—"}`
      : "weather service unavailable"
  );
  f.weather.advisories.forEach((a) => para(`• ${a}`));

  // --- Module 4: boundary + zoning -----------------------------------
  heading("3 · Precision Boundary & Optimal Build Zone (UDA Gazette 2021)");
  if (ledger.boundary) {
    const b = ledger.boundary;
    row("Lot area", `${b.lot_area_perches.toFixed(2)} perches (${b.lot_area_sqm.toFixed(0)} m²)`);
    row("Build zone area", `${b.build_zone_area_sqm.toFixed(0)} m²`);
    row(
      "Plot coverage",
      `${b.plot_coverage_pct}% of lot (max ${b.max_plot_coverage_pct}%)`
    );
    row("Calibrated", b.calibrated ? "Yes — to entered perch value" : "No");
    b.setbacks.forEach((s) => row(s.edge, `${s.requirement_m} m — ${s.basis}`));
  } else {
    para("No calibrated boundary. Enter the land area in perches in Parcel Search.");
  }

  // --- Module 1: digitization --------------------------------------
  heading("4 · Survey Plan Digitization");
  if (ledger.digitization) {
    const d = ledger.digitization;
    row("Method", d.method);
    row("Scale source", d.scale_source);
    row("Detected area", `${d.area_perches.toFixed(2)} perches (${d.area_sqm.toFixed(0)} m²)`);
    row("Perimeter", `${d.perimeter_m.toFixed(1)} m`);
    d.notes.forEach((n) => para(`• ${n}`));
  } else {
    para("No survey plan digitized.");
  }

  // --- Module 2: audit --------------------------------------------
  heading("5 · Survey Mistake & Regulatory Audit");
  if (ledger.audit) {
    const a = ledger.audit;
    row("Compliance", `${a.compliance_score}/100 — ${a.summary}`);
    a.elements.forEach((el) => {
      row(el.label, el.status);
      if (el.status !== "PRESENT" && el.advisory.length) {
        el.advisory.forEach((step, i) => para(`   ${i + 1}. ${step}`));
      }
    });
  } else {
    para("No audit performed.");
  }

  // --- footer -----------------------------------------------------
  ensure(40);
  y += 16;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTE);
  doc.text(
    "Generated by the AI-Driven Pre-Construction Feasibility Analyzer. Indicative only — not a substitute for a licensed surveyor or chartered engineer.",
    margin,
    y,
    { maxWidth: pageW - margin * 2 }
  );

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
