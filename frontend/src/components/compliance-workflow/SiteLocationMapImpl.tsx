"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, MapPin, Navigation2 } from "lucide-react";
import {
  ESRI_ATTRIBUTION,
  ESRI_IMAGERY,
  ESRI_LABELS,
  MAJOR_CITIES,
  SRI_LANKA_CENTER,
  type MajorCity,
} from "@/lib/sri-lanka-map";
import { cn } from "@/lib/utils";

export type SitePin = {
  lat: number;
  lon: number;
};

type SiteLocationMapImplProps = {
  confirmedPin?: SitePin | null;
  onConfirm: (pin: SitePin) => void;
  disabled?: boolean;
  confirming?: boolean;
};

const DEFAULT_ZOOM = 8;
const CITY_FLY_ZOOM = 13;

function createPulsePinIcon(): L.DivIcon {
  return L.divIcon({
    className: "site-location-pin-icon",
    html: `
      <div class="site-location-pin" aria-hidden="true">
        <span class="site-location-pin__pulse"></span>
        <span class="site-location-pin__dot"></span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function MapClickHandler({
  onSelect,
  disabled,
  onManualSelect,
}: {
  onSelect: (lat: number, lon: number) => void;
  disabled?: boolean;
  onManualSelect: () => void;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onManualSelect();
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToPin({
  pin,
  zoom,
}: {
  pin: SitePin | null;
  zoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!pin) return;
    map.flyTo([pin.lat, pin.lon], zoom ?? Math.max(map.getZoom(), CITY_FLY_ZOOM), {
      duration: 0.85,
    });
  }, [map, pin?.lat, pin?.lon, zoom]);

  return null;
}

function formatCoord(value: number, positiveSuffix: string, negativeSuffix: string): string {
  const abs = Math.abs(value).toFixed(6);
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix;
  return `${abs}° ${suffix}`;
}

function matchCityForPin(pin: SitePin): MajorCity | undefined {
  return MAJOR_CITIES.find(
    (city) =>
      Math.abs(city.lat - pin.lat) < 0.02 && Math.abs(city.lon - pin.lon) < 0.02
  );
}

export default function SiteLocationMapImpl({
  confirmedPin,
  onConfirm,
  disabled = false,
  confirming = false,
}: SiteLocationMapImplProps) {
  const pinIcon = useMemo(() => createPulsePinIcon(), []);
  const [draftPin, setDraftPin] = useState<SitePin | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [flyZoom, setFlyZoom] = useState<number | undefined>(undefined);

  const displayPin = draftPin ?? confirmedPin ?? null;
  const hasDraft = draftPin !== null;
  const isConfirmed = confirmedPin != null;
  const canConfirm = hasDraft && !disabled && !confirming;
  const matchedCity = displayPin ? matchCityForPin(displayPin) : undefined;
  const activeCityId = selectedCityId ?? matchedCity?.id ?? null;

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setSelectedCityId(null);
    setFlyZoom(undefined);
    setDraftPin({ lat, lon });
  }, []);

  const handleCitySelect = useCallback(
    (city: MajorCity) => {
      if (disabled || confirming) return;
      setSelectedCityId(city.id);
      setFlyZoom(city.zoom);
      setDraftPin({ lat: city.lat, lon: city.lon });
    },
    [disabled, confirming]
  );

  const handleConfirm = useCallback(() => {
    if (!draftPin || !canConfirm) return;
    onConfirm(draftPin);
  }, [canConfirm, draftPin, onConfirm]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-[min(52vh,420px)] min-h-[320px] w-full">
        <MapContainer
          center={displayPin ? [displayPin.lat, displayPin.lon] : SRI_LANKA_CENTER}
          zoom={displayPin ? CITY_FLY_ZOOM : DEFAULT_ZOOM}
          className="h-full w-full z-0"
          scrollWheelZoom
          zoomControl
        >
          {/* Hybrid basemap: satellite imagery + roads / city labels */}
          <TileLayer url={ESRI_IMAGERY} attribution={ESRI_ATTRIBUTION} maxZoom={19} />
          <TileLayer url={ESRI_LABELS} maxZoom={19} pane="overlayPane" />

          <MapClickHandler
            onSelect={handleMapClick}
            disabled={disabled || confirming}
            onManualSelect={() => setSelectedCityId(null)}
          />
          {displayPin && <FlyToPin pin={displayPin} zoom={flyZoom} />}
          {displayPin && (
            <Marker position={[displayPin.lat, displayPin.lon]} icon={pinIcon} />
          )}
        </MapContainer>

        {/* Major city quick-select */}
        <div className="absolute bottom-4 left-4 right-4 z-[400] sm:right-auto">
          <div className="inline-flex max-w-full flex-wrap gap-2 rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-lg backdrop-blur-md">
            <span className="hidden px-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline">
              Quick select
            </span>
            {MAJOR_CITIES.map((city) => {
              const isActive = activeCityId === city.id;
              return (
                <motion.button
                  key={city.id}
                  type="button"
                  disabled={disabled || confirming}
                  onClick={() => handleCitySelect(city)}
                  whileHover={!disabled && !confirming ? { scale: 1.03 } : undefined}
                  whileTap={!disabled && !confirming ? { scale: 0.97 } : undefined}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                    (disabled || confirming) && "cursor-not-allowed opacity-50"
                  )}
                >
                  {city.name}
                </motion.button>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {!displayPin && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="pointer-events-none absolute inset-x-0 top-4 flex justify-center z-[400]"
            >
              <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/90 px-4 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-sm">
                <Crosshair className="h-3.5 w-3.5 text-blue-700" />
                Click the map or choose a major city below
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {displayPin && (
            <motion.div
              key={`${displayPin.lat}-${displayPin.lon}`}
              initial={{ opacity: 0, x: 16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="absolute right-4 top-4 z-[400] w-[min(100%-2rem,280px)]"
            >
              <div className="rounded-xl border border-slate-200/80 bg-white/95 p-4 shadow-xl backdrop-blur-md">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Navigation2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Site Coordinates
                    </p>
                    <p className="text-xs text-slate-600">
                      {matchedCity
                        ? `${matchedCity.name} · ${isConfirmed && !hasDraft ? "Confirmed" : "Draft"}`
                        : isConfirmed && !hasDraft
                          ? "Confirmed location"
                          : "Draft selection"}
                    </p>
                  </div>
                </div>

                <dl className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs font-medium text-slate-500">Latitude</dt>
                    <dd className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                      {formatCoord(displayPin.lat, "N", "S")}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs font-medium text-slate-500">Longitude</dt>
                    <dd className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                      {formatCoord(displayPin.lon, "E", "W")}
                    </dd>
                  </div>
                  <div className="border-t border-slate-100 pt-2">
                    <dt className="sr-only">Raw coordinates</dt>
                    <dd className="font-mono text-[10px] leading-relaxed text-slate-400">
                      {displayPin.lat.toFixed(6)}, {displayPin.lon.toFixed(6)}
                    </dd>
                  </div>
                </dl>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            {displayPin
              ? hasDraft
                ? "Review the coordinates above, then confirm to run zone analysis."
                : "Location confirmed — zone analysis complete."
              : "Select a major city or drop a pin on the hybrid map to begin."}
          </p>
        </div>

        <motion.button
          type="button"
          disabled={!canConfirm}
          onClick={handleConfirm}
          whileHover={canConfirm ? { scale: 1.02 } : undefined}
          whileTap={canConfirm ? { scale: 0.98 } : undefined}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
            canConfirm
              ? "bg-slate-900 text-white shadow-md hover:bg-slate-800"
              : "cursor-not-allowed bg-slate-200 text-slate-400"
          )}
        >
          {confirming ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Analyzing zone…
            </>
          ) : (
            "Confirm Location & Analyze Zone"
          )}
        </motion.button>
      </div>
    </div>
  );
}
