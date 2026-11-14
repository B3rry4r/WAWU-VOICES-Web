"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Icon, SponsoredSurvey, TextField, TopicChip } from "@/components/vx";
import { createSurvey, decideSurvey, listBrands, listSurveys, submitSurvey, updateSurvey } from "@/lib/api/admin-surveys";
import type { AdminBrand, AdminSurvey, SurveyQuestionInput, UpsertSurveyRequest } from "@/lib/api/admin-surveys";
import { getCategories } from "@/lib/api/feed";
import { useAdmin } from "./AdminFrame";
import { dayMonth } from "./time";
import { Card, CardTitle, ErrorLine, Gated, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, isSuspendedError, useAction } from "./ui";

const KIND_WORDS: Record<SurveyQuestionInput["kind"], string> = {
  SINGLE_CHOICE: "Pick one choice",
  TEXT: "Short written answer",
  VOICE: "Short voice answer",
};

function statusPill(s: AdminSurvey) {
  if (s.status === "AWAITING_APPROVAL") return <Pill tone="sun">Awaiting approval</Pill>;
  if (s.status === "APPROVED") return s.live ? <Pill tone="red" dot>Live</Pill> : <Pill tone="green">Approved</Pill>;
  if (s.status === "PAUSED") return <Pill>Paused</Pill>;
  if (s.status === "DRAFT") return s.changeRequest ? <Pill tone="blue">Changes asked</Pill> : <Pill>Draft</Pill>;
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Pill tone="red">Rejected</Pill>
      {s.rejectReason ? <span className="max-w-[28ch] break-words text-caption text-ink-2">{s.rejectReason}</span> : null}
    </div>
  );
}

