export type ZoneType = "coastal" | "hilly" | "municipal";

export type GeoPin = {
  lat: number;
  lon: number;
};

export type ZoneAnalysis = {
  zoneType: ZoneType;
  label: string;
  description: string;
  riskBand: "Low" | "Moderate" | "High";
  advisory: string;
  /** Human-readable geofence rule that matched (for UI transparency). */
  matchedRule: string;
};

export type RoadmapStep = {
  id: string;
  phase: number;
  title: string;
  authority: string;
  description: string;
  /** Synced from authority registry `avgResponseDays` at roadmap build time. */
  estimatedDays: number;
};

export type AuthorityContact = {
  institution: string;
  officerName: string;
  role: string;
  phone: string;
  email: string;
  address: string;
  lat: number;
  lon: number;
};

export type WorkingHoursRow = {
  day: string;
  hours: string;
};

/**
 * Canonical authority record — single source of truth for Step 2 roadmap
 * phase badges and Step 4 Authority Locator cards.
 */
export type AuthorityMetadata = AuthorityContact & {
  /** Roadmap phase headline (Step 2). */
  roadmapTitle: string;
  /** Roadmap phase description (Step 2). */
  roadmapDescription: string;
  /** Shared SLA metric shown as "~Nd" on roadmap and "Avg. Response Time" in Step 4. */
  avgResponseDays: number;
  activeSubmissions: number;
  workingHours: WorkingHoursRow[];
};

/** Enriched authority record for Step 4 Authority Locator UI. */
export type AuthorityProfile = AuthorityMetadata & {
  displayName: string;
};

/** Southern coastal belt — Matara / Galle corridor (mock geofence). */
export function isSouthernCoastalZone(lat: number, lon: number): boolean {
  return lat >= 5.85 && lat <= 6.35 && lon >= 80.15 && lon <= 81.0;
}

/** Central highland slope belt — NBRO landslide screening (mock geofence). */
export function isLandslideProneZone(lat: number, lon: number): boolean {
  return lat >= 6.8 && lat <= 7.5 && lon >= 80.4 && lon <= 80.95;
}

/**
 * Mock geofencing classifier — maps lat/lng to regulatory zone labels.
 * Used by Step 1 when the user confirms a map pin.
 */
export function classifyZoneFromCoordinates(pin: GeoPin): ZoneAnalysis {
  return analyzeZoneFromPin(pin);
}

/** @deprecated Alias — prefer `classifyZoneFromCoordinates`. */
export function analyzeZoneFromPin(pin: GeoPin): ZoneAnalysis {
  const { lat, lon } = pin;

  if (isSouthernCoastalZone(lat, lon)) {
    return {
      zoneType: "coastal",
      label: "Coastal Zone — High Risk",
      description:
        "Southern coastal belt (Matara / Galle). Coast Conservation Department clearance is mandatory before any UDA or municipal submission.",
      riskBand: "High",
      advisory:
        "Maintain a 50 m buffer from the high-water mark and submit CCD Form CCD-01 with erosion study.",
      matchedRule: "Southern coastal: 5.85°–6.35°N, 80.15°–81.0°E",
    };
  }

  if (isLandslideProneZone(lat, lon)) {
    return {
      zoneType: "hilly",
      label: "Landslide Prone Area (NBRO)",
      description:
        "Central highland slope detected. NBRO geotechnical assessment is required prior to foundation design and UDA review.",
      riskBand: "High",
      advisory:
        "Submit NBRO slope stability report; retain minimum 30% green cover on the plot.",
      matchedRule: "Highland slope: 6.8°–7.5°N, 80.4°–80.95°E",
    };
  }

  return {
    zoneType: "municipal",
    label: "Standard Municipal Area",
    description:
      "No special environmental overlay detected. Standard UDA and local municipal council approval pathway applies.",
    riskBand: "Low",
    advisory:
      "Verify road width, FAR, and setbacks against your local MC Development Regulations 2021.",
    matchedRule: "Default municipal jurisdiction",
  };
}

