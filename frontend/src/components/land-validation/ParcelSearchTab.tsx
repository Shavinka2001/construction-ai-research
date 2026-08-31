"use client";

import { useMemo, useState } from "react";
import {
  Loader2,
  Search,
  Upload,
  MapPin,
  ScanLine,
  Check,
  X,
  Crosshair,
  Hexagon,
  Pencil,
  Trash2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { searchPlaces, type Anchor, type GeocodeResult } from "@/lib/land-validation";
import {
  formatArea,
  geodesicAreaSqm,
  haversineMetres,
  isValidLatLon,
  polygonCentroid,
} from "@/lib/geo";
import { useFeasibility } from "./FeasibilityContext";
import { DynamicLocationPickerMap } from "./DynamicLocationPickerMap";

type Mode = "idle" | "place" | "draw" | "edit";

const round6 = (n: number) => Number(n.toFixed(6));

export function ParcelSearchTab() {
  const {
    surveyFile,
    surveyPreviewUrl,
    perches,
    digitization,
    digitizing,
    attachSurvey,
    setPerches,
    digitizeSurvey,
    setAnchor,
    anchor,
    address,
    analyzing,
    manualLotPolygon,
    setManualLotPolygon,
    error,
  } = useFeasibility();

  // --- location search (unchanged behaviour) ------------------------------
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [latIn, setLatIn] = useState("");
  const [lonIn, setLonIn] = useState("");

  // --- unified pending selection -----------------------------------------
  const [pin, setPin] = useState<Anchor | null>(anchor);
  const [pinLabel, setPinLabel] = useState<string>(address ?? "");
  const [mode, setMode] = useState<Mode>("idle");
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const polygon = useMemo(() => manualLotPolygon ?? [], [manualLotPolygon]);
  const areaSqm = useMemo(() => geodesicAreaSqm(polygon), [polygon]);
  const polygonFar = useMemo(() => {
    const c = polygonCentroid(polygon);
    return !!pin && !!c && polygon.length >= 3 && haversineMetres(pin, c) > 400;
  }, [pin, polygon]);

  // ---------------------------------------------------------------------- //
  // Location methods — all three land in the same `pin` state
  // ---------------------------------------------------------------------- //
  const applyPin = (a: Anchor, label: string) => {
    setPin(a);
    setPinLabel(label);
    setNotice(null);
    if (mode === "place") setMode("idle");
  };

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchPlaces(query.trim());
      setResults(found);
      if (found.length === 0) setSearchError("No matching place found.");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const useManualCoords = () => {
    const la = Number(latIn);
    const lo = Number(lonIn);
    if (!isValidLatLon(la, lo)) {
      setNotice("Enter a valid latitude (−90…90) and longitude (−180…180).");
      return;
    }
    applyPin({ lat: round6(la), lon: round6(lo) }, `${la.toFixed(6)}, ${lo.toFixed(6)}`);
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setNotice("This browser does not support geolocation. Use search or Select on Map.");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyPin(
          { lat: round6(pos.coords.latitude), lon: round6(pos.coords.longitude) },
          "My current location"
        );
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setNotice(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow location access, or use search / Select on Map."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Your location is currently unavailable. Try search or Select on Map."
            : "Timed out while getting your location. Please try again."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  const handlePinChange = (a: Anchor) => {
    if (!isValidLatLon(a.lat, a.lon)) return;
    setPin(a);
    setPinLabel(`${a.lat.toFixed(6)}, ${a.lon.toFixed(6)}`);
  };

  // ---------------------------------------------------------------------- //
  // Land-area polygon
  // ---------------------------------------------------------------------- //
  const startDraw = () => {
    setManualLotPolygon(null);
    setMode("draw");
    setNotice(null);
  };
  const finishDraw = () => {
    if (polygon.length >= 3) setMode("edit");
  };
  const undoPoint = () => setManualLotPolygon(polygon.slice(0, -1));
  const cancelDraw = () => {
    setManualLotPolygon(null);
    setMode("idle");
  };
  const clearArea = () => {
    setManualLotPolygon(null);
    setMode("idle");
  };

  // ---------------------------------------------------------------------- //
  // Confirm — hands the location (+ polygon) to the existing analysis flow
  // ---------------------------------------------------------------------- //
  const confirmAll = async () => {
    if (!pin) {
      setNotice("Choose a location first — My Current Location, search, or Select on Map.");
      return;
    }
    if (mode === "draw" && polygon.length > 0 && polygon.length < 3) {
      setNotice("Finish the land boundary (at least 3 points) or clear it before confirming.");
      return;
    }
    setConfirming(true);
    setNotice(null);
    // `manualLotPolygon` is already in context; setAnchor reads it and switches
    // to the Analysis tab.
    await setAnchor(pin, pinLabel || `${pin.lat.toFixed(6)}, ${pin.lon.toFixed(6)}`);
  };

  const polygonMode = mode === "draw" ? "draw" : mode === "edit" ? "edit" : "off";
  const mapCursor =
    mode === "place" || mode === "draw"
      ? "[&_.leaflet-container]:cursor-crosshair"
      : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* --- Module 1: survey plan (unchanged) --- */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Survey Plan Digitization
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">Module 1 &amp; 2</h3>

        <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center hover:border-gold">
          <Upload className="h-5 w-5 text-slate-400" />
          <span className="text-sm text-slate-600">
            {surveyFile ? surveyFile.name : "Upload a Sri Lankan survey plan / deed image"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => attachSurvey(e.target.files?.[0] ?? null)}
          />
        </label>

        {surveyPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={surveyPreviewUrl}
            alt="Survey plan preview"
            className="mt-3 max-h-52 w-full rounded-lg border border-slate-100 object-contain"
          />
        )}

        <label className="mt-3 block text-xs font-medium text-slate-600">
          Manual calibration — land area in perches (1 perch = 25.2929 m²)
          <input
            type="number"
            step="0.01"
            min="0"
            value={perches ?? ""}
            onChange={(e) =>
              setPerches(e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="e.g. 12.5"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>

        <button
          type="button"
          onClick={() => void digitizeSurvey()}
          disabled={!surveyFile || digitizing}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-charcoal-light disabled:opacity-50"
        >
          {digitizing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanLine className="h-4 w-4 text-gold" />
          )}
          Digitize &amp; audit plan
        </button>

        {digitization && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              <strong>{digitization.area_perches.toFixed(2)} perches</strong> ·{" "}
              {digitization.area_sqm.toFixed(0)} m² · perimeter{" "}
              {digitization.perimeter_m.toFixed(1)} m
            </p>
            <p className="mt-0.5 text-slate-400">
              method: {digitization.method} · scale: {digitization.scale_source}
            </p>
            {digitization.notes.map((n, i) => (
              <p key={i} className="mt-1 text-amber-600">
                {n}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* --- Module 3: satellite location finder --- */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-luxury">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Satellite Location Finder
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">Module 3</h3>

        {/* ---- Location ---- */}
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Location
        </p>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-gold/40 disabled:opacity-50"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5 text-gold" />
            )}
            My Current Location
          </button>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "place" ? "idle" : "place"))}
            className={
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors " +
              (mode === "place"
                ? "border-gold bg-gold/10 text-slate-800"
                : "border-slate-200 text-slate-600 hover:border-gold/40")
            }
          >
            <MapPin className="h-3.5 w-3.5 text-gold" /> Select on Map
          </button>
        </div>

        <form onSubmit={runSearch} className="mt-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search address or place (e.g. Kandy)"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal px-3 py-2 text-sm text-white hover:bg-charcoal-light disabled:opacity-50"
            aria-label="Search"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-gold" />
            )}
          </button>
        </form>

        {searchError && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {searchError}
          </p>
        )}

        {results.length > 0 && (
          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => applyPin({ lat: r.lat, lon: r.lon }, r.display_name)}
                  className="flex w-full items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-left text-xs hover:border-gold/40"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                  <span className="text-slate-600">{r.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex gap-2">
          <input
            value={latIn}
            onChange={(e) => setLatIn(e.target.value)}
            placeholder="lat"
            className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            value={lonIn}
            onChange={(e) => setLonIn(e.target.value)}
            placeholder="lon"
            className="w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={useManualCoords}
            className="rounded-lg bg-charcoal px-3 py-2 text-sm text-white hover:bg-charcoal-light"
          >
            Set
          </button>
        </div>

        {notice && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {notice}
          </p>
        )}

        {mode === "place" && (
          <p className="mt-2 flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-medium text-slate-700">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gold" />
            Click the satellite map to drop your location pin — then drag it to fine-tune.
          </p>
        )}

        {/* ---- Selected Location ---- */}
        {pin && (
          <>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Selected Location
            </p>
            <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-mono text-xs text-slate-700">
                Latitude: {pin.lat.toFixed(6)}
              </p>
              <p className="font-mono text-xs text-slate-700">
                Longitude: {pin.lon.toFixed(6)}
              </p>
              {pinLabel && pinLabel !== `${pin.lat.toFixed(6)}, ${pin.lon.toFixed(6)}` && (
                <p className="mt-0.5 truncate text-[11px] text-slate-400">{pinLabel}</p>
              )}
            </div>
          </>
        )}

        {/* ---- Property Area ---- */}
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Property Area
        </p>

        {mode === "draw" ? (
          <div className="mt-1 space-y-2">
            <p className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-medium text-slate-700">
              <Hexagon className="h-3.5 w-3.5 shrink-0 text-gold" />
              Click points around the property boundary ({polygon.length} added).
              {polygon.length >= 3 && " Click the green point or Finish to close it."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={undoPoint}
                disabled={polygon.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo point
              </button>
              <button
                type="button"
                onClick={finishDraw}
                disabled={polygon.length < 3}
                className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:bg-charcoal-light disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5 text-gold" /> Finish
              </button>
              <button
                type="button"
                onClick={cancelDraw}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </div>
        ) : polygon.length >= 3 ? (
          <div className="mt-1 space-y-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Selected Area
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-800">
                {formatArea(areaSqm)}
              </p>
              <p className="text-[11px] text-slate-400">
                {polygon.length} boundary points · approximate
              </p>
            </div>
            {mode === "edit" ? (
              <div className="space-y-2">
                <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-medium text-slate-700">
                  Drag points to move · click a point to remove · click a hollow
                  midpoint to add a point.
                </p>
                <button
                  type="button"
                  onClick={() => setMode("idle")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:bg-charcoal-light"
                >
                  <Check className="h-3.5 w-3.5 text-gold" /> Done editing
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5 text-gold" /> Edit Boundary
                </button>
                <button
                  type="button"
                  onClick={startDraw}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-gold" /> Redraw
                </button>
                <button
                  type="button"
                  onClick={clearArea}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Area
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startDraw}
            disabled={!pin}
            className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-gold/40 disabled:opacity-50"
          >
            <Hexagon className="h-4 w-4 text-gold" /> Mark Land Area
          </button>
        )}

        {polygonFar && (
          <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your location pin is far from the marked land area. Move the pin onto
            the property or clear the area to keep them consistent.
            <button
              type="button"
              onClick={clearArea}
              className="mt-1.5 block rounded-md border border-amber-300 px-2 py-1 text-[11px] font-semibold hover:bg-amber-100"
            >
              Clear land area
            </button>
          </div>
        )}

        {/* ---- Map ---- */}
        <div
          className={
            "mt-3 h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 " +
            mapCursor
          }
        >
          <DynamicLocationPickerMap
            value={pin}
            onChange={handlePinChange}
            centerHint={anchor}
            clickToSetPin={mode === "place"}
            polygon={polygon}
            polygonMode={polygonMode}
            onPolygonChange={(pts) => setManualLotPolygon(pts)}
            onPolygonFinish={finishDraw}
            className="h-full w-full"
          />
        </div>

        {/* ---- Confirm ---- */}
        <button
          type="button"
          onClick={() => void confirmAll()}
          disabled={!pin || confirming || analyzing}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-charcoal-light disabled:opacity-50"
        >
          {confirming || analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 text-gold" />
          )}
          Confirm Location{polygon.length >= 3 ? " & Area" : ""}
        </button>
      </section>

      {error && (
        <p className="lg:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
