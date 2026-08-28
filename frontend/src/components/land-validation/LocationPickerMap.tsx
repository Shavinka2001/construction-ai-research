"use client";

import { Fragment, useEffect, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Anchor } from "@/lib/land-validation";

const ESRI_IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

// Sri Lanka — sensible default before the user has picked anything.
const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718];

export type PolygonMode = "off" | "draw" | "edit";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="
      width:20px;height:20px;border-radius:9999px;
      background:#16a34a;border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(22,163,74,0.35), 0 2px 6px rgba(0,0,0,0.45);
    "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const vertexIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:9999px;background:#D4AF37;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.5);cursor:pointer;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const firstVertexIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#16a34a;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.5);cursor:pointer;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const midpointIcon = L.divIcon({
  className: "",
  html: `<div style="width:11px;height:11px;border-radius:9999px;background:rgba(255,255,255,0.9);border:1px dashed #475569;cursor:copy;"></div>`,
  iconSize: [11, 11],
  iconAnchor: [5.5, 5.5],
});

function round6(n: number): number {
  return Number(n.toFixed(6));
}

const asLatLng = (a: Anchor): [number, number] => [a.lat, a.lon];

/** Route map clicks to either the pin or the polygon depending on mode. */
function MapClicks({
  polygonMode,
  polygon,
  clickToSetPin,
  onPinPick,
  onPolygonChange,
  onPolygonFinish,
}: {
  polygonMode: PolygonMode;
  polygon: Anchor[];
  clickToSetPin: boolean;
  onPinPick?: (a: Anchor) => void;
  onPolygonChange?: (pts: Anchor[]) => void;
  onPolygonFinish?: () => void;
}) {
  const map = useMapEvents({
    click(e) {
      const pt = { lat: round6(e.latlng.lat), lon: round6(e.latlng.lng) };
      if (polygonMode === "draw") {
        // Click near the first vertex closes the ring.
        if (polygon.length >= 3) {
          const a = map.latLngToContainerPoint([polygon[0].lat, polygon[0].lon]);
          const b = map.latLngToContainerPoint(e.latlng);
          if (a.distanceTo(b) < 14) {
            onPolygonFinish?.();
            return;
          }
        }
        onPolygonChange?.([...polygon, pt]);
      } else if (clickToSetPin) {
        onPinPick?.(pt);
      }
    },
  });
  return null;
}

/**
 * Fly to `target` only when it lands outside the current viewport (i.e. a
 * search result or a "my location" jump) — a click or a small pin drag the
 * user just made stays put instead of the map yanking itself around.
 */
