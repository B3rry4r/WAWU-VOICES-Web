'use client';
import type { ReactElement, ReactNode } from 'react';
import { cx } from './helpers';
import type { NewsKind } from './helpers';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface BadgeProps {
  tone?: 'neutral' | 'green' | 'sun' | 'forest' | 'ad' | 'sponsored' | 'proposed' | 'promoted' | 'live' | 'rank' | 'you' | 'leading' | 'count';
  icon?: IconName;
  children?: ReactNode;
  className?: string;
}

const BADGE_LABELS: Partial<Record<NonNullable<BadgeProps['tone']>, string>> = {
  ad: 'Ad', sponsored: 'Sponsored', proposed: 'Proposed', promoted: 'Promoted', live: 'Live', you: 'Your vote', leading: 'Leading',
};

export function Badge(p: BadgeProps): ReactElement {
  const tone = p.tone || 'neutral';
  const label = p.children || BADGE_LABELS[tone];
  const cls = tone === 'leading' ? 'sun' : tone;
  return (
    <span className={cx('vx-badge', 'vx-badge--' + cls, p.className)}>
      {p.icon ? <Icon name={p.icon} size={14} strokeWidth={2.5} /> : null}
      {label}
    </span>
  );
}

const NEWS: Record<NewsKind, { label: string; icon: IconName; note: string }> = {
  verified: { label: 'Verified News', icon: 'shield-check', note: "Confirmed by WAWU's editors against a named source. The source is linked." },
  unverified: { label: 'Unverified News', icon: 'shield-alert', note: 'A news claim WAWU has not confirmed. Treat it with care.' },
  gossip: { label: 'Gossip', icon: 'messages-square', note: 'Talk, rumour or opinion. Not presented as fact.' },
};

export interface NewsTagProps {
  kind: NewsKind;
  size?: 's' | 'm';
  withNote?: boolean;
  source?: { name: string; href?: string };
  className?: string;
}

export function NewsTag(p: NewsTagProps): ReactElement {
  const k: NewsKind = NEWS[p.kind] ? p.kind : 'unverified';
  const t = NEWS[k];
  const tag = (
    <span className={cx('vx-tag', 'vx-tag--' + k, p.size === 'm' && 'vx-tag--m', p.className)} title={t.note}>
      <Icon name={t.icon} size={p.size === 'm' ? 16 : 14} strokeWidth={2.5} />
      {t.label}
    </span>
  );
  if (!p.withNote) return tag;
  return (
    <div className="vx-tagnote">
      {tag}
      <p>
        {t.note}
        {k === 'verified' && p.source ? (
          <>
            {' '}
            <a className="vx-link" href={p.source.href || '#'} style={{ minHeight: 0, display: 'inline' }}>
              {'Source: ' + p.source.name}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
NewsTag.notes = NEWS;

export interface VerifyMarkProps {
  status: 'verified' | 'unverified';
  pill?: boolean;
  detail?: string;
  className?: string;
}

export function VerifyMark(p: VerifyMarkProps): ReactElement {
  const ok = p.status === 'verified';
  return (
    <span className={cx('vx-mark', ok ? 'vx-mark--verified' : 'vx-mark--unverified', p.pill && 'vx-mark--pill', p.className)}>
      <Icon name={ok ? 'badge-check' : 'circle-dashed'} size={16} strokeWidth={2.5} />
      {ok ? 'Verified' : 'Not verified'}
      {p.detail ? <span className="vx-mark__detail">{'· ' + p.detail}</span> : null}
    </span>
  );
}
