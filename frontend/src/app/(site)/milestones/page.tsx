import type { Metadata } from "next";

import { PageHeader } from "@/components/landing/primitives/PageHeader";
import { Container, Section } from "@/components/landing/primitives/Section";
import { MilestoneExplorer } from "@/components/landing/MilestoneExplorer";

export const metadata: Metadata = {
  title: "Milestones",
  description:
    "Every assessment in the ConstructAI research project, what it covers and when it falls.",
};

export default function MilestonesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Milestones"
        title="Assessments and deliverables."
        lede="Each assessment in the project, what it covers, what is handed in and where it currently stands. Marks are allocated by the module outline and are not published here."
      />

      <Section id="milestones" className="py-section lg:py-section-lg">
        <Container>
          <MilestoneExplorer />
        </Container>
      </Section>
    </>
  );
}
