import type * as React from "react";
/* Small pure helpers shared by the VOICES components. */

export function cx(...a: Array<string | false | null | undefined | 0>): string {
  return a.filter(Boolean).join(' ');
}

export function fmt(n: number | string): string {
  return typeof n === 'number' ? n.toLocaleString('en-NG') : n;
}

/** "1 voice", "0 voices", "12.5K voices": plural for every count except exactly 1. */
export function voicesText(n: number | undefined): string {
  return short(n) + (n === 1 ? ' voice' : ' voices');
}

/** "1 vote", "0 votes": a poll counts votes, not voices (RX5). */
export function votesCount(n: number | undefined): string {
  return short(n) + (n === 1 ? ' vote' : ' votes');
}

export function short(n: number | string | undefined): string {
  if (typeof n !== 'number') return n === undefined ? '' : n;
  if (n >= 1e6) return Math.round(n / 1e5) / 10 + 'M';
  if (n >= 1e4) return Math.round(n / 100) / 10 + 'K';
  return fmt(n);
}

export function clock(s: number): string {
  const t = Math.max(0, Math.round(s));
  return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
}

export function initials(name?: string): string {
  const parts = String(name || '')
    .replace(/^@/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

export type Tone = 'sun' | 'mint' | 'sky' | 'coral' | 'forest';

export function hashTone(s?: string): Tone {
  const t: Tone[] = ['sun', 'mint', 'sky', 'coral'];
  let x = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0;
  return t[x % t.length];
}

/* A speech-like waveform: deterministic for a seed. */
export function waveBars(seed: number, n: number): number[] {
  const out: number[] = [];
  let x = (seed || 7) * 9973;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const r = x / 2147483648;
    const env = 0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / n);
    const syll = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.9 + seed));
    out.push(Math.max(0.12, Math.min(1, env * syll * (0.55 + r * 0.6))));
  }
  return out;
}

const DOM_KEYS = ['id', 'title', 'href', 'target', 'rel', 'onClick', 'onKeyDown', 'onFocus', 'onBlur', 'tabIndex', 'role', 'style', 'name', 'value', 'form', 'type'];

/* The props a component hands straight to its DOM element: a short list plus aria-* and data-*. */
export function domProps(p: object): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(p)) {
    if (DOM_KEYS.indexOf(k) >= 0 || k.indexOf('aria-') === 0 || k.indexOf('data-') === 0) o[k] = (p as Record<string, unknown>)[k];
  }
  return o;
}

export interface Person {
  handle?: string;
  name?: string;
  avatar?: string;
  /** An account with the admin role: draws the "Admin" pill after the name. Read as `=== true`. */
  admin?: boolean;
}

export type NewsKind = 'verified' | 'unverified' | 'gossip';

/* Props any component may carry to reach its DOM node. */
export interface DomExtras {
  id?: string;
  title?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  [key: `data-${string}`]: string | undefined;
}
