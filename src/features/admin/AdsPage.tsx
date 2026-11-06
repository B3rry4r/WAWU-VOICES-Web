"use client";

import { useCallback, useEffect, useState } from "react";
import { AdSlot, Button, EmptyState, Icon, TextField, TopicChip } from "@/components/vx";
import { createAd, decideAd, listAds } from "@/lib/api/admin";
import type { AdminAd, UpsertAdRequest } from "@/lib/api/admin";
import { getCategories } from "@/lib/api/feed";
import { useAdmin } from "./AdminFrame";
import { dayMonth } from "./time";
import { Card, CardTitle, ErrorLine, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, useAction, Gated } from "./ui";

const KIND_WORDS: Record<AdminAd["kind"], string> = {
  FEED_CARD: "Ad · feed card",
  BANNER: "Ad · banner",
  AUDIO_SLOT: "Ad · audio slot in the feed",
  WALLET_OFFER: "Voice Units offer · buy-units sheet",
};
const KIND_VARIANT: Record<AdminAd["kind"], "card" | "audio" | "banner"> = { FEED_CARD: "card", BANNER: "banner", AUDIO_SLOT: "audio", WALLET_OFFER: "banner" };

function statusPill(a: AdminAd) {
  if (a.status === "AWAITING_APPROVAL") return <Pill tone="sun">Awaiting approval</Pill>;
  if (a.status === "APPROVED") return a.live ? <Pill tone="red" dot>Live</Pill> : <Pill tone="green">Approved</Pill>;
  if (a.status === "PAUSED") return <Pill>Paused</Pill>;
  if (a.status === "DRAFT") return <Pill tone="blue">Changes asked</Pill>;
  return <Pill tone="red">{a.rejectReason ? `Rejected: ${a.rejectReason}` : "Rejected"}</Pill>;
}

function dates(a: AdminAd): string {
  if (!a.startsOn && !a.endsOn) return "-";
  const s = a.startsOn ? dayMonth(a.startsOn + "T12:00:00+01:00") : "";
  const e = a.endsOn ? dayMonth(a.endsOn + "T12:00:00+01:00") : "";
  return a.startsOn && a.endsOn ? `${s} to ${e}` : s || e;
}

