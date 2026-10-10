import { Building2, Mountain, ScrollText, Wallet } from "lucide-react";

import type { Engine } from "@/components/landing/types";

/**
 * The four integrated research components.
 *
 * Every capability, threshold and metric below was read off the implementation
 * rather than written from the proposal:
 *
 *  C1 -> backend/app/services/land_analyzer_service.py
 *  C2 -> backend/app/services/{clash_detection,architectural_audit,
 *       generative_structural_layout,dxf_export}.py
 *  C3 -> backend/app/services/compliance_predictor.py
 *       frontend/src/lib/compliance-workflow/*
 *  C4 -> frontend/src/components/dashboard/quantity-surveyor/*
 *
 * C4 is marked `prototype` deliberately: its BOQ rows and OPEX curve are
 * illustrative in the current build, and no gradient-boosting dependency is
 * declared in backend/requirements.txt. Flip it to "live" once the regressor
 * is wired up.
 */
export const ENGINES: readonly Engine[] = [
  {
    id: "site-intelligence",
    index: 1,
    title: "Site & Geospatial Intelligence",
    academicName: "Automated Site Analysis & Geospatial Intelligence Module",
    tagline:
      "Scores a parcel before anyone walks it. Every point of the verdict is traceable to the factor that cost it.",
    icon: Mountain,
    maturity: "live",
    accent: "emerald",
    gridClass: "lg:col-span-3",
    capabilities: [
      {
        label: "DEM topography & slope",
        detail:
          "SRTM elevation sampled across a 14-point, 200 m east-west transect to derive slope and contour profile.",
      },
      {
        label: "Steep-slope risk flagging",
        detail:
          "Slope severity is scored and penalised, isolating terrain that needs geotechnical review before foundation design.",
      },
      {
        label: "Flood & surface-water hazard",
        detail:
          "JRC Global Surface Water occurrence is banded into a flood-risk class per parcel.",
      },
      {
        label: "Terrain classification",
        detail:
          "ESA WorldCover v100 resolves tree cover, built-up and wetland classes into site-clearance cost penalties.",
      },
      {
        label: "Explainable buildability score",
        detail:
          "Weighted 0-100 matrix - slope 35%, flood 25%, terrain 15%, setback 15%, weather 10% - each with a written reason.",
      },
      {
        label: "Deterministic offline fallback",
        detail:
          "Every Earth Engine call degrades to a lat/lon-seeded synthetic model, so the endpoint always answers.",
      },
    ],
    metrics: [
      { label: "Scoring factors", value: "5" },
      { label: "Transect samples", value: "14" },
      { label: "Score range", value: "0-100" },
    ],
    stack: [
      "Google Earth Engine",
      "SRTM DEM",
      "ESA WorldCover v100",
      "JRC Surface Water",
      "Open-Meteo",
      "Leaflet",
      "Three.js terrain",
    ],
    href: "/dashboard/site-feasibility",
  },
  {
    id: "architectural-validation",
    index: 2,
    title: "Architectural Validation & Generative BIM",
    academicName:
      "Automated Architectural Validation & Metric Extraction Module",
    tagline:
      "Reads a scanned plan, finds what collides, works out the fix, and rebuilds the result as a model you can walk through.",
    icon: Building2,
    maturity: "live",
    accent: "gold",
    gridClass: "lg:col-span-3",
    capabilities: [
      {
        label: "Hybrid YOLOv8 + OpenCV perception",
        detail:
          "YOLOv8 detects doors, windows and openings; adaptive-threshold OpenCV extracts wall centrelines and column symbols.",
      },
      {
        label: "Shared registration canvas",
        detail:
          "Architectural and structural sheets are both registered to one 1024x1024 frame at about 100 px per metre.",
      },
      {
        label: "Closed-loop Generative Clash Resolution",
        detail:
          "IoU overlap flags a clash, a minimal clearance shift is computed, then the move is re-validated before it is recommended.",
      },
      {
        label: "AI Generative Structural Layout",
        detail:
          "With no structural sheet, a clash-free column grid is synthesised from wall junctions at 3-5 m bay spacing.",
      },
      {
        label: "Load-bearing wall classifier",
        detail:
          "Stroke thickness past the 0.23 m threshold plus column alignment separates load-bearing walls from partitions.",
      },
      {
        label: "3D dollhouse & first-person walkthrough",
        detail:
          "Orthogonal wall runs are welded into a Three.js maquette with orbit, walkthrough and day/night lighting modes.",
      },
      {
        label: "Layered AutoCAD .dxf export",
        detail:
          "Four ACI-coloured layers - WALLS, COLUMNS, DOORS, WINDOWS - remapped from pixel space into CAD model space.",
      },
      {
        label: "Stamped PDF audit report",
        detail:
          "Detections, resolutions and the openings schedule are composited into a distributable report.",
      },
    ],
    metrics: [
      { label: "Registration canvas", value: "1024", unit: "px sq." },
      { label: "Model scale", value: "100", unit: "px/m" },
      { label: "Bay spacing", value: "3-5", unit: "m" },
      { label: "DXF layers", value: "4" },
    ],
    stack: [
      "YOLOv8 (Ultralytics)",
      "OpenCV",
      "PyTorch",
      "PyMuPDF",
      "ezdxf",
      "Three.js",
      "Tesseract OCR",
    ],
    href: "/dashboard/clash-detection",
  },
  {
    id: "regulatory-compliance",
    index: 3,
    title: "Regulatory Approval & Compliance Advisory",
    academicName:
      "Automated Regulatory Approval & Compliance Advisory Module",
    tagline:
      "Turns a map pin into the approval pathway it actually requires, down to the officer who signs it off.",
    icon: ScrollText,
    maturity: "live",
    accent: "emerald",
    gridClass: "lg:col-span-2",
    capabilities: [
      {
        label: "Zone overlay detection",
        detail:
          "Coordinates resolve to a coastal belt, NBRO landslide-prone or standard municipal overlay, each with its own clearance chain.",
      },
      {
        label: "Four-stage approval workflow",
        detail:
          "Geospatial identification, authority mapping, document verification and approval roadmap, as a testable state machine.",
      },
      {
        label: "ML document classification",
        detail:
          "A 487-feature hashing vectoriser feeds a classifier returning Compliant, Pending Approval, Minor or High-Risk Violation.",
      },
      {
        label: "Natural ventilation & daylight audit",
        detail:
          "Window-to-floor ratio is checked against the 10% minimum, with cross-ventilation scored from opposite openings per room.",
      },
      {
        label: "Room code compliance",
        detail:
          "Minimum habitable area 6.5 sq.m, bathroom 3.3 sq.m and 2.1 m clear width are verified per detected room polygon.",
      },
      {
        label: "Authority directory & routing",
        detail:
          "UDA plus Colombo, Galle and Matara Municipal Councils carry real desks, officers, working hours and response windows.",
      },
    ],
    metrics: [
      { label: "Min. window-to-floor", value: "10", unit: "%" },
      { label: "Workflow stages", value: "4" },
      { label: "Risk classes", value: "4" },
    ],
    stack: [
      "scikit-learn",
      "HashingVectorizer",
      "FastAPI",
      "Leaflet",
      "Shapely",
      "Pure TS state machine",
    ],
    href: "/dashboard/regulatory-checker",
  },
  {
    id: "cost-lifecycle",
    index: 4,
    title: "Cost, Scheduling & Lifecycle Consultant",
    academicName: "Intelligent Cost, Scheduling & Lifecycle Consultant",
    tagline:
      "Takes the quantities the earlier stages validated and prices them, programmes them, and projects what upkeep will cost.",
    icon: Wallet,
    maturity: "prototype",
    accent: "gold",
    gridClass: "lg:col-span-4",
    capabilities: [
      {
        label: "Automated bill of quantities",
        detail:
          "Validated take-off lines roll up to an LKR grand total across excavation, concrete, brickwork and joinery.",
      },
      {
        label: "Market-linked rate library",
        detail:
          "Unit rates are held centrally so a rate revision re-prices every open estimate at once.",
      },
      {
        label: "Critical Path Method programme",
        detail:
          "Dependencies resolve into a Gantt timeline that exposes the driving path and float per activity.",
      },
      {
        label: "30-year lifecycle OPEX outlook",
        detail:
          "A material degradation curve projects maintenance spend beyond handover, next to day-one CAPEX.",
      },
    ],
    metrics: [
      { label: "Lifecycle horizon", value: "30", unit: "yrs" },
      { label: "Currency", value: "LKR" },
      { label: "Status", value: "UI complete" },
    ],
    stack: ["Next.js", "TypeScript", "jsPDF", "SVG charting"],
    href: "/dashboard/cost-estimation",
  },
] satisfies readonly Engine[];
