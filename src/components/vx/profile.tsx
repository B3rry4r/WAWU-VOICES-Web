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
  /** 'plain' never swaps to the low or empty look, whatever the figure is. */
  state?: 'low' | 'empty' | 'plain';
  /** A link (to the wallet) instead of a button. false draws it as plain text, for a screen that has nowhere to go yet. */
  href?: string | false;
  onClick?: () => void;
  className?: string;
}

export function UnitsChip(p: UnitsChipProps): ReactElement {
  const u = parseFloat(p.units);
  const state = p.state === 'plain' ? '' : p.state || (u === 0 ? 'empty' : u < 2 ? 'low' : '');
  const cls = cx('vx-units', state && 'vx-units--' + state, p.href === false && 'vx-units--static', p.className);
  const label = state === 'empty' ? 'No tokens. Get tokens' : p.units + (p.href === false ? ' tokens' : ' tokens. Open your tokens');
  const body = (
    <>
      <span className="vx-units__coin" aria-hidden="true"><Icon name="coins" size={18} strokeWidth={2.25} /></span>
      {state === 'empty' ? (
        'Get tokens'
      ) : (
        <>
          {p.units + ' units'}
          {state === 'low' ? <small>Low</small> : p.freeLeft !== undefined && p.freeLeft > 0 ? <small>{'· ' + p.freeLeft + ' free'}</small> : null}
        </>
      )}
    </>
  );
  if (p.href === false) return <span className={cls} aria-label={label}>{body}</span>;
  if (p.href) return <a className={cls} href={p.href} aria-label={label} onClick={p.onClick}>{body}</a>;
  return <button type="button" className={cls} onClick={p.onClick} aria-label={label}>{body}</button>;
}

export interface ProfileHeaderProps {
  name: string;
  handle: string;
  avatar?: string;
  place?: string;
  joined?: string;
  /** Seconds of the Voice Card. false leaves the card out (the person has none). */
  voiceCard?: number | false;
  /** With `playing`, the parent owns playback: the card only asks (onPlay, onPause). */
  playing?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  /** The clip's real waveform (the API's peak values, 0 to 255). With it the Voice Card bars follow the clip; without it they are the usual drawn bars. */
  voiceCardPeaks?: number[];
  /** A line under the Voice Card (a play error). */
  voiceNote?: ReactNode;
  stats?: { label: string; value: number }[];
  units?: string;
  freeLeft?: number;
  /** Where the units chip goes. false draws it as plain text. */
  unitsHref?: string | false;
  /** Passed to the units chip ('plain' keeps "0 units" as plain figures). */
  unitsState?: UnitsChipProps['state'];
  referral?: string;
  /** Tapping the copy button. `copied` swaps its icon and label to a tick and "Copied". */
  onCopyReferral?: () => void;
  copied?: boolean;
  own?: boolean;
  /** Edit profile goes here (a link) or runs this. */
  editHref?: string;
  onEdit?: () => void;
  className?: string;
}

export function ProfileHeader(p: ProfileHeaderProps): ReactElement {
  const [innerPlaying, setPlaying] = useState(false);
  const playing = p.playing !== undefined ? p.playing : innerPlaying;
  const bars = p.voiceCardPeaks && p.voiceCardPeaks.length
    ? Array.from({ length: 18 }, (_, i) => {
        const peaks = p.voiceCardPeaks as number[];
        const from = Math.floor((i * peaks.length) / 18);
        const to = Math.max(from + 1, Math.floor(((i + 1) * peaks.length) / 18));
        const part = peaks.slice(from, to);
        return Math.max(0.12, Math.min(1, Math.max(...part) / 255));
      })
    : waveBars(9, 18);
  const row = p.units !== undefined || !!p.referral || !!p.own;
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
        {p.voiceCard === false ? null : (
        <button
          type="button"
          className={cx('vx-vcard', playing && 'is-playing')}
          aria-pressed={playing ? 'true' : 'false'}
          onClick={() => {
            setPlaying(!playing);
            if (!playing && p.onPlay) p.onPlay();
            if (playing && p.onPause) p.onPause();
          }}
        >
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
        )}
        {p.voiceNote}
        <div className="vx-prof__stats">
          {(p.stats || []).map((s) => (
            <div key={s.label} className="vx-stat">
              <b>{short(s.value)}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        {row ? (
          <div className="vx-prof__row">
            {p.units !== undefined ? <UnitsChip units={p.units} freeLeft={p.freeLeft} href={p.unitsHref} state={p.unitsState} /> : null}
            {p.referral ? (
              <span className="vx-refcode">
                {p.referral}
                <IconButton icon={p.copied ? 'check' : 'copy'} label={p.copied ? 'Copied' : 'Copy referral code'} variant="ghost" size="s" onClick={p.onCopyReferral} />
              </span>
            ) : null}
            {p.own ? <Button variant="secondary" size="s" icon="settings" href={p.editHref} onClick={p.onEdit}>Edit profile</Button> : null}
          </div>
        ) : null}
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
