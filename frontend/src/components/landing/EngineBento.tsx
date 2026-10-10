import {
  Container,
  Section,
  SectionMasthead,
} from "@/components/landing/primitives/Section";
import { EngineGrid } from "@/components/landing/EngineGrid";

/** The four research components, as full-width editorial rows. */
export function EngineBento() {
  return (
    <Section id="engines" className="py-section lg:py-section-lg">
      <Container>
        <SectionMasthead
          id="engines"
          index="01"
          label="Components"
          title="Four engines, one pipeline."
          lede={
            <>
              <p>
                Each component stands as its own research contribution and also
                forms one stage of the same pipeline: score the site, validate
                the plan, clear the permit, price the build. Output from one
                stage is the input to the next.
              </p>
              <p className="mt-3">
                Figures below are read from the implementation. Where an engine
                is still a prototype it says so.
              </p>
            </>
          }
        />

        <EngineGrid />
      </Container>
    </Section>
  );
}
