"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, MapPin, Navigation2 } from "lucide-react";

export type SitePin = {
  lat: number;
  lon: number;
};

type SiteLocationMapImplProps = {
  /** Confirmed pin from workflow context (shown when returning to Step 1). */
  confirmedPin?: SitePin | null;
  onConfirm: (pin: SitePin) => void;
  /** When true, disables map interaction and confirm button. */
  disabled?: boolean;
  /** Brief loading state while zone analysis runs after confirm. */
  confirming?: boolean;
};

/** Sri Lanka centroid — default viewport for ConstructAI compliance workflow. */
const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718];
const DEFAULT_ZOOM = 8;

/** Esri World Imagery — free satellite tiles, no API key. */
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

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
}: {
  onSelect: (lat: number, lon: number) => void;
  disabled?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOnPin({ pin }: { pin: SitePin | null }) {
  const map = useMap();

  useEffect(() => {
    if (!pin) return;
    map.flyTo([pin.lat, pin.lon], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [map, pin?.lat, pin?.lon]);

  return null;
}

function formatCoord(value: number, positiveSuffix: string, negativeSuffix: string): string {
  const abs = Math.abs(value).toFixed(6);
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix;
  return `${abs}° ${suffix}`;
}

export default function SiteLocationMapImpl({
  confirmedPin,
  onConfirm,
  disabled = false,
  confirming = false,
}: SiteLocationMapImplProps) {
  const pinIcon = useMemo(() => createPulsePinIcon(), []);
  const [draftPin, setDraftPin] = useState<SitePin | null>(null);

  const displayPin = draftPin ?? confirmedPin ?? null;
  const hasDraft = draftPin !== null;
  const isConfirmed = confirmedPin !== null && confirmedPin !== undefined;
  const canConfirm = hasDraft && !disabled && !confirming;

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      setDraftPin({ lat, lon });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (!draftPin || !canConfirm) return;
    onConfirm(draftPin);
  }, [canConfirm, draftPin, onConfirm]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Map canvas */}
      <div className="relative h-[min(52vh,420px)] min-h-[320px] w-full">
        <MapContainer
          center={displayPin ? [displayPin.lat, displayPin.lon] : DEFAULT_CENTER}
          zoom={displayPin ? 14 : DEFAULT_ZOOM}
          className="h-full w-full z-0"
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
            url={SATELLITE_TILES}
            maxZoom={19}
          />
          <MapClickHandler onSelect={handleMapClick} disabled={disabled || confirming} />
          {displayPin && <RecenterOnPin pin={displayPin} />}
          {displayPin && (
            <Marker position={[displayPin.lat, displayPin.lon]} icon={pinIcon} />
          )}
        </MapContainer>

        {/* Click hint — fades once a pin exists */}
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
                Click anywhere on the map to drop your site pin
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Site Coordinates floating card */}
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
                      {isConfirmed && !hasDraft ? "Confirmed location" : "Draft selection"}
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

      {/* Confirm bar */}
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            {displayPin
              ? hasDraft
                ? "Review the coordinates above, then confirm to run zone analysis."
                : "Location confirmed — zone analysis complete."
              : "Select your land parcel on the satellite map to begin."}
          </p>
        </div>

        <motion.button
          type="button"
          disabled={!canConfirm}
          onClick={handleConfirm}
          whileHover={canConfirm ? { scale: 1.02 } : undefined}
          whileTap={canConfirm ? { scale: 0.98 } : undefined}
          className={[
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
            canConfirm
              ? "bg-slate-900 text-white shadow-md hover:bg-slate-800"
              : "cursor-not-allowed bg-slate-200 text-slate-400",
          ].join(" ")}
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
