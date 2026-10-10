"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import {
  Container,
  Section,
  SectionHeading,
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

/** Nodes grouped into their layer column, preserving declaration order. */
const NODES_BY_LAYER = LAYER_ORDER.map((layer) => ({
  layer,
  nodes: STACK_NODES.filter((node) => node.layer === layer),
}));

function NodeCard({
  node,
  isActive,
  isDimmed,
  onActivate,
  onClear,
}: {
  node: StackNode;
  isActive: boolean;
  isDimmed: boolean;
  onActivate: () => void;
  onClear: () => void;
}) {
  const Icon = node.icon;

  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onMouseLeave={onClear}
      onFocus={onActivate}
      onBlur={onClear}
      onClick={onActivate}
      aria-pressed={isActive}
      className={cn(
        "lp-focus group w-full rounded-xl border p-3.5 text-left transition-all duration-300 ring-offset-ink",
        isActive
          ? "border-gold/50 bg-gold/[0.08] shadow-glow-gold"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
        isDimmed && "opacity-40"
      )}
    >
      <span className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
            isActive
              ? "border-gold/40 bg-gold/15 text-gold"
              : "border-white/10 bg-white/5 text-slate-400"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-bold tracking-tight text-white">
            {node.label}
          </span>
          <span className="mt-0.5 block text-[0.6875rem] leading-tight text-slate-400">
            {node.role}
          </span>
        </span>
      </span>

      {/* Outgoing payload, revealed when this node is the focus. */}
      <span
        className={cn(
          "mt-2.5 block overflow-hidden text-[0.625rem] font-semibold uppercase tracking-[0.1em] transition-all duration-300",
          isActive ? "max-h-10 text-gold" : "max-h-0 text-transparent"
        )}
      >
        {node.flowsTo.length > 0 ? `→ ${node.payload}` : "Durable store"}
      </span>
    </button>
  );
}

export function ArchitectureFlow() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeNode = STACK_NODES.find((node) => node.id === activeId) ?? null;

  /**
   * A node stays lit when it is the focus, when the focus sends data to it, or
   * when it sends data to the focus — so hovering any box lights its real
   * request path rather than an arbitrary neighbour.
   */
  const isOnActivePath = (node: StackNode): boolean => {
    if (!activeNode) return true;
    if (node.id === activeNode.id) return true;
    if (activeNode.flowsTo.includes(node.id)) return true;
    return node.flowsTo.includes(activeNode.id);
  };

  return (
    <Section id="architecture" tone="ink">
      <div
        aria-hidden
        className="lp-grid-blueprint lp-grid-mask absolute inset-0"
      />

      <Container className="relative">
        <SectionHeading
          id="architecture"
          tone="ink"
          eyebrow="Technical architecture"
          title={
            <>
              One request path, from browser to{" "}
              <span className="lp-text-gold-gradient">model and back</span>.
            </>
          }
          description="Hover or focus any service to trace what it sends and where. The arrangement below is the deployed topology, not a reference diagram."
        />

        <Reveal className="mt-12 sm:mt-14">
          <div className="grid gap-4 lg:grid-cols-4 lg:gap-5">
            {NODES_BY_LAYER.map(({ layer, nodes }, columnIndex) => (
              <div key={layer} className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-display text-[0.625rem] font-bold tabular-nums text-gold">
                    {String(columnIndex + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-[0.625rem] font-bold uppercase tracking-[0.16em] text-slate-400">
                    {LAYER_LABELS[layer]}
                  </h3>
                </div>

                <ul className="space-y-3">
                  {nodes.map((node) => (
                    <li key={node.id}>
                      <NodeCard
                        node={node}
                        isActive={activeId === node.id}
                        isDimmed={!isOnActivePath(node)}
                        onActivate={() => setActiveId(node.id)}
                        onClear={() => setActiveId(null)}
                      />
                    </li>
                  ))}
                </ul>

                {/* Connector between layer columns. Horizontal on desktop,
                    hidden on narrow screens where the columns stack. */}
                {columnIndex < NODES_BY_LAYER.length - 1 ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-5 bg-gradient-to-r from-gold/50 to-transparent lg:block"
                  />
                ) : null}
              </div>
            ))}
          </div>

          {/* Live caption so the hover state is also announced as text. */}
          <p
            aria-live="polite"
            className="mt-6 min-h-[1.5rem] text-center text-[0.8125rem] text-slate-400"
          >
            {activeNode ? (
              <>
                <span className="font-semibold text-white">
                  {activeNode.label}
                </span>
                {activeNode.flowsTo.length > 0 ? (
                  <>
                    {" sends "}
                    <span className="text-gold">{activeNode.payload}</span>
                    {" to "}
                    {activeNode.flowsTo
                      .map(
                        (id) =>
                          STACK_NODES.find((node) => node.id === id)?.label ?? id
                      )
                      .join(", ")}
                    .
                  </>
                ) : (
                  <> is the terminal store: {activeNode.payload}.</>
                )}
              </>
            ) : (
              "Select a service to trace its data flow."
            )}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
