export type ZoneType = "coastal" | "hilly" | "urban" | "wetland";

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
};

export type RoadmapStep = {
  id: string;
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

/** Mock geospatial zone classifier — Sri Lanka–centric heuristics. */
export function analyzeZoneFromPin(pin: GeoPin): ZoneAnalysis {
  const { lat, lon } = pin;

  if (lon < 80.2 || (lat < 6.55 && lon < 80.6)) {
    return {
      zoneType: "coastal",
      label: "Coastal Zone Detected",
      description:
        "Site falls within the coastal belt — Coast Conservation Department clearance is required before UDA submission.",
      riskBand: "Moderate",
      advisory: "Maintain 50 m buffer from high-water mark per CCD guidelines.",
    };
  }

  if (lat >= 6.85 && lat <= 7.45 && lon >= 80.45 && lon <= 80.9) {
    return {
      zoneType: "hilly",
      label: "Landslide Prone Area",
      description:
        "Central highland slope detected — NBRO geotechnical assessment mandatory prior to foundation design.",
      riskBand: "High",
      advisory: "Submit slope stability report and retain 30% green cover on plot.",
    };
  }

  if (lon > 80.95 && lat < 7.8) {
    return {
      zoneType: "wetland",
      label: "Wetland Buffer Zone",
      description:
        "Proximity to protected marshland — Central Environmental Authority EIA screening applies.",
      riskBand: "High",
      advisory: "No fill material within 100 m of Ramsar-designated boundaries.",
    };
  }

  return {
    zoneType: "urban",
    label: "Urban Development Zone",
    description:
      "Standard municipal jurisdiction — UDA or local MC approval pathway based on plot extent.",
    riskBand: "Low",
    advisory: "Verify road width and FAR against MC Development Regulations 2021.",
  };
}

const ROADMAP_BY_ZONE: Record<ZoneType, RoadmapStep[]> = {
  coastal: [
    {
      id: "ccd",
      title: "Coast Conservation Clearance",
      authority: "Coast Conservation Department",
      description: "Coastal setback & erosion risk review",
      estimatedDays: 21,
    },
    {
      id: "uda",
      title: "UDA Development Permit",
      authority: "Urban Development Authority",
      description: "Building plan scrutiny & zoning compliance",
      estimatedDays: 28,
    },
    {
      id: "mc",
      title: "Municipal Building Approval",
      authority: "Local Municipal Council",
      description: "Construction permit & occupancy certificate",
      estimatedDays: 14,
    },
    {
      id: "doc",
      title: "Document Verification",
      authority: "ConstructAI ML Compliance Engine",
      description: "AI-assisted plan & inspection audit",
      estimatedDays: 1,
    },
  ],
  hilly: [
    {
      id: "nbro",
      title: "NBRO Slope Assessment",
      authority: "National Building Research Organisation",
      description: "Geotechnical & landslide hazard clearance",
      estimatedDays: 35,
    },
    {
      id: "uda",
      title: "UDA Development Permit",
      authority: "Urban Development Authority",
      description: "Hill-country zoning & coverage review",
      estimatedDays: 28,
    },
    {
      id: "mc",
      title: "Pradeshiya Sabha Approval",
      authority: "Local Pradeshiya Sabha",
      description: "Rural building permit issuance",
      estimatedDays: 18,
    },
    {
      id: "doc",
      title: "Document Verification",
      authority: "ConstructAI ML Compliance Engine",
      description: "AI-assisted plan & inspection audit",
      estimatedDays: 1,
    },
  ],
  urban: [
    {
      id: "uda",
      title: "UDA Development Permit",
      authority: "Urban Development Authority",
      description: "Primary metropolitan approval gate",
      estimatedDays: 21,
    },
    {
      id: "mc",
      title: "Municipal Council Permit",
      authority: "Colombo Municipal Council",
      description: "Local building regulation enforcement",
      estimatedDays: 14,
    },
    {
      id: "fire",
      title: "Fire Safety Clearance",
      authority: "Fire Service Department",
      description: "Means of escape & hydrant compliance",
      estimatedDays: 7,
    },
    {
      id: "doc",
      title: "Document Verification",
      authority: "ConstructAI ML Compliance Engine",
      description: "AI-assisted plan & inspection audit",
      estimatedDays: 1,
    },
  ],
  wetland: [
    {
      id: "cea",
      title: "CEA Environmental Screening",
      authority: "Central Environmental Authority",
      description: "EIA / IEE determination for wetland impact",
      estimatedDays: 42,
    },
    {
      id: "ccd",
      title: "Coast Conservation Review",
      authority: "Coast Conservation Department",
      description: "Hydrological buffer verification",
      estimatedDays: 21,
    },
    {
      id: "uda",
      title: "UDA Development Permit",
      authority: "Urban Development Authority",
      description: "Conditional approval with mitigation plan",
      estimatedDays: 28,
    },
    {
      id: "doc",
      title: "Document Verification",
      authority: "ConstructAI ML Compliance Engine",
      description: "AI-assisted plan & inspection audit",
      estimatedDays: 1,
    },
  ],
};

export function buildRoadmap(zoneType: ZoneType): RoadmapStep[] {
  return ROADMAP_BY_ZONE[zoneType].map((step) => ({ ...step }));
}

const AUTHORITY_DIRECTORY: Record<string, AuthorityContact> = {
  "Coast Conservation Department": {
    institution: "Coast Conservation Department",
    officerName: "Mrs. Dilani Perera",
    role: "Assistant Director — Coastal Regulation",
    phone: "+94 11 258 8456",
    email: "ccd.clearance@gov.lk",
    address: "Maligawatta Rd, Colombo 10",
    lat: 6.9366,
    lon: 79.8747,
  },
  "National Building Research Organisation": {
    institution: "National Building Research Organisation",
    officerName: "Dr. Ruwan Silva",
    role: "Senior Geotechnical Officer",
    phone: "+94 11 267 8901",
    email: "geotech@nbro.lk",
    address: "128/1, Nawala Rd, Rajagiriya",
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
  "Local Pradeshiya Sabha": {
    institution: "Local Pradeshiya Sabha",
    officerName: "Mrs. Kumari Ratnayake",
    role: "Planning Officer",
    phone: "+94 81 222 3344",
    email: "planning@ps.gov.lk",
    address: "Pradeshiya Sabha Office, Kandy District",
    lat: 7.2906,
    lon: 80.6337,
  },
  "Fire Service Department": {
    institution: "Fire Service Department",
    officerName: "Capt. Roshan Mendis",
    role: "Fire Safety Inspector",
    phone: "+94 11 242 2222",
    email: "inspection@fireservice.gov.lk",
    address: "Fire Service HQ, Colombo 10",
    lat: 6.936,
    lon: 79.865,
  },
  "Central Environmental Authority": {
    institution: "Central Environmental Authority",
    officerName: "Dr. Priya Wijesuriya",
    role: "EIA Review Officer",
    phone: "+94 11 287 2419",
    email: "eia@cea.lk",
    address: "104, Denzil Kobbekaduwa Mawatha, Battaramulla",
    lat: 6.898,
    lon: 79.919,
  },
  "ConstructAI ML Compliance Engine": {
    institution: "ConstructAI — ML Compliance Engine",
    officerName: "AI Assessment Module",
    role: "Automated Document Classifier",
    phone: "N/A — API routed",
    email: "compliance@constructai.lk",
    address: "Cloud inference endpoint · /api/predict-compliance",
    lat: 6.9271,
    lon: 79.8612,
  },
};

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
