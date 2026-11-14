'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { countryByCode, searchCountries } from '@/lib/phone/countries';
import { Icon } from './Icon';
import { TextField } from './inputs';

export interface CountryPickerProps {
  /** ISO code of the country shown as chosen. */
  selected: string;
  onPick: (code: string) => void;
  onClose: () => void;
  /** A tap outside: closes without taking focus back. Defaults to onClose. */
  onOutside?: () => void;
  /** Names the search box for a screen reader. */
  label?: string;
}

/** The searchable list of countries: flag, name and dial code, Nigeria first. Search by name, ISO code or dial code. */
export function CountryPicker(p: CountryPickerProps): ReactElement {
  const [q, setQ] = useState('');
  const rows = useMemo(() => searchCountries(q), [q]);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const { onClose } = p;
  const onOutside = p.onOutside ?? onClose;
  useEffect(() => {
    ref.current?.querySelector('input')?.focus();
    ref.current?.scrollIntoView?.({ block: 'nearest' });
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [onOutside]);
  return (
    <div
      ref={ref}
      className="vx-dial__list"
      onKeyDown={(e) => {
        const rowsEls = Array.from(ref.current?.querySelectorAll<HTMLElement>('.vx-dial__row') ?? []);
        const at = rowsEls.indexOf(document.activeElement as HTMLElement);
        const go = (i: number) => {
          e.preventDefault();
          rowsEls[Math.max(0, Math.min(rowsEls.length - 1, i))]?.focus();
        };
        if (e.key === 'ArrowDown') go(at + 1);
        else if (e.key === 'ArrowUp') {
          if (at <= 0) {
            e.preventDefault();
            ref.current?.querySelector('input')?.focus();
          } else go(at - 1);
        } else if (e.key === 'Home' && at >= 0) go(0);
        else if (e.key === 'End' && at >= 0) go(rowsEls.length - 1);
        else if (e.key === 'Enter' && at < 0 && rowsEls.length > 0) {
          // Enter in the search box picks the first country listed.
          e.preventDefault();
          rowsEls[0].click();
        }
        if (e.key === 'Escape') {
          // Closes this list only, not the sheet around the field.
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          onClose();
        }
      }}
    >
      <label className="vx-dial__search">
        <Icon name="search" size={18} />
        <span className="vx-sr">{p.label || 'Search countries or codes'}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries or codes" autoComplete="off" aria-controls={listId} />
      </label>
      {rows.length === 0 ? (
        <p className="vx-dial__none" role="status">Nothing matches. Check the spelling, or search by code.</p>
      ) : (
        <ul className="vx-dial__rows" id={listId} aria-label="Countries">
          {rows.map((c) => (
            <li key={c.code}>
              <button type="button" aria-current={c.code === p.selected ? 'true' : undefined} aria-label={`${c.name} +${c.dial}`} className="vx-dial__row" data-country={c.code} onClick={() => p.onPick(c.code)}>
                <span className="vx-dial__flag" aria-hidden="true">{c.flag}</span>
                <span className="vx-dial__name">{c.name}</span>
                <span className="vx-dial__code">+{c.dial}</span>
                {c.code === p.selected ? <Icon name="check" size={18} /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface PhoneFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** ISO code of the country dialled from (Nigeria by default). */
  country: string;
  onCountry: (code: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  autoComplete?: string;
  /** False hides the country button (a field that holds an email until a number is typed). Default true. */
  showCountry?: boolean;
  /** The field also takes an email (sign in): plain text keyboard, no phone type. */
  mixed?: boolean;
  id?: string;
  className?: string;
}

const EXAMPLE: Record<string, string> = { NG: '803 214 7720', GH: '24 123 4567', GB: '7400 123456', US: '201 555 0123', KE: '712 345678', ZA: '82 123 4567' };

/** A phone field: the chosen country's flag and dial code as the prefix, a button that opens the list, and the number. */
export function PhoneField(p: PhoneFieldProps): ReactElement {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const c = countryByCode(p.country);
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) setTimeout(() => btn.current?.focus(), 0);
  };
  const slot =
    p.showCountry === false ? undefined : (
      <span className="vx-dial">
        <button
          ref={btn}
          type="button"
          className="vx-dial__btn"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={`Country code, ${c.name} +${c.dial}. Change`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="vx-dial__flag" aria-hidden="true">{c.flag}</span>
          <span>+{c.dial}</span>
          <Icon name="chevron-down" size={16} />
        </button>
        {open ? (
          <CountryPicker
            selected={c.code}
            onClose={() => close()}
            onOutside={() => close(false)}
            onPick={(code) => {
              p.onCountry(code);
              close();
            }}
          />
        ) : null}
      </span>
    );
  return (
    <TextField
      id={p.id}
      className={p.className}
      label={p.label}
      type={p.mixed ? 'text' : 'tel'}
      inputMode={p.mixed ? 'text' : 'tel'}
      autoComplete={p.autoComplete ?? 'tel-national'}
      value={p.value}
      onChange={p.onChange}
      placeholder={p.placeholder ?? (p.mixed ? undefined : (EXAMPLE[c.code] ?? 'Phone number'))}
      hint={p.hint}
      error={p.error}
      prefixSlot={slot}
    />
  );
}
