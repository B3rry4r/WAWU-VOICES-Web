'use client';
/* eslint-disable @next/next/no-img-element -- fixed brand images with a known height */
import type { ReactElement } from 'react';
import { ASSETS } from './assets';
import { cx } from './helpers';

export interface LogoProps {
  variant?: 'wordmark' | 'mark';
  tone?: 'green' | 'white';
  height?: number;
  alt?: string;
  src?: string;
  className?: string;
}

export function Logo(p: LogoProps): ReactElement {
  const variant = p.variant || 'wordmark';
  const tone = p.tone || 'green';
  const src = variant === 'mark' ? (tone === 'white' ? ASSETS.markWhite : ASSETS.mark) : tone === 'white' ? ASSETS.wordmarkWhite : ASSETS.wordmark;
  return (
    <img
      src={p.src || src}
      alt={p.alt === undefined ? 'VOICES' : p.alt}
      className={cx('vx-logo', p.className)}
      style={{ height: p.height || 32, width: 'auto', display: 'block' }}
    />
  );
}
