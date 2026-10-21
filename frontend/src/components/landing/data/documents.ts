import type {
  Presentation,
  ProjectDocument,
} from "@/components/landing/types";

/*
 * ===========================================================================
 *  Project document register.
 *
 *  `href` points at a file under /public/documents. Leave it `null` while a
 *  document is still outstanding: the page then renders it as "Pending"
 *  rather than as a dead link, which is what the guidelines ask for.
 *
 *  `submittedOn` is only filled where the date is recorded on the document
 *  itself. A null date renders as an em dash rather than an invented value.
 * ===========================================================================
 */
export const PROJECT_DOCUMENTS: readonly ProjectDocument[] = [
  {
    id: "topic-assessment-form",
    title: "Topic Assessment Form (project charter)",
    kind: "charter",
    author: "Research group R26-IT-154",
    submittedOn: "2026-01-11",
    href: "/documents/topic-assessment-form.pdf",
  },
  {
    id: "proposal",
    title: "Proposal Document",
    kind: "proposal",
    author: "Research group R26-IT-154",
    submittedOn: null,
    href: null,
  },
  {
    id: "checklist-1",
    title: "Checklist — Topic Assessment",
    kind: "checklist",
    author: "Research group R26-IT-154",
    submittedOn: null,
    href: null,
  },
  {
    id: "checklist-2",
    title: "Checklist — Progress Evaluation",
    kind: "checklist",
    author: "Research group R26-IT-154",
    submittedOn: null,
    href: null,
  },
  {
    id: "final-main",
    title: "Common Integrated Solution Report (main document)",
    kind: "final",
    author: "Research group R26-IT-154",
    submittedOn: null,
    href: "/documents/final-dissertation-main.pdf",
  },
  {
    id: "final-c1",
    title: "Component 1 — Automated Site Analysis",
    kind: "final",
    author: "Ranaweera K. A. · IT22542724",
    submittedOn: null,
    href: "/documents/final-component-1-ranaweera.pdf",
  },
  {
    id: "final-c2",
    title: "Component 2 — Blueprint Extractor",
    kind: "final",
    author: "Shavinka Y. G. K. · IT22110770",
    submittedOn: null,
    href: null,
  },
  {
    id: "final-c3",
    title: "Component 3 — Regulatory Compliance Advisory",
    kind: "final",
    author: "Samuditha T. A. V. · IT22542892",
    submittedOn: null,
    href: "/documents/final-component-3-samuditha.pdf",
  },
  {
    id: "final-c4",
    title: "Component 4 — Cost and Lifecycle Consultant",
    kind: "final",
    author: "Shamindi E. E. · IT22547460",
    submittedOn: null,
    href: "/documents/final-component-4-shamindi.pdf",
  },
  {
    id: "paper-constructai",
    title:
      "ConstructAI: An Integrated AI-Driven Framework for Automated Pre-Construction Feasibility Analysis",
    kind: "other",
    author: "Research group R26-IT-154",
    submittedOn: null,
    href: "/documents/research-paper-constructai.pdf",
  },
  {
    id: "paper-component-2",
    title: "Research Paper — Component 2: Blueprint Extractor",
    kind: "other",
    author: "Shavinka Y. G. K. · IT22110770",
    submittedOn: null,
    href: "/documents/research-paper-component-2.pdf",
  },
  {
    id: "poster",
    title: "Research Poster — R26-IT-154",
    kind: "other",
    author: "Research group R26-IT-154",
    submittedOn: null,
    href: "/documents/research-poster-r26-it-154.pdf",
  },
] satisfies readonly ProjectDocument[];

export const DOCUMENT_KIND_LABELS: Record<ProjectDocument["kind"], string> = {
  charter: "Charter",
  proposal: "Proposal",
  checklist: "Checklist",
  final: "Final submission",
  other: "Papers and poster",
};

/*
 * ===========================================================================
 *  >>> Slide decks are not published yet. <<<
 *
 *  Drop each deck as a PDF under /public/documents and set `href` to it, for
 *  example "/documents/slides-proposal.pdf". Until then each entry renders as
 *  "Not yet presented" so the sequence stays visible.
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
