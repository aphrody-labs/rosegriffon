"use client";

import { useEffect, useRef } from "react";

type AnimationDirection = "up" | "left" | "right" | "scale";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: AnimationDirection;
  /** Stagger delay (in seconds) between direct children */
  stagger?: number;
}

const directionClass: Record<AnimationDirection, string> = {
  up: "scroll-reveal-up",
  left: "scroll-reveal-left",
  right: "scroll-reveal-right",
  scale: "scroll-reveal-scale",
};

export function AnimatedSection({
  children,
  className,
  delay = 0,
  direction = "up",
  stagger,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.classList.add("scroll-reveal-visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}s`;
          el.classList.add("scroll-reveal-visible");

          // Stagger direct children if requested
          if (stagger) {
            const children = el.querySelectorAll(":scope > .scroll-stagger-child");
            children.forEach((child, i) => {
              (child as HTMLElement).style.transitionDelay = `${delay + i * stagger}s`;
              child.classList.add("scroll-reveal-visible");
            });
          }

          observer.unobserve(el);
        }
      },
      { rootMargin: "-60px", threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, stagger]);

  return (
    <div ref={ref} className={`${directionClass[direction]} ${className || ""}`}>
      {children}
    </div>
  );
}
