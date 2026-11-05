'use client';
import { useRef, useState } from 'react';
import type { MouseEvent, KeyboardEvent, ReactElement } from 'react';
import { Button, IconButton } from './actions';
import { useTicker } from './hooks';
import { Avatar } from './identity';
import { clock, cx, fmt, short, waveBars } from './helpers';
import type { NewsKind, Person } from './helpers';
import { Icon } from './Icon';
import { Badge, NewsTag } from './labels';
import { TopicChip } from './navigation';

export interface VoicePlayerProps {
  duration: number;
  seed?: number;
  bars?: number;
  tone?: 'mint' | 'surface' | 'forest';
  progress?: number;
  playing?: boolean;
  speed?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
}

export function VoicePlayer(p: VoicePlayerProps): ReactElement {
  const dur = p.duration || 10;
  const bars = useRef(waveBars(p.seed || dur * 3, p.bars || 34)).current;
  const [playing, setPlaying] = useState(!!p.playing);
  const [prog, setProg] = useState(p.progress || 0);
  const [speed, setSpeed] = useState(1);
  useTicker(playing, 100, () => {
    setProg((v) => {
      const n = v + (0.1 * speed) / dur;
      if (n >= 1) {
        setPlaying(false);
        if (p.onPlayingChange) p.onPlayingChange(false);
        return 0;
      }
      return n;
    });
  });
  function toggle() {
    const n = !playing;
    setPlaying(n);
    if (p.onPlayingChange) p.onPlayingChange(n);
  }
  function seek(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setProg(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  }
  function keys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') setProg(Math.min(1, prog + 1 / dur));
    if (e.key === 'ArrowLeft') setProg(Math.max(0, prog - 1 / dur));
  }
  const cut = Math.round(prog * bars.length);
  const left = playing || prog > 0 ? dur * (1 - prog) : dur;
  return (
    <div className={cx('vx-player', p.tone && 'vx-player--' + p.tone, p.className)}>
      <button type="button" className="vx-player__play" onClick={toggle} aria-label={(playing ? 'Pause' : 'Play') + ' voice, ' + dur + ' seconds'}>
        <Icon name={playing ? 'pause' : 'play'} size={22} fill strokeWidth={1.5} />
      </button>
      <div
        className="vx-player__track"
        role="slider"
        tabIndex={0}
        aria-label="Position"
        aria-valuemin={0}
        aria-valuemax={dur}
        aria-valuenow={Math.round(prog * dur)}
        aria-valuetext={clock(prog * dur) + ' of ' + clock(dur)}
        onClick={seek}
        onKeyDown={keys}
      >
        {bars.map((b, i) => (
          <i key={i} className={i < cut ? 'on' : ''} style={{ height: Math.round(6 + b * 30) }} />
        ))}
      </div>
      <span className="vx-player__time">{clock(left)}</span>
      {p.speed !== false ? (
        <button type="button" className="vx-player__speed" aria-label={'Playback speed ' + speed + 'x'} onClick={() => setSpeed(speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1)}>
          {speed + 'x'}
        </button>
      ) : null}
    </div>
  );
}

export const REACTIONS: { e: string; name: string }[] = [
  { e: '🔥', name: 'Powerful' }, { e: '💀', name: 'Wild' }, { e: '❤️', name: 'Relatable' }, { e: '😂', name: 'Funny' }, { e: '😮', name: 'Surprising' },
  { e: '😢', name: 'Sad' }, { e: '👏', name: 'Well said' }, { e: '🤔', name: 'Thought-provoking' }, { e: '💯', name: 'Exactly' }, { e: '👎', name: 'Disagree' },
];

export interface ReactionTrayProps {
  value?: string | null;
  defaultValue?: string;
  onChange?: (name: string | null) => void;
  freeLeft?: number;
  className?: string;
}

export function ReactionTray(p: ReactionTrayProps): ReactElement {
  const [inner, setInner] = useState<string | null>(p.defaultValue || null);
  const val = p.value !== undefined ? p.value : inner;
  function pick(name: string) {
    const n = name === val ? null : name;
    setInner(n);
    if (p.onChange) p.onChange(n);
  }
  return (
    <div className={cx('vx-react', p.className)} role="radiogroup" aria-label="React to this voice. One reaction each.">
      {REACTIONS.map((r) => {
        const on = r.name === val;
        return (
          <button key={r.name} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="vx-react__btn" onClick={() => pick(r.name)}>
            <span aria-hidden="true">{r.e}</span>
            <span>{r.name}</span>
          </button>
        );
      })}
      <div className="vx-react__foot">
        <span>{val ? 'Tap again to remove. Changing is free.' : 'One reaction each. Changing is free.'}</span>
        {p.freeLeft !== undefined ? <span className="vx-num">{p.freeLeft + ' free today'}</span> : null}
      </div>
    </div>
  );
}
ReactionTray.reactions = REACTIONS;

export interface AnswerCardProps {
  author: Person;
  time: string;
  place?: string;
  text?: string;
  voice?: { duration: number; seed?: number; transcript?: string };
  likes?: number;
  liked?: boolean;
  replies?: number;
  reactions?: { top: string[]; total: number };
  reaction?: string;
  label?: string;
  tag?: NewsKind;
  sponsor?: string;
  cta?: { label: string; href?: string };
  unfolded?: boolean;
  trayOpen?: boolean;
  compact?: boolean;
  freeReactions?: number;
  className?: string;
}

