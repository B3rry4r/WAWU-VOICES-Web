'use client';
import type { MouseEventHandler, ReactElement, ReactNode } from 'react';
import { cx, domProps } from './helpers';
import type { DomExtras } from './helpers';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface ButtonProps extends DomExtras {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'dark' | 'onforest';
  size?: 's' | 'm' | 'l';
  icon?: IconName;
  iconEnd?: IconName;
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  type?: 'button' | 'submit';
  onClick?: MouseEventHandler;
  className?: string;
}

export function Button(p: ButtonProps): ReactElement {
  const v = p.variant || 'primary';
  const s = p.size || 'm';
  const props = domProps(p);
  props.className = cx('vx-btn', 'vx-btn--' + v, s !== 'm' && 'vx-btn--' + s, p.block && 'vx-btn--block', p.loading && 'is-loading', p.className);
  if (!p.href) {
    props.type = p.type || 'button';
    props.disabled = !!(p.disabled || p.loading);
  }
  if (p.loading) props['aria-busy'] = 'true';
  const icSize = s === 's' ? 18 : 22;
  const kids = (
    <>
      {p.loading ? <span className="vx-spin" aria-hidden="true" /> : p.icon ? <Icon name={p.icon} size={icSize} /> : null}
      <span className="vx-btn__label">{p.children}</span>
      {p.iconEnd ? <Icon name={p.iconEnd} size={18} /> : null}
    </>
  );
  return p.href ? <a {...props}>{kids}</a> : <button {...props}>{kids}</button>;
}

export interface IconButtonProps extends DomExtras {
  icon: IconName;
  label: string;
  variant?: 'ghost' | 'solid' | 'dark';
  size?: 's' | 'm';
  dot?: boolean;
  count?: number;
  pressed?: boolean;
  iconSize?: number;
  onClick?: MouseEventHandler;
  className?: string;
}

export function IconButton(p: IconButtonProps): ReactElement {
  const props = domProps(p);
  props.type = 'button';
  props.className = cx('vx-iconbtn', p.variant && 'vx-iconbtn--' + p.variant, p.size === 's' && 'vx-iconbtn--s', p.className);
  props['aria-label'] = p.label + (p.count ? ', ' + p.count + ' new' : p.dot ? ', new' : '');
  if (p.pressed !== undefined) props['aria-pressed'] = p.pressed ? 'true' : 'false';
  return (
    <button {...props}>
      <Icon name={p.icon} size={p.iconSize || 22} />
      {p.count ? (
        <span className="vx-iconbtn__count" aria-hidden="true">{p.count > 99 ? '99+' : p.count}</span>
      ) : p.dot ? (
        <span className="vx-iconbtn__dot" aria-hidden="true" />
      ) : null}
    </button>
  );
}
