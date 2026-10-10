import type {
  Institution,
  Supervisor,
  TeamMember,
} from "@/components/landing/types";

/*
 * ===========================================================================
 *  >>> EDIT THIS FILE TO PUBLISH THE REAL TEAM DETAILS. <<<
 *
 *  This is the only file that needs changing. Nothing else on the landing page
 *  hard-codes a name, an index number or an institution.
 *
 *  - `name`        replace the placeholder with the full name as it should be
 *                  printed on the submission.
 *  - `studentId`   registration / index number. Delete the line to hide it.
 *  - `branch`      the git branch each member works on. These four values are
 *                  real, read from the repository, and map each member to the
 *                  component below. Verify the pairing before publishing.
 *  - `email`       required on the About us page.
 *  - `photo`       optional path under /public (e.g. "/team/name.jpg").
 *                  Omit it and the card shows a monogram instead.
 *  - `achievements` optional list of awards or publications.
 *  - `focusAreas`  three to four short phrases. These are derived from the code
 *                  actually committed on each branch.
 *
 *  The cards render a monogram from `name`, so no photography is required.
 * ===========================================================================
 */

export const TEAM: readonly TeamMember[] = [
  {
    id: "member-1",
    email: "researcher.one@example.com",
    name: "Researcher One",
    studentId: "ITxxxxxxxx",
    componentLabel: "Component 1",
    componentTitle: "Site & Geospatial Intelligence",
    branch: "Shavinka",
    focusAreas: [
      "Earth Engine DEM & slope analysis",
      "Flood and terrain hazard banding",
      "Explainable buildability scoring",
      "Land parcel 3D terrain viewer",
    ],
  },
  {
    id: "member-2",
    email: "researcher.two@example.com",
    name: "Researcher Two",
    studentId: "ITxxxxxxxx",
    componentLabel: "Component 2",
    componentTitle: "Architectural Validation & Generative BIM",
    branch: "Kavith",
    focusAreas: [
      "YOLOv8 and OpenCV plan perception",
      "Closed-loop clash resolution",
      "Three.js dollhouse & walkthrough",
      "Layered AutoCAD DXF export",
    ],
  },
  {
    id: "member-3",
    email: "researcher.three@example.com",
    name: "Researcher Three",
    studentId: "ITxxxxxxxx",
    componentLabel: "Component 3",
    componentTitle: "Regulatory Approval & Compliance Advisory",
    branch: "Vinusha",
    focusAreas: [
      "Four-stage approval state machine",
      "ML document classification",
      "Authority directory & routing",
      "Passive design code auditing",
    ],
  },
  {
    id: "member-4",
    email: "researcher.four@example.com",
    name: "Researcher Four",
    studentId: "ITxxxxxxxx",
    componentLabel: "Component 4",
    componentTitle: "Cost, Scheduling & Lifecycle Consultant",
    branch: "Emalsha",
    focusAreas: [
      "Automated bill of quantities",
      "Critical path programme modelling",
      "Lifecycle OPEX projection",
      "Quantity surveyor workspace",
    ],
  },
] satisfies readonly TeamMember[];

export const SUPERVISORS: readonly Supervisor[] = [
  {
    id: "supervisor",
    name: "Supervisor Name",
    title: "Senior Lecturer",
    role: "Supervisor",
  },
  {
    id: "co-supervisor",
    name: "Co-Supervisor Name",
    title: "Lecturer",
    role: "Co-Supervisor",
  },
] satisfies readonly Supervisor[];

export const INSTITUTION: Institution = {
  university: "University Name",
  faculty: "Faculty of Computing",
  department: "Department of Information Technology",
  degree: "BSc (Hons) in Information Technology",
  academicYear: "2025 / 2026",
};

/** Public repository for the research artefact. */
export const REPOSITORY_URL =
  "https://github.com/Shavinka2001/construction-ai-research";
