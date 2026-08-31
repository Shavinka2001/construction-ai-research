/**
 * Real 2-D elevation grid for the 3D terrain mesh.
 *
 * Primary source: AWS "Terrarium" terrain tiles (`elevation-tiles-prod`,
 * SRTM/NED-derived ~30 m, RGB-encoded), keyless with `Access-Control-Allow-Origin: *`.
 * Fallback: Open-Meteo Elevation API (Copernicus GLO-90, ~90 m), also keyless.
 *
 * This drives ONLY the visual mesh shape. Elevation/slope numbers in the
 * analysis come from the backend (GEE SRTM) and are never replaced — the grid is
 * re-levelled so its value at the parcel centre equals the backend `elevation_m`.
 */

import {
  bboxFromCentre,
  chooseZoom,
  lonLatToWorldPx,
  TILE_SIZE,
} from "@/lib/web-mercator";

const TERRARIUM =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const OPEN_METEO = "https://api.open-meteo.com/v1/elevation";
const OM_GRID = 12;
const OM_MAX_PER_CALL = 100;

export type DemGrid = {
  size: number;
  /** Row-major, row 0 = north edge, col 0 = west edge. Metres, re-levelled. */
  heights: Float32Array;
  halfSpanM: number;
  min: number;
  max: number;
  source: "terrain-tiles" | "open-meteo";
  /** Smooth sample at local ENU metres (x east, y north), clamped to edges. */
  sample: (x: number, y: number) => number;
};

const clampIdx = (i: number, n: number) => (i < 0 ? 0 : i >= n ? n - 1 : i);

function makeSampler(heights: Float32Array, size: number, halfSpanM: number) {
  const at = (r: number, c: number) =>
    heights[clampIdx(r, size) * size + clampIdx(c, size)];
  return (x: number, y: number) => {
    const fc = ((x + halfSpanM) / (2 * halfSpanM)) * (size - 1);
    const fr = ((halfSpanM - y) / (2 * halfSpanM)) * (size - 1);
    const c0 = Math.floor(fc);
    const r0 = Math.floor(fr);
    const tc = fc - c0;
    const tr = fr - r0;
    const top = at(r0, c0) * (1 - tc) + at(r0, c0 + 1) * tc;
    const bot = at(r0 + 1, c0) * (1 - tc) + at(r0 + 1, c0 + 1) * tc;
    return top * (1 - tr) + bot * tr;
  };
}

function relevel(heights: Float32Array, size: number, halfSpanM: number, centreM: number) {
  const offset = centreM - makeSampler(heights, size, halfSpanM)(0, 0);
  if (Number.isFinite(offset)) {
    for (let i = 0; i < heights.length; i++) heights[i] += offset;
  }
}

function finish(
  heights: Float32Array,
  size: number,
  halfSpanM: number,
  source: DemGrid["source"]
): DemGrid {
  let min = Infinity;
  let max = -Infinity;
  for (const h of heights) {
    if (h < min) min = h;
    if (h > max) max = h;
  }
  return {
    size,
    heights,
    halfSpanM,
    min,
    max,
    source,
    sample: makeSampler(heights, size, halfSpanM),
  };
}

function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const onAbort = () => {
      img.src = "";
      reject(new DOMException("aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
    img.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve(img);
    };
    img.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error(`terrain tile failed: ${url}`));
    };
    img.src = url;
  });
}

