"use client";

import { useEffect, useRef, useState } from "react";

import { HERO_STATS } from "@/components/landing/data/stats";
import type { HeroStat } from "@/components/landing/types";

const COUNT_DURATION_MS = 900;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || target === 0) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / COUNT_DURATION_MS, 1);
      setValue(target * easeOutCubic(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);

  return value;
}

function StatItem({
  stat,
  active,
  mounted,
}: {
  stat: HeroStat;
  active: boolean;
  mounted: boolean;
}) {
  const counted = useCountUp(stat.value, active);
  const decimals = stat.decimals ?? 0;

  // Server-render and first paint show the real figure; the count-up only
  // takes over once the client is live, so without JavaScript the strip reads
  // 99.2 rather than 0.
  const value = mounted ? counted : stat.value;

  return (
    <div>
      <dd className="font-mono text-[1.125rem] font-medium tabular-nums leading-none tracking-tight text-white">
        {stat.prefix}
        {value.toFixed(decimals)}
        <span className="text-gold">{stat.suffix}</span>
      </dd>
      <dt
        title={stat.provenance}
        className="mt-2 cursor-help text-[0.75rem] leading-snug text-slate-500"
      >
        {stat.label}
      </dt>
    </div>
  );
}

/**
 * Headline figures.
 *
 * Set as four columns under a single hairline rather than inside a bordered
 * panel — the rule and the mono figures do the work, so the hero keeps one
 * visual idea instead of two.
 */
export function StatsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const node = ref.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="border-t border-white/10 pt-8">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:gap-x-10">
        {HERO_STATS.map((stat) => (
          <StatItem
            key={stat.label}
            stat={stat}
            active={active}
            mounted={mounted}
          />
        ))}
      </dl>
    </div>
  );
}
