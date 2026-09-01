/** Free Esri hybrid basemap — satellite + place names (no API key). */
export const ESRI_IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const ESRI_LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

export const ESRI_ATTRIBUTION =
  'Imagery &amp; labels &copy; <a href="https://www.esri.com/">Esri</a>';

/** Sri Lanka centroid — default map viewport. */
export const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718];

export type MajorCity = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Suggested zoom when quick-selecting this city. */
  zoom: number;
};

export const MAJOR_CITIES: MajorCity[] = [
  { id: "colombo", name: "Colombo", lat: 6.9271, lon: 79.8612, zoom: 13 },
  { id: "kandy", name: "Kandy", lat: 7.2906, lon: 80.6337, zoom: 13 },
  { id: "galle", name: "Galle", lat: 6.0329, lon: 80.2168, zoom: 13 },
  { id: "matara", name: "Matara", lat: 5.9549, lon: 80.555, zoom: 13 },
];
