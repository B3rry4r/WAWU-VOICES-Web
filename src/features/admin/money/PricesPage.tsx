"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Switch, TextField } from "@/components/vx";
import { listConfig, listConfigChanges, rollbackConfig, updateConfig } from "@/lib/api/admin";
import type { ConfigChange, ConfigEntry } from "@/lib/api/admin";
import { slot } from "../time";
import { Card, CardTitle, ErrorLine, Eyebrow, Gated, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, useAction } from "../ui";
import { koboFromNaira, milliFromTokens, naira, tokens } from "./format";
import { ConfirmPanel, TableFrame, Td, Th } from "./parts";
import { GROUPS, MONEY_KEYS, PACKS_KEY, PLANS_KEY, describe, fromInput, labelOf, show, toInput, unitHint } from "./prices-model";
import type { Def, Pack, Plan } from "./prices-model";

type Editing = { kind: "setting"; key: string } | { kind: "packs" } | { kind: "plans" } | null;

const REASON_MIN = 3;
const reasonOk = (r: string) => r.trim().length >= REASON_MIN;
const REASON_HINT = "Required. It goes in the change log with your name, the time, the old value and the new one.";

/** One number: type it in the unit people think in, give a reason, review, confirm. */
function SettingEditor({ def, entry, onSave, onCancel, busy, error }: { def: Def; entry: ConfigEntry; onSave: (value: number, reason: string) => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const [text, setText] = useState(toInput(def.unit, entry.value));
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const next = fromInput(def.unit, text);
  const bad = text.trim() !== "" && next === null ? unitHint[def.unit] : undefined;
  const same = next !== null && next === entry.value;
  const ready = next !== null && !same && reasonOk(reason);
  return (
    <div className="mt-3 flex max-w-[560px] flex-col gap-4 rounded-xl border border-line-strong bg-surface-2 p-5">
      <TextField label={def.label} value={text} onChange={(v) => { setText(v); setReview(false); }} inputMode="decimal" error={bad} hint={bad ? undefined : unitHint[def.unit]} />
      <TextField label="Reason" multiline value={reason} onChange={(v) => { setReason(v); setReview(false); }} maxLength={500} hint={REASON_HINT} />
      {review && ready ? (
        <ConfirmPanel title={`Change "${def.label}"?`} confirmLabel="Change it" busy={busy} onConfirm={() => onSave(next!, reason.trim())} onCancel={() => setReview(false)}>
          <p className="m-0">{`From ${show(def.unit, entry.value, def.noun)} to ${show(def.unit, next, def.noun)}. It applies to the next checkout or message, with no new release. Anything already started keeps its own amounts.`}</p>
          <div className="mt-3">
            <ErrorLine>{error}</ErrorLine>
          </div>
        </ConfirmPanel>
      ) : (
        <div className="flex items-center gap-3">
          <Button disabled={!ready} onClick={() => setReview(true)}>
            Review the change
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function PacksEditor({ entry, onSave, onCancel, busy, error }: { entry: ConfigEntry; onSave: (value: Pack[], reason: string) => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const packs = entry.value as Pack[];
  const [rows, setRows] = useState(() => packs.map((p) => ({ price: String(p.priceKobo / 100), units: String(p.unitsMilli / 1000), bonus: String(p.bonusMilli / 1000) })));
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const parsed = rows.map((r) => ({ price: koboFromNaira(r.price), units: milliFromTokens(r.units), bonus: milliFromTokens(r.bonus) }));
  const valid = parsed.every((r) => r.price !== null && r.units !== null && r.bonus !== null);
  const value: Pack[] | null = valid ? packs.map((p, i) => ({ ...p, priceKobo: parsed[i].price!, unitsMilli: parsed[i].units!, bonusMilli: parsed[i].bonus! })) : null;
  const changed = value ? value.filter((p, i) => p.priceKobo !== packs[i].priceKobo || p.unitsMilli !== packs[i].unitsMilli || p.bonusMilli !== packs[i].bonusMilli) : [];
  const ready = !!value && changed.length > 0 && reasonOk(reason);
  const set = (i: number, k: "price" | "units" | "bonus", v: string) => { setRows((x) => x.map((r, j) => (j === i ? { ...r, [k]: v } : r))); setReview(false); };
  return (
    <div className="mt-3 flex flex-col gap-4 rounded-xl border border-line-strong bg-surface-2 p-5">
      <div className="grid grid-cols-[120px_1fr_1fr_1fr] items-end gap-3">
        <Eyebrow>Pack</Eyebrow>
        <Eyebrow>Price in naira</Eyebrow>
        <Eyebrow>Tokens</Eyebrow>
        <Eyebrow>Bonus tokens</Eyebrow>
        {packs.map((p, i) => (
          <div key={p.slug} className="contents">
            <div className="pb-4 text-body-strong">{p.name}</div>
            <TextField label={`${p.name} price`} value={rows[i].price} onChange={(v) => set(i, "price", v)} inputMode="decimal" error={koboFromNaira(rows[i].price) === null ? "Use naira, like 183" : undefined} />
            <TextField label={`${p.name} tokens`} value={rows[i].units} onChange={(v) => set(i, "units", v)} inputMode="decimal" error={milliFromTokens(rows[i].units) === null ? "Use tokens" : undefined} />
            <TextField label={`${p.name} bonus`} value={rows[i].bonus} onChange={(v) => set(i, "bonus", v)} inputMode="decimal" error={milliFromTokens(rows[i].bonus) === null ? "Use tokens" : undefined} />
          </div>
        ))}
      </div>
      <div className="max-w-[560px]">
        <TextField label="Reason" multiline value={reason} onChange={(v) => { setReason(v); setReview(false); }} maxLength={500} hint={REASON_HINT} />
      </div>
      {review && ready ? (
        <ConfirmPanel title="Change these packs?" confirmLabel="Change them" busy={busy} onConfirm={() => onSave(value!, reason.trim())} onCancel={() => setReview(false)}>
          <ul className="m-0 list-none p-0">
            {changed.map((p) => {
              const was = packs.find((x) => x.slug === p.slug)!;
              return <li key={p.slug}>{`${p.name}: ${naira(was.priceKobo)} for ${tokens(was.unitsMilli)} tokens, to ${naira(p.priceKobo)} for ${tokens(p.unitsMilli)} tokens`}</li>;
            })}
          </ul>
          <p className="m-0 mt-2">A payment already started keeps the price and tokens it began with.</p>
          <div className="mt-3">
            <ErrorLine>{error}</ErrorLine>
          </div>
        </ConfirmPanel>
      ) : (
        <div className="flex items-center gap-3">
          <Button disabled={!ready} onClick={() => setReview(true)}>
            Review the change
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function PlansEditor({ entry, onSave, onCancel, busy, error }: { entry: ConfigEntry; onSave: (value: Plan[], reason: string) => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const plans = entry.value as Plan[];
  const [rows, setRows] = useState(() => plans.map((p) => ({ name: p.name, price: String(p.priceKobo / 100), active: p.active })));
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const prices = rows.map((r) => koboFromNaira(r.price));
  const valid = prices.every((x) => x !== null && x >= 100 && x % 100 === 0) && rows.every((r) => r.name.trim().length > 0);
  const value: Plan[] | null = valid ? plans.map((p, i) => ({ ...p, name: rows[i].name.trim(), priceKobo: prices[i]!, active: rows[i].active })) : null;
  const changed = value ? value.filter((p, i) => p.name !== plans[i].name || p.priceKobo !== plans[i].priceKobo || p.active !== plans[i].active) : [];
  const ready = !!value && changed.length > 0 && reasonOk(reason);
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => { setRows((x) => x.map((r, j) => (j === i ? { ...r, ...patch } : r))); setReview(false); };
  return (
    <div className="mt-3 flex flex-col gap-4 rounded-xl border border-line-strong bg-surface-2 p-5">
      <p className="m-0 text-caption text-ink-2">A plan keeps its months and the tokens it gives each month, because people have already been shown them. Switch a plan off to stop selling it.</p>
      <div className="grid grid-cols-[1fr_1fr_160px] items-start gap-3">
        <Eyebrow>Name</Eyebrow>
        <Eyebrow>Price in naira (whole naira)</Eyebrow>
        <Eyebrow>On sale</Eyebrow>
        {plans.map((p, i) => (
          <div key={p.slug} className="contents">
            <TextField label={`${p.slug} name`} value={rows[i].name} onChange={(v) => set(i, { name: v })} maxLength={40} hint={`${p.months} months, ${tokens(p.monthlyMilli)} tokens a month`} />
            <TextField label={`${p.slug} price`} value={rows[i].price} onChange={(v) => set(i, { price: v })} inputMode="decimal" error={prices[i] === null || prices[i]! < 100 || prices[i]! % 100 !== 0 ? "Whole naira, like 2999" : undefined} />
            <Switch checked={rows[i].active} onChange={(v) => set(i, { active: v })} label={rows[i].active ? "On sale" : "Off"} />
          </div>
        ))}
      </div>
      <div className="max-w-[560px]">
        <TextField label="Reason" multiline value={reason} onChange={(v) => { setReason(v); setReview(false); }} maxLength={500} hint={REASON_HINT} />
      </div>
      {review && ready ? (
        <ConfirmPanel title="Change these plans?" confirmLabel="Change them" busy={busy} onConfirm={() => onSave(value!, reason.trim())} onCancel={() => setReview(false)}>
          <ul className="m-0 list-none p-0">
            {changed.map((p) => {
              const was = plans.find((x) => x.slug === p.slug)!;
              return <li key={p.slug}>{`${p.name}: ${naira(was.priceKobo)}${was.active ? "" : " (off)"}, to ${naira(p.priceKobo)}${p.active ? "" : " (off)"}`}</li>;
            })}
          </ul>
          <p className="m-0 mt-2">A plan already bought keeps the price, months and tokens it was bought with.</p>
          <div className="mt-3">
            <ErrorLine>{error}</ErrorLine>
          </div>
        </ConfirmPanel>
      ) : (
        <div className="flex items-center gap-3">
          <Button disabled={!ready} onClick={() => setReview(true)}>
            Review the change
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function PutBack({ change, onConfirm, onCancel, busy, error }: { change: ConfigChange; onConfirm: (reason: string) => void; onCancel: () => void; busy: boolean; error: string | null }) {
  const [reason, setReason] = useState("");
  return (
    <div className="max-w-[640px]">
      <ConfirmPanel title={`Put "${labelOf(change.key)}" back?`} confirmLabel="Put it back" busy={busy} onConfirm={() => reasonOk(reason) && onConfirm(reason.trim())} onCancel={onCancel}>
        <p className="m-0">{`From ${describe(change.key, change.newValue)} back to ${describe(change.key, change.oldValue)}. This is written to the change log as a new line.`}</p>
        <div className="mt-3 max-w-[520px]">
          <TextField label="Reason" multiline value={reason} onChange={setReason} maxLength={500} hint={reasonOk(reason) ? REASON_HINT : `${REASON_HINT} At least ${REASON_MIN} characters.`} />
        </div>
        <div className="mt-3">
          <ErrorLine>{error}</ErrorLine>
        </div>
      </ConfirmPanel>
    </div>
  );
}

function PricesBody() {
  const [entries, setEntries] = useState<Record<string, ConfigEntry> | null>(null);
  const [changes, setChanges] = useState<ConfigChange[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [back, setBack] = useState<ConfigChange | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const act = useAction();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [c, l] = await Promise.all([listConfig(), listConfigChanges({ limit: 50 })]);
      setEntries(Object.fromEntries(c.items.map((e) => [e.key, e])));
      setChanges(l.items);
      setNext(l.nextCursor ?? null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!next) return;
    setMore(true);
    try {
      const l = await listConfigChanges({ limit: 50, cursor: next });
      setChanges((x) => [...x, ...l.items]);
      setNext(l.nextCursor ?? null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setMore(false);
    }
  }

  // The newest line of each setting is the one that can be put back.
  const latest = useMemo(() => {
    const m = new Map<string, ConfigChange>();
    for (const c of changes) if (!m.has(c.key)) m.set(c.key, c);
    return m;
  }, [changes]);
  const log = useMemo(() => changes.filter((c) => MONEY_KEYS.has(c.key)), [changes]);

  async function save(key: string, value: unknown, reason: string) {
    const out = await act.run(() => updateConfig(key, value, reason));
    if (!out) return;
    setEditing(null);
    setSaved(`${labelOf(key)} changed. It applies to the next checkout or message, with no new release.`);
    await load();
  }
  async function putBack(c: ConfigChange, reason: string) {
    const out = await act.run(() => rollbackConfig(c.id, reason));
    if (!out) return;
    setBack(null);
    setSaved(`${labelOf(c.key)} put back to ${describe(c.key, c.oldValue)}.`);
    await load();
  }

  const open = (e: Editing) => { setEditing(e); setBack(null); setSaved(null); act.clear(); };
  const openBack = (c: ConfigChange) => { setBack(c); setEditing(null); setSaved(null); act.clear(); };

  if (error) return <LoadFailed error={error} retry={load} />;
  if (!entries) return <ListSkeleton rows={5} />;

  const putBackButton = (key: string) => {
    const c = latest.get(key);
    return c ? (
      <Button size="s" variant="secondary" icon="rotate-ccw" onClick={() => openBack(c)}>
        Put back
      </Button>
    ) : null;
  };

  return (
    <div className="flex flex-col gap-5">
      {saved ? <SavedLine>{saved}</SavedLine> : null}
      {back ? <PutBack change={back} onConfirm={(r) => void putBack(back, r)} onCancel={() => { setBack(null); act.clear(); }} busy={act.busy} error={act.error} /> : null}

      {GROUPS.map((g) => (
        <Card key={g.id}>
          <CardTitle>{g.title}</CardTitle>
          {g.note ? <p className="m-0 mb-2 text-caption text-ink-2">{g.note}</p> : null}
          <ul className="m-0 list-none p-0">
            {g.defs.map((d) => {
              const e = entries[d.key];
              if (!e) return null;
              const isEditing = editing?.kind === "setting" && editing.key === d.key;
              return (
                <li key={d.key} className="border-t border-line py-4 first:border-t-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-body-strong text-ink">{d.label}</div>
                      <div className="text-caption text-ink-2">{d.help}</div>
                      {e.version > 1 && e.updatedBy ? <div className="text-caption text-ink-2">{`Last changed by ${e.updatedBy}, ${slot(e.updatedAt)}`}</div> : null}
                    </div>
                    <div className="flex flex-none items-center gap-3">
                      {e.placeholder ? <Pill tone="sun">Owner to confirm</Pill> : null}
                      <span className="font-display text-num-m text-ink">{show(d.unit, e.value, d.noun)}</span>
                      <Button size="s" variant="secondary" icon="settings" onClick={() => open({ kind: "setting", key: d.key })}>
                        Change
                      </Button>
                      {putBackButton(d.key)}
                    </div>
                  </div>
                  {isEditing ? <SettingEditor def={d} entry={e} busy={act.busy} error={act.error} onCancel={() => { setEditing(null); act.clear(); }} onSave={(v, r) => void save(d.key, v, r)} /> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {entries[PACKS_KEY] ? (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <CardTitle>Token packs</CardTitle>
            <div className="flex items-center gap-3">
              <Button size="s" variant="secondary" icon="settings" onClick={() => open({ kind: "packs" })}>
                Change
              </Button>
              {putBackButton(PACKS_KEY)}
            </div>
          </div>
          <TableFrame label="Token packs">
            <thead>
              <tr className="text-ink-2">
                <Th>Pack</Th>
                <Th right>Price</Th>
                <Th right>Tokens</Th>
                <Th right>Bonus</Th>
              </tr>
            </thead>
            <tbody>
              {(entries[PACKS_KEY].value as Pack[]).map((p) => (
                <tr key={p.slug} className="border-t border-line">
                  <Td>{p.name}</Td>
                  <Td right>{naira(p.priceKobo)}</Td>
                  <Td right>{tokens(p.unitsMilli)}</Td>
                  <Td right>{tokens(p.bonusMilli)}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          {editing?.kind === "packs" ? <PacksEditor entry={entries[PACKS_KEY]} busy={act.busy} error={act.error} onCancel={() => { setEditing(null); act.clear(); }} onSave={(v, r) => void save(PACKS_KEY, v, r)} /> : null}
        </Card>
      ) : null}

      {entries[PLANS_KEY] ? (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <CardTitle>Subscription plans</CardTitle>
            <div className="flex items-center gap-3">
              <Button size="s" variant="secondary" icon="settings" onClick={() => open({ kind: "plans" })}>
                Change
              </Button>
              {putBackButton(PLANS_KEY)}
            </div>
          </div>
          <TableFrame label="Subscription plans">
            <thead>
              <tr className="text-ink-2">
                <Th>Plan</Th>
                <Th right>Months</Th>
                <Th right>Tokens a month</Th>
                <Th right>Price</Th>
                <Th>On sale</Th>
              </tr>
            </thead>
            <tbody>
              {(entries[PLANS_KEY].value as Plan[]).map((p) => (
                <tr key={p.slug} className="border-t border-line">
                  <Td>{p.name}</Td>
                  <Td right>{p.months}</Td>
                  <Td right>{tokens(p.monthlyMilli)}</Td>
                  <Td right>{naira(p.priceKobo)}</Td>
                  <Td>{p.active ? "Yes" : "Off"}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          {editing?.kind === "plans" ? <PlansEditor entry={entries[PLANS_KEY]} busy={act.busy} error={act.error} onCancel={() => { setEditing(null); act.clear(); }} onSave={(v, r) => void save(PLANS_KEY, v, r)} /> : null}
        </Card>
      ) : null}

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-5">
          <CardTitle>Change log</CardTitle>
          <p className="m-0 mb-2 text-caption text-ink-2">Every change to a price or a limit, newest first. Put back restores the value before the newest change of that setting.</p>
        </div>
        {log.length === 0 ? (
          <p className="m-0 px-6 pb-5 text-body text-ink-2">Nothing has been changed yet.</p>
        ) : (
          <TableFrame label="Change log">
            <thead>
              <tr className="text-ink-2">
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Setting</Th>
                <Th>Before</Th>
                <Th>After</Th>
                <Th>Reason</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {log.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <Td className="whitespace-nowrap">{slot(c.createdAt)}</Td>
                  <Td>{c.by}</Td>
                  <Td>
                    {labelOf(c.key)}
                    {c.rollbackOfId ? <div className="text-ink-2">Put back</div> : null}
                  </Td>
                  <Td className="max-w-[220px] break-words">{describe(c.key, c.oldValue)}</Td>
                  <Td className="max-w-[220px] break-words">{describe(c.key, c.newValue)}</Td>
                  <Td className="max-w-[240px] break-words">{c.reason}</Td>
                  <Td>{latest.get(c.key)?.id === c.id ? putBackButton(c.key) : null}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
        {next ? (
          <div className="p-4">
            <Button variant="secondary" loading={more} onClick={() => void loadMore()}>
              Show more
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function AdminPricesPage() {
  return (
    <Gated page="money-prices">
      <div>
        <PageHead eyebrow="Admin only" title="Prices and limits" sub="A change applies at once, with no new release. It is logged, and any change can be put back." />
        <PricesBody />
      </div>
    </Gated>
  );
}
