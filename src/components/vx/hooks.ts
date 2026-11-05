'use client';
import { useEffect, useRef } from 'react';

/* Calls cb every stepMs while active. The latest cb is always used. */
export function useTicker(active: boolean, stepMs: number, cb: () => void): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => ref.current(), stepMs);
    return () => clearInterval(id);
  }, [active, stepMs]);
}
