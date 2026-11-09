"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Where a page puts content the shell owns the place for: the desktop right rail, and the phone header (replacing the logo bar). */
export interface ShellSlots {
  railEl: HTMLElement | null;
  barEl: HTMLElement | null;
  claimBar: () => () => void;
  /** A page that is a full-screen task only in some states (the mood Posted screen) asks for no tab bar while it is mounted. */
  hideTabs: () => () => void;
}

export const ShellSlotsContext = createContext<ShellSlots>({ railEl: null, barEl: null, claimBar: () => () => {}, hideTabs: () => () => {} });

/** Content for the desktop right rail ("This week"). Nothing renders on a phone, and an empty rail stays empty. */
export function Rail({ children }: { children: ReactNode }) {
  const { railEl } = useContext(ShellSlotsContext);
  return railEl ? createPortal(children, railEl) : null;
}

/** A page's own phone header (back arrow, title). While it is mounted the logo bar steps aside. Phone only. */
export function PhoneBar({ children }: { children: ReactNode }) {
  const { barEl, claimBar } = useContext(ShellSlotsContext);
  useEffect(() => claimBar(), [claimBar]);
  return barEl ? createPortal(children, barEl) : null;
}

/** While this is mounted the tab bar is hidden (phone). */
export function useHideTabBar(): void {
  const { hideTabs } = useContext(ShellSlotsContext);
  useEffect(() => hideTabs(), [hideTabs]);
}
