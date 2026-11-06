'use client';
/* eslint-disable @next/next/no-img-element -- fixed brand images */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { ASSETS } from './assets';
import { cx, voicesText } from './helpers';
import type { NewsKind } from './helpers';
import { Icon } from './Icon';
import { NewsTag } from './labels';

export interface ShareCardProps {
  kind?: 'question' | 'voice' | 'poll' | 'weekly';
  topic: string;
  country?: string;
  question: string;
  args?: { text: string; voices: number }[];
  poll?: { label: string; pct: number }[];
  open?: boolean;
  quote?: string;
  tag?: NewsKind;
  summary?: string;
  voices: number;
  updated?: string;
  link?: string;
  scale?: number;
  className?: string;
}

export function ShareCard(p: ShareCardProps): ReactElement {
  const kind = p.kind || 'question';
  const wrap = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(p.scale || 1);
  useEffect(() => {
    if (p.scale) return undefined;
    function fit() {
      if (wrap.current) setS(Math.min(1, wrap.current.clientWidth / 1200));
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [p.scale]);
  const top = (
    <div className="vx-share__top">
      <img className="vx-share__logo" src={ASSETS.wordmark} alt="VOICES" />
      {p.tag ? <NewsTag kind={p.tag} /> : null}
      <span className="vx-share__topic">{(p.country || 'Nigeria') + ' · ' + p.topic}</span>
    </div>
  );
  let mid: ReactElement;
  if (kind === 'voice') {
    mid = (
      <>
        <p className="vx-share__q" style={{ fontSize: 36, lineHeight: '42px', color: 'var(--on-forest-2)' }}>{p.question}</p>
        <p className="vx-share__quote">{'“' + p.quote + '”'}</p>
      </>
    );
  } else if (kind === 'poll' || kind === 'weekly') {
    mid = (
      <>
        <p className="vx-share__q">{p.question}</p>
        <div className="vx-share__poll">
          {(p.poll || []).map((r, i) => (
            <div key={i}>
              <div className="vx-share__pollrow">
                <span>{r.label}</span>
                <span>{r.pct + '%' + (i === 0 && kind === 'poll' && p.open ? ' so far' : '')}</span>
              </div>
              <div className="vx-share__pollbar"><i style={{ width: r.pct + '%', background: i === 0 ? 'var(--sun)' : 'var(--on-forest-2)' }} /></div>
            </div>
          ))}
        </div>
      </>
    );
  } else {
    mid = (
      <>
        <p className="vx-share__q">{p.question}</p>
        <div className="vx-share__args">
          {(p.args || []).map((a, i) => (
            <div key={i} className="vx-share__arg">
              {a.text}
              <small>{voicesText(a.voices)}</small>
            </div>
          ))}
        </div>
      </>
    );
  }
  const cardStyle: CSSProperties = { transform: 'scale(' + s + ')' };
  return (
    <div className={cx('vx-sharewrap', p.className)} ref={wrap} style={{ height: 630 * s }}>
      <div className="vx-share" data-theme="light" role="img" aria-label={'Share card: ' + p.question} style={cardStyle}>
        <img className="vx-share__motif" src={ASSETS.markWhite} alt="" aria-hidden="true" />
        {top}
        {mid}
        <div className="vx-share__foot">
          <span className="vx-share__based">
            <b>{p.summary || 'People are split so far.'}</b>
            <br />
            {'Based on ' + voicesText(p.voices) + ' · updated ' + (p.updated || 'just now')}
            <br />
            {p.link || 'voices.wawuafrica.com'}
          </span>
          <span className="vx-share__cta">
            <Icon name="mic" size={32} strokeWidth={2.5} />
            Add your voice
          </span>
        </div>
      </div>
    </div>
  );
}
