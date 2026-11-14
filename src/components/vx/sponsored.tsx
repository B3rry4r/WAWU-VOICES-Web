'use client';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from './actions';
import { VoicePlayer } from './conversation';
import { cx, initials } from './helpers';
import { Icon } from './Icon';
import { Badge } from './labels';

export interface AdSlotProps {
  variant?: 'card' | 'audio' | 'banner';
  brand: string;
  headline: string;
  body?: string;
  /** The button label. false leaves the button out (an ad with no link). */
  cta?: string | false;
  href?: string;
  duration?: number;
  /** "Why this ad?" opens something. false leaves the link out (no screen for it yet); left out, it is drawn as before. */
  onWhy?: (() => void) | false;
  /** The button was tapped (to count the tap). */
  onOpen?: () => void;
  className?: string;
}

export function AdSlot(p: AdSlotProps): ReactElement {
  const v = p.variant || 'card';
  const brandMark = <span className="vx-ad__logo" aria-hidden="true">{initials(p.brand)}</span>;
  if (v === 'banner') {
    return (
      <aside className="vx-ad vx-ad--banner" aria-label={'Ad from ' + p.brand}>
        {brandMark}
        <div className="vx-ad__txt">
          <span className="vx-ad__brand"><Badge tone="ad" />{p.brand}</span>
          <p className="vx-ad__head">{p.headline}</p>
        </div>
        <Button variant="secondary" size="s" href={p.href || '#'} onClick={p.onOpen}>{p.cta || 'Open'}</Button>
      </aside>
    );
  }
  return (
    <aside className={cx('vx-ad', v === 'audio' && 'vx-ad--audio', p.className)} aria-label={'Ad from ' + p.brand}>
      <div className="vx-ad__top">
        <span className="vx-ad__brand">{brandMark}{p.brand}</span>
        <Badge tone="ad" />
      </div>
      <p className="vx-ad__head">{p.headline}</p>
      {p.body ? <p className="vx-ad__body">{p.body}</p> : null}
      {v === 'audio' ? <VoicePlayer duration={p.duration || 15} seed={21} tone="surface" /> : null}
      {p.cta === false && p.onWhy === false ? null : (
        <div className="vx-ad__top">
          {p.cta === false ? null : <Button variant="secondary" size="s" iconEnd="chevron-right" href={p.href || '#'} onClick={p.onOpen}>{p.cta || 'Learn more'}</Button>}
          {p.onWhy === false ? null : <button type="button" className="vx-ad__why" onClick={p.onWhy}>Why this ad?</button>}
        </div>
      )}
    </aside>
  );
}

export interface SponsoredSurveyProps {
  brand: string;
  question: string;
  options?: string[];
  voiceToo?: boolean;
  questions?: number;
  minutes?: number;
  className?: string;
  /** Controlled choice: with `onSelect`, `selected` is the truth. Left out, the card keeps its own. */
  selected?: number | null;
  onSelect?: (index: number) => void;
  /** The send button: its words, the tap, and whether it can be tapped yet. */
  sendLabel?: string;
  onSend?: () => void;
  sendDisabled?: boolean;
  sendBusy?: boolean;
  /** A card that only opens the survey: one button that goes to `href` (in place of the send and say-why buttons). */
  href?: string;
  cta?: string;
  onOpen?: () => void;
  /** Extra body under the question for a question with no choices (a text box, a recorder). */
  children?: ReactNode;
  /** Leaves the button row out (a recorder brings its own send). */
  hideActions?: boolean;
}

export function SponsoredSurvey(p: SponsoredSurveyProps): ReactElement {
  const [own, setOwn] = useState<number | null>(null);
  const controlled = p.onSelect !== undefined;
  const sel = controlled ? (p.selected ?? null) : own;
  const pick = (i: number) => (controlled ? p.onSelect?.(i) : setOwn(i));
  return (
    <section className={cx('vx-poll vx-poll--sponsored vx-survey', p.className)} aria-label={'Sponsored Survey from ' + p.brand}>
      <div className="vx-poll__head">
        <Badge tone="sponsored" icon="clipboard-list">Sponsored Survey</Badge>
        <span className="vx-ad__brand">{'by ' + p.brand}</span>
      </div>
      <h3 className="vx-poll__q">{p.question}</h3>
      {p.options ? (
        <div className="vx-poll__opts" role="radiogroup" aria-label={p.question}>
          {p.options.map((o, i) => {
            const on = sel === i;
            return (
              <button key={i} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="vx-opt" onClick={() => pick(i)}>
                <span className="vx-opt__radio">{on ? <Icon name="check" size={14} strokeWidth={3.5} /> : null}</span>
                {o}
              </button>
            );
          })}
        </div>
      ) : null}
      {p.children}
      {p.hideActions ? null : p.href ? (
        <div className="vx-poll__actions">
          <Button iconEnd="chevron-right" href={p.href} onClick={p.onOpen}>{p.cta || 'Start the survey'}</Button>
        </div>
      ) : (
        <div className="vx-poll__actions">
          <Button disabled={p.sendDisabled ?? (p.options ? sel === null : false)} loading={p.sendBusy} onClick={p.onSend}>{p.sendLabel || (p.options ? 'Send answer' : 'Answer by voice')}</Button>
          {p.voiceToo ? <Button variant="secondary" icon="mic">Say why</Button> : null}
        </div>
      )}
      <p className="vx-survey__privacy">
        <Icon name="lock" size={16} />
        {p.brand + ' sees totals only, never your name or number. ' + (p.questions ? p.questions + ' ' + (p.questions === 1 ? 'question' : 'questions') + ' · about ' + p.minutes + ' min' : '')}
      </p>
    </section>
  );
}
