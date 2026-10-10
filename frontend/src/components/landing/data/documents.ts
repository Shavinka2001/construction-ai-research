import type {
  Presentation,
  ProjectDocument,
} from "@/components/landing/types";

/*
 * ===========================================================================
 *  >>> PLACEHOLDER DATA — add the real links before publishing. <<<
 *
 *  Set `href` to the published file (a Drive link, a repository path, or a
 *  file under /public). Leave it `null` while a document is still pending:
 *  the page then renders it as "Pending" instead of a dead link, which is
 *  what the guidelines ask for.
 * ===========================================================================
 */
export const PROJECT_DOCUMENTS: readonly ProjectDocument[] = [
  {
    id: "charter",
    title: "Project Charter",
    kind: "charter",
    author: "Research group",
    submittedOn: null,
    href: null,
  },
  {
    id: "proposal",
    title: "Proposal Document",
    kind: "proposal",
    author: "Research group",
    submittedOn: null,
    href: null,
  },
  {
    id: "checklist-1",
    title: "Checklist — Topic Assessment",
    kind: "checklist",
    author: "Research group",
    submittedOn: null,
    href: null,
  },
  {
    id: "checklist-2",
    title: "Checklist — Progress Evaluation",
    kind: "checklist",
    author: "Research group",
    submittedOn: null,
    href: null,
  },
  {
    id: "final-main",
    title: "Final Dissertation (main document)",
    kind: "final",
    author: "Research group",
    submittedOn: null,
    href: null,
  },
  {
    id: "final-c1",
    title: "Final Document — Component 1: Site & Geospatial Intelligence",
    kind: "final",
    author: "Researcher One",
    submittedOn: null,
    href: null,
  },
  {
    id: "final-c2",
    title:
      "Final Document — Component 2: Architectural Validation & Generative BIM",
    kind: "final",
    author: "Researcher Two",
    submittedOn: null,
    href: null,
  },
  {
    id: "final-c3",
    title: "Final Document — Component 3: Regulatory Approval & Compliance",
    kind: "final",
    author: "Researcher Three",
    submittedOn: null,
    href: null,
  },
  {
    id: "final-c4",
    title: "Final Document — Component 4: Cost, Scheduling & Lifecycle",
    kind: "final",
    author: "Researcher Four",
    submittedOn: null,
    href: null,
  },
] satisfies readonly ProjectDocument[];

export const DOCUMENT_KIND_LABELS: Record<ProjectDocument["kind"], string> = {
  charter: "Charter",
  proposal: "Proposal",
  checklist: "Checklist",
  final: "Final submission",
  other: "Other",
};

/*
 * ===========================================================================
 *  >>> PLACEHOLDER DATA — add the real slide links before publishing. <<<
 * ===========================================================================
 */
export const PRESENTATIONS: readonly Presentation[] = [
  {
    id: "proposal-presentation",
    title: "Proposal Presentation",
    date: null,
    href: null,
    summary:
      "The research problem, the gap in existing work, and the proposed scope of each of the four components.",
  },
  {
    id: "progress-1",
    title: "Progress Presentation I",
    date: null,
    href: null,
    summary:
      "First working implementations: site scoring, plan perception and the initial compliance workflow.",
  },
  {
    id: "progress-2",
    title: "Progress Presentation II",
    date: null,
    href: null,
    summary:
      "The integrated pipeline, with clash resolution, generative structural layout and the costing workspace.",
  },
  {
    id: "final-presentation",
    title: "Final Presentation",
    date: null,
    href: null,
    summary:
      "Complete system demonstration, evaluation results and the research contribution.",
  },
] satisfies readonly Presentation[];
