import type { Metadata } from "next";

import { PageHeader } from "@/components/landing/primitives/PageHeader";
import { TeamSection } from "@/components/landing/TeamSection";

export const metadata: Metadata = {
  title: "About us",
  description:
    "The research group behind Construction AI, the component each member owns, and the academic supervision of the project.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About us"
        title="The group behind the project."
        lede="Four undergraduate researchers, one component each, supervised within the Department of Information Technology."
      />

      <TeamSection />
    </>
  );
}