const AUTHORITY_REGISTRY: Record<string, AuthorityMetadata> = {
  "Coast Conservation Department": {
    institution: "Coast Conservation Department",
    roadmapTitle: "Coast Conservation Department (CCD) Clearance",
    roadmapDescription:
      "Coastal setback verification, erosion risk review, and buffer compliance",
    avgResponseDays: 21,
    officerName: "Mrs. Dilani Perera",
    role: "Assistant Director — Coastal Regulation",
    phone: "+94 11 258 8456",
    email: "ccd.clearance@gov.lk",
    address: "Coast Conservation Dept, Maligawatta Rd, Colombo 10",
    lat: 6.9366,
    lon: 79.8747,
    activeSubmissions: 18,
    workingHours: [
      { day: "Mon – Thu", hours: "8:30 AM – 4:15 PM" },
      { day: "Friday", hours: "8:30 AM – 4:00 PM" },
      { day: "Public Holidays", hours: "Closed" },
    ],
  },
  "National Building Research Organisation": {
    institution: "National Building Research Organisation",
    roadmapTitle: "NBRO Geological Clearance",
    roadmapDescription:
      "Geotechnical assessment, landslide hazard screening, and slope stability sign-off",
    avgResponseDays: 35,
    officerName: "Dr. Ruwan Silva",
    role: "Senior Geotechnical Officer",
    phone: "+94 11 267 8901",
    email: "geotech@nbro.lk",
    address: "128/1 Nawala Rd, Rajagiriya, Colombo",
    lat: 6.9089,
    lon: 79.8934,
    activeSubmissions: 11,
    workingHours: [
      { day: "Mon – Fri", hours: "8:30 AM – 4:30 PM" },
      { day: "Saturday", hours: "By appointment" },
      { day: "Sunday", hours: "Closed" },
    ],
  },
  "Urban Development Authority": {
    institution: "Urban Development Authority",
    roadmapTitle: "UDA Clearance",
    roadmapDescription:
      "Development permit, zoning compliance, and building plan scrutiny",
    avgResponseDays: 28,
    officerName: "Mr. Kasun Jayawardena",
    role: "Development Control Officer",
    phone: "+94 11 287 3412",
    email: "dco@uda.lk",
    address: "Sir Chittampalam A Gardiner Mawatha, Colombo 02",
    lat: 6.9271,
    lon: 79.8612,
    activeSubmissions: 26,
    workingHours: [
      { day: "Mon – Fri", hours: "8:30 AM – 4:30 PM" },
      { day: "Document Drop-off", hours: "Until 3:00 PM" },
      { day: "Weekends", hours: "Closed" },
    ],
  },
  "Local Municipal Council": {
    institution: "Local Municipal Council",
    roadmapTitle: "Local Authority / Municipal Council Approval",
    roadmapDescription:
      "Construction permit issuance and occupancy certificate sign-off",
    avgResponseDays: 15,
    officerName: "Mr. Ajith Bandara",
    role: "Chief Building Officer",
    phone: "+94 11 278 1120",
    email: "cbo@mc.gov.lk",
    address: "Municipal Secretariat, District HQ",
    lat: 6.901,
    lon: 79.872,
    activeSubmissions: 9,
    workingHours: [
      { day: "Mon – Fri", hours: "8:00 AM – 4:00 PM" },
      { day: "Saturday", hours: "Closed" },
      { day: "Sunday", hours: "Closed" },
    ],
  },
  "Matara Municipal Council": {
    institution: "Matara Municipal Council",
    roadmapTitle: "Matara Municipal Council Approval",
    roadmapDescription:
      "Construction permit issuance and occupancy certificate sign-off",
    avgResponseDays: 12,
    officerName: "Mrs. Sanduni Wickramasinghe",
    role: "Assistant Municipal Commissioner — Building",
    phone: "+94 41 222 3030",
    email: "building@matara.mc.gov.lk",
    address: "Nupe Rd, Matara 81000",
    lat: 5.9549,
    lon: 80.555,
    activeSubmissions: 14,
    workingHours: [
      { day: "Mon – Fri", hours: "8:00 AM – 4:00 PM" },
      { day: "Public Counter", hours: "8:30 AM – 3:00 PM" },
      { day: "Saturday", hours: "Closed" },
    ],
  },
  "Galle Municipal Council": {
    institution: "Galle Municipal Council",
    roadmapTitle: "Galle Municipal Council Approval",
    roadmapDescription:
      "Construction permit issuance and occupancy certificate sign-off",
    avgResponseDays: 11,
    officerName: "Mr. Nimal Jayasinghe",
    role: "Chief Building Inspector",
    phone: "+94 91 223 4567",
    email: "permits@galle.mc.gov.lk",
    address: "Esplanade Rd, Galle 80000",
    lat: 6.0329,
    lon: 80.2168,
    activeSubmissions: 16,
    workingHours: [
      { day: "Mon – Fri", hours: "8:00 AM – 4:00 PM" },
      { day: "Public Counter", hours: "8:30 AM – 3:00 PM" },
      { day: "Saturday", hours: "Closed" },
    ],
  },
  "Colombo Municipal Council": {
    institution: "Colombo Municipal Council",
    roadmapTitle: "Colombo Municipal Council Approval",
    roadmapDescription:
      "Construction permit issuance and occupancy certificate sign-off",
    avgResponseDays: 10,
    officerName: "Ms. Nethmi Fernando",
    role: "Building Inspector — Zone B",
    phone: "+94 11 268 4290",
    email: "building@cmb.lk",
    address: "Town Hall, Colombo 07",
    lat: 6.9147,
    lon: 79.8615,
    activeSubmissions: 32,
    workingHours: [
      { day: "Mon – Fri", hours: "8:30 AM – 4:30 PM" },
      { day: "Public Counter", hours: "9:00 AM – 3:00 PM" },
      { day: "Weekends", hours: "Closed" },
    ],
  },
};