export function AnswerCard(p: AnswerCardProps): ReactElement {
  const a = p.author || {};
  const [liked, setLiked] = useState(!!p.liked);
  const [reaction, setReaction] = useState<string | null>(p.reaction || null);
  const [tray, setTray] = useState(!!p.trayOpen);
  const [open, setOpen] = useState(!!p.unfolded);
  const [playing, setPlaying] = useState(false);
  const r = REACTIONS.filter((x) => x.name === reaction)[0];
  const likes = (p.likes || 0) + (liked && !p.liked ? 1 : 0) - (!liked && p.liked ? 1 : 0);
  return (
    <article className={cx('vx-answer', p.sponsor && 'vx-answer--sponsored', p.className)} aria-label={p.sponsor ? 'Sponsored voice from ' + p.sponsor : 'Voice from ' + (a.handle || a.name)}>
      <div className="vx-answer__head">
        <Avatar name={a.name || a.handle} src={a.avatar} playing={playing} />
        <div className="vx-answer__who">
          <span className="vx-answer__name">
            {a.handle || a.name}
            {p.sponsor ? <Icon name="badge-check" size={16} label="Verified brand" /> : null}
          </span>
          <span className="vx-answer__time">{p.time + (p.place ? ' · ' + p.place : '')}</span>
        </div>
        {p.sponsor ? <Badge tone="sponsored" /> : null}
        <IconButton icon="ellipsis" label="More: report, block, copy link" variant="ghost" size="s" />
      </div>
      {p.label || p.tag ? (
        <div className="vx-answer__labels">
          {p.tag ? <NewsTag kind={p.tag} /> : null}
          {p.label ? <Badge tone="rank" icon="trending-up">{p.label}</Badge> : null}
        </div>
      ) : null}
      {p.voice ? <VoicePlayer duration={p.voice.duration} seed={p.voice.seed} onPlayingChange={setPlaying} /> : null}
      {p.text ? <p className="vx-answer__text">{p.text}</p> : null}
      {p.voice && p.voice.transcript ? (
        <div className="vx-answer__tx">
          <button type="button" className="vx-link" aria-expanded={open ? 'true' : 'false'} onClick={() => setOpen(!open)}>
            <Icon name="captions" size={18} />
            {open ? 'Hide transcript' : 'Read transcript'}
          </button>
          <div className={cx('vx-answer__unfold', open && 'is-open')}>
            <div>
              <p className="vx-answer__transcript"><b>Transcript</b>{p.voice.transcript}</p>
            </div>
          </div>
        </div>
      ) : null}
      {p.reactions ? (
        <div className="vx-answer__sum">
          <span className="e" aria-hidden="true">{p.reactions.top.join(' ')}</span>
          {fmt(p.reactions.total) + ' reactions'}
        </div>
      ) : null}
      <div className="vx-answer__actions">
        {tray ? (
          <div className="vx-answer__tray">
            <ReactionTray
              value={reaction}
              freeLeft={p.freeReactions}
              onChange={(v) => {
                setReaction(v);
                setTray(false);
              }}
            />
          </div>
        ) : null}
        <button type="button" className="vx-act" aria-pressed={liked ? 'true' : 'false'} aria-label={'Like, ' + likes + ' likes'} onClick={() => setLiked(!liked)}>
          <Icon name="heart" size={20} fill={liked} />
          {short(likes)}
        </button>
        <button type="button" className={cx('vx-act', r && 'vx-act--reacted')} aria-expanded={tray ? 'true' : 'false'} aria-label={r ? 'Your reaction: ' + r.name + '. Change' : 'React'} onClick={() => setTray(!tray)}>
          {r ? <span className="vx-act__emoji" aria-hidden="true">{r.e}</span> : <Icon name="smile-plus" size={20} />}
          {r ? r.name : 'React'}
        </button>
        <button type="button" className="vx-act" aria-label={'Reply, ' + (p.replies || 0) + ' replies'}>
          <Icon name="message-circle" size={20} />
          {short(p.replies || 0)}
        </button>
        <button type="button" className="vx-act vx-act--end" aria-label="Share">
          <Icon name="share-2" size={20} />
          {p.compact ? null : 'Share'}
        </button>
      </div>
      {p.sponsor && p.cta ? <Button variant="secondary" size="s" iconEnd="chevron-right" href={p.cta.href || '#'}>{p.cta.label}</Button> : null}
    </article>
  );
}

export interface ProposalCardProps {
  author: string;
  time: string;
  text: string;
  supports?: number;
  challenges?: number;
  grouped?: number;
  className?: string;
}

export function ProposalCard(p: ProposalCardProps): ReactElement {
  const [mine, setMine] = useState<'support' | 'challenge' | null>(null);
  return (
    <article className={cx('vx-prop', p.className)}>
      <div className="vx-answer__head">
        <Avatar name={p.author} size="s" />
        <div className="vx-answer__who">
          <span className="vx-answer__name">{p.author}</span>
          <span className="vx-answer__time">{p.time}</span>
        </div>
        <Badge tone="proposed" icon="lightbulb" />
      </div>
      <p className="vx-prop__text">{p.text}</p>
      {p.grouped ? (
        <span className="vx-prop__group">
          <Icon name="messages-square" size={16} />
          {p.grouped + ' similar proposals grouped here'}
        </span>
      ) : null}
      <div className="vx-prop__acts">
        <TopicChip icon="check" label="Support" count={(p.supports || 0) + (mine === 'support' ? 1 : 0)} selected={mine === 'support'} onClick={() => setMine(mine === 'support' ? null : 'support')} />
        <TopicChip icon="circle-x" label="Challenge" count={(p.challenges || 0) + (mine === 'challenge' ? 1 : 0)} selected={mine === 'challenge'} onClick={() => setMine(mine === 'challenge' ? null : 'challenge')} />
        <TopicChip icon="plus" label="Improve it" selected={false} />
      </div>
    </article>
  );
}
