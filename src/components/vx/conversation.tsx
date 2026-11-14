'use client';
import { pauseSongForVoice } from "@/lib/theme-song";
import { useEffect, useRef, useState } from 'react';
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
  /** With `progress`, the parent owns how far the voice has played (0 to 1): the bars follow it and a tap on the bars asks through `onSeek`. */
  progress?: number;
  /** The clip's real waveform (the API's 48 peak values, 0 to 255). Without it the bars are drawn from `seed`. */
  peaks?: number[];
  onSeek?: (fraction: number) => void;
  onSpeedChange?: (speed: number) => void;
  /** With `playing` the parent owns play and pause: the button only asks (onPlay, onPause). Without it the player keeps its own state. */
  playing?: boolean;
  speed?: boolean;
  /** A file to play. The player makes the audio element itself and follows it; leave out to draw the wave only. */
  src?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
}

export function VoicePlayer(p: VoicePlayerProps): ReactElement {
  const dur = p.duration || 10;
  const seeded = useRef(waveBars(p.seed || dur * 3, p.bars || 34)).current;
  const bars = p.peaks && p.peaks.length ? p.peaks.map((v) => Math.max(0.12, Math.min(1, v / 255))) : seeded;
  const progCtl = p.progress !== undefined;
  const [innerPlaying, setInnerPlaying] = useState(!!p.playing);
  const playing = p.playing !== undefined ? p.playing : innerPlaying;
  const [innerProg, setProg] = useState(p.progress || 0);
  const prog = progCtl ? Math.max(0, Math.min(1, p.progress as number)) : innerProg;
  const [speed, setSpeed] = useState(1);
  const audio = useRef<HTMLAudioElement | null>(null);
  const set = (n: boolean) => {
    setInnerPlaying(n);
    if (n && p.onPlay) p.onPlay();
    if (!n && p.onPause) p.onPause();
    if (p.onPlayingChange) p.onPlayingChange(n);
  };
  useTicker(playing && !p.src && !progCtl, 100, () => {
    setProg((v) => {
      const n = v + (0.1 * speed) / dur;
      if (n >= 1) {
        set(false);
        return 0;
      }
      return n;
    });
  });
  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => {
    if (!p.src || typeof Audio === 'undefined') return undefined;
    const a = new Audio(p.src);
    audio.current = a;
    a.ontimeupdate = () => {
      if (a.duration) setProg(a.currentTime / a.duration);
    };
    a.onended = () => {
      setProg(0);
      setRef.current(false);
    };
    a.onerror = () => setRef.current(false);
    return () => {
      a.pause();
      audio.current = null;
    };
  }, [p.src]);
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.playbackRate = speed;
    if (playing) { pauseSongForVoice(); a.play().catch(() => setRef.current(false)); }
    else a.pause();
  }, [playing, speed, p.src]);
  function toggle() {
    set(!playing);
  }
  function seek(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (p.onSeek) p.onSeek(f);
    if (!progCtl) setProg(f);
    if (audio.current && audio.current.duration) audio.current.currentTime = f * audio.current.duration;
  }
  function keys(e: KeyboardEvent<HTMLDivElement>) {
    const to = e.key === 'ArrowRight' ? Math.min(1, prog + 1 / dur) : e.key === 'ArrowLeft' ? Math.max(0, prog - 1 / dur) : null;
    if (to === null) return;
    if (p.onSeek) p.onSeek(to);
    if (!progCtl) setProg(to);
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
        <button type="button" className="vx-player__speed" aria-label={'Playback speed ' + speed + 'x'} onClick={() => { const n = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1; setSpeed(n); if (p.onSpeedChange) p.onSpeedChange(n); }}>
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
  voice?: { duration: number; seed?: number; transcript?: string; src?: string };
  likes?: number;
  /** With `onLike`, `liked` and `likeCount` are the truth and the card only asks. */
  liked?: boolean;
  likeCount?: number;
  replies?: number;
  reactions?: { top: string[]; total: number };
  /** Count of each reaction by name ("Powerful": 3). Draws the top three emoji and the total, in place of `reactions`. */
  reactionCounts?: Record<string, number>;
  /** With `onReact`, the person's reaction (a name from REACTIONS, or null) is this prop alone. */
  reaction?: string | null;
  label?: string;
  tag?: NewsKind;
  sponsor?: string;
  cta?: { label: string; href?: string };
  unfolded?: boolean;
  trayOpen?: boolean;
  compact?: boolean;
  freeReactions?: number;
  /** Controlled voice playback (see VoicePlayer). */
  playing?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onLike?: (next: boolean) => void;
  onReact?: (name: string | null) => void;
  /** With this, `trayOpen` is the truth and the card asks to open or close the reaction tray. */
  onTrayChange?: (open: boolean) => void;
  onReply?: () => void;
  onShare?: () => void;
  onMore?: () => void;
  className?: string;
}

