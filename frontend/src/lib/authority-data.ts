export type ApplicationStatus =
  | "Compliant"
  | "Pending Approval"
  | "Minor Violation"
  | "High Risk Violation";

export type BuildingApplication = {
  id: string;
  projectName: string;
  applicant: string;
  location: string;
  submittedDate: string;
  status: ApplicationStatus;
  complianceScore: number;
  inspectionText: string;
};

export const BUILDING_APPLICATIONS: BuildingApplication[] = [
  {
    id: "app-01",
    projectName: "Lakeview Residences — Block A",
    applicant: "Colombo Prime Developers (Pvt) Ltd",
    location: "Battaramulla, Western Province",
    submittedDate: "08 Jul 2026",
    status: "Compliant",
    complianceScore: 94,
    inspectionText:
      "All setbacks verified: front 3.2m, rear 2.8m, side 1.6m. FAR 1.3 within zoning limit 1.5. Road width 14ft exceeds 12ft minimum. No environmental constraints detected. Drainage plan approved.",
  },
  {
    id: "app-02",
    projectName: "Harbor Commercial Annex",
    applicant: "Maritime Holdings PLC",
    location: "Galle Face, Colombo 03",
    submittedDate: "06 Jul 2026",
    status: "Pending Approval",
    complianceScore: 81,
    inspectionText:
      "Commercial annex extension. Setbacks compliant. Awaiting UDA height clearance certificate. Fire escape route plan submitted but not yet stamped by CMC fire division.",
  },
  {
    id: "app-03",
    projectName: "Greenfield Townhouses",
    applicant: "EcoHomes Lanka",
    location: "Malabe, Western Province",
    submittedDate: "04 Jul 2026",
    status: "Compliant",
    complianceScore: 97,
    inspectionText:
      "Low-density residential cluster. All 12 units meet minimum habitable area. Perimeter wall height 1.8m compliant. Stormwater retention pond included. Full compliance with Gazette 2021 residential guidelines.",
  },
  {
    id: "app-04",
    projectName: "Cinnamon Hill Villa",
    applicant: "Mr. N. Perera",
    location: "Kandy, Central Province",
    submittedDate: "02 Jul 2026",
    status: "Minor Violation",
    complianceScore: 72,
    inspectionText:
      "Single dwelling on sloped plot. Road access width measured at 11ft — below 12ft minimum for this zone. Rear setback 2.1m vs required 2.5m. Applicant submitted variance request with LKR 15,000 fine calculation.",
  },
  {
    id: "app-05",
    projectName: "Metro Plaza Extension",
    applicant: "Urban Retail Group",
    location: "Nugegoda, Western Province",
    submittedDate: "30 Jun 2026",
    status: "High Risk Violation",
    complianceScore: 58,
    inspectionText:
      "Multi-storey retail extension. Plot coverage 72% exceeds 60% maximum for commercial zone C2. No approved EIA for increased footprint. Structural engineer stamp missing on revised foundation plan. Flood zone overlay intersects north boundary.",
  },
];

export function countByStatus(
  applications: BuildingApplication[],
  status: ApplicationStatus
): number {
  return applications.filter((a) => a.status === status).length;
}

export function pendingCount(applications: BuildingApplication[]): number {
  return applications.filter((a) => a.status === "Pending Approval").length;
}

export function flaggedCount(applications: BuildingApplication[]): number {
  return applications.filter(
    (a) => a.status === "Minor Violation" || a.status === "High Risk Violation"
  ).length;
}

export function approvedCount(applications: BuildingApplication[]): number {
  return applications.filter((a) => a.status === "Compliant").length;
}
