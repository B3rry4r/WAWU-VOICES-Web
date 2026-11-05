'use client';
import type { CSSProperties, ReactElement } from 'react';
import {
  ArrowLeft, ArrowUp, BadgeCheck, Bell, Bookmark, Captions, ChartColumn, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleCheck, CircleDashed, CircleX, ClipboardList, Clock, Coins, Compass, Copy, Ellipsis, Eye, FileDown, Flag, Globe,
  Headphones, Heart, House, Info, Lightbulb, Link, Lock, MapPin, Megaphone, MessageCircle, MessageSquare, MessagesSquare,
  Mic, MicOff, Minus, Moon, Pause, Play, Plus, Radio, RefreshCw, RotateCcw, Search, Send, Settings, Share2, ShieldAlert,
  ShieldCheck, SmilePlus, Square, Sun, Trash2, TrendingUp, TriangleAlert, User, UserCheck, Volume2, Vote, Wallet, WifiOff, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './helpers';

const ICONS = {
  house: House, compass: Compass, mic: Mic, user: User, bell: Bell, globe: Globe, search: Search, play: Play, pause: Pause,
  heart: Heart, 'smile-plus': SmilePlus, 'message-circle': MessageCircle, 'share-2': Share2, flag: Flag, ellipsis: Ellipsis,
  x: X, check: Check, 'chevron-right': ChevronRight, 'chevron-left': ChevronLeft, 'chevron-down': ChevronDown,
  'arrow-left': ArrowLeft, 'arrow-up': ArrowUp, 'rotate-ccw': RotateCcw, 'trash-2': Trash2, square: Square,
  'shield-check': ShieldCheck, 'shield-alert': ShieldAlert, 'messages-square': MessagesSquare, 'badge-check': BadgeCheck,
  'circle-dashed': CircleDashed, 'wifi-off': WifiOff, 'triangle-alert': TriangleAlert, info: Info, 'circle-check': CircleCheck,
  'circle-x': CircleX, coins: Coins, wallet: Wallet, 'chart-column': ChartColumn, 'user-check': UserCheck, plus: Plus,
  minus: Minus, clock: Clock, lock: Lock, settings: Settings, copy: Copy, link: Link, megaphone: Megaphone,
  'clipboard-list': ClipboardList, 'trending-up': TrendingUp, radio: Radio, eye: Eye, headphones: Headphones,
  lightbulb: Lightbulb, vote: Vote, 'message-square': MessageSquare, 'map-pin': MapPin, send: Send, captions: Captions,
  'refresh-cw': RefreshCw, 'volume-2': Volume2, bookmark: Bookmark, 'file-down': FileDown, 'mic-off': MicOff, sun: Sun, moon: Moon,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  fill?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function Icon(p: IconProps): ReactElement | null {
  const Cmp = ICONS[p.name];
  if (!Cmp) return null;
  return (
    <Cmp
      className={cx('vx-icon', p.className)}
      size={p.size || 22}
      strokeWidth={p.strokeWidth || 2}
      fill={p.fill ? 'currentColor' : 'none'}
      focusable="false"
      aria-hidden={p.label ? undefined : 'true'}
      role={p.label ? 'img' : undefined}
      aria-label={p.label}
      style={p.style}
    />
  );
}
Icon.names = Object.keys(ICONS) as IconName[];
