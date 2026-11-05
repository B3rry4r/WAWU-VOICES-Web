'use client';
/* eslint-disable @next/next/no-img-element -- fixed brand images */
import { useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { ASSETS } from './assets';
import { Button, IconButton } from './actions';
import { cx, fmt, short } from './helpers';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { SearchField } from './inputs';
import { UnitsChip } from './profile';

export interface TabsProps {
  items: { id: string; label: string; icon?: IconName; count?: number }[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  variant?: 'underline' | 'segmented';
  block?: boolean;
  label?: string;
  className?: string;
}

export function Tabs(p: TabsProps): ReactElement {
  const items = p.items || [];
  const [inner, setInner] = useState<string | undefined>(p.defaultValue || (items[0] && items[0].id));
  const val = p.value !== undefined ? p.value : inner;
  function pick(id: string) {
    setInner(id);
    if (p.onChange) p.onChange(id);
  }
  function key(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const at = (i + d + items.length) % items.length;
    pick(items[at].id);
    const btns = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    btns?.[at]?.focus();
  }
  return (
    <div className={cx(p.variant === 'segmented' ? 'vx-seg' : 'vx-tabs', p.block && 'vx-seg--block', p.className)} role="tablist" aria-label={p.label}>
      {items.map((it, i) => {
        const on = it.id === val;
        return (
          <button key={it.id} type="button" role="tab" className="vx-tab" aria-selected={on ? 'true' : 'false'} tabIndex={on ? 0 : -1} onClick={() => pick(it.id)} onKeyDown={(e) => key(e, i)}>
            {it.icon ? <Icon name={it.icon} size={18} /> : null}
            {it.label}
            {it.count !== undefined ? <span className="vx-tab__count">{fmt(it.count)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface TopicChipProps {
  label: string;
  selected?: boolean;
  defaultSelected?: boolean;
  onClick?: (selected: boolean) => void;
  count?: number;
  newCount?: number;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function TopicChip(p: TopicChipProps): ReactElement {
  const [inner, setInner] = useState(!!p.defaultSelected);
  const on = p.selected !== undefined ? p.selected : inner;
  return (
    <button
      type="button"
      className={cx('vx-chip', p.className)}
      aria-pressed={on ? 'true' : 'false'}
      aria-disabled={p.disabled ? 'true' : undefined}
      aria-label={p['aria-label']}
      onClick={() => {
        if (p.disabled) return;
        setInner(!on);
        if (p.onClick) p.onClick(!on);
      }}
    >
      {p.icon ? <Icon name={p.icon} size={16} strokeWidth={2.25} /> : null}
      {p.label}
      {p.count !== undefined ? <span className="vx-chip__count">{short(p.count)}</span> : null}
      {p.newCount ? <span className="vx-chip__new" aria-label={p.newCount + ' new'}>{p.newCount}</span> : null}
    </button>
  );
}

export type StageId = 'speak' | 'discuss' | 'vote' | 'next';

const STAGES: { id: StageId; label: string; icon: IconName }[] = [
  { id: 'speak', label: 'Speak', icon: 'mic' },
  { id: 'discuss', label: 'Discuss', icon: 'message-square' },
  { id: 'vote', label: 'Vote', icon: 'vote' },
  { id: 'next', label: 'What Next?', icon: 'lightbulb' },
];

export interface StageBarProps {
  current?: StageId;
  value?: StageId;
  onChange?: (id: StageId) => void;
  visited?: string[];
  counts?: { speak?: string; discuss?: string; vote?: string; next?: string };
  className?: string;
}

export function StageBar(p: StageBarProps): ReactElement {
  const [inner, setInner] = useState<StageId>(p.current || 'discuss');
  const cur = p.value !== undefined ? p.value : inner;
  const visited = p.visited || [];
  const counts = p.counts || {};
  return (
    <nav className={cx('vx-stage', p.className)} aria-label="Conversation stages">
      {STAGES.map((s) => {
        const on = s.id === cur;
        return (
          <button
            key={s.id}
            type="button"
            className={cx('vx-stage__step', visited.indexOf(s.id) >= 0 && 'is-visited')}
            aria-current={on ? 'step' : undefined}
            onClick={() => {
              setInner(s.id);
              if (p.onChange) p.onChange(s.id);
            }}
          >
            <span className="vx-stage__dot"><Icon name={s.icon} size={20} /></span>
            {s.label}
            {counts[s.id] !== undefined ? <span className="vx-stage__n">{counts[s.id]}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

export interface TopBarProps {
  country?: string;
  onCountry?: () => void;
  unread?: boolean;
  count?: number;
  onBell?: () => void;
  className?: string;
}

export function TopBar(p: TopBarProps): ReactElement {
  return (
    <header className={cx('vx-topbar', p.className)}>
      <img className="vx-topbar__logo" src={ASSETS.wordmark} alt="VOICES home" />
      <button type="button" className="vx-country" aria-label={'Country: ' + (p.country || 'Nigeria') + '. Change country'} onClick={p.onCountry}>
        <Icon name="globe" size={18} />
        {p.country || 'Nigeria'}
        <Icon name="chevron-down" size={16} />
      </button>
      <IconButton icon="bell" label="Notifications" dot={p.unread !== false && !p.count} count={p.count} onClick={p.onBell} />
    </header>
  );
}

export type NavId = 'home' | 'discover' | 'speak' | 'profile';

const NAV: { id: NavId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'discover', label: 'Discover', icon: 'compass' },
  { id: 'speak', label: 'Speak', icon: 'mic' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

export interface BottomNavProps {
  active?: NavId;
  value?: string;
  onChange?: (id: NavId) => void;
  className?: string;
}

export function BottomNav(p: BottomNavProps): ReactElement {
  const [inner, setInner] = useState<string>(p.active || 'home');
  const act = p.value !== undefined ? p.value : inner;
  function go(id: NavId) {
    setInner(id);
    if (p.onChange) p.onChange(id);
  }
  return (
    <nav className={cx('vx-bottombar', p.className)} aria-label="Main">
      {NAV.map((n) => {
        const cur = n.id === act ? 'page' : undefined;
        if (n.id === 'speak') {
          return (
            <button key={n.id} type="button" className="vx-speak" aria-current={cur} onClick={() => go(n.id)}>
              <span className="vx-speak__btn"><Icon name="mic" size={28} strokeWidth={2.25} /></span>
              Speak
            </button>
          );
        }
        return (
          <button key={n.id} type="button" className="vx-navitem" aria-current={cur} onClick={() => go(n.id)}>
            <span className="vx-navitem__ic"><Icon name={n.icon} size={22} strokeWidth={cur ? 2.4 : 2} /></span>
            {n.label}
          </button>
        );
      })}
    </nav>
  );
}

export type SideId = 'home' | 'discover' | 'report' | 'profile';

const SIDE: { id: SideId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'discover', label: 'Discover', icon: 'compass' },
  { id: 'report', label: 'Weekly report', icon: 'chart-column' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

export interface SideNavProps {
  active?: SideId;
  value?: string;
  onChange?: (id: SideId) => void;
  collapsed?: boolean;
  units?: string;
  freeLeft?: number;
  onSpeak?: () => void;
  className?: string;
}

export function SideNav(p: SideNavProps): ReactElement {
  const [inner, setInner] = useState<string>(p.active || 'home');
  const act = p.value !== undefined ? p.value : inner;
  const rail = p.collapsed;
  return (
    <nav className={cx('vx-sidenav', rail && 'vx-sidenav--rail', p.className)} aria-label="Main">
      <img className="vx-sidenav__logo" src={rail ? ASSETS.mark : ASSETS.wordmark} alt="VOICES home" />
      {SIDE.map((n) => {
        const cur = n.id === act ? 'page' : undefined;
        return (
          <button
            key={n.id}
            type="button"
            className="vx-navitem"
            aria-current={cur}
            onClick={() => {
              setInner(n.id);
              if (p.onChange) p.onChange(n.id);
            }}
          >
            <span className="vx-navitem__ic"><Icon name={n.icon} size={22} strokeWidth={cur ? 2.4 : 2} /></span>
            {n.label}
          </button>
        );
      })}
      <Button className="vx-sidenav__speak" size="l" icon="mic" onClick={p.onSpeak} aria-label="Speak">Speak</Button>
      {!rail && p.units !== undefined ? (
        <div className="vx-sidenav__foot"><UnitsChip units={p.units} freeLeft={p.freeLeft} /></div>
      ) : null}
    </nav>
  );
}

export interface AppShellProps {
  layout?: 'phone' | 'tablet' | 'desktop';
  children?: ReactNode;
  rail?: ReactNode;
  active?: string;
  country?: string;
  units?: string;
  freeLeft?: number;
  className?: string;
}

export function AppShell(p: AppShellProps): ReactElement {
  const layout = p.layout || 'desktop';
  if (layout === 'phone') {
    return (
      <div className={cx('vx-shell', 'vx-shell--phone', p.className)}>
        <TopBar country={p.country} />
        <main className="vx-shell__main">{p.children}</main>
        <BottomNav active={(p.active as NavId) || 'home'} />
      </div>
    );
  }
  const bar = (
    <div className="vx-shell__deskbar">
      <SearchField placeholder="Search questions, voices and handles" style={{ flex: 1 }} />
      <button type="button" className="vx-country" aria-label="Country: Nigeria. Change country">
        <Icon name="globe" size={18} />
        {p.country || 'Nigeria'}
        <Icon name="chevron-down" size={16} />
      </button>
      <IconButton icon="bell" label="Notifications" dot />
    </div>
  );
  if (layout === 'tablet') {
    return (
      <div className={cx('vx-shell', 'vx-shell--tablet', p.className)}>
        <SideNav collapsed active={(p.active as SideId) || 'home'} />
        <main className="vx-shell__main">{bar}{p.children}{p.rail}</main>
      </div>
    );
  }
  return (
    <div className={cx('vx-shell', 'vx-shell--desktop', p.className)}>
      <SideNav active={(p.active as SideId) || 'home'} units={p.units === undefined ? '12.5' : p.units} freeLeft={p.freeLeft} />
      <main className="vx-shell__main">{bar}{p.children}</main>
      <aside className="vx-shell__rail" aria-label="This week">{p.rail}</aside>
    </div>
  );
}