// --------------------------------------------------------------------------- //
// Primary: Terrarium RGB terrain tiles
// --------------------------------------------------------------------------- //
async function fromTerrainTiles(
  centreLat: number,
  centreLon: number,
  halfSpanM: number,
  centreM: number,
  signal: AbortSignal | undefined,
  gridSize = 96
): Promise<DemGrid> {
  const bbox = bboxFromCentre(centreLat, centreLon, halfSpanM);
  const zoom = Math.min(15, chooseZoom(bbox, 900, 15, 10));

  const nw = lonLatToWorldPx(bbox.west, bbox.north, zoom);
  const se = lonLatToWorldPx(bbox.east, bbox.south, zoom);
  const spanX = se.x - nw.x;
  const spanY = se.y - nw.y;
  const tx0 = Math.floor(nw.x / TILE_SIZE);
  const tx1 = Math.floor((se.x - 1e-6) / TILE_SIZE);
  const ty0 = Math.floor(nw.y / TILE_SIZE);
  const ty1 = Math.floor((se.y - 1e-6) / TILE_SIZE);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 16) throw new Error("terrain: too many tiles");

  const canvas = document.createElement("canvas");
  canvas.width = gridSize;
  canvas.height = gridSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingEnabled = true;

  const sx = gridSize / spanX;
  const sy = gridSize / spanY;
  await Promise.all(
    (() => {
      const jobs: Promise<void>[] = [];
      for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = ty0; ty <= ty1; ty++) {
          const url = `${TERRARIUM}/${zoom}/${tx}/${ty}.png`;
          jobs.push(
            loadImage(url, signal).then((img) => {
              ctx.drawImage(
                img,
                (tx * TILE_SIZE - nw.x) * sx,
                (ty * TILE_SIZE - nw.y) * sy,
                TILE_SIZE * sx,
                TILE_SIZE * sy
              );
            })
          );
        }
      }
      return jobs;
    })()
  );
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  const { data } = ctx.getImageData(0, 0, gridSize, gridSize);
  const heights = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < heights.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    heights[i] = r * 256 + g + b / 256 - 32768;
  }
  // Sanity: SRTM sea-void / decode failure → all ~ -32768 or wildly out of range.
  if (!heights.some((h) => h > -500 && h < 9000)) {
    throw new Error("terrain: implausible decode");
  }
  relevel(heights, gridSize, halfSpanM, centreM);
  return finish(heights, gridSize, halfSpanM, "terrain-tiles");
}

// --------------------------------------------------------------------------- //
// Fallback: Open-Meteo Elevation API
// --------------------------------------------------------------------------- //
async function fromOpenMeteo(
  centreLat: number,
  centreLon: number,
  halfSpanM: number,
  centreM: number,
  signal?: AbortSignal
): Promise<DemGrid> {
  const bbox = bboxFromCentre(centreLat, centreLon, halfSpanM);
  const lats: number[] = [];
  const lons: number[] = [];
  for (let r = 0; r < OM_GRID; r++) {
    const lat = bbox.north - (r / (OM_GRID - 1)) * (bbox.north - bbox.south);
    for (let c = 0; c < OM_GRID; c++) {
      lons.push(bbox.west + (c / (OM_GRID - 1)) * (bbox.east - bbox.west));
      lats.push(lat);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < lats.length; i += OM_MAX_PER_CALL) {
    const la = lats.slice(i, i + OM_MAX_PER_CALL);
    const lo = lons.slice(i, i + OM_MAX_PER_CALL);
    const url = `${OPEN_METEO}?latitude=${la.map((v) => v.toFixed(5)).join(",")}&longitude=${lo
      .map((v) => v.toFixed(5))
      .join(",")}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`elevation API ${res.status}`);
    const body = (await res.json()) as { elevation?: number[] };
    if (!Array.isArray(body.elevation) || body.elevation.length !== la.length) {
      throw new Error("elevation API: unexpected payload");
    }
    out.push(...body.elevation);
  }
  if (out.length !== OM_GRID * OM_GRID || out.some((v) => v == null || !Number.isFinite(v))) {
    throw new Error("elevation API: incomplete grid");
  }
  const heights = Float32Array.from(out, Number);
  relevel(heights, OM_GRID, halfSpanM, centreM);
  return finish(heights, OM_GRID, halfSpanM, "open-meteo");
}

export async function fetchElevationGrid(
  centreLat: number,
  centreLon: number,
  halfSpanM: number,
  centreElevationM: number,
  signal?: AbortSignal
): Promise<DemGrid> {
  try {
    return await fromTerrainTiles(
      centreLat,
      centreLon,
      halfSpanM,
      centreElevationM,
      signal
    );
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    return fromOpenMeteo(centreLat, centreLon, halfSpanM, centreElevationM, signal);
  }
}
