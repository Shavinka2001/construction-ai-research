"use client";

import { useEffect, useRef, useState } from "react";

import { HERO_STATS } from "@/components/landing/data/stats";
import type { HeroStat } from "@/components/landing/types";

const COUNT_DURATION_MS = 1100;

/** Eases out so the number decelerates into its final value. */
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
  // takes over once we know the client is live. Without JavaScript the strip
  // therefore reads 99.2% rather than 0%.
  const value = mounted ? counted : stat.value;

  return (
    <div className="flex flex-col gap-1.5 border-b border-r border-white/10 px-1 py-4 sm:px-4">
      <dd className="font-display text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
        {stat.prefix}
        {value.toFixed(decimals)}
        <span className="text-gold">{stat.suffix}</span>
      </dd>
      <dt
        title={stat.provenance}
        className="text-[0.6875rem] font-semibold uppercase leading-tight tracking-[0.12em] text-slate-400 sm:text-xs"
      >
        {stat.label}
      </dt>
    </div>
  );
}

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
    <div
      ref={ref}
      className="lp-glass overflow-hidden rounded-2xl shadow-inset-hairline"
    >
      {/* Each cell carries a right and bottom hairline; the negative margins
          pull the outermost ones past the clipped edge, so the same markup
          yields 2x2 on phones and 1x4 from `sm` up with no trailing rules. */}
      <dl className="-mb-px -mr-px grid grid-cols-2 text-center sm:grid-cols-4">
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
