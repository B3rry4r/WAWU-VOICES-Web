'use client';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Button, IconButton } from './actions';
import { Avatar } from './identity';
import { cx, fmt, short } from './helpers';
import type { Person } from './helpers';
import { Icon } from './Icon';
import { Badge, VerifyMark } from './labels';
import { Tabs } from './navigation';
import { EmptyState } from './feedback';

export interface PollOption {
  id: string;
  label: string;
  votes?: number;
}

export type PollState = 'vote' | 'confirm' | 'results';

export interface PollProps {
  question: string;
  options: PollOption[];
  total?: number;
  closesIn?: string;
  state?: PollState;
  selected?: string;
  cost?: string;
  costNote?: string;
  sponsor?: string;
  live?: boolean;
  onExplain?: (() => void) | false;
  className?: string;
}

export function Poll(p: PollProps): ReactElement {
  const opts = p.options || [];
  const total = p.total || opts.reduce((s, o) => s + (o.votes || 0), 0);
  const [state, setState] = useState<PollState>(p.state || 'vote');
  const [chosen, setChosen] = useState<string | null>(p.selected || null);
  const [grow, setGrow] = useState(p.state === 'results' ? false : true);
  useEffect(() => {
    if (state === 'results') {
      const id = setTimeout(() => setGrow(true), 40);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state]);
  const lead = opts.reduce<PollOption>((m, o) => ((o.votes || 0) > (m.votes || 0) ? o : m), opts[0] || { id: '', label: '' });
  const chosenOpt = opts.filter((o) => o.id === chosen)[0];
  const head = (
    <div className="vx-poll__head">
      {p.sponsor ? <Badge tone="sponsored">Sponsored poll</Badge> : <Badge tone="green" icon="vote">Open poll</Badge>}
      {state === 'results' && p.live !== false ? <Badge tone="live" /> : null}
      {p.closesIn ? (
        <span className="vx-poll__time">
          <Icon name="clock" size={16} />
          {'Closes in ' + p.closesIn}
        </span>
      ) : null}
    </div>
  );
  let body: ReactElement;
  if (state === 'vote') {
    body = (
      <>
        <div className="vx-poll__opts" role="radiogroup" aria-label={p.question}>
          {opts.map((o) => {
            const on = o.id === chosen;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="vx-opt" onClick={() => setChosen(o.id)}>
                <span className="vx-opt__radio">{on ? <Icon name="check" size={14} strokeWidth={3.5} /> : null}</span>
                {o.label}
              </button>
            );
          })}
        </div>
        <Button block size="l" disabled={!chosen} onClick={() => setState('confirm')}>Vote</Button>
        <p className="vx-poll__fine">{p.costNote || 'One vote per account. Voting is free today: 3 of 3 votes left.'}</p>
      </>
    );
  } else if (state === 'confirm') {
    body = (
      <>
        <div className="vx-poll__confirm" role="group" aria-label="Confirm your vote">
          <p className="vx-eyebrow" style={{ color: 'var(--ink-2)' }}>Your vote</p>
          <p className="vx-poll__choice">{chosenOpt ? chosenOpt.label : ''}</p>
          <p className="vx-poll__fine">One vote per account. You cannot change it after you confirm.</p>
          <p className="vx-poll__fine">
            <Icon name="coins" size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
            {p.cost || 'Free: 2 of 3 free votes left today.'}
          </p>
        </div>
        <div className="vx-poll__actions">
          <Button variant="secondary" onClick={() => setState('vote')}>Back</Button>
          <Button icon="check" onClick={() => { setGrow(false); setState('results'); }}>Confirm vote</Button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <ul className="vx-res">
          {opts.map((o) => {
            const pct = total ? Math.round(((o.votes || 0) * 100) / total) : 0;
            const isLead = o.id === lead.id;
            return (
              <li key={o.id} className={cx('vx-res__row', isLead && 'is-lead')}>
                <span className="vx-res__label">
                  {o.label}
                  {o.id === chosen ? <Badge tone="you" /> : null}
                  {isLead ? <Badge tone="leading" /> : null}
                </span>
                <span className="vx-res__pct">{pct + '%'}</span>
                <span className="vx-res__bar" role="img" aria-label={pct + ' percent'}><i style={{ width: (grow ? pct : 0) + '%' }} /></span>
                <span className="vx-res__votes">{fmt(o.votes || 0) + ' votes'}</span>
              </li>
            );
          })}
        </ul>
        <div className="vx-poll__foot">
          <span className="vx-poll__total">
            {fmt(total) + ' votes'}
            {p.closesIn ? <span className="vx-caption">{'· ' + p.closesIn + ' left'}</span> : null}
          </span>
          <span className="vx-caption">Open poll: one vote per account. It shows what voters here think, not the whole country.</span>
          {p.sponsor ? <span className="vx-poll__presented">{'Results presented by ' + p.sponsor}</span> : null}
          {p.onExplain !== false ? (
            <button type="button" className="vx-link" onClick={p.onExplain}>
              <Icon name="mic" size={18} />
              Explain your vote
            </button>
          ) : null}
        </div>
      </>
    );
  }
  return (
    <section className={cx('vx-poll', p.sponsor && 'vx-poll--sponsored', p.className)} aria-label="Poll">
      {head}
      <h3 className="vx-poll__q">{p.question}</h3>
      {body}
    </section>
  );
}

