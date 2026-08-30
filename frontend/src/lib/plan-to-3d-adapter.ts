import type { ClashDetectionResult, DetectionBox } from "@/lib/clash-detection";
import type { FloorPlan, PlanColumn, PlanOpening, PlanWall } from "@/lib/plan-to-3d";

const DOOR_HEIGHT = 2.1;
const WINDOW_HEIGHT = 1.15;
const WINDOW_SILL = 1.0;

function parsePercent(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(n) ? n / 100 : 0;
}

function labelOf(box: DetectionBox): string {
  return `${box.id ?? ""} ${box.label ?? ""}`.toLowerCase();
}

function classifyRole(box: DetectionBox): "wall" | "column" | "door" | "window" | null {
  const label = labelOf(box);
  if (label.includes("window")) return "window";
  if (label.includes("door")) return "door";
  if (label.includes("column") || label.includes("pillar")) return "column";
  if (
    label.includes("wall") ||
    label.includes("partition") ||
    label.includes("boundary") ||
    label.includes("load-bearing")
  ) {
    return "wall";
  }
  if (box.kind === "column") return "column";
  if (box.kind === "wall" || box.wallType) return "wall";
  const id = (box.id ?? "").toLowerCase();
  if (/^d\d/.test(id)) return "door";
  if (/^w\d/.test(id)) return "window";
  if (/^c\d/.test(id)) return "column";
  if (box.kind === "opening") return "window";
  return null;
}

function boxCenterPx(box: DetectionBox, imgWidth: number, imgHeight: number) {
  const left = parsePercent(box.left) * imgWidth;
  const top = parsePercent(box.top) * imgHeight;
  const wPx = Math.max(4, parsePercent(box.width) * imgWidth);
  const hPx = Math.max(4, parsePercent(box.height) * imgHeight);
  return { cx: left + wPx / 2, cy: top + hPx / 2, wPx, hPx };
}

function wallsFromDetections(
  detections: DetectionBox[],
  imgWidth: number,
  imgHeight: number
): PlanWall[] {
  const walls: PlanWall[] = [];
  for (const box of detections) {
    if (classifyRole(box) !== "wall") continue;
    if (box.segment) {
      walls.push({
        id: box.id,
        start: { x: box.segment.x1, y: box.segment.y1 },
        end: { x: box.segment.x2, y: box.segment.y2 },
      });
      continue;
    }
    const { cx, cy, wPx, hPx } = boxCenterPx(box, imgWidth, imgHeight);
    const horizontal = wPx >= hPx;
    walls.push(
      horizontal
        ? {
            id: box.id,
            start: { x: cx - wPx / 2, y: cy },
            end: { x: cx + wPx / 2, y: cy },
          }
        : {
            id: box.id,
            start: { x: cx, y: cy - hPx / 2 },
            end: { x: cx, y: cy + hPx / 2 },
          }
    );
  }
  return walls;
}

function openingsFromDetections(
  detections: DetectionBox[],
  imgWidth: number,
  imgHeight: number
): PlanOpening[] {
  const openings: PlanOpening[] = [];
  for (const box of detections) {
    const role = classifyRole(box);
    if (role !== "door" && role !== "window") continue;
    const { cx, cy, wPx, hPx } = boxCenterPx(box, imgWidth, imgHeight);
    openings.push({
      id: box.id,
      type: role,
      center: { x: cx, y: cy },
      widthPx: Math.max(wPx, hPx),
      heightM: role === "door" ? DOOR_HEIGHT : WINDOW_HEIGHT,
      sillM: role === "door" ? 0 : WINDOW_SILL,
    });
  }
  return openings;
}

function columnsFromDetections(
  detections: DetectionBox[],
  imgWidth: number,
  imgHeight: number,
  clashIds: Set<string>
): PlanColumn[] {
  const columns: PlanColumn[] = [];
  for (const box of detections) {
    if (classifyRole(box) !== "column") continue;
    const { cx, cy } = boxCenterPx(box, imgWidth, imgHeight);
    const key = box.id.toLowerCase();
    columns.push({
      id: box.id,
      center: { x: cx, y: cy },
      translateX: box.translateX,
      translateY: box.translateY,
      isClash:
        clashIds.has(key) ||
        [...clashIds].some((id) => id.includes(key) || key.includes(id)),
    });
  }
  return columns;
}

export function adaptClashResultToFloorPlan(
  data: ClashDetectionResult,
  fallbackDetections: DetectionBox[] = [],
  clashIds: Set<string> = new Set()
): FloorPlan {
  const imgWidth = data.imageWidth ?? 1024;
  const imgHeight = data.imageHeight ?? 1024;
  const all = data.detections.length > 0 ? data.detections : fallbackDetections;
  const wallSource = data.detections.some((d) => classifyRole(d) === "wall")
    ? data.detections
    : all;
  const structural =
    data.structuralDetections.length > 0
      ? data.structuralDetections
      : all.filter((d) => classifyRole(d) === "column");
  const architectural =
    data.architecturalDetections.length > 0
      ? data.architecturalDetections
      : all.filter((d) => {
          const role = classifyRole(d);
          return role === "door" || role === "window";
        });

  return {
    walls: wallsFromDetections(wallSource, imgWidth, imgHeight),
    openings: openingsFromDetections(architectural, imgWidth, imgHeight),
    columns: columnsFromDetections(structural, imgWidth, imgHeight, clashIds),
  };
}