function Recenter({ target, zoom }: { target: Anchor | null; zoom: number }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!target) return;
    const key = `${target.lat},${target.lon}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (!map.getBounds().pad(-0.15).contains([target.lat, target.lon])) {
      map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), zoom), {
        duration: 0.8,
      });
    }
  }, [target, zoom, map]);
  return null;
}

/** Frame the polygon when the user switches into edit mode. */
function FitOnEdit({ polygon, mode }: { polygon: Anchor[]; mode: PolygonMode }) {
  const map = useMap();
  const prev = useRef<PolygonMode>(mode);
  useEffect(() => {
    if (mode === "edit" && prev.current !== "edit" && polygon.length >= 3) {
      map.fitBounds(polygon.map(asLatLng), {
        padding: [40, 40],
        maxZoom: 19,
      });
    }
    prev.current = mode;
  }, [mode, polygon, map]);
  return null;
}

/** Leaflet mis-measures when it mounts inside a modal / freshly shown box. */
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export function LocationPickerMapImpl({
  value,
  onChange,
  centerHint,
  pinDraggable = true,
  clickToSetPin,
  polygon = [],
  polygonMode = "off",
  onPolygonChange,
  onPolygonFinish,
  readOnly = false,
  className,
}: {
  value: Anchor | null;
  onChange?: (a: Anchor) => void;
  /** Where to centre the map on mount when there is no `value` yet. */
  centerHint?: Anchor | null;
  pinDraggable?: boolean;
  /** Map click sets the pin. Defaults to on whenever `onChange` is available
   *  and the polygon tool is idle (preserves the original behaviour). */
  clickToSetPin?: boolean;
  polygon?: Anchor[];
  polygonMode?: PolygonMode;
  onPolygonChange?: (pts: Anchor[]) => void;
  onPolygonFinish?: () => void;
  readOnly?: boolean;
  className?: string;
}) {
  const start = value ?? centerHint ?? null;
  const initialCenter = useRef<[number, number]>(
    start ? [start.lat, start.lon] : DEFAULT_CENTER
  ).current;
  const initialZoom = useRef(value ? 17 : start ? 16 : 8).current;
  const markerRef = useRef<L.Marker>(null);

  const pinClicks =
    clickToSetPin ?? (!readOnly && !!onChange && polygonMode === "off");

  const updateVertex = (i: number, ll: L.LatLng) => {
    const next = polygon.slice();
    next[i] = { lat: round6(ll.lat), lon: round6(ll.lng) };
    onPolygonChange?.(next);
  };
  const removeVertex = (i: number) => {
    if (polygon.length <= 3) return;
    onPolygonChange?.(polygon.filter((_, j) => j !== i));
  };
  const insertVertexAfter = (i: number, a: Anchor) => {
    const next = polygon.slice();
    next.splice(i + 1, 0, a);
    onPolygonChange?.(next);
  };

  const polyStroke =
    polygonMode === "edit"
      ? { color: "#D4AF37", weight: 3, fillColor: "#D4AF37", fillOpacity: 0.18 }
      : polygonMode === "draw"
      ? { color: "#D4AF37", weight: 2, dashArray: "5 5", fillColor: "#D4AF37", fillOpacity: 0.1 }
      : { color: "#D4AF37", weight: 2, fillColor: "#D4AF37", fillOpacity: 0.15 };

  return (
    <div className={className ?? "h-full w-full overflow-hidden rounded-xl border border-slate-200"}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom={!readOnly}
        dragging={!readOnly}
        doubleClickZoom={!readOnly && polygonMode !== "draw"}
        zoomControl={!readOnly}
        attributionControl={!readOnly}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={ESRI_IMAGERY}
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          maxZoom={20}
        />
        <TileLayer url={ESRI_LABELS} maxZoom={20} />
        <InvalidateOnMount />
        <Recenter target={value} zoom={17} />
        <FitOnEdit polygon={polygon} mode={polygonMode} />
        {!readOnly && (
          <MapClicks
            polygonMode={polygonMode}
            polygon={polygon}
            clickToSetPin={pinClicks}
            onPinPick={onChange}
            onPolygonChange={onPolygonChange}
            onPolygonFinish={onPolygonFinish}
          />
        )}

        {/* ---- Land-area polygon ------------------------------------------ */}
        {polygon.length >= 3 && (
          <Polygon positions={polygon.map(asLatLng)} pathOptions={polyStroke} />
        )}
        {polygonMode === "draw" && polygon.length === 2 && (
          <Polyline
            positions={polygon.map(asLatLng)}
            pathOptions={{ color: "#D4AF37", weight: 2, dashArray: "5 5" }}
          />
        )}

        {/* draw mode: plain dots; the green first dot marks where the ring closes */}
        {polygonMode === "draw" &&
          polygon.map((v, i) => (
            <Marker
              key={`d${i}`}
              position={asLatLng(v)}
              icon={i === 0 ? firstVertexIcon : vertexIcon}
              eventHandlers={
                i === 0
                  ? { click: () => polygon.length >= 3 && onPolygonFinish?.() }
                  : undefined
              }
            />
          ))}

        {/* edit mode: draggable vertices + midpoint "add" handles */}
        {polygonMode === "edit" &&
          polygon.map((v, i) => {
            const nxt = polygon[(i + 1) % polygon.length];
            const mid: Anchor = {
              lat: round6((v.lat + nxt.lat) / 2),
              lon: round6((v.lon + nxt.lon) / 2),
            };
            return (
              <Fragment key={`e${i}`}>
                <Marker
                  position={asLatLng(v)}
                  icon={vertexIcon}
                  draggable
                  eventHandlers={{
                    dragend: (e) =>
                      updateVertex(i, (e.target as L.Marker).getLatLng()),
                    click: () => removeVertex(i),
                  }}
                />
                <Marker
                  position={asLatLng(mid)}
                  icon={midpointIcon}
                  eventHandlers={{ click: () => insertVertexAfter(i, mid) }}
                />
              </Fragment>
            );
          })}

        {/* ---- Location pin -------------------------------------------------- */}
        {value && (
          <Marker
            ref={markerRef}
            position={[value.lat, value.lon]}
            icon={pinIcon}
            draggable={!readOnly && pinDraggable}
            eventHandlers={{
              dragend: () => {
                const m = markerRef.current;
                if (!m || !onChange) return;
                const { lat, lng } = m.getLatLng();
                onChange({ lat: round6(lat), lon: round6(lng) });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
