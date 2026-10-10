"use client";

import { Reveal } from "@/components/landing/primitives/Reveal";
import { EngineCard } from "@/components/landing/EngineCard";
import { ENGINES } from "@/components/landing/data/engines";

/**
 * Client boundary for the engine grid.
 *
 * The engine records carry `lucide-react` icon components, which are functions
 * and therefore cannot cross a server/client boundary as props. Importing
 * `ENGINES` here instead of receiving it keeps the data on one side of that
 * boundary, so the enclosing section can stay a server component.
 *
 * Grid rhythm: one column on phones, two on tablets, then a six-column desktop
 * track where each card declares its own span via `engine.gridClass`.
 */
export function EngineGrid() {
  return (
    <div className="mt-12 grid gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-6 lg:gap-6">
      {ENGINES.map((engine, index) => (
        <Reveal key={engine.id} delay={index * 90} className={engine.gridClass}>
          <EngineCard engine={engine} />
        </Reveal>
      ))}
    </div>
  );
}
