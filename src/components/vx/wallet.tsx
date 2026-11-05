'use client';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from './actions';
import { fmt } from './helpers';
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
  { id: 'spark', name: 'Spark', price: 138, units: 10, bonus: 0 },
  { id: 'chat', name: 'Chat', price: 345, units: 26, bonus: 1 },
  { id: 'buzz', name: 'Buzz', price: 690, units: 55, bonus: 5 },
  { id: 'loud', name: 'Loud', price: 1380, units: 115, bonus: 15 },
  { id: 'mega', name: 'Mega', price: 3450, units: 310, bonus: 60 },
  { id: 'boss', name: 'Boss', price: 6900, units: 650, bonus: 150 },
];

function naira(n: number): string {
  return '₦' + fmt(n);
}

export interface BuyUnitsSheetProps {
  tiers?: UnitTier[];
  selected?: string;
  paywall?: boolean;
  balance?: string;
  offer?: string;
  variant?: 'sheet' | 'dialog';
  inline?: boolean;
  onClose?: () => void;
}

export function BuyUnitsSheet(p: BuyUnitsSheetProps): ReactElement {
  const tiers = p.tiers || TIERS;
  const [sel, setSel] = useState(p.selected || 'buzz');
  const [method, setMethod] = useState('card');
  const t = tiers.filter((x) => x.id === sel)[0] || tiers[0];
  const content = (
    <>
      {p.paywall ? (
        <div className="vx-paywall" role="status">
          <Icon name="triangle-alert" size={20} />
          <span>You have used your 10 free posts. Get Voice Units from ₦138. Your draft is saved and posts when your units arrive.</span>
        </div>
      ) : null}
      <div className="vx-tiers" role="radiogroup" aria-label="Unit packs">
        {tiers.map((x) => {
          const on = x.id === sel;
          return (
            <button key={x.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="vx-tier" onClick={() => setSel(x.id)}>
              <span className="vx-tier__name">{x.name}</span>
              <span className="vx-tier__units">{fmt(x.units)}<small>units</small></span>
              <span className="vx-tier__price">{naira(x.price)}</span>
              <span className="vx-tier__per">{'₦' + (x.price / x.units).toFixed(2) + ' a unit'}</span>
              {x.bonus ? <span className="vx-tier__bonus"><Badge tone="sun">{'+' + x.bonus + ' bonus'}</Badge></span> : null}
              {on ? <span className="vx-tier__check" aria-hidden="true"><Icon name="check" size={14} strokeWidth={3.5} /></span> : null}
            </button>
          );
        })}
      </div>
      <div className="vx-field">
        <span className="vx-field__label">Pay with</span>
        <Tabs variant="segmented" block label="Payment method" value={method} onChange={setMethod} items={[{ id: 'card', label: 'Card' }, { id: 'transfer', label: 'Transfer' }, { id: 'ussd', label: 'USSD' }]} />
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
      <Button size="l" block icon="lock">{'Pay ' + naira(t.price) + ' for ' + fmt(t.units) + ' units'}</Button>
      <p className="vx-sheet__fine">You see the full price before you pay. Units cannot be cashed out or sent to others. Reading, listening, liking and sharing stay free.</p>
    </div>
  );
  return (
    <Sheet title="Get Voice Units" subtitle={p.balance ? 'Balance: ' + p.balance : undefined} variant={p.variant} inline={p.inline} footer={foot} onClose={p.onClose}>
      {content}
    </Sheet>
  );
}
BuyUnitsSheet.tiers = TIERS;
