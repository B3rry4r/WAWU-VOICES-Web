'use client';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Button, IconButton } from './actions';
import { Avatar } from './identity';
import { cx, fmt, voicesText } from './helpers';
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
  /** The poll has closed: the head says so instead of "Open poll", and the footnote drops "Open poll". */
  closed?: boolean;
  /** Controlled: true shows the results, false shows the vote steps. Leave out and the poll moves on by itself. */
  voted?: boolean;
  /** Controlled choice: with `onSelect`, `selected` is the choice and the poll never keeps its own. */
  onSelect?: (optionId: string) => void;
  /** Called by "Confirm vote" with the chosen option. May return a promise: the button waits on it, and a rejection keeps the confirm step. */
  onConfirm?: (optionId: string) => void | Promise<void>;
  /** The page already shows the poll's title above it: the title stays for screen readers only. */
  hideQuestion?: boolean;
  className?: string;
}

function votesText(n: number): string {
  return fmt(n) + (n === 1 ? ' vote' : ' votes');
}

export function Poll(p: PollProps): ReactElement {
  const opts = p.options || [];
  const total = p.total || opts.reduce((s, o) => s + (o.votes || 0), 0);
  const [step, setState] = useState<PollState>(p.state || 'vote');
  const [inner, setChosen] = useState<string | null>(p.selected || null);
  const [pending, setPending] = useState(false);
  const picking = p.onSelect !== undefined;
  const chosen = picking ? p.selected || null : inner;
  const state: PollState = p.voted === undefined ? step : p.voted ? 'results' : step === 'results' ? 'vote' : step;
  const [grow, setGrow] = useState(state === 'results' ? false : true);
  useEffect(() => {
    if (state === 'results') {
      const id = setTimeout(() => setGrow(true), 40);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state]);
  async function confirm() {
    if (pending) return;
    if (!p.onConfirm || !chosen) {
      setGrow(false);
      setState('results');
      return;
    }
    setPending(true);
    try {
      await p.onConfirm(chosen);
      if (p.voted === undefined) {
        setGrow(false);
        setState('results');
      }
    } catch {
      /* the caller shows why; the confirm step stays so the person can tap again */
    } finally {
      setPending(false);
    }
  }
  const lead = opts.reduce<PollOption>((m, o) => ((o.votes || 0) > (m.votes || 0) ? o : m), opts[0] || { id: '', label: '' });
  const chosenOpt = opts.filter((o) => o.id === chosen)[0];
  const head = (
    <div className="vx-poll__head">
      {p.sponsor ? <Badge tone="sponsored">Sponsored poll</Badge> : p.closed ? <Badge tone="neutral" icon="lock">Poll closed</Badge> : <Badge tone="green" icon="vote">Open poll</Badge>}
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
              <button key={o.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="vx-opt" onClick={() => {
                if (picking) p.onSelect?.(o.id);
                else setChosen(o.id);
              }}>
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
          <Button variant="secondary" disabled={pending} onClick={() => setState('vote')}>Back</Button>
          <Button icon="check" loading={pending} onClick={() => void confirm()}>Confirm vote</Button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <ul className="vx-res">
          {opts.map((o) => {
            const pct = total ? Math.round(((o.votes || 0) * 100) / total) : 0;
            // lead ruling WF, 6 Nov (B-L4): nobody leads a poll with no votes (no "Leading 0%").
            // A tie has no leader (WF-7b, A-F5): two options level at the top show no Leading mark.
            const isLead = (o.votes || 0) > 0 && o.id === lead.id && !opts.some((x) => x.id !== o.id && (x.votes || 0) === (o.votes || 0));
            return (
              <li key={o.id} className={cx('vx-res__row', isLead && 'is-lead')}>
                <span className="vx-res__label">
                  {o.label}
                  {o.id === chosen ? <Badge tone="you" /> : null}
                  {isLead ? <Badge tone="leading" /> : null}
                </span>
                <span className="vx-res__pct">{pct + '%'}</span>
                <span className="vx-res__bar" role="img" aria-label={pct + ' percent'}><i style={{ width: (grow ? pct : 0) + '%' }} /></span>
                <span className="vx-res__votes">{votesText(o.votes || 0)}</span>
              </li>
            );
          })}
        </ul>
        <div className="vx-poll__foot">
          <span className="vx-poll__total">
            {votesText(total)}
            {p.closesIn ? <span className="vx-caption">{'· ' + p.closesIn + ' left'}</span> : null}
          </span>
          <span className="vx-caption">{(p.closed ? 'Closed poll' : 'Open poll') + ': one vote per account. It shows what voters here think, not the whole country.'}</span>
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
      <h3 className={cx('vx-poll__q', p.hideQuestion && 'sr-only')}>{p.question}</h3>
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
  /** Leaves the Reply and Report buttons out (a preview, or a screen where they do nothing yet). */
  hideActions?: boolean;
  onReply?: () => void;
  onReport?: () => void;
  className?: string;
}

export function ResultComment(p: ResultCommentProps): ReactElement {
  const a = p.author || {};
  const ok = p.status === 'verified';
  return (
    <article className={cx('vx-result', ok && 'vx-result--verified', p.isNew && 'is-new', p.className)}>
      <div className="vx-answer__head">
        <Avatar name={a.name || a.handle} src={a.avatar} size="s" />
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
        {p.hideActions ? null : (
          <span>
            <IconButton icon="message-circle" label="Reply" variant="ghost" size="s" onClick={p.onReply} />
            <IconButton icon="flag" label="Report wrong numbers" variant="ghost" size="s" onClick={p.onReport} />
          </span>
        )}
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
  /** The approved summary text; drawn under the headline when there is one (lead ruling WF, 6 Nov, C-H4). */
  summary?: string;
  mood: { label: string; pct: number; delta?: number }[];
  themes: { text: string; voices: number }[];
  poll?: { pct: number; text: string };
  voices: number;
  votes: number;
  updated?: string;
  onShare?: () => void;
  /** The PDF comes after launch (V-10), so the Download PDF button is left out unless this is false. */
  hidePdf?: boolean;
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
        {p.summary?.trim() ? <p className="m-0 text-body text-ink-2">{p.summary.trim()}</p> : null}
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
                  {m.delta === undefined ? null : (
                  <span className="vx-mood__delta" aria-label={(d > 0 ? 'up ' : d < 0 ? 'down ' : 'no change ') + Math.abs(d) + ' points on last week'}>
                    {(d > 0 ? '↑' : d < 0 ? '↓' : '') + (d ? Math.abs(d) : '0')}
                  </span>)}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="vx-report__sec">
          {/* lead ruling WF, 6 Nov (C-H4): "Main arguments" only when there are arguments. */}
          {(p.themes || []).length ? (
            <>
              <h4 className="vx-eyebrow">Main arguments</h4>
              <ol className="vx-themes">
                {(p.themes || []).map((t, i) => (
                  <li key={i}>
                    {t.text}
                    <span>{voicesText(t.voices)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {p.poll ? (
            <div className="vx-report__poll">
              <b>{p.poll.pct + '%'}</b>
              <p>{p.poll.text}</p>
            </div>
          ) : null}
        </div>
        <div className="vx-report__foot">
          <p className="vx-report__based">{'Based on ' + fmt(p.voices) + (p.voices === 1 ? ' voice' : ' voices') + ' and ' + fmt(p.votes) + (p.votes === 1 ? ' vote. ' : ' votes. ') + (p.updated || '') + ' People are split on some points; this is a summary, not a consensus.'}</p>
          <div className="vx-report__btns">
            <Button variant="secondary" icon="share-2" size="s" onClick={p.onShare}>Share</Button>
            {p.hidePdf === false ? <Button variant="secondary" icon="file-down" size="s">Download PDF</Button> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
