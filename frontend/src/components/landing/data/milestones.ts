import type { Milestone } from "@/components/landing/types";

/*
 * ===========================================================================
 *  >>> PLACEHOLDER DATA — replace dates and marks before publishing. <<<
 *
 *  The assessment names follow the project web guidelines. Fill in `date`
 *  (ISO, YYYY-MM-DD) and `marks` (percentage of the module grade) from the
 *  module outline, and set `status` to match. A `null` date renders as
 *  "To be announced" rather than an invented value, so the page stays honest
 *  until the real schedule is in.
 * ===========================================================================
 */
export const MILESTONES: readonly Milestone[] = [
  {
    id: "project-charter",
    name: "Project Charter",
    date: null,
    marks: null,
    description:
      "Registers the group, the supervisor and the scope of the research with the department.",
    deliverables: ["Project charter document"],
    status: "completed",
  },
  {
    id: "project-proposal",
    name: "Project Proposal",
    date: null,
    marks: null,
    description:
      "Sets out the research problem, the gap in existing work, the objectives and the proposed methodology for each component.",
    deliverables: [
      "Proposal document",
      "Proposal presentation",
      "Supervisor evaluation",
    ],
    status: "completed",
  },
  {
    id: "progress-presentation-1",
    name: "Progress Presentation I",
    date: null,
    marks: null,
    description:
      "Demonstrates roughly half the implemented scope against the objectives agreed at proposal stage.",
    deliverables: ["Progress presentation", "Demonstration of each component"],
    status: "completed",
  },
  {
    id: "progress-presentation-2",
    name: "Progress Presentation II",
    date: null,
    marks: null,
    description:
      "Demonstrates the integrated system with all four components working against the shared platform contracts.",
    deliverables: ["Progress presentation", "Integrated system demonstration"],
    status: "upcoming",
  },
  {
    id: "final-assessment",
    name: "Final Assessment",
    date: null,
    marks: null,
    description:
      "Final submission of the dissertation, the implemented system and the supporting research documents.",
    deliverables: [
      "Final dissertation",
      "Individual component chapters",
      "Complete system",
    ],
    status: "upcoming",
  },
  {
    id: "viva",
    name: "Viva Voce",
    date: null,
    marks: null,
    description:
      "Oral examination on the research contribution, the implementation and each member's individual component.",
    deliverables: ["Oral defence", "Live system demonstration"],
    status: "upcoming",
  },
] satisfies readonly Milestone[];
