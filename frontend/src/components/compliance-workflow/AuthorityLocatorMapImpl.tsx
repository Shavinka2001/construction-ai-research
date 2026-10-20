"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

export type AuthorityMapPin = {
  lat: number;
  lon: number;
  label: string;
};

type AuthorityLocatorMapImplProps = {
  authority: AuthorityMapPin;
};

const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function createAuthorityMarkerIcon(label: string): L.DivIcon {
  const safeLabel = label.length > 28 ? `${label.slice(0, 26)}…` : label;
  return L.divIcon({
    className: "authority-locator-pin-icon",
    html: `
      <div class="authority-locator-pin" aria-hidden="true">
        <span class="authority-locator-pin__pulse"></span>
        <span class="authority-locator-pin__dot"></span>
        <span class="authority-locator-pin__label">${safeLabel}</span>
      </div>
    `,
    iconSize: [160, 48],
    iconAnchor: [80, 44],
  });
}

function RecenterOnAuthority({ pin }: { pin: AuthorityMapPin }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([pin.lat, pin.lon], 15, { duration: 0.9 });
  }, [map, pin.lat, pin.lon]);

  return null;
}

export default function AuthorityLocatorMapImpl({
  authority,
}: AuthorityLocatorMapImplProps) {
  const icon = useMemo(
    () => createAuthorityMarkerIcon(authority.label),
    [authority.label]
  );

  return (
    <div className="relative h-full min-h-[320px] w-full">
      <MapContainer
        center={[authority.lat, authority.lon]}
        zoom={15}
        className="h-full w-full z-0 rounded-none"
        scrollWheelZoom
        zoomControl
        dragging
      >
        <TileLayer
          attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a>'
          url={SATELLITE_TILES}
          maxZoom={19}
        />
        <RecenterOnAuthority pin={authority} />
        <Marker position={[authority.lat, authority.lon]} icon={icon} />
      </MapContainer>
    </div>
  );
}
