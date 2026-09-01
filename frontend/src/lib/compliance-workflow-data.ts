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

/** Enriched authority record for Step 4 Authority Locator UI. */
export type AuthorityProfile = AuthorityContact & {
  displayName: string;
  workingHours: WorkingHoursRow[];
  activeSubmissions: number;
  avgResponseDays: number;
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

const UDA_STEP: RoadmapStep = {
  id: "uda",
  phase: 0,
  title: "UDA Clearance",
  authority: "Urban Development Authority",
  description: "Development permit, zoning compliance, and building plan scrutiny",
  estimatedDays: 28,
};

const MC_STEP: RoadmapStep = {
  id: "mc",
  phase: 0,
  title: "Local Authority / Municipal Council Approval",
  authority: "Local Municipal Council",
  description: "Construction permit issuance and occupancy certificate sign-off",
  estimatedDays: 14,
};

const CCD_STEP: RoadmapStep = {
  id: "ccd",
  phase: 1,
  title: "Coast Conservation Department (CCD) Clearance",
  authority: "Coast Conservation Department",
  description: "Coastal setback verification, erosion risk review, and buffer compliance",
  estimatedDays: 21,
};

const NBRO_STEP: RoadmapStep = {
  id: "nbro",
  phase: 1,
  title: "NBRO Geological Clearance",
  authority: "National Building Research Organisation",
  description: "Geotechnical assessment, landslide hazard screening, and slope stability sign-off",
  estimatedDays: 35,
};

/** Assign sequential phase numbers after assembly. */
function withPhases(steps: RoadmapStep[]): RoadmapStep[] {
  return steps.map((step, index) => ({
    ...step,
    phase: index + 1,
  }));
}

/**
 * Dynamically builds the approval roadmap from detected zone type.
 * Every path ends with UDA Clearance + Municipal Council Approval.
 */
export function buildRoadmap(zoneType: ZoneType): RoadmapStep[] {
  switch (zoneType) {
    case "coastal":
      return withPhases([CCD_STEP, UDA_STEP, MC_STEP]);
    case "hilly":
      return withPhases([NBRO_STEP, UDA_STEP, MC_STEP]);
    case "municipal":
    default:
      return withPhases([UDA_STEP, MC_STEP]);
  }
}

const AUTHORITY_DIRECTORY: Record<string, AuthorityContact> = {
  "Coast Conservation Department": {
    institution: "Coast Conservation Department",
    officerName: "Mrs. Dilani Perera",
    role: "Assistant Director — Coastal Regulation",
    phone: "+94 11 258 8456",
    email: "ccd.clearance@gov.lk",
    address: "Coast Conservation Dept, Maligawatta Rd, Colombo 10",
    lat: 6.9366,
    lon: 79.8747,
  },
  "National Building Research Organisation": {
    institution: "National Building Research Organisation",
    officerName: "Dr. Ruwan Silva",
    role: "Senior Geotechnical Officer",
    phone: "+94 11 267 8901",
    email: "geotech@nbro.lk",
    address: "128/1 Nawala Rd, Rajagiriya, Colombo",
    lat: 6.9089,
    lon: 79.8934,
  },
  "Urban Development Authority": {
    institution: "Urban Development Authority",
    officerName: "Mr. Kasun Jayawardena",
    role: "Development Control Officer",
    phone: "+94 11 287 3412",
    email: "dco@uda.lk",
    address: "Sir Chittampalam A Gardiner Mawatha, Colombo 02",
    lat: 6.9271,
    lon: 79.8612,
  },
  "Local Municipal Council": {
    institution: "Local Municipal Council",
    officerName: "Mr. Ajith Bandara",
    role: "Chief Building Officer",
    phone: "+94 11 278 1120",
    email: "cbo@mc.gov.lk",
    address: "Municipal Secretariat, District HQ",
    lat: 6.901,
    lon: 79.872,
  },
  "Matara Municipal Council": {
    institution: "Matara Municipal Council",
    officerName: "Mrs. Sanduni Wickramasinghe",
    role: "Assistant Municipal Commissioner — Building",
    phone: "+94 41 222 3030",
    email: "building@matara.mc.gov.lk",
    address: "Nupe Rd, Matara 81000",
    lat: 5.9549,
    lon: 80.555,
  },
  "Galle Municipal Council": {
    institution: "Galle Municipal Council",
    officerName: "Mr. Nimal Jayasinghe",
    role: "Chief Building Inspector",
    phone: "+94 91 223 4567",
    email: "permits@galle.mc.gov.lk",
    address: "Esplanade Rd, Galle 80000",
    lat: 6.0329,
    lon: 80.2168,
  },
  "Colombo Municipal Council": {
    institution: "Colombo Municipal Council",
    officerName: "Ms. Nethmi Fernando",
    role: "Building Inspector — Zone B",
    phone: "+94 11 268 4290",
    email: "building@cmb.lk",
    address: "Town Hall, Colombo 07",
    lat: 6.9147,
    lon: 79.8615,
  },
};

const AUTHORITY_PROFILE_EXTRAS: Record<
  string,
  Pick<AuthorityProfile, "workingHours" | "activeSubmissions" | "avgResponseDays">
> = {
  "Coast Conservation Department": {
    activeSubmissions: 18,
    avgResponseDays: 14,
    workingHours: [
      { day: "Mon – Thu", hours: "8:30 AM – 4:15 PM" },
      { day: "Friday", hours: "8:30 AM – 4:00 PM" },
      { day: "Public Holidays", hours: "Closed" },
    ],
  },
  "National Building Research Organisation": {
    activeSubmissions: 11,
    avgResponseDays: 21,
    workingHours: [
      { day: "Mon – Fri", hours: "8:30 AM – 4:30 PM" },
      { day: "Saturday", hours: "By appointment" },
      { day: "Sunday", hours: "Closed" },
    ],
  },
  "Urban Development Authority": {
    activeSubmissions: 26,
    avgResponseDays: 12,
    workingHours: [
      { day: "Mon – Fri", hours: "8:30 AM – 4:30 PM" },
      { day: "Document Drop-off", hours: "Until 3:00 PM" },
      { day: "Weekends", hours: "Closed" },
    ],
  },
  "Matara Municipal Council": {
    activeSubmissions: 14,
    avgResponseDays: 12,
    workingHours: [
      { day: "Mon – Fri", hours: "8:00 AM – 4:00 PM" },
      { day: "Public Counter", hours: "8:30 AM – 3:00 PM" },
      { day: "Saturday", hours: "Closed" },
    ],
  },
  "Galle Municipal Council": {
    activeSubmissions: 16,
    avgResponseDays: 11,
    workingHours: [
      { day: "Mon – Fri", hours: "8:00 AM – 4:00 PM" },
      { day: "Public Counter", hours: "8:30 AM – 3:00 PM" },
      { day: "Saturday", hours: "Closed" },
    ],
  },
  "Colombo Municipal Council": {
    activeSubmissions: 32,
    avgResponseDays: 10,
    workingHours: [
      { day: "Mon – Fri", hours: "8:30 AM – 4:30 PM" },
      { day: "Public Counter", hours: "9:00 AM – 3:00 PM" },
      { day: "Weekends", hours: "Closed" },
    ],
  },
  "Local Municipal Council": {
    activeSubmissions: 9,
    avgResponseDays: 15,
    workingHours: [
      { day: "Mon – Fri", hours: "8:00 AM – 4:00 PM" },
      { day: "Saturday", hours: "Closed" },
      { day: "Sunday", hours: "Closed" },
    ],
  },
};

const DEFAULT_PROFILE_EXTRAS = AUTHORITY_PROFILE_EXTRAS["Local Municipal Council"];

/** Resolve municipal council name from site pin (mock jurisdiction routing). */
function resolveMunicipalAuthorityKey(pin?: GeoPin | null): string {
  if (!pin) return "Local Municipal Council";
  if (isSouthernCoastalZone(pin.lat, pin.lon)) {
    return pin.lon < 80.45 ? "Galle Municipal Council" : "Matara Municipal Council";
  }
  if (pin.lat >= 6.85 && pin.lon >= 79.8 && pin.lon <= 79.95) {
    return "Colombo Municipal Council";
  }
  return "Local Municipal Council";
}

export function getAuthorityContact(authority: string): AuthorityContact {
  return (
    AUTHORITY_DIRECTORY[authority] ?? {
      institution: authority,
      officerName: "Duty Officer",
      role: "Regulatory Liaison",
      phone: "+94 11 000 0000",
      email: "info@gov.lk",
      address: "Government Secretariat",
      lat: 6.9271,
      lon: 79.8612,
    }
  );
}

/**
 * Builds the full authority profile for Step 4, accounting for active roadmap
 * phase and site pin jurisdiction (e.g. Matara MC for southern coastal pins).
 */
export function resolveAuthorityProfile(
  authorityKey: string,
  context?: { pin?: GeoPin | null; zone?: ZoneAnalysis | null }
): AuthorityProfile {
  const resolvedKey =
    authorityKey === "Local Municipal Council"
      ? resolveMunicipalAuthorityKey(context?.pin)
      : authorityKey;

  const contact = getAuthorityContact(resolvedKey);
  const extras =
    AUTHORITY_PROFILE_EXTRAS[resolvedKey] ??
    AUTHORITY_PROFILE_EXTRAS[authorityKey] ??
    DEFAULT_PROFILE_EXTRAS;

  return {
    ...contact,
    displayName: contact.institution,
    ...extras,
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