const DEFAULT_AUTHORITY_KEY = "Local Municipal Council";

/** Roadmap step templates — authority keys reference AUTHORITY_REGISTRY. */
const ROADMAP_TEMPLATES: Record<
  ZoneType,
  { id: string; authorityKey: string }[]
> = {
  coastal: [
    { id: "ccd", authorityKey: "Coast Conservation Department" },
    { id: "uda", authorityKey: "Urban Development Authority" },
    { id: "mc", authorityKey: "Local Municipal Council" },
  ],
  hilly: [
    { id: "nbro", authorityKey: "National Building Research Organisation" },
    { id: "uda", authorityKey: "Urban Development Authority" },
    { id: "mc", authorityKey: "Local Municipal Council" },
  ],
  municipal: [
    { id: "uda", authorityKey: "Urban Development Authority" },
    { id: "mc", authorityKey: "Local Municipal Council" },
  ],
};

/** Assign sequential phase numbers after assembly. */
function withPhases(steps: RoadmapStep[]): RoadmapStep[] {
  return steps.map((step, index) => ({
    ...step,
    phase: index + 1,
  }));
}

function buildStepFromRegistry(
  template: { id: string; authorityKey: string },
  pin?: GeoPin | null
): RoadmapStep {
  const resolvedKey = resolveAuthorityKey(template.authorityKey, pin);
  const meta = getAuthorityMetadata(resolvedKey);

  return {
    id: template.id,
    phase: 0,
    title: meta.roadmapTitle,
    authority: template.authorityKey,
    description: meta.roadmapDescription,
    estimatedDays: meta.avgResponseDays,
  };
}

/**
 * Dynamically builds the approval roadmap from detected zone type.
 * Every path ends with UDA Clearance + Municipal Council Approval.
 * `estimatedDays` is sourced from AUTHORITY_REGISTRY (pin-aware for MC).
 */
