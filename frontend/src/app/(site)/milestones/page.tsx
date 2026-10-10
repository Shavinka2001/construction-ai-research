import type { Metadata } from "next";

import { PageHeader } from "@/components/landing/primitives/PageHeader";
import { Container, Section } from "@/components/landing/primitives/Section";
import { MilestoneExplorer } from "@/components/landing/MilestoneExplorer";

export const metadata: Metadata = {
  title: "Milestones",
  description:
    "Every assessment in the Construction AI research project, with its date and the marks allocated.",
};

export default function MilestonesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Milestones"
        title="Assessments and marks."
        lede="Each assessment in the project, what it covers, when it falls and how much it carries toward the module grade."
      />

      <Section id="milestones" className="py-16 sm:py-20">
        <Container>
          <MilestoneExplorer />
        </Container>
      </Section>
    </>
  );
}
