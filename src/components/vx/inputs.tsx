'use client';
import { useId, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cx } from './helpers';
import { Icon } from './Icon';

export interface TextFieldProps {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  prefix?: string;
  prefixIcon?: string;
  /** Your own control in the prefix place (the phone field's country button). Replaces `prefix`. */
  prefixSlot?: ReactNode;
  type?: string;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  autoComplete?: string;
  multiline?: boolean;
  maxLength?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function TextField(p: TextFieldProps): ReactElement {
  const auto = useId();
  const id = p.id || 'vx-f' + auto;
  const [inner, setInner] = useState(p.defaultValue || '');
  const val = p.value !== undefined ? p.value : inner;
  const hintId = id + '-h';
  const common = {
    id,
    className: 'vx-field__input',
    inputMode: p.inputMode,
    autoComplete: p.autoComplete,
    placeholder: p.placeholder,
    value: val,
    disabled: p.disabled,
    maxLength: p.maxLength,
    'aria-invalid': p.error ? ('true' as const) : undefined,
    'aria-describedby': p.hint || p.error || p.maxLength ? hintId : undefined,
  };
  function change(v: string) {
    setInner(v);
    if (p.onChange) p.onChange(v);
  }
  return (
    <div className={cx('vx-field', p.error && 'is-error', p.disabled && 'is-disabled', p.className)}>
      <label className="vx-field__label" htmlFor={id}>{p.label}</label>
      <div className="vx-field__box">
        {p.prefixSlot ? (
          <span className="vx-field__prefix vx-field__prefix--slot">{p.prefixSlot}</span>
        ) : p.prefix ? (
          <span className="vx-field__prefix">
            {p.prefixIcon ? <span aria-hidden="true">{p.prefixIcon}</span> : null}
            {p.prefix}
          </span>
        ) : null}
        {p.multiline ? (
          <textarea {...common} onChange={(e) => change(e.target.value)} />
        ) : (
          <input {...common} type={p.type || 'text'} onChange={(e) => change(e.target.value)} />
        )}
      </div>
      {p.hint || p.error || p.maxLength ? (
        <div className="vx-field__hint" id={hintId}>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'flex-start' }}>
            {p.error ? <Icon name="circle-x" size={16} style={{ marginTop: 1 }} /> : null}
            {p.error || p.hint || ''}
          </span>
          {p.maxLength ? <span className="vx-num">{String(val).length + ' / ' + p.maxLength}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export interface SearchFieldProps {
  placeholder?: string;
  label?: string;
  defaultValue?: string;
  shortcut?: string;
  style?: CSSProperties;
  className?: string;
}

export function SearchField(p: SearchFieldProps): ReactElement {
  return (
    <label className={cx('vx-search', p.className)} style={p.style}>
      <Icon name="search" size={20} />
      <span className="vx-sr">{p.label || 'Search'}</span>
      <input className="vx-search__input" type="search" placeholder={p.placeholder || 'Search'} defaultValue={p.defaultValue} />
      {p.shortcut ? <kbd>{p.shortcut}</kbd> : null}
    </label>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The name a screen reader hears, when no visible label wraps the switch. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/** An on or off switch (a checkbox with role "switch"). Controlled: `checked` is the truth, `onChange` hears the tap. */
export function Switch(p: SwitchProps): ReactElement {
  return (
    <input
      type="checkbox"
      role="switch"
      className={cx('vx-switch', p.className)}
      checked={p.checked}
      disabled={p.disabled}
      aria-label={p.label}
      onChange={(e) => p.onChange(e.target.checked)}
    />
  );
}
