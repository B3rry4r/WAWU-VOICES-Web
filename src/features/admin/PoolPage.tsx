"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, TextField, TopicChip } from "@/components/vx";
import { addPoolQuestions, listQuestionPool, schedulePoolQuestion, updateQuestion } from "@/lib/api/admin";
import type { AdminQuestion, AdminQuestionPool } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { listCategories } from "@/lib/api/profile";
import { FLASH_HOURS, startFlashNow } from "./flash";
import { dayStringWeekday } from "./time";
import { Card, ErrorLine, Eyebrow, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, useAction, Gated } from "./ui";

/** The most lines the API takes in one go (V-42). */
const MAX_LINES = 50;

type Kind = "DAILY" | "FLASH";
type Category = { id: string; name: string };

const kindWord = (k: string) => (k === "FLASH" ? "Flash" : "Daily");

/** The question the API names when a day is taken (409 DAY_TAKEN, details.question). */
function takenBy(e: unknown): { id: string; text: string } | null {
  if (!(e instanceof ApiError) || e.status !== 409 || e.code !== "DAY_TAKEN") return null;
  const q = (e.details as { question?: { id?: unknown; text?: unknown } } | undefined)?.question;
  return q && typeof q.id === "string" && typeof q.text === "string" ? { id: q.id, text: q.text } : null;
}

