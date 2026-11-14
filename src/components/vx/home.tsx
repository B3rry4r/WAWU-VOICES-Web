'use client';
/* eslint-disable @next/next/no-img-element -- fixed brand images */
import type { ReactElement } from 'react';
import { ASSETS } from './assets';
import { Button } from './actions';
import { AvatarStack } from './identity';
import { cx, voicesText, waveBars } from './helpers';
import type { NewsKind, Tone } from './helpers';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { NewsTag } from './labels';

export interface QuestionHeroProps {
  question: string;
  eyebrow?: string;
  voices?: number;
  closesIn?: string;
  avatars?: string[];
  speakLabel?: string;
  /** The big button's icon. Default the microphone. */
  speakIcon?: IconName;
  /** V-PRELAUNCH: set while the question has not opened ("Opens Sunday 15 November"). The card says "Coming up", shows this in place of the counts and has no buttons. */
  opensLabel?: string;
  /** The one thing a coming-up card can do: share the question. */
  onShare?: () => void;
  /** True once the viewer has answered: the card says so and the quick Listen button (now the big one) is not repeated. */
  answered?: boolean;
  onSpeak?: () => void;
  onListen?: () => void;
  onDiscuss?: () => void;
  onVote?: () => void;
  className?: string;
}

export function QuestionHero(p: QuestionHeroProps): ReactElement {
  return (
    <section className={cx('vx-hero', p.className)} aria-labelledby="vx-hero-q">
      <div className="vx-hero__card">
        <img className="vx-hero__motif" src={ASSETS.markWhite} alt="" aria-hidden="true" />
        <span className="vx-hero__sticker">{p.opensLabel ? "Coming up" : p.eyebrow || "Today’s question"}</span>
        <h2 className="vx-hero__q" id="vx-hero-q">{p.question}</h2>
        {p.opensLabel ? (
          <div className="vx-hero__meta"><span>{p.opensLabel}</span>{p.onShare ? <Button size="s" icon="share-2" onClick={p.onShare}>Share</Button> : null}</div>
        ) : (
        <div className="vx-hero__meta">
          {p.avatars ? <AvatarStack names={p.avatars} /> : null}
          <span className="vx-num">{voicesText(p.voices) + ' so far'}</span>
          {p.answered ? (
            <>
              <span className="vx-dot" aria-hidden="true" />
              <span>You have answered</span>
            </>
          ) : null}
          {p.closesIn ? (
            <>
              <span className="vx-dot" aria-hidden="true" />
              <span>{'Closes in ' + p.closesIn}</span>
            </>
          ) : null}
        </div>
        )}
        {p.opensLabel ? null : (
        <div className="vx-hero__cta">
          <Button variant="dark" size="l" icon={p.speakIcon || 'mic'} className="vx-hero__speak" onClick={p.onSpeak}>{p.speakLabel || 'Speak'}</Button>
          <div className="vx-hero__quick">
            {p.answered ? null : <Button size="s" icon="headphones" onClick={p.onListen}>Listen</Button>}
            <Button size="s" icon="message-square" onClick={p.onDiscuss}>Discuss</Button>
            <Button size="s" icon="vote" onClick={p.onVote}>Vote</Button>
          </div>
        </div>
        )}
      </div>
    </section>
  );
}

export interface TopicOfWeekProps {
  title: string;
  meta?: string;
  /** The week has not begun: the rail card has no "Join the conversation" button. */
  upcoming?: boolean;
  eyebrow?: string;
  icon?: IconName;
  variant?: 'banner' | 'rail';
  href?: string;
  onClick?: () => void;
}

export function TopicOfWeek(p: TopicOfWeekProps): ReactElement {
  if (p.variant === 'rail') {
    return (
      <section className="vx-totw vx-totw--rail" aria-label="Topic of the week">
        <span className="vx-eyebrow vx-totw__eye">Topic of the week</span>
        <span className="vx-totw__title">{p.title}</span>
        {p.meta ? <span className="vx-totw__meta">{p.meta}</span> : null}
        {p.upcoming ? null : <Button block onClick={p.onClick}>Join the conversation</Button>}
      </section>
    );
  }
  const inner = (
    <>
      <span className="vx-totw__ic"><Icon name={p.icon || 'globe'} size={24} /></span>
      <span className="vx-totw__txt">
        <span className="vx-eyebrow vx-totw__eye">{p.eyebrow || 'Topic of the week'}</span>
        <span className="vx-totw__title">{p.title}</span>
        {p.meta ? <span className="vx-totw__meta">{p.meta}</span> : null}
      </span>
      <Icon name="chevron-right" size={22} className="vx-totw__chev" />
    </>
  );
  return p.href ? (
    <a className="vx-totw" href={p.href} onClick={p.onClick}>{inner}</a>
  ) : (
    <button className="vx-totw" type="button" onClick={p.onClick}>{inner}</button>
  );
}

export interface TopicTileProps {
  question: string;
  category?: string;
  voices?: number;
  tone?: Tone;
  tag?: NewsKind;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function TopicTile(p: TopicTileProps): ReactElement {
  const bars = waveBars(String(p.question || '').length, 7);
  const cls = cx('vx-tile', 'vx-tile--' + (p.tone || 'mint'), p.className);
  const inner = (
    <>
      {p.category ? <span className="vx-eyebrow vx-tile__cat">{p.category}</span> : null}
      <span className="vx-tile__q">{p.question}</span>
      {p.tag ? <NewsTag kind={p.tag} /> : null}
      <span className="vx-tile__foot">
        <span className="vx-tile__wave" aria-hidden="true">
          {bars.map((b, i) => (
            <i key={i} style={{ height: Math.round(4 + b * 10) }} />
          ))}
        </span>
        {voicesText(p.voices)}
      </span>
    </>
  );
  return p.href ? (
    <a className={cls} href={p.href} onClick={p.onClick}>{inner}</a>
  ) : (
    <button className={cls} type="button" onClick={p.onClick}>{inner}</button>
  );
}

export interface TrendingListProps {
  items: { question: string; voices: number; category?: string; href?: string }[];
  title?: string;
  className?: string;
}

export function TrendingList(p: TrendingListProps): ReactElement {
  return (
    <section className={cx('vx-card vx-trend', p.className)} aria-labelledby="vx-trend-h">
      <h3 className="vx-eyebrow vx-trend__head" id="vx-trend-h">
        <Icon name="trending-up" size={16} strokeWidth={2.5} />
        {p.title || 'Trending'}
      </h3>
      <ol>
        {(p.items || []).map((it, i) => (
          <li key={i}>
            <a className="vx-trend__row vx-focus" href={it.href || '#'}>
              <span className="vx-trend__n" aria-hidden="true">{i + 1}</span>
              <span>
                <p className="vx-trend__q">{it.question}</p>
                <span className="vx-trend__meta">{voicesText(it.voices) + (it.category ? ' · ' + it.category : '')}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
