"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Wraps a line that must be seen where the person is looking: when it appears it is scrolled into view (a phone's first screen). */
export function InView({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", behavior: "auto" });
  }, []);
  return <div ref={ref} className="scroll-my-4">{children}</div>;
}