function AdsBody() {
  const { reloadToday } = useAdmin();
  const [items, setItems] = useState<AdminAd[] | null>(null);
  const [awaiting, setAwaiting] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await listAds();
      setItems(p.items);
      setAwaiting(p.awaitingApproval);
      setSelected((cur) => cur ?? (p.items.find((a) => a.status === "AWAITING_APPROVAL") ?? p.items[0])?.id ?? null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void load();
    getCategories().then(
      (c) => setCats(Object.fromEntries(c.items.map((x) => [x.id, x.name]))),
      () => undefined,
    );
  }, [load]);


  const ad = items?.find((a) => a.id === selected) ?? null;
  const audience = (a: AdminAd) => [a.categoryIds.map((id) => cats[id]).filter(Boolean).join(", ") || "Everyone", a.states.length ? a.states.join(", ") : "Nigeria"].join(" · ");

  function changed(a: AdminAd, word: string) {
    setItems((x) => (x ?? []).map((o) => (o.id === a.id ? a : o)));
    setSaved(word);
    reloadToday();
    void load();
  }

  return (
    <div>
      <PageHead
        eyebrow={`Ad manager · ${awaiting} awaiting approval`}
        title="Adverts"
        right={
          <Button icon="plus" onClick={() => { setCreating(true); setSaved(null); }}>
            New advert
          </Button>
        }
      />
      {saved ? (
        <div className="mb-4">
          <SavedLine>{saved}</SavedLine>
        </div>
      ) : null}
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 && !creating ? (
        <EmptyState icon="megaphone" title="No adverts yet" body="Brands' adverts land here for approval. You can also add one yourself." action="New advert" actionIcon="plus" onAction={() => setCreating(true)} />
      ) : (
        <>
          {items.length ? (
            <div className="mb-5 overflow-hidden rounded-xl border border-line bg-surface">
              <table className="w-full border-collapse text-left text-caption">
                <thead>
                  <tr className="text-ink-2">
                    {["Brand", "Type and placement", "Audience", "Dates", "Views · taps · listens", "Status"].map((h) => (
                      <th key={h} className="vx-eyebrow px-4 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => { setSelected(a.id); setCreating(false); setSaved(null); }}
                      className={`cursor-pointer border-t border-line align-top ${selected === a.id && !creating ? "bg-mint" : "hover:bg-surface-2"}`}
                    >
                      <td className="px-4 py-3 text-body-strong">
                        <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-body-strong text-ink" aria-label={`Open ${a.brand}`} aria-current={selected === a.id ? "true" : undefined}>{a.brand}</button>
                      </td>
                      <td className="px-4 py-3">{KIND_WORDS[a.kind]}</td>
                      <td className="px-4 py-3">{audience(a)}</td>
                      <td className="px-4 py-3">{dates(a)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.live || a.views ? `${a.views.toLocaleString("en-NG")} · ${a.taps.toLocaleString("en-NG")} · ${a.listens ? a.listens.toLocaleString("en-NG") : "-"}` : "-"}</td>
                      <td className="px-4 py-3">{statusPill(a)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {creating ? (
            <NewAd cats={cats} onClose={() => setCreating(false)} onCreated={(a) => { setCreating(false); setSelected(a.id); setSaved("Advert saved. It now waits for approval."); reloadToday(); void load(); }} />
          ) : ad ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
              <Preview ad={ad} />
              <Review key={ad.id + ad.status} ad={ad} cats={cats} onDone={changed} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Preview({ ad }: { ad: AdminAd }) {
  return (
    <div>
      <div className="vx-eyebrow mb-2 text-ink-2">Preview, as people will see it</div>
      <AdSlot variant={ad.kind === "AUDIO_SLOT" && !ad.audioClipId ? "card" : KIND_VARIANT[ad.kind]} brand={ad.brand} headline={ad.headline} body={ad.body ?? undefined} cta={ad.ctaLabel ?? "Visit page"} href={ad.linkUrl ?? "#"} />
      <p className="m-0 mt-3 text-caption text-ink-2">Always labelled Ad. Plays only when tapped. Never inside a post, never in the first three items, never beside a sensitive topic.</p>
    </div>
  );
}

function Review({ ad, cats, onDone }: { ad: AdminAd; cats: Record<string, string>; onDone: (a: AdminAd, word: string) => void }) {
  const [reason, setReason] = useState("");
  const act = useAction();
  const waiting = ad.status === "AWAITING_APPROVAL";
  const needReason = reason.trim().length > 0;

  async function go(decision: "APPROVE" | "REJECT" | "ASK_FOR_CHANGES" | "PAUSE" | "RESUME", word: string) {
    const out = await act.run(() => decideAd(ad.id, { decision, ...(reason.trim() ? { reason: reason.trim() } : {}) }));
    if (out) onDone(out, word);
  }
  const names = ad.categoryIds.map((id) => cats[id]).filter(Boolean).join(", ") || "Everyone";

  return (
    <Card>
      <CardTitle>Approval checks</CardTitle>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {ad.checks.map((c, i) => (
          <li key={i} className="flex items-start gap-3 text-body">
            <Icon name={c.ok ? "circle-check" : "triangle-alert"} size={22} className={`mt-0.5 flex-none ${c.ok ? "text-success" : "text-warning"}`} label={c.ok ? "Passed" : "Needs a look"} />
            {c.text}
          </li>
        ))}
      </ul>
      <dl className="m-0 mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-caption">
        <dt className="text-ink-2">Targeting</dt>
        <dd className="m-0">{[names, ad.states.length ? ad.states.join(", ") : "Nigeria", ad.ageBands.length ? `${ad.ageBands.join(", ")} (consented age bands only)` : "consented age bands only"].join(" · ")}</dd>
        <dt className="text-ink-2">Kept away from</dt>
        <dd className="m-0">Politics, religion, health, sexual life</dd>
        <dt className="text-ink-2">Frequency cap</dt>
        <dd className="m-0">{`${ad.frequencyCapPerDay} a day per person`}</dd>
        <dt className="text-ink-2">Pricing</dt>
        <dd className="m-0">{ad.priceKobo != null ? `₦${(ad.priceKobo / 100).toLocaleString("en-NG")}` : "From the admin price list"}</dd>
      </dl>
      {ad.changeRequest ? <p className="m-0 mt-4 rounded-m bg-surface-2 p-3 text-caption">{`Changes asked: ${ad.changeRequest}`}</p> : null}

      {waiting ? (
        <div className="mt-4 flex flex-col gap-4">
          <TextField label="Note to the brand" multiline value={reason} onChange={setReason} hint="Needed to ask for changes or reject. The brand sees it." />
          <ErrorLine>{act.error}</ErrorLine>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={!needReason || act.busy} onClick={() => go("ASK_FOR_CHANGES", "Sent back with your note.")}>Ask for changes</Button>
            <Button icon="check" loading={act.busy} disabled={act.busy} onClick={() => go("APPROVE", "Approved.")}>Approve</Button>
            <Button variant="ghost" disabled={!needReason || act.busy} onClick={() => go("REJECT", "Rejected. The brand sees your note.")}>Reject</Button>
          </div>
        </div>
      ) : ad.status === "APPROVED" || ad.status === "PAUSED" ? (
        <div className="mt-4 flex flex-col gap-3">
          <ErrorLine>{act.error}</ErrorLine>
          <div>
            {ad.status === "APPROVED" ? (
              <Button variant="secondary" icon="pause" loading={act.busy} onClick={() => go("PAUSE", "Paused.")}>Pause</Button>
            ) : (
              <Button icon="play" loading={act.busy} onClick={() => go("RESUME", "Running again.")}>Resume</Button>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function NewAd({ cats, onClose, onCreated }: { cats: Record<string, string>; onClose: () => void; onCreated: (a: AdminAd) => void }) {
  const [f, setF] = useState({ brand: "", headline: "", body: "", linkUrl: "", ctaLabel: "", startsOn: "", endsOn: "", cap: "3", price: "" });
  const [kind, setKind] = useState<AdminAd["kind"]>("FEED_CARD");
  const [picked, setPicked] = useState<string[]>([]);
  const [states, setStates] = useState("");
  const act = useAction();
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function save() {
    const body: UpsertAdRequest = {
      brand: f.brand.trim(),
      kind,
      headline: f.headline.trim(),
      ...(f.body.trim() ? { body: f.body.trim() } : {}),
      ...(f.linkUrl.trim() ? { linkUrl: f.linkUrl.trim() } : {}),
      ...(f.ctaLabel.trim() ? { ctaLabel: f.ctaLabel.trim() } : {}),
      ...(picked.length ? { categoryIds: picked } : {}),
      ...(states.trim() ? { states: states.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
      ...(f.startsOn ? { startsOn: f.startsOn } : {}),
      ...(f.endsOn ? { endsOn: f.endsOn } : {}),
      ...(f.cap ? { frequencyCapPerDay: Number(f.cap) } : {}),
      ...(f.price ? { priceKobo: Math.round(Number(f.price) * 100) } : {}),
    };
    const out = await act.run(() => createAd(body));
    if (out) onCreated(out);
  }

  return (
    <Card>
      <CardTitle>New advert</CardTitle>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Brand" value={f.brand} onChange={set("brand")} />
        <div className="vx-field">
          <label className="vx-field__label" htmlFor="ad-kind">Where it shows</label>
          <div className="vx-field__box">
            <select id="ad-kind" className="vx-field__input" value={kind} onChange={(e) => setKind(e.target.value as AdminAd["kind"])}>
              {(Object.keys(KIND_WORDS) as AdminAd["kind"][]).map((k) => (
                <option key={k} value={k}>{KIND_WORDS[k]}</option>
              ))}
            </select>
          </div>
        </div>
        <TextField label="Headline" value={f.headline} onChange={set("headline")} />
        <TextField label="Button label" value={f.ctaLabel} onChange={set("ctaLabel")} placeholder="Visit page" />
        <TextField label="Body (optional)" multiline value={f.body} onChange={set("body")} className="col-span-2" />
        <TextField label="Link" value={f.linkUrl} onChange={set("linkUrl")} placeholder="https://" inputMode="url" hint="A working link, starting with https://." />
        <TextField label="States (comma separated, empty for all)" value={states} onChange={setStates} placeholder="Lagos, Ogun" />
        <TextField label="Starts" type="date" value={f.startsOn} onChange={set("startsOn")} />
        <TextField label="Ends" type="date" value={f.endsOn} onChange={set("endsOn")} />
        <TextField label="Most times a day per person" inputMode="numeric" value={f.cap} onChange={set("cap")} />
        <TextField label="Price in naira (flat fee)" inputMode="numeric" value={f.price} onChange={set("price")} hint="Leave empty to use the admin price list." />
      </div>
      <div className="mt-4">
        <div className="mb-2 text-count">Topics it can show beside</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(cats).map(([id, name]) => (
            <TopicChip key={id} label={name} selected={picked.includes(id)} onClick={() => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} />
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <ErrorLine>{act.error}</ErrorLine>
        <div className="flex gap-3">
          <Button icon="check" loading={act.busy} disabled={!f.brand.trim() || !f.headline.trim() || act.busy} onClick={save}>Save advert</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}

export function AdminAdsPage() {
  return (
    <Gated page="ads">
      <AdsBody />
    </Gated>
  );
}
