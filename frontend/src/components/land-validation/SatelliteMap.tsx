"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import type { Anchor, GeoJson } from "@/lib/land-validation";

const ESRI_IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const anchorIcon = L.divIcon({
  className: "",
  html: `<div style="
      width:22px;height:22px;border-radius:9999px;
      background:#16a34a;border:3px solid #fff;
      box-shadow:0 0 0 3px rgba(22,163,74,0.35), 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FlyTo({ anchor }: { anchor: Anchor | null }) {
  const map = useMap();
  useEffect(() => {
    if (anchor) map.flyTo([anchor.lat, anchor.lon], 18, { duration: 1.1 });
  }, [anchor, map]);
  return null;
}

export function SatelliteMapImpl({
  anchor,
  onAnchorChange,
  lotGeoJson,
  buildZoneGeoJson,
  className,
}: {
  anchor: Anchor | null;
  onAnchorChange: (a: Anchor) => void;
  lotGeoJson?: GeoJson | null;
  buildZoneGeoJson?: GeoJson | null;
  className?: string;
}) {
  const center = useMemo<[number, number]>(
    () => (anchor ? [anchor.lat, anchor.lon] : [6.9271, 79.8612]),
    [anchor]
  );
  const markerRef = useRef<L.Marker>(null);

  return (
    <div className={className ?? "h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200"}>
      <MapContainer
        center={center}
        zoom={anchor ? 18 : 12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={ESRI_IMAGERY}
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          maxZoom={20}
        />
        <FlyTo anchor={anchor} />

        {lotGeoJson && (
          <GeoJSON
            key={JSON.stringify(lotGeoJson.geometry.coordinates)}
            data={lotGeoJson as unknown as GeoJsonObject}
            style={{ color: "#D4AF37", weight: 2, fillOpacity: 0.06, dashArray: "6 6" }}
          />
        )}
        {buildZoneGeoJson && (
          <GeoJSON
            key={JSON.stringify(buildZoneGeoJson.geometry.coordinates)}
            data={buildZoneGeoJson as unknown as GeoJsonObject}
            style={{ color: "#16a34a", weight: 2, fillColor: "#22c55e", fillOpacity: 0.28 }}
          />
        )}

        {anchor && (
          <Marker
            ref={markerRef}
            position={[anchor.lat, anchor.lon]}
            icon={anchorIcon}
            draggable
            eventHandlers={{
              dragend: () => {
                const m = markerRef.current;
                if (!m) return;
                const { lat, lng } = m.getLatLng();
                onAnchorChange({ lat: Number(lat.toFixed(6)), lon: Number(lng.toFixed(6)) });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
