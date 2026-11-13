"use client";

import { StarsBackground } from "@/components/animate-ui/backgrounds/stars";

export default function StarsBackgroundDemo() {
  return (
    <StarsBackground
      starColor="var(--star-color)"
      pointerEvents={false}
      aria-hidden="true"
      className="hero-atmosphere pointer-events-none absolute inset-0 [&_[data-slot=star-layer]]:opacity-40 dark:[&_[data-slot=star-layer]]:opacity-70"
    />
  );
}
