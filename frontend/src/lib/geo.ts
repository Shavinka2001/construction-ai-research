/**
 * Small geographic helpers for the Satellite Location Finder.
 *
 * The backend (`boundary_geomarking_service.py`) geo-references a boundary from a
 * local-metre polygon `[[x_east, y_north], ...]` using an equirectangular model
 * with `_EARTH_M_PER_DEG = 111_320`. `lonLatToLocalMetres` is the exact inverse,
 * so a polygon drawn on the map round-trips through the existing `markBoundary`
 * API unchanged.
 */

import type { Anchor } from "@/lib/land-validation";

const EARTH_M_PER_DEG = 111_320; // matches backend _EARTH_M_PER_DEG
const WGS84_RADIUS_M = 6_378_137;
export const SQM_PER_PERCH = 25.2929; // matches backend PERCH_SQM

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function isValidLatLon(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** WGS84 lat/lon -> local ENU metres about `origin` (equirectangular). */
export function lonLatToLocalMetres(p: Anchor, origin: Anchor): [number, number] {
  const mPerDegLon = EARTH_M_PER_DEG * Math.cos(toRad(origin.lat));
  return [
    (p.lon - origin.lon) * mPerDegLon,
    (p.lat - origin.lat) * EARTH_M_PER_DEG,
  ];
}

/**
 * Geodesic ring area in m² — spherical-excess method (the same algorithm
 * `@turf/area` uses), so it is correct for real lat/lon coordinates rather than
 * a flat Cartesian approximation.
 */
export function geodesicAreaSqm(ring: Anchor[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    total +=
      toRad(b.lon - a.lon) *
      (2 + Math.sin(toRad(a.lat)) + Math.sin(toRad(b.lat)));
  }
  return Math.abs((total * WGS84_RADIUS_M * WGS84_RADIUS_M) / 2);
}

/** Great-circle distance in metres. */
export function haversineMetres(a: Anchor, b: Anchor): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * WGS84_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Vertex-average centroid — good enough for proximity checks. */
export function polygonCentroid(ring: Anchor[]): Anchor | null {
  if (ring.length === 0) return null;
  const sum = ring.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }),
    { lat: 0, lon: 0 }
  );
  return { lat: sum.lat / ring.length, lon: sum.lon / ring.length };
}

/** "2,450 m² · 96.87 perches" (adds hectares past 1 ha). */
export function formatArea(sqm: number): string {
  if (sqm <= 0) return "—";
  const perches = sqm / SQM_PER_PERCH;
  const m2 = `${Math.round(sqm).toLocaleString()} m²`;
  const pchs = `${perches.toFixed(perches < 100 ? 2 : 1)} perches`;
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(2)} ha · ${m2} · ${pchs}`;
  return `${m2} · ${pchs}`;
}
