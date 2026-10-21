import type { Milestone } from "@/components/landing/types";

/*
 * ===========================================================================
 *  Assessment timeline for IT4010 Research Project (2026).
 *
 *  Marks are deliberately not published here: the module outline allocates
 *  them and the group has not been given a confirmed breakdown, so quoting a
 *  weight would be inventing one.
 *
 *  Fill `date` (ISO, YYYY-MM-DD) from the module outline as each assessment
 *  is scheduled. A null date renders as "To be announced" rather than as a
 *  made-up value, and `status` should be moved to "completed" as each one
 *  passes.
 * ===========================================================================
 */
export const MILESTONES: readonly Milestone[] = [
  {
    id: "project-charter",
    name: "Topic Assessment",
    date: "2026-01-11",
    description:
      "Registers the group, the supervisor and the scope of the research with the department, and establishes the four-component split.",
    deliverables: ["Topic Assessment Form", "Supervisor and co-supervisor sign-off"],
    status: "completed",
  },
  {
    id: "project-proposal",
    name: "Project Proposal",
    date: null,
    description:
      "Sets out the research problem, the gap in existing work, the objectives and the proposed methodology for each of the four components.",
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
    description:
      "Demonstrates roughly half the implemented scope against the objectives agreed at proposal stage.",
    deliverables: ["Progress presentation", "Demonstration of each component"],
    status: "completed",
  },
  {
    id: "progress-presentation-2",
    name: "Progress Presentation II",
    date: null,
    description:
      "Demonstrates the integrated system with all four components operating over the shared project state.",
    deliverables: ["Progress presentation", "Integrated system demonstration"],
    status: "completed",
  },
  {
    id: "final-assessment",
    name: "Final Assessment",
    date: null,
    description:
      "Final submission of the common integrated solution report, the four individual theses and the implemented system.",
    deliverables: [
      "Common Integrated Solution Report",
      "Four individual theses",
      "Complete system",
    ],
    status: "upcoming",
  },
  {
    id: "viva",
    name: "Viva Voce",
    date: null,
    description:
      "Oral examination on the research contribution, the integration design and each member's individual component.",
    deliverables: ["Oral defence", "Live system demonstration"],
    status: "upcoming",
  },
] satisfies readonly Milestone[];
