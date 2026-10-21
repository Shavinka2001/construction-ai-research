import type {
  Institution,
  Supervisor,
  TeamMember,
} from "@/components/landing/types";

/*
 * ===========================================================================
 *  Research group roster.
 *
 *  Names, index numbers and component ownership are taken from the Common
 *  Integrated Solution Report (Table 2.1) and the individual theses. E-mail
 *  addresses are the ones printed on the ConstructAI research paper.
 *
 *  `photo` is optional: a path under /public (e.g. "/team/ranaweera.jpg").
 *  Omit it and the card renders a monogram instead, so no placeholder
 *  portrait ever ships.
 * ===========================================================================
 */

export const TEAM: readonly TeamMember[] = [
  {
    id: "it22542724",
    name: "Ranaweera K. A.",
    studentId: "IT22542724",
    email: "kavithashwinranaweera@gmail.com",
    componentLabel: "Component 1",
    componentTitle: "Automated Site Analysis",
    branch: "Kavith",
    focusAreas: [
      "SRTM, Sentinel-2, SoilGrids and OpenStreetMap retrieval pipeline",
      "Horn slope estimation and four-band buildability classification",
      "D8 flow accumulation for hydrological flood screening",
      "Six quantified environmental exposure parameters per coordinate",
    ],
  },
  {
    id: "it22110770",
    name: "Shavinka Y. G. K.",
    studentId: "IT22110770",
    email: "345kavindushavinka@gmail.com",
    componentLabel: "Component 2",
    componentTitle: "Blueprint Extractor",
    branch: "Shavinka",
    focusAreas: [
      "Tiled YOLOv8s detection of walls, columns, doors and windows",
      "Tesseract OCR scale calibration from the drawing's own dimensions",
      "Wall-run merging, quantity synthesis and clash detection",
      "Six structural parameters recovered from ordinary 2D plans",
    ],
  },
  {
    id: "it22542892",
    name: "Samuditha T. A. V.",
    studentId: "IT22542892",
    email: "vinusha1212@gmail.com",
    componentLabel: "Component 3",
    componentTitle: "Regulatory Compliance Advisory",
    branch: "Vinusha",
    focusAreas: [
      "Twenty clause-cited UDA rules encoded as a declarative store",
      "Forward-chaining evaluator with three-valued verdicts",
      "Buildable envelope derived from the statutory clearances",
      "Sequenced approval roadmap and permit fee basis",
    ],
  },
  {
    id: "it22547460",
    name: "Shamindi E. E.",
    studentId: "IT22547460",
    email: "shamindiemalsha@gmail.com",
    componentLabel: "Component 4",
    componentTitle: "Cost and Lifecycle Consultant",
    branch: "Emalsha",
    focusAreas: [
      "Physics-informed degradation function and dataset generation",
      "XGBoost service life regressor over thirteen parameters",
      "ISO 15686-5 fifty-year discounted whole-life costing",
      "Value engineering reported as a break-even year",
    ],
  },
] satisfies readonly TeamMember[];

export const SUPERVISORS: readonly Supervisor[] = [
  {
    id: "supervisor",
    name: "Mr. Ravi Supunya",
    title: "Faculty of Computing, SLIIT",
    role: "Supervisor",
  },
  {
    id: "co-supervisor",
    name: "Mrs. Suriya Kumari",
    title: "Faculty of Computing, SLIIT",
    role: "Co-Supervisor",
  },
] satisfies readonly Supervisor[];

export const INSTITUTION: Institution = {
  groupId: "R26-IT-154",
  university: "Sri Lanka Institute of Information Technology",
  faculty: "Faculty of Computing",
  department: "Department of Information Technology",
  degree: "BSc (Hons) in Information Technology",
  academicYear: "2026",
};

/** Public repository for the research artefact. */
export const REPOSITORY_URL =
  "https://github.com/Shavinka2001/construction-ai-research";
