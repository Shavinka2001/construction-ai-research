/**
 * Fetch and composite Esri World Imagery XYZ tiles into a single canvas that
 * corresponds *exactly* to a lon/lat bounding box, so it can be draped onto the
 * 3D terrain plane with a straight linear UV mapping.
 *
 * Esri World Imagery is the same keyless provider the 2D satellite map uses
 * (`SatelliteMap.tsx`). Its tile endpoint returns `Access-Control-Allow-Origin: *`,
 * so the composed canvas is not tainted and can be uploaded as a WebGL texture.
 */

import {
  bboxFromCentre,
  chooseZoom,
  lonLatToWorldPx,
  TILE_SIZE,
} from "@/lib/web-mercator";

const ESRI_IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

export const IMAGERY_ATTRIBUTION =
  "Imagery © Esri, Maxar, Earthstar Geographics";

export type SiteImagery = {
  canvas: HTMLCanvasElement;
  /** Ground half-span (m) the canvas covers, each side of centre. */
  halfSpanM: number;
  zoom: number;
  attribution: string;
};

function loadTile(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
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
      reject(new Error(`tile failed: ${url}`));
    };
    img.src = url;
  });
}

/**
 * @param centreLat/centreLon  parcel centroid (== local-metre origin)
 * @param halfSpanM            ground half-span to cover (context radius)
 * @param outSize              square output canvas edge in px (power of two)
 */
export async function fetchSiteImagery(
  centreLat: number,
  centreLon: number,
  halfSpanM: number,
  signal?: AbortSignal,
  outSize = 1024
): Promise<SiteImagery> {
  const bbox = bboxFromCentre(centreLat, centreLon, halfSpanM);
  const zoom = chooseZoom(bbox);

  // Pixel-space bbox at this zoom (top-left = NW, bottom-right = SE).
  const nw = lonLatToWorldPx(bbox.west, bbox.north, zoom);
  const se = lonLatToWorldPx(bbox.east, bbox.south, zoom);
  const spanX = se.x - nw.x;
  const spanY = se.y - nw.y;

  const tx0 = Math.floor(nw.x / TILE_SIZE);
  const tx1 = Math.floor((se.x - 1e-6) / TILE_SIZE);
  const ty0 = Math.floor(nw.y / TILE_SIZE);
  const ty1 = Math.floor((se.y - 1e-6) / TILE_SIZE);

  // Guard against a pathological request (shouldn't happen with chooseZoom).
  const tileCount = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
  if (tileCount > 25) throw new Error(`too many tiles (${tileCount})`);

  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingQuality = "high";

  const sx = outSize / spanX;
  const sy = outSize / spanY;

  const jobs: Promise<void>[] = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const url = `${ESRI_IMAGERY}/${zoom}/${ty}/${tx}`;
      jobs.push(
        loadTile(url, signal).then((img) => {
          const dx = (tx * TILE_SIZE - nw.x) * sx;
          const dy = (ty * TILE_SIZE - nw.y) * sy;
          ctx.drawImage(img, dx, dy, TILE_SIZE * sx, TILE_SIZE * sy);
        })
      );
    }
  }
  await Promise.all(jobs);
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");

  return { canvas, halfSpanM, zoom, attribution: IMAGERY_ATTRIBUTION };
}
