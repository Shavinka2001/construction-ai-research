import { API_V1, ApiRequestError, type ApiResponse } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { handleUnauthorized } from "@/lib/session-guard";

// --------------------------------------------------------------------------- //
// Types (mirror backend/app/schemas/land_validation.py)
// --------------------------------------------------------------------------- //
export type GeoJson = {
  type: string;
  properties?: Record<string, unknown>;
  geometry: { type: string; coordinates: number[][][] };
};

export type GeocodeResult = {
  display_name: string;
  lat: number;
  lon: number;
  type: string | null;
  bounding_box: number[] | null;
};

export type SurveyDigitizeResult = {
  method: string;
  boundary_geojson: GeoJson;
  pixel_polygon: number[][];
  scale_source: string;
  meters_per_pixel: number;
  area_sqm: number;
  area_perches: number;
  perimeter_m: number;
  image_width: number;
  image_height: number;
  notes: string[];
};

export type AuditStatus = "PRESENT" | "MISSING" | "UNVERIFIED";

export type AuditElement = {
  key: string;
  label: string;
  status: AuditStatus;
  evidence: string | null;
  advisory: string[];
};

export type SurveyAuditResult = {
  ocr_available: boolean;
  ocr_engine: string | null;
  text_excerpt: string | null;
  elements: AuditElement[];
  present_count: number;
  missing_count: number;
  unverified_count: number;
  compliance_score: number;
  summary: string;
};

export type SetbackRow = { edge: string; requirement_m: number; basis: string };

export type BoundaryResult = {
  lot_geojson: GeoJson;
  build_zone_geojson: GeoJson;
  lot_polygon_m: number[][];
  build_zone_polygon_m: number[][];
  lot_area_sqm: number;
  lot_area_perches: number;
  build_zone_area_sqm: number;
  plot_coverage_pct: number;
  max_plot_coverage_pct: number;
  setbacks: SetbackRow[];
  calibrated: boolean;
  notes: string[];
};

export type TopographyResult = {
  elevation_m: number;
  slope_deg: number;
  transect_ew_m: number[];
  source: string;
};

export type TerrainResult = {
  worldcover_class: string;
  suitability: string;
  penalty_note: string | null;
  source: string;
};

export type FloodResult = {
  water_occurrence_pct: number;
  risk_band: "Low" | "Moderate" | "Flood Zone";
  source: string;
};

export type WeatherResult = {
  temperature_2m: number | null;
  relative_humidity_2m: number | null;
  precipitation: number | null;
  precipitation_sum_7d: number | null;
  uv_index_max: number | null;
  rainfall_exposure: string;
  solar_exposure: string;
  advisories: string[];
  source: string;
};

export type ScoreFactor = {
  key: string;
  label: string;
  weight_pct: number;
  factor_score: number;
  reason: string;
};

export type FeasibilityResult = {
  lat: number;
  lon: number;
  topography: TopographyResult;
  terrain: TerrainResult;
  flood: FloodResult;
  weather: WeatherResult;
  buildability_score: number;
  rating: "Poor" | "Marginal" | "Moderate" | "Good" | "Excellent";
  factors: ScoreFactor[];
  reasons: string[];
  generated_at: string;
};

export type Anchor = { lat: number; lon: number };

export type LedgerReport = {
  project_id: number | null;
  address: string | null;
  anchor: Anchor;
  digitization: SurveyDigitizeResult | null;
  audit: SurveyAuditResult | null;
  boundary: BoundaryResult | null;
  feasibility: FeasibilityResult;
  generated_at: string;
};

export type SavedReport = {
  id: number;
  project_id: number;
  report_type: string;
  clash_data_json: { address?: string | null; ledger: LedgerReport } | null;
  created_at: string;
};