function dates(s: AdminSurvey): string {
  if (!s.startsOn && !s.endsOn) return "-";
  const a = s.startsOn ? dayMonth(s.startsOn + "T12:00:00+01:00") : "";
  const b = s.endsOn ? dayMonth(s.endsOn + "T12:00:00+01:00") : "";
  return s.startsOn && s.endsOn ? `${a} to ${b}` : a || b;
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

function SurveysBody() {
  const { reloadToday } = useAdmin();
  const [items, setItems] = useState<AdminSurvey[] | null>(null);
  const [awaiting, setAwaiting] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await listSurveys();
      setItems(p.items);
      setAwaiting(p.awaitingApproval);
      setSelected((cur) => cur ?? (p.items.find((x) => x.status === "AWAITING_APPROVAL") ?? p.items[0])?.id ?? null);
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
    listBrands().then(
      (b) => setBrands(b.items),
      () => undefined,
    );
  }, [load]);

  const sv = items?.find((x) => x.id === selected) ?? null;

  function changed(s: AdminSurvey, word: string) {
    setItems((x) => (x ?? []).map((o) => (o.id === s.id ? s : o)));
    setSaved(word);
    reloadToday();
    void load();
  }
  const pick = (id: string) => {
    setSelected(id);
    setCreating(false);
    setEditing(false);
    setSaved(null);
  };

  return (
    <div>
      <PageHead
        eyebrow={`Ad manager · ${awaiting} awaiting approval`}
        title="Sponsored Surveys"
        sub="A brand pays for the questions. An admin enters them here. Members answer for free."
        right={error && isSuspendedError(error) ? undefined : (
          <Button icon="plus" onClick={() => { setCreating(true); setEditing(false); setSaved(null); }}>
            New survey
          </Button>
        )}
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
        <EmptyState icon="vote" title="No surveys yet" body="Surveys you add land here, then go for approval." action="New survey" actionIcon="plus" onAction={() => setCreating(true)} />
      ) : (
        <>
          {items.length ? (
            <div className="mb-5 overflow-hidden rounded-xl border border-line bg-surface">
              <table className="w-full border-collapse text-left text-caption">
                <thead>
                  <tr className="text-ink-2">
                    {["Brand", "Survey", "Questions", "Dates", "Seen · started · answered", "Status"].map((h) => (
                      <th key={h} className="vx-eyebrow whitespace-nowrap px-4 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} onClick={() => pick(s.id)} className={`cursor-pointer border-t border-line align-top ${selected === s.id && !creating ? "bg-mint" : "hover:bg-surface-2"}`}>
                      <td className="px-4 py-3 text-body-strong">
                        <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-body-strong text-ink" aria-label={`Open ${s.brandName}: ${s.title}`} aria-current={selected === s.id ? "true" : undefined}>{s.brandName}</button>
                      </td>
                      <td className="px-4 py-3">{s.title}</td>
                      <td className="px-4 py-3 tabular-nums">{s.questions.length}</td>
                      <td className="px-4 py-3">{dates(s)}</td>
                      <td className="px-4 py-3 tabular-nums">{s.live || s.views ? `${s.views.toLocaleString("en-NG")} · ${s.starts.toLocaleString("en-NG")} · ${s.responses.toLocaleString("en-NG")}` : "-"}</td>
                      <td className="px-4 py-3">{statusPill(s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {editing && sv && !creating ? (
            <SurveyForm key={sv.id} survey={sv} cats={cats} brands={brands} onClose={() => setEditing(false)} onSaved={(s) => { setEditing(false); changed(s, sv.status === "PAUSED" ? "Survey saved. If you changed its words, it waits for approval again." : "Survey saved."); }} />
          ) : creating ? (
            <SurveyForm cats={cats} brands={brands} onClose={() => setCreating(false)} onSaved={(s) => { setCreating(false); setSelected(s.id); setSaved("Survey saved as a draft. Send it for approval when it is ready."); reloadToday(); void load(); }} />
          ) : sv ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
              <Preview survey={sv} />
              <Review key={sv.id + sv.status} survey={sv} cats={cats} onDone={changed} onEdit={() => { setEditing(true); setSaved(null); }} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Preview({ survey }: { survey: AdminSurvey }) {
  return (
    <div>
      <div className="vx-eyebrow mb-2 text-ink-2">Preview, as people will see the card</div>
      <SponsoredSurvey brand={survey.brandName} question={survey.title} questions={survey.questions.length} minutes={Math.max(1, Math.ceil(survey.questions.length / 3))} href="#" />
      <div className="vx-eyebrow mb-2 mt-5 text-ink-2">Questions</div>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {survey.questions.map((q) => (
          <li key={q.id} className="rounded-l bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="text-caption text-ink-2">{`${q.position}. ${KIND_WORDS[q.kind]}`}</div>
            <div className="text-body-strong">{q.prompt}</div>
            {q.kind === "SINGLE_CHOICE" ? <ul className="m-0 mt-2 list-disc pl-5 text-body">{q.options.map((o) => <li key={o.id}>{o.label}</li>)}</ul> : null}
          </li>
        ))}
      </ol>
      <p className="m-0 mt-3 text-caption text-ink-2">Always labelled Sponsored Survey. Free for members. It never uses a free post. The brand sees combined results only.</p>
    </div>
  );
}

function Review({ survey, cats, onDone, onEdit }: { survey: AdminSurvey; cats: Record<string, string>; onDone: (s: AdminSurvey, word: string) => void; onEdit: () => void }) {
  const [reason, setReason] = useState("");
  const act = useAction();
  const waiting = survey.status === "AWAITING_APPROVAL";
  const needReason = reason.trim().length > 0;

  async function go(decision: "APPROVE" | "REJECT" | "ASK_FOR_CHANGES" | "PAUSE" | "RESUME", word: string) {
    const out = await act.run(() => decideSurvey(survey.id, { decision, ...(reason.trim() ? { reason: reason.trim() } : {}) }));
    if (out) onDone(out, word);
  }
  async function sendForApproval() {
    const out = await act.run(() => submitSurvey(survey.id));
    if (out) onDone(out, "Sent for approval. The brand contact has been emailed.");
  }
  const names = survey.categoryIds.map((id) => cats[id]).filter(Boolean).join(", ") || "Everyone";

  return (
    <Card>
      <CardTitle>Approval checks</CardTitle>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {survey.checks.map((c, i) => (
          <li key={i} className="flex items-start gap-3 text-body">
            <Icon name={c.ok ? "circle-check" : "triangle-alert"} size={22} className={`mt-0.5 flex-none ${c.ok ? "text-success" : "text-warning"}`} label={c.ok ? "Passed" : "Needs a look"} />
            {c.text}
          </li>
        ))}
      </ul>
      <dl className="m-0 mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-caption">
        <dt className="text-ink-2">Brand contact</dt>
        <dd className="m-0 break-words">{survey.contactEmail}</dd>
        <dt className="text-ink-2">Targeting</dt>
        <dd className="m-0">{[names, survey.states.length ? survey.states.join(", ") : "Nigeria"].join(" · ")}</dd>
        <dt className="text-ink-2">Most shown a day</dt>
        <dd className="m-0">{`${survey.frequencyCapPerDay} a day per person`}</dd>
        <dt className="text-ink-2">Answers wanted</dt>
        <dd className="m-0">{survey.responseTarget != null ? survey.responseTarget.toLocaleString("en-NG") : "No target"}</dd>
        <dt className="text-ink-2">Price</dt>
        <dd className="m-0">{survey.priceKobo != null ? naira(survey.priceKobo) : "From the admin price list"}</dd>
        <dt className="text-ink-2">So far</dt>
        <dd className="m-0 tabular-nums">{`${survey.views} seen, ${survey.starts} started, ${survey.skips} skipped, ${survey.responses} answered`}</dd>
      </dl>
      {survey.changeRequest ? <p className="m-0 mt-4 rounded-m bg-surface-2 p-3 text-caption">{`Changes asked: ${survey.changeRequest}`}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {survey.status === "DRAFT" || waiting || survey.status === "PAUSED" ? <Button variant="secondary" onClick={onEdit}>Edit survey</Button> : null}
        {survey.status === "APPROVED" || survey.status === "PAUSED" || survey.responses > 0 ? (
          <Link href={`/admin/surveys/${survey.id}/results`} className="vx-btn vx-btn--secondary no-underline">Results for the brand</Link>
        ) : null}
      </div>

      {survey.status === "DRAFT" ? (
        <div className="mt-4 flex flex-col gap-3">
          <ErrorLine>{act.error}</ErrorLine>
          <div>
            <Button icon="send" loading={act.busy} disabled={act.busy} onClick={sendForApproval}>Send for approval</Button>
          </div>
        </div>
      ) : waiting ? (
        <div className="mt-4 flex flex-col gap-4">
          <TextField label="Note to the brand" multiline value={reason} onChange={setReason} hint="Needed to ask for changes or reject. The brand sees it." />
          <ErrorLine>{act.error}</ErrorLine>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={!needReason || act.busy} onClick={() => go("ASK_FOR_CHANGES", "Sent back with your note.")}>Ask for changes</Button>
            <Button icon="check" loading={act.busy} disabled={act.busy} onClick={() => go("APPROVE", "Approved.")}>Approve</Button>
            <Button variant="ghost" disabled={!needReason || act.busy} onClick={() => go("REJECT", "Rejected. The brand sees your note.")}>Reject</Button>
          </div>
        </div>
      ) : survey.status === "APPROVED" || survey.status === "PAUSED" ? (
        <div className="mt-4 flex flex-col gap-3">
          <ErrorLine>{act.error}</ErrorLine>
          <div>
            {survey.status === "APPROVED" ? (
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

/** The question rows of the form, as the API takes them. */
export interface QDraft {
  kind: SurveyQuestionInput["kind"];
  prompt: string;
  options: string[];
}

export const blankQuestion = (): QDraft => ({ kind: "SINGLE_CHOICE", prompt: "", options: ["", ""] });

export function toQuestionInputs(qs: QDraft[]): SurveyQuestionInput[] {
  return qs.map((q) => ({
    kind: q.kind,
    prompt: q.prompt.trim(),
    ...(q.kind === "SINGLE_CHOICE" ? { options: q.options.map((o) => o.trim()).filter(Boolean) } : {}),
  }));
}

function questionDrafts(s?: AdminSurvey): QDraft[] {
  if (!s) return [blankQuestion()];
  return s.questions.map((q) => ({ kind: q.kind, prompt: q.prompt, options: q.kind === "SINGLE_CHOICE" ? q.options.map((o) => o.label) : [] }));
}

/** Is the form complete enough to send? (The API still does its own checks and its words are shown.) */
export function formReady(f: { brandName: string; contactEmail: string; title: string }, qs: QDraft[]): boolean {
  if (!f.brandName.trim() || !f.contactEmail.trim() || !f.title.trim()) return false;
  if (qs.length < 1 || qs.length > 5) return false;
  return qs.every((q) => q.prompt.trim() && (q.kind !== "SINGLE_CHOICE" || (q.options.map((o) => o.trim()).filter(Boolean).length >= 2 && q.options.length <= 6)));
}

/** The fields of `next` that differ from the saved survey. An edit sends only these, so a change of dates never counts as a change of words. */
export function changedFields(s: AdminSurvey, next: UpsertSurveyRequest): Partial<UpsertSurveyRequest> {
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const saved: Record<string, unknown> = {
    brandName: s.brandName,
    brandId: s.brandId,
    contactEmail: s.contactEmail,
    title: s.title,
    questions: toQuestionInputs(questionDrafts(s)),
    categoryIds: s.categoryIds ?? [],
    states: s.states ?? [],
    startsOn: s.startsOn,
    endsOn: s.endsOn,
    frequencyCapPerDay: s.frequencyCapPerDay,
    priceKobo: s.priceKobo,
    responseTarget: s.responseTarget,
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) if (!same(v, saved[k])) out[k] = v;
  return out as Partial<UpsertSurveyRequest>;
}

function SurveyForm({ survey, cats, brands, onClose, onSaved }: { survey?: AdminSurvey; cats: Record<string, string>; brands: AdminBrand[]; onClose: () => void; onSaved: (s: AdminSurvey) => void }) {
  const [f, setF] = useState({
    brandName: survey?.brandName ?? "",
    contactEmail: survey?.contactEmail ?? "",
    title: survey?.title ?? "",
    startsOn: survey?.startsOn ?? "",
    endsOn: survey?.endsOn ?? "",
    cap: String(survey?.frequencyCapPerDay ?? 1),
    price: survey?.priceKobo != null ? String(survey.priceKobo / 100) : "",
    target: survey?.responseTarget != null ? String(survey.responseTarget) : "",
  });
  const [brandId, setBrandId] = useState(survey?.brandId ?? "");
  const [qs, setQs] = useState<QDraft[]>(() => questionDrafts(survey));
  const [picked, setPicked] = useState<string[]>(survey?.categoryIds ?? []);
  const [states, setStates] = useState(survey?.states.join(", ") ?? "");
  const act = useAction();
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
  const setQ = (i: number, patch: Partial<QDraft>) => setQs((l) => l.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  async function save() {
    const body: UpsertSurveyRequest = {
      brandName: f.brandName.trim(),
      ...(brandId ? { brandId } : {}),
      contactEmail: f.contactEmail.trim(),
      title: f.title.trim(),
      questions: toQuestionInputs(qs),
      ...(picked.length ? { categoryIds: picked } : {}),
      ...(states.trim() ? { states: states.split(",").map((x) => x.trim()).filter(Boolean) } : {}),
      ...(f.startsOn ? { startsOn: f.startsOn } : {}),
      ...(f.endsOn ? { endsOn: f.endsOn } : {}),
      ...(f.cap ? { frequencyCapPerDay: Number(f.cap) } : {}),
      ...(f.price ? { priceKobo: Math.round(Number(f.price) * 100) } : {}),
      ...(f.target ? { responseTarget: Number(f.target) } : {}),
    };
    const diff = survey ? changedFields(survey, body) : null;
    if (survey && diff && Object.keys(diff).length === 0) {
      onClose();
      return;
    }
    const out = await act.run(() => (survey && diff ? updateSurvey(survey.id, diff) : createSurvey(body)));
    if (out) onSaved(out);
  }

  return (
    <Card>
      <CardTitle>{survey ? "Edit survey" : "New survey"}</CardTitle>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Brand name" value={f.brandName} onChange={set("brandName")} />
        <div className="vx-field">
          <label className="vx-field__label" htmlFor="sv-brand">Brand page (optional)</label>
          <div className="vx-field__box">
            <select
              id="sv-brand"
              className="vx-field__input"
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                const b = brands.find((x) => x.id === e.target.value);
                if (b && !f.brandName.trim()) set("brandName")(b.name);
              }}
            >
              <option value="">No brand page</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <TextField label="Brand contact email" type="email" inputMode="email" value={f.contactEmail} onChange={set("contactEmail")} hint="Status emails go here." />
        <TextField label="Title of the survey" value={f.title} onChange={set("title")} hint="Shown on the card in the feed." />
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <div className="text-count">{`Questions (${qs.length} of 5)`}</div>
        {qs.map((q, i) => (
          <fieldset key={i} className="m-0 flex flex-col gap-3 rounded-l border border-line p-4">
            <legend className="px-2 text-caption text-ink-2">{`Question ${i + 1}`}</legend>
            <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4">
              <div className="vx-field">
                <label className="vx-field__label" htmlFor={`sv-kind-${i}`}>Kind</label>
                <div className="vx-field__box">
                  <select id={`sv-kind-${i}`} className="vx-field__input" value={q.kind} onChange={(e) => { const kind = e.target.value as QDraft["kind"]; setQ(i, { kind, options: kind === "SINGLE_CHOICE" && q.options.length < 2 ? ["", ""] : q.options }); }}>
                    {(Object.keys(KIND_WORDS) as QDraft["kind"][]).map((k) => (
                      <option key={k} value={k}>{KIND_WORDS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <TextField label="The question" value={q.prompt} onChange={(v) => setQ(i, { prompt: v })} />
            </div>
            {q.kind === "SINGLE_CHOICE" ? (
              <div className="flex flex-col gap-2">
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-end gap-2">
                    <div className="min-w-0 flex-1"><TextField label={`Choice ${j + 1}`} value={o} onChange={(v) => setQ(i, { options: q.options.map((x, k) => (k === j ? v : x)) })} /></div>
                    {q.options.length > 2 ? <Button variant="ghost" icon="trash-2" aria-label={`Remove choice ${j + 1}`} onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== j) })} /> : null}
                  </div>
                ))}
                {q.options.length < 6 ? (
                  <div><Button variant="secondary" size="s" icon="plus" onClick={() => setQ(i, { options: [...q.options, ""] })}>Add a choice</Button></div>
                ) : <span className="text-caption text-ink-2">Six choices is the most.</span>}
              </div>
            ) : null}
            {qs.length > 1 ? (
              <div><Button variant="ghost" size="s" icon="trash-2" onClick={() => setQs((l) => l.filter((_, j) => j !== i))}>{`Remove question ${i + 1}`}</Button></div>
            ) : null}
          </fieldset>
        ))}
        {qs.length < 5 ? (
          <div><Button variant="secondary" icon="plus" onClick={() => setQs((l) => [...l, blankQuestion()])}>Add a question</Button></div>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <TextField label="States (comma separated, empty for all)" value={states} onChange={setStates} placeholder="Lagos, Ogun" />
        <TextField label="Most times a day per person" inputMode="numeric" value={f.cap} onChange={set("cap")} />
        <TextField label="Starts" type="date" value={f.startsOn} onChange={set("startsOn")} />
        <TextField label="Ends" type="date" value={f.endsOn} onChange={set("endsOn")} />
        <TextField label="Price in naira (flat fee)" inputMode="numeric" value={f.price} onChange={set("price")} hint="Leave empty to use the admin price list." />
        <TextField label="Answers wanted" inputMode="numeric" value={f.target} onChange={set("target")} hint="It stops showing at this number. Empty for no limit." />
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
          <Button icon="check" loading={act.busy} disabled={!formReady(f, qs) || act.busy} onClick={save}>Save survey</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}

export function AdminSurveysPage() {
  return (
    <Gated page="surveys">
      <SurveysBody />
    </Gated>
  );
}
