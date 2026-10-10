"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import {
  Container,
  Section,
  SectionMasthead,
} from "@/components/landing/primitives/Section";
import { Reveal } from "@/components/landing/primitives/Reveal";
import {
  LAYER_LABELS,
  STACK_NODES,
} from "@/components/landing/data/architecture";
import type { StackLayer, StackNode } from "@/components/landing/types";

const LAYER_ORDER: readonly StackLayer[] = [
  "client",
  "service",
  "intelligence",
  "persistence",
];

const NODES_BY_LAYER = LAYER_ORDER.map((layer) => ({
  layer,
  nodes: STACK_NODES.filter((node) => node.layer === layer),
}));

const nodeLabel = (id: string) =>
  STACK_NODES.find((node) => node.id === id)?.label ?? id;

export function ArchitectureFlow() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeNode = STACK_NODES.find((node) => node.id === activeId) ?? null;

  /**
   * A row stays lit when it is the focus, when the focus sends data to it, or
   * when it sends data to the focus — so selecting any service lights its real
   * request path rather than an arbitrary neighbour.
   */
  const isOnActivePath = (node: StackNode): boolean => {
    if (!activeNode) return true;
    if (node.id === activeNode.id) return true;
    if (activeNode.flowsTo.includes(node.id)) return true;
    return node.flowsTo.includes(activeNode.id);
  };

  return (
    <Section id="architecture" tone="ink" className="py-section lg:py-section-lg">
      <Container>
        <SectionMasthead
          id="architecture"
          index="07"
          label="Technologies used"
          tone="ink"
          title="The request path, as deployed."
          lede="Four layers, seven services. Select a row to see what it sends and to whom. This is the topology that runs, not a reference diagram."
        />

        <Reveal className="mt-14 sm:mt-16">
          {/* Layer columns. */}
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {NODES_BY_LAYER.map(({ layer, nodes }, columnIndex) => (
              <div key={layer}>
                <div className="flex items-baseline gap-2.5 border-b border-white/10 pb-3">
                  <span className="font-mono text-label-sm tabular-nums text-gold">
                    {String(columnIndex + 1).padStart(2, "0")}
                  </span>
                  <h3 className="lp-label text-slate-500">
                    {LAYER_LABELS[layer]}
                  </h3>
                </div>

                <ul className="mt-1">
                  {nodes.map((node) => {
                    const Icon = node.icon;
                    const isActive = activeId === node.id;

                    return (
                      <li key={node.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveId(node.id)}
                          onMouseLeave={() => setActiveId(null)}
                          onFocus={() => setActiveId(node.id)}
                          onBlur={() => setActiveId(null)}
                          onClick={() => setActiveId(node.id)}
                          aria-pressed={isActive}
                          className={cn(
                            "lp-focus group flex w-full items-start gap-3 border-b border-white/5 py-3.5 text-left transition-opacity duration-300 ring-offset-ink",
                            !isOnActivePath(node) && "opacity-30"
                          )}
                        >
                          <Icon
                            aria-hidden
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0 transition-colors",
                              isActive ? "text-gold" : "text-slate-500"
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-body-sm font-semibold transition-colors",
                                isActive ? "text-gold" : "text-white"
                              )}
                            >
                              {node.label}
                            </span>
                            <span className="mt-0.5 block text-micro leading-snug text-slate-500">
                              {node.role}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Edge table. Dense by design: a payload manifest reads as
              engineering documentation, and it also makes the whole data flow
              available without any hover interaction. */}
          <div className="mt-14 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <caption className="sr-only">
                Service-to-service data flow, listing the payload each service
                sends and its destinations.
              </caption>
              <thead>
                <tr className="border-y border-white/10">
                  <th
                    scope="col"
                    className="py-3 pr-6 font-mono text-label-sm font-medium uppercase tracking-label text-slate-500"
                  >
                    From
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-6 font-mono text-label-sm font-medium uppercase tracking-label text-slate-500"
                  >
                    Payload
                  </th>
                  <th
                    scope="col"
                    className="py-3 font-mono text-label-sm font-medium uppercase tracking-label text-slate-500"
                  >
                    To
                  </th>
                </tr>
              </thead>
              <tbody>
                {STACK_NODES.map((node) => (
                  <tr
                    key={node.id}
                    onMouseEnter={() => setActiveId(node.id)}
                    onMouseLeave={() => setActiveId(null)}
                    className={cn(
                      "border-b border-white/5 align-top transition-opacity duration-300",
                      !isOnActivePath(node) && "opacity-30"
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        "whitespace-nowrap py-3.5 pr-6 text-caption font-semibold transition-colors",
                        activeId === node.id ? "text-gold" : "text-white"
                      )}
                    >
                      {node.label}
                    </th>
                    <td className="py-3.5 pr-6 text-caption leading-snug text-slate-400">
                      {node.payload}
                    </td>
                    <td className="py-3.5 font-mono text-micro leading-snug text-slate-500">
                      {node.flowsTo.length > 0
                        ? node.flowsTo.map(nodeLabel).join(", ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mirrors the hover state as text, so the highlighted path is not
              conveyed by opacity alone. */}
          <p aria-live="polite" className="sr-only">
            {activeNode
              ? activeNode.flowsTo.length > 0
                ? `${activeNode.label} sends ${activeNode.payload} to ${activeNode.flowsTo.map(nodeLabel).join(", ")}.`
                : `${activeNode.label} is the terminal store: ${activeNode.payload}.`
              : ""}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