// --------------------------------------------------------------------------- //
// Fetch helpers
// --------------------------------------------------------------------------- //
async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !body.success || body.data == null) {
    if (res.status === 401) handleUnauthorized();
    throw new ApiRequestError(
      body.message || "Request failed",
      res.status,
      body.errors ?? []
    );
  }
  return body.data;
}

function authHeaders(): Record<string, string> {
  const token = getAuthSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --------------------------------------------------------------------------- //
// Module 3 — geocoding
// --------------------------------------------------------------------------- //
export async function searchPlaces(q: string): Promise<GeocodeResult[]> {
  const res = await fetch(
    `${API_V1}/land-validation/search?q=${encodeURIComponent(q)}`
  );
  return unwrap<GeocodeResult[]>(res);
}

// --------------------------------------------------------------------------- //
// Module 1 — digitize
// --------------------------------------------------------------------------- //
export async function digitizePlan(
  file: File,
  opts: { perches?: number; scale?: number } = {}
): Promise<SurveyDigitizeResult> {
  const form = new FormData();
  form.append("file", file);
  if (opts.perches != null) form.append("perches", String(opts.perches));
  if (opts.scale != null) form.append("scale", String(opts.scale));
  const res = await fetch(`${API_V1}/land-validation/digitize`, {
    method: "POST",
    body: form,
  });
  return unwrap<SurveyDigitizeResult>(res);
}

// --------------------------------------------------------------------------- //
// Module 2 — audit
// --------------------------------------------------------------------------- //
export async function auditPlan(file: File): Promise<SurveyAuditResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_V1}/land-validation/audit`, {
    method: "POST",
    body: form,
  });
  return unwrap<SurveyAuditResult>(res);
}

// --------------------------------------------------------------------------- //
// Module 4 — boundary
// --------------------------------------------------------------------------- //
export async function markBoundary(payload: {
  anchor: Anchor;
  polygon_m?: number[][] | null;
  calibration_perches?: number | null;
}): Promise<BoundaryResult> {
  const res = await fetch(`${API_V1}/land-validation/boundary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrap<BoundaryResult>(res);
}

// --------------------------------------------------------------------------- //
// Module 5 — analyze
// --------------------------------------------------------------------------- //
export async function analyzeSite(
  lat: number,
  lon: number,
  opts: { lotArea?: number; buildArea?: number } = {}
): Promise<FeasibilityResult> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  if (opts.lotArea != null) params.set("lot_area", String(opts.lotArea));
  if (opts.buildArea != null) params.set("build_area", String(opts.buildArea));
  const res = await fetch(`${API_V1}/land-validation/analyze?${params.toString()}`);
  return unwrap<FeasibilityResult>(res);
}

// --------------------------------------------------------------------------- //
// Module 7 — full ledger + persistence
// --------------------------------------------------------------------------- //
export async function runFeasibility(payload: {
  lat: number;
  lon: number;
  perches?: number;
  address?: string;
  projectId?: number;
  file?: File | null;
}): Promise<LedgerReport> {
  const form = new FormData();
  form.append("lat", String(payload.lat));
  form.append("lon", String(payload.lon));
  if (payload.perches != null) form.append("perches", String(payload.perches));
  if (payload.address) form.append("address", payload.address);
  if (payload.projectId != null) form.append("project_id", String(payload.projectId));
  if (payload.file) form.append("file", payload.file);
  const res = await fetch(`${API_V1}/land-validation/feasibility`, {
    method: "POST",
    body: form,
  });
  return unwrap<LedgerReport>(res);
}

export async function saveLedger(payload: {
  project_id: number;
  address?: string;
  ledger: LedgerReport;
}): Promise<SavedReport> {
  const res = await fetch(`${API_V1}/land-validation/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return unwrap<SavedReport>(res);
}

export async function listLedgers(projectId: number): Promise<SavedReport[]> {
  const res = await fetch(`${API_V1}/land-validation/reports/${projectId}`, {
    headers: authHeaders(),
  });
  return unwrap<SavedReport[]>(res);
}
