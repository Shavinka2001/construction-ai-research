/**
 * Industrial export helpers — PNG blueprint snapshot + AutoCAD DXF download.
 *
 * DXF layers: WALLS | COLUMNS | DOORS | WINDOWS (Y-flipped in backend).
 */

import axios from "axios";
import { API_V1, type ApiResponse } from "@/lib/api";
import type { DetectionBox } from "@/lib/clash-detection";

export const RESOLVED_BLUEPRINT_PNG = "Construction_AI_Resolved_Blueprint.png";
export const RESOLVED_DXF_FILENAME = "Resolved_Blueprint_Layout.dxf";
const CANVAS_SIZE = 1024;

function parsePercent(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(n) ? n / 100 : 0;
}

/** Convert a CSS%-positioned detection (+ GCR translate) into canvas xyxy. */
export function detectionToBbox(
  box: DetectionBox,
  canvas = CANVAS_SIZE
): [number, number, number, number] {
  const xmin = parsePercent(box.left) * canvas + (box.translateX ?? 0);
  const ymin = parsePercent(box.top) * canvas + (box.translateY ?? 0);
  const width = parsePercent(box.width) * canvas;
  const height = parsePercent(box.height) * canvas;
  return [
    Math.round(xmin * 100) / 100,
    Math.round(ymin * 100) / 100,
    Math.round((xmin + width) * 100) / 100,
    Math.round((ymin + height) * 100) / 100,
  ];
}

type DxfEntity = {
  id: string;
  bbox: number[];
  label?: string;
  resolved?: boolean;
};

export type DxfLayoutPayload = {
  canvas_size: number;
  walls: DxfEntity[];
  columns: DxfEntity[];
  doors: DxfEntity[];
  windows: DxfEntity[];
};

function toEntity(d: DetectionBox, resolved = false): DxfEntity {
  return {
    id: d.id,
    label: d.label,
    bbox: detectionToBbox(d),
    resolved,
  };
}

function isDoor(d: DetectionBox): boolean {
  const s = `${d.id} ${d.label}`.toLowerCase();
  return s.includes("door") || /^d\d/.test(d.id.toLowerCase());
}

function isWindow(d: DetectionBox): boolean {
  const s = `${d.id} ${d.label}`.toLowerCase();
  // Avoid classifying wall ids like "W1" that are labeled "Wall"
  if (s.includes("wall")) return false;
  return s.includes("window") || /^w\d/.test(d.id.toLowerCase());
}

/**
 * Build a complete floor-plan payload for DXF:
 * WALLS + COLUMNS + DOORS + WINDOWS from live detections.
 */
export function buildDxfLayoutFromDetections(
  detections: DetectionBox[]
): DxfLayoutPayload {
  const walls = detections
    .filter((d) => d.kind === "other" || /wall/i.test(d.label))
    .filter((d) => !isDoor(d) && !isWindow(d) && d.kind !== "column")
    .map((d) => toEntity(d));

  // Outer boundary so AutoCAD always has a WALLS frame
  if (walls.length === 0) {
    walls.push({
      id: "BOUNDARY",
      label: "Outer Boundary",
      bbox: [0, 0, CANVAS_SIZE, CANVAS_SIZE],
      resolved: false,
    });
  }

  const columns = detections
    .filter((d) => d.kind === "column")
    .map((d) => toEntity(d, Boolean(d.resolved)));

  const openings = detections.filter((d) => d.kind === "opening");
  const doors = openings.filter(isDoor).map((d) => toEntity(d));
  const windows = openings.filter(isWindow).map((d) => toEntity(d));

  // Any remaining openings default to DOORS so nothing is dropped
  for (const d of openings) {
    if (!isDoor(d) && !isWindow(d)) {
      doors.push(toEntity(d));
    }
  }

  return {
    canvas_size: CANVAS_SIZE,
    walls,
    columns,
    doors,
    windows,
  };
}

/** Same-tab download via temporary hidden anchor (avoids pop-up blockers). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** Download a PNG data URL as a named file. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

type ClashLayoutReportOut = {
  report_id: number;
  project_id: number;
  report_type: string;
};

/**
 * Persist the full floor-plan layout, then GET the DXF via authenticated fetch +
 * hidden-anchor download (Bearer token cannot ride a bare `<a href>`).
 */
export async function exportResolvedDxf(opts: {
  projectId: number;
  detections: DetectionBox[];
  token: string;
}): Promise<void> {
  const layout = buildDxfLayoutFromDetections(opts.detections);

  const { data: body } = await axios.post<ApiResponse<ClashLayoutReportOut>>(
    `${API_V1}/architect/clash-layout-reports`,
    {
      project_id: opts.projectId,
      layout,
    },
    {
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!body.success || !body.data?.report_id) {
    throw new Error(body.message || "Failed to create clash layout report");
  }

  const reportId = body.data.report_id;
  const response = await fetch(`${API_V1}/architect/export-dxf/${reportId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${opts.token}`,
    },
  });

  if (!response.ok) {
    let detail = `DXF export failed (${response.status})`;
    try {
      const errBody = (await response.json()) as {
        detail?: string;
        message?: string;
      };
      detail = errBody.detail || errBody.message || detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  downloadBlob(blob, RESOLVED_DXF_FILENAME);
}
