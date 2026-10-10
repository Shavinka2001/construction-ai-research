"use client";

import { Reveal } from "@/components/landing/primitives/Reveal";
import { EngineRow } from "@/components/landing/EngineRow";
import { ENGINES } from "@/components/landing/data/engines";

/**
 * Client boundary for the component rows.
 *
 * Engine records carry `lucide-react` icon components, which are functions and
 * cannot be passed as props across the server/client divide, so `ENGINES` is
 * imported here instead of received and the enclosing section stays
 * server-rendered.
 */
export function EngineGrid() {
  return (
    <div className="mt-14 sm:mt-16">
      {ENGINES.map((engine, index) => (
        <Reveal key={engine.id}>
          <EngineRow engine={engine} flip={index % 2 === 1} />
        </Reveal>
      ))}
    </div>
  );
}
