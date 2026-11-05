'use client';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button, IconButton } from './actions';
import { Avatar } from './identity';
import { clock, cx, short, waveBars } from './helpers';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface UnitsChipProps {
  units: string;
  freeLeft?: number;
  state?: 'low' | 'empty';
  onClick?: () => void;
  className?: string;
}

export function UnitsChip(p: UnitsChipProps): ReactElement {
  const u = parseFloat(p.units);
  const state = p.state || (u === 0 ? 'empty' : u < 2 ? 'low' : '');
  return (
    <button type="button" className={cx('vx-units', state && 'vx-units--' + state, p.className)} onClick={p.onClick} aria-label={state === 'empty' ? 'No Voice Units. Get units' : p.units + ' Voice Units. Open wallet'}>
      <span className="vx-units__coin" aria-hidden="true"><Icon name="coins" size={18} strokeWidth={2.25} /></span>
      {state === 'empty' ? (
        'Get Voice Units'
      ) : (
        <>
          {p.units + ' units'}
          {state === 'low' ? <small>Low</small> : p.freeLeft !== undefined && p.freeLeft > 0 ? <small>{'· ' + p.freeLeft + ' free'}</small> : null}
        </>
      )}
    </button>
  );
}

export interface ProfileHeaderProps {
  name: string;
  handle: string;
  avatar?: string;
  place?: string;
  joined?: string;
  voiceCard?: number;
  stats?: { label: string; value: number }[];
  units?: string;
  freeLeft?: number;
  referral?: string;
  own?: boolean;
  className?: string;
}

export function ProfileHeader(p: ProfileHeaderProps): ReactElement {
  const [playing, setPlaying] = useState(false);
  const bars = waveBars(9, 18);
  return (
    <section className={cx('vx-prof', p.className)} aria-label="Profile">
      <div className="vx-prof__in">
        <div className="vx-prof__top">
          <Avatar name={p.name} src={p.avatar} size="l" playing={playing} />
          <div className="vx-prof__id">
            <h2 className="vx-prof__handle">{p.handle}</h2>
            <span className="vx-prof__meta">{[p.place, p.joined].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
        <button type="button" className={cx('vx-vcard', playing && 'is-playing')} aria-pressed={playing ? 'true' : 'false'} onClick={() => setPlaying(!playing)}>
          <span className="vx-vcard__play"><Icon name={playing ? 'pause' : 'play'} size={22} fill strokeWidth={1.5} /></span>
          <span className="vx-vcard__txt">
            <b>{playing ? 'Playing Voice Card' : 'Play Voice Card'}</b>
            <span>{'Voice bio · ' + clock(p.voiceCard || 8)}</span>
          </span>
          <span className="vx-vcard__wave" aria-hidden="true">
            {bars.map((b, i) => (
              <i key={i} style={{ height: Math.round(6 + b * 22), animationDelay: i * 60 + 'ms' }} />
            ))}
          </span>
        </button>
        <div className="vx-prof__stats">
          {(p.stats || []).map((s) => (
            <div key={s.label} className="vx-stat">
              <b>{short(s.value)}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="vx-prof__row">
          {p.units !== undefined ? <UnitsChip units={p.units} freeLeft={p.freeLeft} /> : null}
          {p.referral ? (
            <span className="vx-refcode">
              {p.referral}
              <IconButton icon="copy" label="Copy referral code" variant="ghost" size="s" />
            </span>
          ) : null}
          {p.own ? <Button variant="secondary" size="s" icon="settings">Edit profile</Button> : null}
        </div>
      </div>
    </section>
  );
}

export interface NotificationRowProps {
  type?: 'reply' | 'reaction' | 'poll' | 'daily' | 'tag' | 'units' | 'verified';
  actor?: string;
  emoji?: string;
  children?: ReactNode;
  time: string;
  unread?: boolean;
  href?: string;
  className?: string;
}

const NOTE_IC: Record<NonNullable<NotificationRowProps['type']>, IconName> = {
  reply: 'message-circle', reaction: 'smile-plus', poll: 'chart-column', daily: 'mic', tag: 'shield-alert', units: 'coins', verified: 'badge-check',
};

export function NotificationRow(p: NotificationRowProps): ReactElement {
  const type = p.type || 'reply';
  return (
    <a className={cx('vx-note vx-focus', p.unread && 'is-unread', p.className)} href={p.href || '#'}>
      {p.actor ? (
        <span style={{ position: 'relative', display: 'block', flex: 'none', height: 40 }}>
          <Avatar name={p.actor} />
          {p.emoji ? (
            <span className="vx-note__emoji" style={{ position: 'absolute', right: -4, bottom: -4, fontSize: 16 }} aria-hidden="true">{p.emoji}</span>
          ) : null}
        </span>
      ) : (
        <span className={cx('vx-note__ic', 'vx-note__ic--' + type)}><Icon name={NOTE_IC[type] || 'bell'} size={20} /></span>
      )}
      <span className="vx-note__txt">
        {p.children}
        <span className="vx-note__time">{p.time + (p.unread ? ' · New' : '')}</span>
      </span>
    </a>
  );
}
