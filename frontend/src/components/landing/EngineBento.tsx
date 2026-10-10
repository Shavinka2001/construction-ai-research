import {
  Container,
  Section,
  SectionHeading,
} from "@/components/landing/primitives/Section";
import { EngineGrid } from "@/components/landing/EngineGrid";

/** The four research components, as an asymmetric bento grid. */
export function EngineBento() {
  return (
    <Section id="engines">
      <div
        aria-hidden
        className="lp-grid-blueprint-light lp-grid-mask absolute inset-0"
      />

      <Container className="relative">
        <SectionHeading
          id="engines"
          eyebrow="The four engines"
          title={
            <>
              Four research components,{" "}
              <span className="lp-text-gold-gradient">one pipeline</span>.
            </>
          }
          description="Each component is an independent research contribution that also forms one stage of a single pre-construction pipeline: site, plan, permit, price. Figures below are read from the implementation, and each card states whether the engine behind it is live or still a prototype."
        />

        <EngineGrid />
      </Container>
    </Section>
  );
}
