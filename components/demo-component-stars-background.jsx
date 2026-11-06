"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { StarsBackground } from "@/components/animate-ui/backgrounds/stars";

export default function StarsBackgroundDemo() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const starColor = mounted && resolvedTheme === "dark" ? "#fff" : "#000";

  return (
    <StarsBackground
      starColor={starColor}
      className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,#f5f5f5_0%,#fff_100%)] dark:bg-[radial-gradient(ellipse_at_bottom,#262626_0%,#000_100%)]"
    />
  );
}