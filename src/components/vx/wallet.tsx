'use client';
import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { Button } from './actions';
import { cx, fmt } from './helpers';
import { Icon } from './Icon';
import { Badge } from './labels';
import { Tabs } from './navigation';
import { Sheet } from './overlays';

export interface UnitTier {
  id: string;
  name: string;
  price: number;
  units: number;
  bonus: number;
}

/* Reference tiers drawn in the design. The real ones come from the API (PRICES.md). */
export const TIERS: UnitTier[] = [
  { id: 'entry', name: 'Entry', price: 183, units: 183, bonus: 0 },
  { id: 'starter', name: 'Starter', price: 366, units: 366, bonus: 0 },
  { id: 'standard', name: 'Standard', price: 732, units: 732, bonus: 0 },
  { id: 'plus', name: 'Plus', price: 1464, units: 1464, bonus: 0 },
  { id: 'pro', name: 'Pro', price: 3660, units: 3660, bonus: 0 },
  { id: 'premium', name: 'Premium', price: 7320, units: 7320, bonus: 0 },
  { id: 'ultimate', name: 'Ultimate', price: 14640, units: 14640, bonus: 0 },
];

function naira(n: number): string {
  return '₦' + fmt(n);
}

/** One pack as drawn: every figure is a ready string, so the page decides the money format (kobo and milli-units never reach here). */
export interface PackOption {
  id: string;
  name: string;
  units: string;
  price: string;
  per?: string;
  bonus?: string;
}

export interface PackPickerProps {
  packs: PackOption[];
  selected: string;
  onSelect: (id: string) => void;
  className?: string;
  /** The Get tokens board: name, then the price large, then "183 tokens". Without it, the tokens are the large figure. */
  priceFirst?: boolean;
}

/** The radio group of token packs. Arrow keys move between them (the chosen one is the only tab stop). */
export function PackPicker(p: PackPickerProps): ReactElement {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = Math.max(0, p.packs.findIndex((x) => x.id === p.selected));
  function key(e: KeyboardEvent<HTMLButtonElement>) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (at + step + p.packs.length) % p.packs.length;
    p.onSelect(p.packs[n].id);
    refs.current[n]?.focus();
  }
  return (
    <div className={cx('vx-tiers', p.priceFirst && 'vx-tiers--price', p.className)} role="radiogroup" aria-label="Token packs">
      {p.packs.map((x, i) => {
        const on = x.id === p.selected;
        return (
          <button
            key={x.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on ? 'true' : 'false'}
            tabIndex={i === at ? 0 : -1}
            className="vx-tier"
            onClick={() => p.onSelect(x.id)}
            onKeyDown={key}
          >
            <span className="vx-tier__name">{x.name}</span>
            {p.priceFirst ? (
              <>
                <span className="vx-tier__price">{x.price}</span>
                <span className="vx-tier__units">{x.units + (x.units === '1' ? ' token' : ' tokens')}</span>
              </>
            ) : (
              <>
                <span className="vx-tier__units">{x.units}<small>tokens</small></span>
                <span className="vx-tier__price">{x.price}</span>
                <span className="vx-tier__per">{x.per}</span>
              </>
            )}
            {x.bonus ? <span className="vx-tier__bonus"><Badge tone="sun">{x.bonus}</Badge></span> : null}
            {on ? <span className="vx-tier__check" aria-hidden="true"><Icon name="check" size={14} strokeWidth={3.5} /></span> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface PayMethodOption {
  id: string;
  label: string;
}

export interface BuyUnitsSheetProps {
  /** The design's reference packs (naira and units as numbers). Leave out when you pass `packs`. */
  tiers?: UnitTier[];
  /** Ready-made packs from the real prices. */
  packs?: PackOption[];
  /** With `onSelect`, the chosen pack is this prop alone. */
  selected?: string;
  onSelect?: (id: string) => void;
  paywall?: boolean | ReactNode;
  balance?: string;
  offer?: string;
  /** Payment methods. Defaults to Card, Transfer and USSD; `method` and `onMethod` control the choice. */
  methods?: PayMethodOption[];
  method?: string;
  onMethod?: (id: string) => void;
  /** The pay button's words (with the price). Defaults to "Pay ₦X for N tokens" from `tiers`. */
  payLabel?: string;
  onPay?: (packId: string, method: string) => void;
  busy?: boolean;
  /** Something above the pack list, like an error banner. */
  notice?: ReactNode;
  variant?: 'sheet' | 'dialog';
  inline?: boolean;
  onClose?: () => void;
}

export function BuyUnitsSheet(p: BuyUnitsSheetProps): ReactElement {
  const tiers = p.tiers || TIERS;
  const packs: PackOption[] = p.packs || tiers.map((x) => ({
    id: x.id,
    name: x.name,
    units: fmt(x.units),
    price: naira(x.price),
    per: '₦' + (x.price / x.units).toFixed(2) + ' a token',
    bonus: x.bonus ? '+' + x.bonus + ' bonus' : undefined,
  }));
  const [innerSel, setSel] = useState(p.selected || 'standard');
  const [innerMethod, setMethod] = useState('card');
  const sel = p.onSelect ? p.selected || packs[0]?.id || '' : innerSel;
  const method = p.onMethod ? p.method || 'card' : innerMethod;
  const t = tiers.filter((x) => x.id === sel)[0] || tiers[0];
  const content = (
    <>
      {p.notice}
      {p.paywall ? (
        <div className="vx-paywall" role="status">
          <Icon name="triangle-alert" size={20} />
          <span>{p.paywall === true ? 'You have used your 10 free posts. Get tokens from ₦183. Your draft is saved and posts when your tokens arrive.' : p.paywall}</span>
        </div>
      ) : null}
      <PackPicker packs={packs} selected={sel} onSelect={(id) => (p.onSelect ? p.onSelect(id) : setSel(id))} />
      <div className="vx-field">
        <span className="vx-field__label">Pay with</span>
        <Tabs
          variant="segmented"
          block
          label="Payment method"
          value={method}
          onChange={(id) => (p.onMethod ? p.onMethod(id) : setMethod(id))}
          items={p.methods || [{ id: 'card', label: 'Card' }, { id: 'transfer', label: 'Transfer' }, { id: 'ussd', label: 'USSD' }]}
        />
      </div>
      {p.offer ? (
        <div className="vx-offer">
          <Badge tone="sponsored">Offer</Badge>
          <span>{p.offer}</span>
        </div>
      ) : null}
    </>
  );
  const foot = (
    <div className="vx-sheet__foot">
      <Button size="l" block icon="lock" loading={p.busy} onClick={() => p.onPay && p.onPay(sel, method)}>
        {p.payLabel || (t ? 'Pay ' + naira(t.price) + ' for ' + fmt(t.units) + ' tokens' : 'Pay')}
      </Button>
      <p className="vx-sheet__fine">You see the full price before you pay. Tokens cannot be cashed out or sent to others. Reading, listening, liking and sharing stay free.</p>
    </div>
  );
  return (
    <Sheet title="Get tokens" subtitle={p.balance ? 'Balance: ' + p.balance : undefined} variant={p.variant} inline={p.inline} footer={foot} onClose={p.onClose}>
      {content}
    </Sheet>
  );
}
BuyUnitsSheet.tiers = TIERS;