export function AnswerCard(p: AnswerCardProps): ReactElement {
  const a = p.author || {};
  const [innerLiked, setLiked] = useState(!!p.liked);
  const [innerReaction, setReaction] = useState<string | null>(p.reaction || null);
  const [innerTray, setTray] = useState(!!p.trayOpen);
  const [open, setOpen] = useState(!!p.unfolded);
  const [innerPlaying, setPlaying] = useState(false);
  const likeCtl = p.onLike !== undefined;
  const reactCtl = p.onReact !== undefined;
  const liked = likeCtl ? !!p.liked : innerLiked;
  const reaction = reactCtl ? p.reaction || null : innerReaction;
  const tray = p.onTrayChange ? !!p.trayOpen : innerTray;
  const playing = p.playing !== undefined ? p.playing : innerPlaying;
  const r = REACTIONS.filter((x) => x.name === reaction)[0];
  const likes = likeCtl
    ? p.likeCount !== undefined ? p.likeCount : p.likes || 0
    : (p.likeCount !== undefined ? p.likeCount : p.likes || 0) + (liked && !p.liked ? 1 : 0) - (!liked && p.liked ? 1 : 0);
  let sum = p.reactions;
  if (p.reactionCounts) {
    const rows = REACTIONS.map((x) => ({ x, n: p.reactionCounts![x.name] || 0 })).filter((o) => o.n > 0);
    const total = rows.reduce((t, o) => t + o.n, 0);
    sum = total > 0 ? { top: rows.slice().sort((m, n) => n.n - m.n).slice(0, 3).map((o) => o.x.e), total } : undefined;
  }
  const setTrayOpen = (n: boolean) => {
    if (p.onTrayChange) p.onTrayChange(n);
    else setTray(n);
  };
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
        <IconButton icon="ellipsis" label="More: report, block, copy link" variant="ghost" size="s" onClick={p.onMore} />
      </div>
      {p.label || p.tag ? (
        <div className="vx-answer__labels">
          {p.tag ? <NewsTag kind={p.tag} /> : null}
          {p.label ? <Badge tone="rank" icon="trending-up">{p.label}</Badge> : null}
        </div>
      ) : null}
      {p.voice ? (
        <VoicePlayer
          duration={p.voice.duration}
          seed={p.voice.seed}
          src={p.voice.src}
          playing={p.playing}
          onPlay={p.onPlay}
          onPause={p.onPause}
          onPlayingChange={setPlaying}
        />
      ) : null}
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
      {sum ? (
        <div className="vx-answer__sum">
          <span className="e" aria-hidden="true">{sum.top.join(' ')}</span>
          {fmt(sum.total) + (sum.total === 1 ? ' reaction' : ' reactions')}
        </div>
      ) : null}
      <div className="vx-answer__actions">
        <button
          type="button"
          className="vx-act"
          aria-pressed={liked ? 'true' : 'false'}
          aria-label={'Like, ' + likes + (likes === 1 ? ' like' : ' likes')}
          onClick={() => {
            if (likeCtl) p.onLike!(!liked);
            else setLiked(!liked);
          }}
        >
          <Icon name="heart" size={20} fill={liked} />
          {short(likes)}
        </button>
        <button type="button" className={cx('vx-act', r && 'vx-act--reacted')} aria-expanded={tray ? 'true' : 'false'} aria-label={r ? 'Your reaction: ' + r.name + '. Change' : 'React'} onClick={() => setTrayOpen(!tray)}>
          {r ? <span className="vx-act__emoji" aria-hidden="true">{r.e}</span> : <Icon name="smile-plus" size={20} />}
          {r ? r.name : 'React'}
        </button>
        {/* After the React button in the DOM so Tab reaches the tray next; it is absolutely placed above the row, so nothing moves. */}
        {tray ? (
          <div className="vx-answer__tray">
            <ReactionTray
              value={reaction}
              freeLeft={p.freeReactions}
              onChange={(v) => {
                if (reactCtl) p.onReact!(v);
                else setReaction(v);
                setTrayOpen(false);
              }}
            />
          </div>
        ) : null}
        <button type="button" className="vx-act" aria-label={'Reply, ' + (p.replies === 1 ? '1 reply' : (p.replies || 0) + ' replies')} onClick={p.onReply}>
          <Icon name="message-circle" size={20} />
          {short(p.replies || 0)}
        </button>
        <button type="button" className="vx-act vx-act--end" aria-label="Share" onClick={p.onShare}>
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
  /** What the avatar draws its initials from, when that differs from the shown name (the name is a "@handle"). */
  avatarName?: string;
  time: string;
  text: string;
  supports?: number;
  challenges?: number;
  grouped?: number;
  /** The person's stance. When given (null for none), it and the two counts are the truth and the card only asks. */
  stance?: 'support' | 'challenge' | null;
  onSupport?: () => void;
  onChallenge?: () => void;
  onImprove?: () => void;
  className?: string;
}

export function ProposalCard(p: ProposalCardProps): ReactElement {
  const [inner, setMine] = useState<'support' | 'challenge' | null>(null);
  const ctl = p.stance !== undefined;
  const mine = ctl ? p.stance : inner;
  const bump = (kind: 'support' | 'challenge') => (ctl ? 0 : mine === kind ? 1 : 0);
  const tap = (kind: 'support' | 'challenge', cb?: () => void) => () => {
    if (cb) cb();
    if (!ctl) setMine(mine === kind ? null : kind);
  };
  return (
    <article className={cx('vx-prop', p.className)}>
      <div className="vx-answer__head">
        <Avatar name={p.avatarName ?? p.author} size="s" />
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
        <TopicChip icon="check" label="Support" count={(p.supports || 0) + bump('support')} selected={mine === 'support'} onClick={tap('support', p.onSupport)} />
        <TopicChip icon="circle-x" label="Challenge" count={(p.challenges || 0) + bump('challenge')} selected={mine === 'challenge'} onClick={tap('challenge', p.onChallenge)} />
        <TopicChip icon="plus" label="Improve it" selected={false} onClick={p.onImprove} />
      </div>
    </article>
  );
}
