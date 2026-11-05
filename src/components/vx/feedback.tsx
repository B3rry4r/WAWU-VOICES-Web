'use client';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Button, IconButton } from './actions';
import { cx } from './helpers';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface BannerProps {
  tone?: 'info' | 'offline' | 'warning' | 'danger' | 'success';
  title?: string;
  children?: ReactNode;
  icon?: IconName;
  action?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  onClose?: () => void;
  className?: string;
}

const BANNER_IC: Record<NonNullable<BannerProps['tone']>, IconName> = {
  info: 'info', offline: 'wifi-off', warning: 'triangle-alert', danger: 'circle-x', success: 'circle-check',
};

export function Banner(p: BannerProps): ReactElement {
  const tone = p.tone || 'info';
  return (
    <div className={cx('vx-banner', 'vx-banner--' + tone, p.className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={p.icon || BANNER_IC[tone]} size={22} className="vx-banner__ic" />
      <div className="vx-banner__txt">
        {p.title ? <b>{p.title}</b> : null}
        {p.children}
      </div>
      {p.action ? <Button variant="secondary" size="s" icon={p.actionIcon} onClick={p.onAction}>{p.action}</Button> : null}
      {p.onClose ? <IconButton icon="x" label="Dismiss" variant="ghost" size="s" onClick={p.onClose} /> : null}
    </div>
  );
}

export interface ToastProps {
  tone?: 'success' | 'info' | 'danger';
  icon?: IconName;
  children?: ReactNode;
  action?: string;
  onAction?: () => void;
  className?: string;
}

export function Toast(p: ToastProps): ReactElement {
  const tone = p.tone || 'success';
  const ic: IconName = p.icon || (tone === 'danger' ? 'circle-x' : tone === 'info' ? 'info' : 'check');
  return (
    <div className={cx('vx-toast', 'vx-toast--' + tone, p.className)} role="status" aria-live="polite">
      <span className="vx-toast__ic"><Icon name={ic} size={16} strokeWidth={3} /></span>
      <span className="vx-toast__msg">{p.children}</span>
      {p.action ? <button type="button" className="vx-toast__act" onClick={p.onAction}>{p.action}</button> : null}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  body?: string;
  action?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  className?: string;
}

export function EmptyState(p: EmptyStateProps): ReactElement {
  return (
    <div className={cx('vx-empty', p.className)}>
      <span className="vx-empty__art" aria-hidden="true"><Icon name={p.icon || 'mic'} size={40} strokeWidth={2} /></span>
      <h3 className="vx-empty__title">{p.title}</h3>
      {p.body ? <p className="vx-empty__body">{p.body}</p> : null}
      {p.action ? <Button icon={p.actionIcon} onClick={p.onAction}>{p.action}</Button> : null}
    </div>
  );
}

export interface SkeletonProps {
  variant?: 'answer' | 'tile' | 'line';
  width?: string | number;
}

export function Skeleton(p: SkeletonProps): ReactElement {
  const v = p.variant || 'answer';
  const label = <span className="vx-sr">Loading</span>;
  const bar = (w: CSSProperties['width'], h: number, extra?: CSSProperties) => <i style={{ width: w, height: h, ...extra }} />;
  if (v === 'tile') {
    return (
      <div className="vx-skel" aria-busy="true" style={{ minHeight: 156 }}>
        {label}
        {bar('40%', 12)}
        {bar('90%', 18)}
        {bar('70%', 18)}
        {bar('30%', 12, { marginTop: 'auto' })}
      </div>
    );
  }
  if (v === 'line') {
    return (
      <div aria-busy="true" className="vx-skel" style={{ background: 'none', boxShadow: 'none', padding: 0 }}>
        {label}
        {bar(p.width || '100%', 14)}
      </div>
    );
  }
  return (
    <div className="vx-skel" aria-busy="true">
      {label}
      <div className="vx-skel__row">
        <i className="c" style={{ width: 40, height: 40 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bar('38%', 14)}
          {bar('22%', 12)}
        </div>
      </div>
      <i className="p" style={{ width: '100%', height: 60 }} />
      {bar('85%', 14)}
      <div className="vx-skel__row">
        <i className="p" style={{ width: 64, height: 32 }} />
        <i className="p" style={{ width: 80, height: 32 }} />
        <i className="p" style={{ width: 56, height: 32 }} />
      </div>
    </div>
  );
}
