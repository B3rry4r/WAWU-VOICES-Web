'use client';
/* eslint-disable @next/next/no-img-element -- avatars are user-supplied remote images */
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
  return (
    <span
      className={cx('vx-avatar', size !== 'm' && 'vx-avatar--' + size, !p.src && tone !== 'mint' && 'vx-avatar--' + tone, p.playing && 'is-playing', p.className)}
      role="img"
      aria-label={p.name || 'Avatar'}
    >
      {p.src ? <img src={p.src} alt="" /> : <span aria-hidden="true">{initials(p.name)}</span>}
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
