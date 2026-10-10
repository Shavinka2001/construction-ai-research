"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  /** Stagger in ms, applied as an animation delay once visible. */
  delay?: number;
  className?: string;
  /** Render as a different element when the parent needs a specific tag. */
  as?: "div" | "li" | "section" | "article";
};

/**
 * Fades content up the first time it scrolls into view.
 *
 * Starts visible when IntersectionObserver is unavailable or the user prefers
 * reduced motion, so content is never trapped behind an animation that will not
 * run. The decorative transition itself is neutralised by the
 * `prefers-reduced-motion` block in globals.css.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      // Hidden-until-revealed is applied by CSS, and only under
      // `html[data-landing="true"]` — an attribute that exists only once
      // LandingScrollScope has run. Without JavaScript the attribute is never
      // set, so every section renders visible instead of being stranded at
      // opacity 0.
      data-reveal={isVisible ? "shown" : "pending"}
      style={isVisible && delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cn(isVisible && "animate-fade-up", className)}
    >
      {children}
    </Tag>
  );
}
