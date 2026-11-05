'use client';
import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import { Button, IconButton } from './actions';
import { VoicePlayer } from './conversation';
import { useTicker } from './hooks';
import { clock, cx, fmt, waveBars } from './helpers';
import { Icon } from './Icon';
import { TopicChip } from './navigation';

export interface FreePostsProps {
  left: number;
  total?: number;
  pill?: boolean;
  className?: string;
}

export function FreePosts(p: FreePostsProps): ReactElement {
  const total = p.total || 10;
  const left = Math.max(0, p.left === undefined ? total : p.left);
  const tone = left === 0 ? 'none' : left === 1 ? 'last' : '';
  const text = left === 0 ? 'Free posts used' : left === 1 ? 'Last free post' : left + ' free posts left';
  const dots: ReactElement[] = [];
  for (let i = 0; i < total; i++) dots.push(<i key={i} className={i < total - left ? 'used' : ''} />);
  return (
    <span className={cx('vx-free', tone && 'vx-free--' + tone, p.pill && 'vx-free--pill', p.className)} aria-label={text + ' of ' + total}>
      <span className="vx-free__dots" aria-hidden="true">{dots}</span>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

export type IntentKind = 'agree' | 'disagree' | 'experience';
export type ComposerTag = 'none' | 'unverified' | 'gossip';

export interface ComposerProps {
  freeLeft?: number;
  /** No free posts: shows the cost line and "Free posts used" instead of the meter, whatever `freeLeft` says. */
  noFree?: boolean;
  /** false leaves the free-posts meter out (a free action, like a proposal) and puts the button at the end. */
  meter?: boolean;
  maxLength?: number;
  /** The same as `maxLength`. */
  maxChars?: number;
  /** Controlled text: with `value`, the box shows it and `onChange` hears every edit. */
  value?: string;
  onChange?: (text: string) => void;
  /** Sending: the box and the button are held and the button shows its spinner. */
  busy?: boolean;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  replyTo?: string;
  intent?: IntentKind;
  showTags?: boolean;
  newsTag?: ComposerTag;
  /** With these, `intent` and `newsTag` are the truth and the box asks to change them. */
  onIntentChange?: (intent: IntentKind | null) => void;
  onTagChange?: (tag: ComposerTag) => void;
  cost?: string;
  costShort?: string;
  balance?: string;
  onSend?: () => void;
  /** Called with the text when the person taps Post (the same tap as `onSend`). */
  onSubmit?: (text: string) => void;
  onVoice?: (() => void) | false;
  className?: string;
}

export function Composer(p: ComposerProps): ReactElement {
  const max = p.maxChars || p.maxLength || 500;
  const uid = useId();
  const taId = 'vx-compose-ta' + uid;
  const countId = 'vx-compose-count' + uid;
  const [innerText, setText] = useState(p.defaultValue || '');
  const text = p.value !== undefined ? p.value : innerText;
  const [innerIntent, setIntent] = useState<IntentKind | null>(p.intent || null);
  const [innerTag, setTag] = useState<ComposerTag | null>(p.newsTag || null);
  const intent = p.onIntentChange ? p.intent || null : innerIntent;
  const tag = p.onTagChange ? p.newsTag || null : innerTag;
  const pickIntent = (v: IntentKind | null) => (p.onIntentChange ? p.onIntentChange(v) : setIntent(v));
  const pickTag = (v: ComposerTag) => (p.onTagChange ? p.onTagChange(v) : setTag(v));
  const n = text.length;
  const free = p.noFree ? 0 : p.freeLeft === undefined ? 7 : p.freeLeft;
  const meter = p.meter !== false;
  const intents: [IntentKind, string, 'check' | 'circle-x' | 'user'][] = [
    ['agree', 'I agree', 'check'],
    ['disagree', 'I disagree', 'circle-x'],
    ['experience', 'My experience', 'user'],
  ];
  return (
    <section className={cx('vx-compose', p.className)} aria-label={p.replyTo ? 'Reply' : 'Your answer'} aria-busy={p.busy ? 'true' : undefined}>
      <label className="vx-compose__label" htmlFor={taId}>
        {p.replyTo ? 'Reply to ' + p.replyTo : p.label || 'Your answer'}
        {p.onVoice !== false ? <Button variant="ghost" size="s" icon="mic" onClick={p.onVoice}>Use voice</Button> : null}
      </label>
      {p.replyTo ? (
        <div className="vx-intent" role="group" aria-label="How are you replying?">
          {intents.map((o) => (
            <TopicChip key={o[0]} icon={o[2]} label={o[1]} selected={intent === o[0]} onClick={() => pickIntent(intent === o[0] ? null : o[0])} />
          ))}
        </div>
      ) : null}
      <div className="vx-compose__area">
        <textarea
          id={taId}
          className="vx-compose__ta"
          placeholder={p.placeholder || 'Say it in your own words'}
          value={text}
          maxLength={max}
          rows={4}
          readOnly={p.busy}
          aria-describedby={countId}
          onChange={(e) => {
            setText(e.target.value);
            if (p.onChange) p.onChange(e.target.value);
          }}
        />
        <span id={countId} className={cx('vx-compose__count', n >= max ? 'is-over' : n >= max * 0.9 && 'is-near')}>{fmt(n) + ' / ' + fmt(max)}</span>
      </div>
      {p.showTags ? (
        <div className="vx-tagpick" role="group" aria-label="Is this news?">
          <span className="vx-caption">Is this news? Pick a tag so readers know.</span>
          <div className="vx-tagpick__row">
            <TopicChip className="is-none" label="Not news" selected={tag === 'none'} onClick={() => pickTag('none')} />
            <TopicChip className="is-unverified" icon="shield-alert" label="Unverified News" selected={tag === 'unverified'} onClick={() => pickTag('unverified')} />
            <TopicChip className="is-gossip" icon="messages-square" label="Gossip" selected={tag === 'gossip'} onClick={() => pickTag('gossip')} />
            <TopicChip icon="lock" label="Verified News" disabled aria-label="Verified News, editors only" />
          </div>
        </div>
      ) : null}
      {free > 0 || !meter ? null : (
        <div className="vx-compose__cost">
          <Icon name="coins" size={18} />
          <span>
            This post uses <b>{p.cost || '0.5 unit (₦6.90)'}</b>
            {'. Balance: ' + (p.balance || '12.5 units') + '.'}
          </span>
        </div>
      )}
      <div className={cx('vx-compose__foot', !meter && 'vx-compose__foot--end')}>
        {!meter ? null : free > 0 ? <FreePosts left={free} /> : <span className="vx-caption" style={{ marginRight: 'auto' }}>Free posts used</span>}
        <Button
          icon="send"
          disabled={n === 0}
          loading={p.busy}
          onClick={() => {
            if (p.onSubmit) p.onSubmit(text);
            if (p.onSend) p.onSend();
          }}
        >
          {free > 0 || !meter ? 'Post' : 'Post for ' + (p.costShort || '0.5 unit')}
        </Button>
      </div>
    </section>
  );
}

export type RecorderState = 'idle' | 'recording' | 'preview';

export interface RecorderProps {
  question?: string;
  limit?: number;
  freeLeft?: number;
  passes?: { name: string; detail: string }[] | false;
  state?: RecorderState;
  elapsed?: number;
  recorded?: number;
  /** With this, `state`, `elapsed` and `recorded` are the truth (the screen's real recorder) and the buttons only ask. */
  onStateChange?: (state: RecorderState) => void;
  onStart?: () => void;
  onStop?: () => void;
  onRetry?: () => void;
  onDiscard?: () => void;
  /** Level bars (0 to 1) while recording, from the real microphone. Leave out for the drawn motion. */
  levels?: number[];
  /** The recorded clip, so the preview plays it. */
  src?: string;
  onSend?: () => void;
  onClose?: () => void;
  className?: string;
}

export function Recorder(p: RecorderProps): ReactElement {
  const limit = p.limit || 10;
  const ctl = p.onStateChange !== undefined;
  const [innerState, setInnerState] = useState<RecorderState>(p.state || 'idle');
  const [innerT, setT] = useState(p.state === 'preview' ? p.recorded || 8 : p.state === 'recording' ? p.elapsed || 3.4 : 0);
  const [lv, setLv] = useState(() => waveBars(5, 28));
  const state: RecorderState = ctl ? p.state || 'idle' : innerState;
  const t = ctl ? (state === 'preview' ? p.recorded || 0 : state === 'recording' ? p.elapsed || 0 : 0) : innerT;
  const setState = (n: RecorderState) => {
    setInnerState(n);
    if (p.onStateChange) p.onStateChange(n);
  };
  useTicker(state === 'recording' && !ctl, 100, () => {
    setT((v) => {
      const n = v + 0.1;
      if (n >= limit) {
        setState('preview');
        if (p.onStop) p.onStop();
        return limit;
      }
      return n;
    });
    setLv(waveBars(Math.floor(Math.random() * 999) + 1, 28));
  });
  const levels = p.levels && p.levels.length ? p.levels : lv;
  const R = 98;
  const C = 2 * Math.PI * R;
  const frac = state === 'idle' ? 0 : Math.min(1, t / limit);
  const left = Math.max(0, limit - t);
  const free = p.freeLeft === undefined ? 7 : p.freeLeft;
  let hint: ReactElement;
  if (state === 'idle') {
    hint = (
      <p className="vx-rec__hint">
        Tap to record. You have <b>{limit + ' seconds'}</b>
        {free > 0 ? ' on a free post.' : ' for 1 unit (₦13.80).'}
      </p>
    );
  } else if (state === 'recording') {
    hint = (
      <p className="vx-rec__hint" aria-live="polite">
        <b>{Math.ceil(left) + ' seconds left'}</b>
        {'. It stops by itself at ' + limit + '.'}
      </p>
    );
  } else {
    hint = <p className="vx-rec__hint">Listen back. Nothing posts until you tap Send.</p>;
  }
  const passes = p.passes || [{ name: 'Voice 30', detail: '10.5 units · ₦145' }, { name: 'Voice 60', detail: '14.5 units · ₦200' }];
  return (
    <section className={cx('vx-rec', p.className)} aria-label="Voice recorder">
      <div className="vx-rec__top">
        {state === 'recording' ? <span className="vx-rec__dot">Recording</span> : <FreePosts left={free} pill />}
        {p.onClose ? <IconButton icon="x" label="Close recorder" variant="dark" size="s" onClick={p.onClose} /> : null}
      </div>
      <p className="vx-rec__q">{p.question}</p>
      {state !== 'preview' ? (
        <div className="vx-rec__stage">
          <svg className="vx-rec__ring" viewBox="0 0 208 208" aria-hidden="true">
            <circle className="bg" cx={104} cy={104} r={R} />
            <circle className="fg" cx={104} cy={104} r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
          </svg>
          <button
            type="button"
            className={cx('vx-rec__btn', state === 'recording' && 'is-recording')}
            aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
            onClick={() => {
              if (state === 'recording') {
                setState('preview');
                if (p.onStop) p.onStop();
              } else {
                setT(0);
                setState('recording');
                if (p.onStart) p.onStart();
              }
            }}
          >
            <Icon name={state === 'recording' ? 'square' : 'mic'} size={state === 'recording' ? 34 : 44} fill={state === 'recording'} strokeWidth={2} />
          </button>
        </div>
      ) : null}
      {state === 'preview' ? <div className="vx-rec__player"><VoicePlayer duration={Math.round(t) || 8} tone="forest" seed={11} src={p.src} /></div> : null}
      {state === 'preview' ? null : (
        <span className="vx-rec__timer" aria-hidden={state === 'recording' ? 'true' : undefined}>{state === 'recording' ? clock(Math.ceil(left)) : clock(limit)}</span>
      )}
      {state === 'recording' ? (
        <div className="vx-rec__live" aria-hidden="true">
          {levels.map((b, i) => (
            <i key={i} style={{ height: Math.round(6 + b * 38) }} />
          ))}
        </div>
      ) : null}
      {hint}
      {state === 'preview' ? (
        <div className="vx-rec__actions">
          <Button variant="onforest" icon="rotate-ccw" onClick={() => { setT(0); setState('idle'); if (p.onRetry) p.onRetry(); }}>Re-record</Button>
          <Button variant="onforest" icon="trash-2" onClick={() => { setT(0); setState('idle'); if (p.onDiscard) p.onDiscard(); }}>Delete</Button>
          <Button size="l" icon="send" onClick={p.onSend}>{free > 0 ? 'Send' : 'Send for 1 unit'}</Button>
        </div>
      ) : null}
      {state === 'idle' && p.passes !== false ? (
        <div className="vx-rec__more">
          <p>Need more time?</p>
          <div className="vx-rec__pass">
            {passes.map((ps) => (
              <Button key={ps.name} variant="onforest">
                {ps.name}
                <small>{ps.detail}</small>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
