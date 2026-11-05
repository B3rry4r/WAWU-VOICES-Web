"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Puts content in the shell's right rail (the page cannot pass `rail` to the fenced AppShell). Desktop only: the rail is hidden below 1024 px. */
export function RailPortal({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<Element | null>(null);
  useEffect(() => { setEl(document.querySelector(".sh-rail")); }, []);
  return el ? createPortal(children, el) : null;
}
