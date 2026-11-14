'use client';
/* eslint-disable @next/next/no-img-element -- avatars are user-supplied remote images */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { cx, hashTone, initials } from './helpers';
import type { Tone } from './helpers';

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: 's' | 'm' | 'l' | 'xl';
  tone?: Tone;
  playing?: boolean;
  className?: string;
}

export function Avatar(p: AvatarProps): ReactElement {
  const size = p.size || 'm';
  const tone = p.tone || hashTone(p.name);
  // A picture that fails to load (or is slow, then fails) gives way to the initials; the circle has a fixed size, so nothing moves.
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => setFailed(null), [p.src]);
  const src = p.src && failed !== p.src ? p.src : undefined;
  return (
    <span
      className={cx('vx-avatar', size !== 'm' && 'vx-avatar--' + size, !src && tone !== 'mint' && 'vx-avatar--' + tone, p.playing && 'is-playing', p.className)}
      role="img"
      aria-label={p.name || 'Avatar'}
    >
      {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} /> : <span aria-hidden="true">{initials(p.name)}</span>}
    </span>
  );
}

export function AvatarStack(p: { names?: string[] }): ReactElement {
  return (
    <span className="vx-avstack" aria-hidden="true">
      {(p.names || []).slice(0, 3).map((n, i) => (
        <Avatar key={i} name={n} size="s" />
      ))}
    </span>
  );
}