export function buildRoadmap(
  zoneType: ZoneType,
  pin?: GeoPin | null
): RoadmapStep[] {
  const templates = ROADMAP_TEMPLATES[zoneType] ?? ROADMAP_TEMPLATES.municipal;
  return withPhases(templates.map((template) => buildStepFromRegistry(template, pin)));
}

/** Resolve municipal council name from site pin (mock jurisdiction routing). */
export function resolveAuthorityKey(
  authorityKey: string,
  pin?: GeoPin | null
): string {
  if (authorityKey === "Local Municipal Council") {
    return resolveMunicipalAuthorityKey(pin);
  }
  return authorityKey;
}

function resolveMunicipalAuthorityKey(pin?: GeoPin | null): string {
  if (!pin) return DEFAULT_AUTHORITY_KEY;
  if (isSouthernCoastalZone(pin.lat, pin.lon)) {
    return pin.lon < 80.45 ? "Galle Municipal Council" : "Matara Municipal Council";
  }
  if (pin.lat >= 6.85 && pin.lon >= 79.8 && pin.lon <= 79.95) {
    return "Colombo Municipal Council";
  }
  return DEFAULT_AUTHORITY_KEY;
}

/** Lookup canonical authority metadata from the shared registry. */
export function getAuthorityMetadata(authorityKey: string): AuthorityMetadata {
  return (
    AUTHORITY_REGISTRY[authorityKey] ??
    AUTHORITY_REGISTRY[DEFAULT_AUTHORITY_KEY]
  );
}

/**
 * Returns the unified SLA days for an authority — used by Step 2 badges
 * and Step 4 "Avg. Response Time". Pin-aware for municipal council routing.
 */
export function getAuthorityAvgResponseDays(
  authorityKey: string,
  pin?: GeoPin | null
): number {
  const resolvedKey = resolveAuthorityKey(authorityKey, pin);
  return getAuthorityMetadata(resolvedKey).avgResponseDays;
}

export function getAuthorityContact(authority: string): AuthorityContact {
  const meta = getAuthorityMetadata(authority);
  return {
    institution: meta.institution,
    officerName: meta.officerName,
    role: meta.role,
    phone: meta.phone,
    email: meta.email,
    address: meta.address,
    lat: meta.lat,
    lon: meta.lon,
  };
}

/**
 * Builds the full authority profile for Step 4, accounting for active roadmap
 * phase and site pin jurisdiction (e.g. Matara MC for southern coastal pins).
 */
export function resolveAuthorityProfile(
  authorityKey: string,
  context?: { pin?: GeoPin | null; zone?: ZoneAnalysis | null }
): AuthorityProfile {
  const resolvedKey = resolveAuthorityKey(authorityKey, context?.pin);
  const meta = getAuthorityMetadata(resolvedKey);

  return {
    ...meta,
    displayName: meta.institution,
  };
}

/** Heuristic entity extraction for research demo — surfaces NLP-style outputs. */
export function extractEntitiesFromText(text: string): string[] {
  const found = new Set<string>();
  const rules: [RegExp, string][] = [
    [/setback|front\s+\d+/i, "Setback Distance"],
    [/far|floor area ratio|coverage/i, "Floor Area Ratio"],
    [/road width|access road/i, "Road Width"],
    [/perch|perches|sq\.?\s*m/i, "Plot Area"],
    [/flood|wetland|marsh/i, "Environmental Overlay"],
    [/structural|foundation|column/i, "Structural Element"],
    [/fire|escape|hydrant/i, "Fire Safety Feature"],
    [/applicant|developer|owner/i, "Applicant Entity"],
    [/uda|municipal|council|nbro|ccd|cea/i, "Regulatory Reference"],
  ];

  for (const [pattern, label] of rules) {
    if (pattern.test(text)) found.add(label);
  }

  if (found.size === 0) {
    return [
      "Building Classification",
      "Zoning District",
      "Submission Reference",
      "Inspection Timestamp",
    ];
  }

  return Array.from(found);
}