function CategorySelect({ id, label, value, onChange, categories, allowNone }: { id: string; label: string; value: string; onChange: (v: string) => void; categories: Category[]; allowNone: boolean }) {
  return (
    <div className="vx-field">
      <label className="vx-field__label" htmlFor={id}>{label}</label>
      <div className="vx-field__box">
        <select id={id} className="vx-field__input" value={value} onChange={(e) => onChange(e.target.value)}>
          {allowNone ? <option value="">No category</option> : null}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PoolBody() {
  const [page, setPage] = useState<AdminQuestionPool | null>(null);
  const [items, setItems] = useState<AdminQuestion[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setError(null);
    try {
      const p = await listQuestionPool({ limit: 50 });
      if (my !== seq.current) return;
      setPage(p);
      setItems(p.items);
    } catch (e) {
      if (my === seq.current) setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let live = true;
    // Category names are a convenience: without them a row just shows no category.
    listCategories().then(
      (r) => live && setCategories(r.items.map((c) => ({ id: c.id, name: c.name }))),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  async function more() {
    if (!page?.nextCursor) return;
    const p = await listQuestionPool({ limit: 50, cursor: page.nextCursor });
    setPage(p);
    setItems((x) => [...x, ...p.items]);
  }
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const changed = (msg: string) => {
    setSaved(msg);
    void load();
  };

  return (
    <div>
      <PageHead
        eyebrow={page ? `${page.total} ${page.total === 1 ? "question" : "questions"} waiting` : "Question pool"}
        title="Question pool"
        sub="Questions with no week and no day yet. Nothing here is public until it is put on a day and that day opens."
      />
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-5">
        <AddBox categories={categories} onAdded={changed} />
        <div className="flex min-w-0 flex-col gap-3">
          {saved ? <SavedLine>{saved}</SavedLine> : null}
          {error ? (
            <LoadFailed error={error} retry={load} />
          ) : page === null ? (
            <ListSkeleton />
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {items.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon="lightbulb" title="The pool is empty" body="Paste questions into the box, one per line, and they wait here until you put them on a day." />
                </div>
              ) : (
                <ul className="m-0 list-none p-0" aria-label="Questions in the pool">
                  {items.map((q) => (
                    <PoolRow key={q.id} q={q} categories={categories} categoryName={q.categoryId ? names.get(q.categoryId) ?? null : null} onChanged={changed} />
                  ))}
                </ul>
              )}
              {page.nextCursor ? (
                <div className="border-t border-line p-3 text-center">
                  <Button variant="ghost" onClick={more}>Show more questions</Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** K4: the box for many questions, one per line. Lines the API refuses stay in the box under their line number. */
function AddBox({ categories, onAdded }: { categories: Category[]; onAdded: (msg: string) => void }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("DAILY");
  const [categoryId, setCategoryId] = useState("");
  const [refused, setRefused] = useState<{ line: number; text: string; error: string }[]>([]);
  const act = useAction();
  const lines = text.split(/\r?\n/);
  const filled = lines.filter((l) => l.trim().length > 0).length;
  const tooMany = filled > MAX_LINES;

  async function add() {
    setRefused([]);
    const r = await act.run(() => addPoolQuestions({ kind, ...(categoryId ? { categoryId } : {}), lines }));
    if (!r) return;
    const bad = r.items.filter((i) => i.error);
    // What was added leaves the box; what was refused stays, so it can be fixed and sent again.
    setText(bad.map((i) => i.text).join("\n"));
    setRefused(bad.map((i) => ({ line: i.line, text: i.text, error: i.error ?? "" })));
    if (r.created > 0) onAdded(`${r.created} ${r.created === 1 ? "question" : "questions"} added to the pool.`);
  }

  return (
    <Card>
      <h2 className="m-0 mb-1 font-display text-display-m">Add questions</h2>
      <p className="m-0 mb-4 text-caption text-ink-2">{`One question per line, up to ${MAX_LINES} at a time.`}</p>
      <div className="flex flex-col gap-4">
        <div className="[&_textarea]:min-h-[220px]">
          <TextField label="Questions" multiline value={text} onChange={setText} placeholder={"What would make your street safer?\nWhat should the next government fix first?"} />
        </div>
        <div>
          <Eyebrow className="mb-2">Kind</Eyebrow>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of question">
            <TopicChip label="Daily" selected={kind === "DAILY"} onClick={() => setKind("DAILY")} />
            <TopicChip label="Flash" selected={kind === "FLASH"} onClick={() => setKind("FLASH")} />
          </div>
        </div>
        <CategorySelect id="pool-category" label="Category (optional)" value={categoryId} onChange={setCategoryId} categories={categories} allowNone />
        <div className="text-caption text-ink-2" aria-live="polite">
          {tooMany ? `That is ${filled} lines. Add ${MAX_LINES} or fewer.` : `${filled} ${filled === 1 ? "question" : "questions"} ready to add`}
        </div>
        {refused.length ? (
          <div role="alert" className="flex flex-col gap-1 rounded-m bg-danger-bg px-3 py-2 text-count text-danger">
            <div>{`${refused.length} ${refused.length === 1 ? "line was" : "lines were"} not added. They are still in the box.`}</div>
            <ul className="m-0 list-none p-0">
              {refused.map((r) => (
                <li key={r.line}>{`Line ${r.line}: ${r.error}`}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ErrorLine>{act.error}</ErrorLine>
        <div>
          <Button icon="plus" loading={act.busy} disabled={filled === 0 || tooMany || act.busy} onClick={() => void add()}>Add to the pool</Button>
        </div>
      </div>
    </Card>
  );
}

type Mode = "view" | "edit" | "day" | "remove" | "flash";

function PoolRow({ q, categories, categoryName, onChanged }: { q: AdminQuestion; categories: Category[]; categoryName: string | null; onChanged: (msg: string) => void }) {
  const [mode, setMode] = useState<Mode>("view");
  const flash = q.kind === "FLASH";
  const close = () => setMode("view");
  return (
    <li className="border-t border-line px-4 py-3 first:border-t-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="text-body text-ink">{q.text}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone={flash ? "sun" : "neutral"}>{kindWord(q.kind)}</Pill>
            {categoryName ? <span className="text-caption text-ink-2">{categoryName}</span> : null}
          </div>
        </div>
        {mode === "view" ? (
          <div className="flex flex-wrap justify-end gap-2">
            {flash ? (
              <Button size="s" onClick={() => setMode("flash")}>Start now</Button>
            ) : (
              <Button size="s" onClick={() => setMode("day")}>Put on a day</Button>
            )}
            <Button size="s" variant="secondary" aria-label={`Edit question: ${q.text}`} onClick={() => setMode("edit")}>Edit</Button>
            <Button size="s" variant="ghost" aria-label={`Remove question: ${q.text}`} onClick={() => setMode("remove")}>Remove</Button>
          </div>
        ) : null}
      </div>
      {mode === "edit" ? <EditPanel q={q} categories={categories} onClose={close} onSaved={() => { close(); onChanged("Question saved."); }} /> : null}
      {mode === "day" ? <DayPanel q={q} onClose={close} onDone={(msg) => { close(); onChanged(msg); }} /> : null}
      {mode === "remove" ? <RemovePanel q={q} onClose={close} onDone={() => { close(); onChanged("Question removed from the pool."); }} /> : null}
      {mode === "flash" ? <FlashPanel q={q} onClose={close} onDone={() => { close(); onChanged("Flash poll started."); }} /> : null}
    </li>
  );
}

const panel = "mt-3 flex flex-col gap-3 rounded-l bg-surface-2 p-4";

function EditPanel({ q, categories, onClose, onSaved }: { q: AdminQuestion; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(q.text);
  const [kind, setKind] = useState<Kind>(q.kind === "FLASH" ? "FLASH" : "DAILY");
  const [categoryId, setCategoryId] = useState(q.categoryId ?? "");
  const act = useAction();
  async function save() {
    const ok = await act.run(async () => {
      await updateQuestion(q.id, { kind, text: text.trim(), ...(categoryId && categoryId !== q.categoryId ? { categoryId } : {}) });
      return true;
    });
    if (ok) onSaved();
  }
  return (
    <div className={panel} role="group" aria-label="Edit question">
      <TextField label="Question" multiline value={text} onChange={setText} maxLength={400} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of question">
        <TopicChip label="Daily" selected={kind === "DAILY"} onClick={() => setKind("DAILY")} />
        <TopicChip label="Flash" selected={kind === "FLASH"} onClick={() => setKind("FLASH")} />
      </div>
      {/* The API can change a category but not clear one, so "No category" is offered only while there is none. */}
      <CategorySelect id={`edit-cat-${q.id}`} label="Category" value={categoryId} onChange={setCategoryId} categories={categories} allowNone={!q.categoryId} />
      <ErrorLine>{act.error}</ErrorLine>
      <div className="flex gap-2">
        <Button size="s" loading={act.busy} disabled={text.trim().length < 3 || act.busy} onClick={() => void save()}>Save</Button>
        <Button size="s" variant="secondary" disabled={act.busy} onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

function RemovePanel({ q, onClose, onDone }: { q: AdminQuestion; onClose: () => void; onDone: () => void }) {
  const act = useAction();
  async function remove() {
    const ok = await act.run(async () => {
      await updateQuestion(q.id, { kind: q.kind, text: q.text, status: "CLOSED" });
      return true;
    });
    if (ok) onDone();
  }
  return (
    <div className={panel} role="group" aria-label="Remove question">
      <p className="m-0 text-body">Remove this question from the pool? It will not be asked.</p>
      <ErrorLine>{act.error}</ErrorLine>
      <div className="flex gap-2">
        <Button size="s" loading={act.busy} disabled={act.busy} onClick={() => void remove()}>Remove</Button>
        <Button size="s" variant="secondary" disabled={act.busy} onClick={onClose}>Keep it</Button>
      </div>
    </div>
  );
}

/** K4: the date picker. A free day takes the question at once; a taken day asks first, because the question there goes back to the pool. */
function DayPanel({ q, onClose, onDone }: { q: AdminQuestion; onClose: () => void; onDone: (msg: string) => void }) {
  const [day, setDay] = useState("");
  const [taken, setTaken] = useState<{ id: string; text: string } | null>(null);
  const act = useAction();
  async function put(replace: boolean) {
    const r = await act.run(async () => {
      try {
        return await schedulePoolQuestion(q.id, day, replace);
      } catch (e) {
        const t = takenBy(e);
        if (t) {
          setTaken(t);
          return null;
        }
        throw e;
      }
    });
    if (r) onDone(r.swappedWith ? `Question put on ${dayStringWeekday(day)}. The question that was there is back in the pool.` : `Question put on ${dayStringWeekday(day)}.`);
  }
  return (
    <div className={panel} role="group" aria-label="Put on a day">
      <TextField label="Day" type="date" value={day} onChange={(v) => { setDay(v); setTaken(null); act.clear(); }} hint="It joins the week that holds this day." />
      {taken ? (
        <div className="flex flex-col gap-2" role="group" aria-label="Swap days">
          <p className="m-0 text-body">{`That day already has "${taken.text}".`}</p>
          <p className="m-0 text-caption text-ink-2">Putting this question there sends that one back to the pool.</p>
          <div className="flex gap-2">
            <Button size="s" loading={act.busy} disabled={act.busy} onClick={() => void put(true)}>Swap</Button>
            <Button size="s" variant="secondary" disabled={act.busy} onClick={() => setTaken(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <ErrorLine>{act.error}</ErrorLine>
          <div className="flex gap-2">
            <Button size="s" loading={act.busy} disabled={!day || act.busy} onClick={() => void put(false)}>Put on this day</Button>
            <Button size="s" variant="secondary" disabled={act.busy} onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}

/** K4: "Start now" for a Flash question: the same call the calendar uses (RW5), with no week. */
function FlashPanel({ q, onClose, onDone }: { q: AdminQuestion; onClose: () => void; onDone: () => void }) {
  const act = useAction();
  async function start() {
    const r = await act.run(() => startFlashNow(q));
    if (r) onDone();
  }
  return (
    <div className={panel} role="group" aria-label="Start flash poll">
      <p className="m-0 text-body">{`Starts now and stays open for ${FLASH_HOURS} hours.`}</p>
      <p className="m-0 text-caption text-ink-2">People who allow flash polls are told. Only one flash poll can be open at a time.</p>
      <ErrorLine>{act.error}</ErrorLine>
      <div className="flex gap-2">
        <Button size="s" loading={act.busy} disabled={act.busy} onClick={() => void start()}>Start now</Button>
        <Button size="s" variant="secondary" disabled={act.busy} onClick={() => { onClose(); act.clear(); }}>Cancel</Button>
      </div>
    </div>
  );
}

export function AdminPoolPage() {
  return (
    <Gated page="pool">
      <PoolBody />
    </Gated>
  );
}