export interface ResultFigure {
  label: string;
  value: string;
  prefix?: string;
  unit?: string;
}

export interface ResultCommentProps {
  id?: string | number;
  author: Person;
  time: string;
  place: string;
  figures: ResultFigure[];
  status: 'verified' | 'unverified';
  checked?: string;
  note?: string;
  isNew?: boolean;
  className?: string;
}

export function ResultComment(p: ResultCommentProps): ReactElement {
  const a = p.author || {};
  const ok = p.status === 'verified';
  return (
    <article className={cx('vx-result', ok && 'vx-result--verified', p.isNew && 'is-new', p.className)}>
      <div className="vx-answer__head">
        <Avatar name={a.name || a.handle} size="s" />
        <div className="vx-answer__who">
          <span className="vx-answer__name">{a.handle || a.name}</span>
          <span className="vx-answer__time">{p.time}</span>
        </div>
        <VerifyMark status={p.status} pill />
      </div>
      <div className="vx-result__place">
        <Icon name="map-pin" size={18} />
        {p.place}
      </div>
      <dl className="vx-result__figs">
        {(p.figures || []).map((f, i) => (
          <div key={i} className="vx-result__fig">
            <dt>{f.label}</dt>
            <dd>
              {f.prefix ? <small className="pre">{f.prefix}</small> : null}
              {f.value}
              {f.unit ? <small>{f.unit}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      {p.note ? <p className="vx-result__note">{p.note}</p> : null}
      <div className="vx-result__foot">
        <span className="vx-caption">{ok ? p.checked || 'Checked by the WAWU team' : p.checked || 'Not checked yet. Treat with care.'}</span>
        <span>
          <IconButton icon="message-circle" label="Reply" variant="ghost" size="s" />
          <IconButton icon="flag" label="Report wrong numbers" variant="ghost" size="s" />
        </span>
      </div>
    </article>
  );
}

export interface LiveThreadProps {
  title?: string;
  explain?: string;
  items: ResultCommentProps[];
  incoming?: ResultCommentProps[];
  newCount?: number;
  total?: number;
  verifiedTotal?: number;
  filter?: 'all' | 'verified';
  className?: string;
}

export function LiveThread(p: LiveThreadProps): ReactElement {
  const items = p.items || [];
  const [filter, setFilter] = useState<string>(p.filter || 'all');
  const [nw, setNw] = useState(p.newCount || 0);
  const [extra, setExtra] = useState<ResultCommentProps[]>([]);
  const all = extra.concat(items);
  const shown = all.filter((c) => filter === 'all' || c.status === 'verified');
  const verifiedCount = all.filter((c) => c.status === 'verified').length;
  return (
    <section className={cx('vx-thread', p.className)} aria-label={p.title || 'Live results'}>
      <div className="vx-thread__head">
        <div className="vx-thread__title">
          <h3>{p.title || 'Live results'}</h3>
          <Badge tone="live" />
        </div>
        <p className="vx-thread__explain">{p.explain || 'People post the numbers they see. Verified means the WAWU team checked them. WAWU does not publish its own count.'}</p>
      </div>
      <div className="vx-thread__bar">
        <Tabs
          variant="segmented"
          label="Show"
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: 'All', count: p.total || all.length },
            { id: 'verified', label: 'Verified only', icon: 'badge-check', count: p.verifiedTotal || verifiedCount },
          ]}
        />
        {nw > 0 ? (
          <button
            type="button"
            className="vx-newpill"
            aria-live="polite"
            onClick={() => {
              const add: ResultCommentProps[] = (p.incoming || []).slice(0, nw).map((c) => ({ ...c, isNew: true }));
              setExtra(add.concat(extra));
              setNw(0);
            }}
          >
            <Icon name="arrow-up" size={18} strokeWidth={2.5} />
            {nw + (nw === 1 ? ' new result' : ' new results')}
          </button>
        ) : null}
      </div>
      <div className="vx-thread__list">
        {shown.length ? (
          shown.map((c, i) => <ResultComment key={(c.id || i) + (c.isNew ? 'n' : '')} {...c} />)
        ) : (
          <EmptyState icon="badge-check" title="Nothing verified yet" body="The WAWU team checks numbers as they come in. Switch to All to see every post." />
        )}
      </div>
    </section>
  );
}

export interface WeeklyReportCardProps {
  week: string;
  title?: string;
  moodLine: string;
  mood: { label: string; pct: number; delta?: number }[];
  themes: { text: string; voices: number }[];
  poll?: { pct: number; text: string };
  voices: number;
  votes: number;
  updated?: string;
  className?: string;
}

export function WeeklyReportCard(p: WeeklyReportCardProps): ReactElement {
  const mood = p.mood || [];
  return (
    <article className={cx('vx-report', p.className)} aria-label="Weekly report">
      <div className="vx-report__in">
        <div className="vx-report__head">
          <span className="vx-eyebrow vx-report__week">{p.week}</span>
          <h3 className="vx-report__title">{p.title || 'What Nigerians said this week'}</h3>
          <span className="vx-report__label">
            <Icon name="user-check" size={16} strokeWidth={2.5} />
            AI-assisted · Human-reviewed
          </span>
        </div>
        <div className="vx-mood">
          <span className="vx-eyebrow vx-mood__eye">The mood</span>
          <p className="vx-mood__line">{p.moodLine}</p>
          <ul className="vx-mood__rows">
            {mood.map((m) => {
              const d = m.delta || 0;
              return (
                <li key={m.label} className="vx-mood__row">
                  <span>{m.label}</span>
                  <span className="vx-mood__bar" aria-hidden="true"><i style={{ width: m.pct + '%' }} /></span>
                  <span className="vx-mood__pct">{m.pct + '%'}</span>
                  <span className="vx-mood__delta" aria-label={(d > 0 ? 'up ' : d < 0 ? 'down ' : 'no change ') + Math.abs(d) + ' points on last week'}>
                    {(d > 0 ? '↑' : d < 0 ? '↓' : '') + (d ? Math.abs(d) : '0')}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="vx-report__sec">
          <h4 className="vx-eyebrow">Main arguments</h4>
          <ol className="vx-themes">
            {(p.themes || []).map((t, i) => (
              <li key={i}>
                {t.text}
                <span>{short(t.voices) + ' voices'}</span>
              </li>
            ))}
          </ol>
          {p.poll ? (
            <div className="vx-report__poll">
              <b>{p.poll.pct + '%'}</b>
              <p>{p.poll.text}</p>
            </div>
          ) : null}
        </div>
        <div className="vx-report__foot">
          <p className="vx-report__based">{'Based on ' + fmt(p.voices) + ' voices and ' + fmt(p.votes) + ' votes. ' + (p.updated || '') + ' People are split on some points; this is a summary, not a consensus.'}</p>
          <div className="vx-report__btns">
            <Button variant="secondary" icon="share-2" size="s">Share</Button>
            <Button variant="secondary" icon="file-down" size="s">Download PDF</Button>
          </div>
        </div>
      </div>
    </article>
  );
}
