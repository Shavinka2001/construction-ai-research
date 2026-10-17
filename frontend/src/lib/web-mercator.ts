/**
 * Minimal Web Mercator (EPSG:3857) slippy-map maths for draping XYZ raster
 * tiles onto the 3D terrain. Standard 256 px tile scheme, z/x/y.
 */

export const TILE_SIZE = 256;
const R = 6378137; // WGS84 equatorial radius (m) — Web Mercator sphere

const clampLat = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

/** lon/lat (deg) → absolute pixel coords at zoom `z` (world = TILE_SIZE·2^z px). */
export function lonLatToWorldPx(lon: number, lat: number, z: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** z;
  const sinLat = Math.sin((clampLat(lat) * Math.PI) / 180);
  const x = ((lon + 180) / 360) * scale;
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** Metres of ground per pixel at a given latitude and zoom. */
export function metresPerPixel(lat: number, z: number): number {
  return (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * R) / (TILE_SIZE * 2 ** z);
}

/**
 * A lon/lat bounding box centred on a point, sized from a ground half-span in
 * metres. Uses a local equirectangular approximation — identical to the model
 * the backend boundary service uses, so the box lines up with `*_polygon_m`.
 */
export function bboxFromCentre(
  centreLat: number,
  centreLon: number,
  halfSpanM: number
): { west: number; south: number; east: number; north: number } {
  const dLat = halfSpanM / 111_320;
  const dLon = halfSpanM / (111_320 * Math.cos((centreLat * Math.PI) / 180));
  return {
    west: centreLon - dLon,
    east: centreLon + dLon,
    south: centreLat - dLat,
    north: centreLat + dLat,
  };
}

/**
 * Pick the highest zoom (≤ maxZoom) whose covering area for `bbox` stays within
 * `targetPx`, so a fixed-size composite canvas keeps roughly native resolution
 * without pulling an excessive number of tiles.
 */
export function chooseZoom(
  bbox: { west: number; south: number; east: number; north: number },
  targetPx = 680,
  maxZoom = 19,
  minZoom = 13
): number {
  for (let z = maxZoom; z >= minZoom; z--) {
    const a = lonLatToWorldPx(bbox.west, bbox.north, z);
    const b = lonLatToWorldPx(bbox.east, bbox.south, z);
    if (Math.max(b.x - a.x, b.y - a.y) <= targetPx) return z;
  }
  return minZoom;
}
