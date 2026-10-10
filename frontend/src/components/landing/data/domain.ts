import type {
  DomainSection,
  MethodologyPhase,
} from "@/components/landing/types";

/*
 * ===========================================================================
 *  Research write-up for the Domain page.
 *
 *  The research problem, objectives and methodology below are drawn from what
 *  the implementation actually does. The literature survey is the one block
 *  that needs your own sources: replace the bracketed citation markers with
 *  the references from your proposal document before publishing.
 * ===========================================================================
 */

export const PROJECT_ABSTRACT =
  "Pre-construction decisions in Sri Lanka are made with incomplete information. A buyer commits to land before the terrain is surveyed, an architectural plan reaches the structural engineer after the layout is fixed, and the regulatory pathway is often discovered only once a submission is rejected. Each of those gaps is expensive, and each is closed late. This research builds a single platform that answers all four questions from the drawings and coordinates a project already has: whether the site can be built on, whether the plan is structurally sound, which approvals it requires, and what it will cost to build and to maintain.";

export const DOMAIN_SECTIONS: readonly DomainSection[] = [
  {
    id: "literature-survey",
    title: "Literature survey",
    body: [
      "Automated interpretation of architectural drawings has moved from rule-based vectorisation toward learned object detection, with convolutional detectors now reliably locating doors, windows and wall symbols on scanned floor plans. Parallel work in construction informatics has applied geospatial analysis to site selection, and machine learning to cost estimation and schedule risk.",
      "Three limits recur across that body of work. Clash detection is reported descriptively, leaving resolution to the engineer. Structural analysis presumes a structural model already exists alongside the architectural one. Regulatory and passive-design compliance is treated as a manual audit performed late, rather than as a property derivable from plan geometry.",
      "Replace this section with the sources and synthesis from your proposal document. Each claim should carry its citation.",
    ],
    points: [
      "Deep learning for floor plan symbol detection and vectorisation",
      "BIM-based clash detection and coordination workflows",
      "GIS and remote sensing for site suitability assessment",
      "Machine learning applied to construction cost and schedule estimation",
      "Automated building code and passive design compliance checking",
    ],
  },
  {
    id: "research-gap",
    title: "Research gap",
    body: [
      "Existing tools stop at description. They tell a practitioner that two elements collide, that a slope is steep, or that a submission was rejected, without computing what to change, verifying that the change works, or deriving the requirement from the drawing itself.",
      "They also assume an input that small practices and individual landowners rarely have: a complete structural model to check the architectural one against. Where that second model is missing, the tooling has nothing to compare and the analysis cannot run at all.",
    ],
  },
  {
    id: "research-problem",
    title: "Research problem",
    body: [
      "Can a complete pre-construction feasibility assessment — site buildability, structural validation, regulatory clearance and lifecycle cost — be produced automatically from a single two-dimensional architectural plan and a set of site coordinates, without a pre-existing structural model and without manual interpretation at any stage?",
    ],
  },
  {
    id: "research-objectives",
    title: "Research objectives",
    body: [
      "The work is divided into four components, each owned by one member of the group and each addressing one stage of the pipeline.",
    ],
    points: [
      "Derive an explainable buildability score for a land parcel from elevation, terrain class, surface water and climate data, with every point traceable to the factor that cost it.",
      "Extract wall, opening and column geometry from a scanned architectural plan, detect structural clashes, and compute a resolution that is re-verified before it is recommended.",
      "Synthesise a clash-free column grid from the architectural plan alone, so that structural validation does not depend on a second model being available.",
      "Derive regulatory and passive-design compliance — approval pathway, window-to-floor ratio, cross-ventilation and room dimensions — directly from plan geometry and site coordinates.",
      "Carry validated quantities through to capital cost, a critical-path programme and a projection of maintenance cost over the building's life.",
    ],
  },
] satisfies readonly DomainSection[];

export const METHODOLOGY: readonly MethodologyPhase[] = [
  {
    id: "acquisition",
    name: "Input acquisition",
    detail:
      "A scanned or exported architectural plan and a site coordinate pair. No structural model and no BIM file is required.",
  },
  {
    id: "perception",
    name: "Perception",
    detail:
      "YOLOv8 locates doors, windows and openings. Adaptive-threshold OpenCV extracts wall centrelines and column symbols. Both sheets are registered to one 1024-pixel canvas at roughly 100 pixels per metre.",
  },
  {
    id: "synthesis",
    name: "Structural synthesis",
    detail:
      "Where no structural sheet is supplied, column candidates are seeded at wall junctions, rejected if they intersect a clear opening, and spaced to a 3 to 5 metre bay.",
  },
  {
    id: "resolution",
    name: "Clash resolution",
    detail:
      "Overlap is measured by intersection over union. A minimal clearance shift is computed, applied, and the overlap re-measured. Only a shift that measures clear is returned.",
  },
  {
    id: "geospatial",
    name: "Geospatial assessment",
    detail:
      "Elevation, terrain class and surface-water occurrence are sampled from Earth Engine along a fourteen-point transect, combined with climate data, and reduced to a weighted buildability score.",
  },
  {
    id: "compliance",
    name: "Compliance inference",
    detail:
      "Coordinates resolve to a zone overlay and an approval pathway. Submitted documents are classified by a hashing-vectoriser model into four risk bands, and plan geometry is audited against daylight, ventilation and room-dimension rules.",
  },
  {
    id: "costing",
    name: "Costing and programming",
    detail:
      "Validated quantities are priced against a central rate library, sequenced into a critical-path programme, and projected forward as maintenance cost.",
  },
  {
    id: "evaluation",
    name: "Evaluation",
    detail:
      "Extracted dimensions are compared against measured ground truth, resolved clashes against post-resolution overlap, and compliance classifications against expert determination.",
  },
] satisfies readonly MethodologyPhase[];
