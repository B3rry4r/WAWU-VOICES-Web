"use client";

import { countText } from "@/lib/format/plural";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, EmptyState, Tabs, TextField } from "@/components/vx";
import { getModerationItem, listModeration, moderationAction } from "@/lib/api/admin";
import type { ModerationActionKind, ModerationItem, ModerationItemDetail } from "@/lib/api/admin";
import { useAdmin } from "./AdminFrame";
import { AdminPlayer } from "./Player";
import { ago, clock, dayMonth, minutesWords } from "./time";
import { AuditList, Card, ErrorLine, Eyebrow, ListSkeleton, LoadFailed, PageHead, SavedLine, queueRow, useAction, Gated } from "./ui";

type Counts = Record<string, number | string | null>;

const TABS: { id: string; label: string; queue: string }[] = [
  // lead ruling WF (RW3), 6 Nov: "New" (SCREENED) and "Sensitive topics" (SENSITIVE) stay hidden until something feeds them.
  { id: "reported", label: "Reported", queue: "REPORTED" },
  { id: "about", label: "This is about me", queue: "PRIORITY" },
  { id: "appeals", label: "Appeals", queue: "APPEAL" },
];

interface Choice {
  id: string;
  label: string;
  action: ModerationActionKind;
  button: string;
}
const CHOICES: Choice[] = [
  { id: "keep", label: "Keep", action: "KEEP", button: "Keep it up" },
  { id: "remove", label: "Remove", action: "REMOVE_AND_WARN", button: "Remove and warn" },
  { id: "warn", label: "Warn", action: "WARN", button: "Warn" },
  { id: "suspend", label: "Suspend", action: "SUSPEND", button: "Suspend" },
];

/** WF-5: on an appeal the two buttons say what happens to the ACTION appealed, in plain words. */
const APPEAL_WORDS: Record<string, { undo: string; keep: string }> = {
  REMOVAL: { undo: "Put it back", keep: "Keep it removed" },
  WARNING: { undo: "Remove the warning", keep: "Keep the warning" },
  SUSPENSION: { undo: "Lift the suspension", keep: "Keep it" },
};
function appealChoices(kind: string | null | undefined): Choice[] {
  const w = APPEAL_WORDS[kind ?? "REMOVAL"] ?? APPEAL_WORDS.REMOVAL;
  return [
    { id: "restore", label: w.undo, action: "RESTORE", button: w.undo },
    { id: "keep", label: w.keep, action: "KEEP", button: w.keep },
  ];
}

function reasonTag(i: ModerationItem): { text: string; cls: string } {
  const r = i.reasons[0];
  const text = r ? r.charAt(0).toUpperCase() + r.slice(1) : i.queue === "APPEAL" ? "Appeal" : i.queue === "SENSITIVE" ? "Sensitive topic" : "Screening";
  const cls = /threat|harass|hate/i.test(text) ? "bg-danger-bg text-danger" : /private|about me|scam/i.test(text) ? "bg-warning-bg text-warning" : "bg-surface-2 text-ink";
  return { text, cls };
}

/** The row's second line: the API's summary unless it only repeats the tag; a bare item falls back to its report count (C-L3). */
function rowSummary(i: ModerationItem, tagText: string): string {
  let s = (i.summary ?? "").trim();
  const lead = `${tagText} · `;
  if (s.toLowerCase().startsWith(lead.toLowerCase())) s = s.slice(lead.length);
  if (s && s.toLowerCase() !== tagText.toLowerCase()) return s;
  if (i.queue === "APPEAL") return "Asking for a second look";
  return i.reportCount > 0 ? `Reported ${countText(i.reportCount, "time")}` : "";
}

function screenCls(s: string): string {
  return /threat|possible/i.test(s) ? "bg-danger-bg text-danger" : /sensitive/i.test(s) ? "bg-warning-bg text-warning" : "bg-surface-2 text-ink";
}

function contentOf(d: ModerationItemDetail): { kind: string; body: string | null; createdAt: string | null } {
  const c = (d.content ?? {}) as { kind?: string; body?: string | null; createdAt?: string };
  return { kind: c.kind ?? "", body: c.body ?? null, createdAt: c.createdAt ?? null };
}

function ModerationBody() {
  const { reloadToday } = useAdmin();
  const [tab, setTab] = useState("reported");
  const [items, setItems] = useState<ModerationItem[] | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [next, setNext] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ModerationItemDetail>>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const [choice, setChoice] = useState("remove");
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const act = useAction();
  const queue = TABS.find((t) => t.id === tab)?.queue ?? "REPORTED";
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setItems(null);
    setLoadError(null);
    try {
      const p = await listModeration({ queue });
      if (my !== seq.current) return;
      setItems(p.items);
      setNext(p.nextCursor);
      setCounts((p.counts ?? {}) as Counts);
      setSelected(p.items[0]?.id ?? null);
    } catch (e) {
      if (my === seq.current) setLoadError(e as Error);
    }
  }, [queue]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDetailError(null);
    setReason("");
    act.clear();
    setChoice(queue === "APPEAL" ? "restore" : "remove");
    if (!selected || details[selected]) return;
    getModerationItem(selected).then(
      (d) => setDetails((m) => ({ ...m, [selected]: d })),
      (e: Error) => setDetailError(e.message),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const detail = selected ? details[selected] : undefined;
  const choices = queue === "APPEAL" ? appealChoices(detail?.appealKind) : CHOICES;
  const cur = choices.find((c) => c.id === choice) ?? choices[0];
  const reasonOk = reason.trim().length > 0;

  async function more() {
    if (!next) return;
    const p = await listModeration({ queue, cursor: next });
    setItems((x) => [...(x ?? []), ...p.items]);
    setNext(p.nextCursor);
  }

  async function decide(c: Choice) {
    if (!selected || !reasonOk) return;
    const id = selected;
    const done = await act.run(async () => {
      await moderationAction(id, c.action, reason.trim());
      return true;
    });
    if (!done) return;
    // lead ruling WF, 6 Nov (C-M10): a decided appeal is not appealed again, so its banner never says "can appeal".
    setSaved(
      queue === "APPEAL"
        ? c.action === "KEEP"
          ? "Appeal declined. The poster sees your reason."
          : "Appeal accepted. The poster sees your reason."
        : c.action === "KEEP"
          ? "Kept up. The reason is saved."
          : "Done. The poster sees your reason and can appeal.",
    );
    setItems((x) => {
      const rest = (x ?? []).filter((i) => i.id !== id);
      const at = (x ?? []).findIndex((i) => i.id === id);
      setSelected(rest[Math.min(at, rest.length - 1)]?.id ?? null);
      return rest;
    });
    setCounts((c0) => {
      const open0 = Math.max(0, Number(c0.open ?? 0) - 1);
      // WF-7b (C-N-c4): with nothing open there is no "oldest"; otherwise it is re-read below.
      return { ...c0, [queue]: Math.max(0, Number(c0[queue] ?? 0) - 1), open: open0, ...(open0 === 0 ? { oldestOpenAt: null } : {}) };
    });
    listModeration({ queue }).then((p) => setCounts((p.counts ?? {}) as Counts), () => undefined);
    reloadToday();
  }


  const open = Number(counts.open ?? 0);
  const oldest = open > 0 && typeof counts.oldestOpenAt === "string" ? minutesWords(Math.max(0, Math.round((Date.now() - new Date(counts.oldestOpenAt).getTime()) / 60000))) : null;
  const cnt = (q: string) => Number(counts[q] ?? 0);

  return (
    <div>
      <PageHead
        eyebrow={`Safety · ${open} open${oldest ? ` · oldest ${oldest}` : ""}`}
        title="Moderation"
        sub="Strong opinions and disagreement stay up. We remove threats, harassment, hate and private information. Every action needs a reason."
      />
      <div className="mb-5">
        <Tabs
          label="Moderation queues"
          items={TABS.map((t) => ({ id: t.id, label: t.label, count: cnt(t.queue) }))}
          value={tab}
          onChange={(id) => {
            setSaved(null);
            setTab(id);
          }}
        />
      </div>
      {saved ? (
        <div className="mb-4">
          <SavedLine>{saved}</SavedLine>
        </div>
      ) : null}

      {loadError ? (
        <LoadFailed error={loadError} retry={load} />
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon="shield-check" title="Nothing is waiting here" body="New items land here as people report them." />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
          <div className="overflow-hidden rounded-xl border border-line bg-surface" role="list" aria-label="Queue">
            {items.map((it) => {
              const tag = reasonTag(it);
              const accountItem = !it.postKind && it.targetType === "USER";
              const what = accountItem ? (it.queue === "APPEAL" ? "Appeal about an account" : "Report about an account") : it.postKind === "VOICE" ? "Voice answer" : it.postKind === "TEXT" ? "Text answer" : it.postKind === "REPLY_VOICE" ? "Voice reply to a voice" : it.postKind === "REPLY_TEXT" ? "Text reply" : null;
              return (
                <button key={it.id} type="button" role="listitem" className={queueRow(selected === it.id)} onClick={() => setSelected(it.id)} aria-current={selected === it.id ? "true" : undefined}>
                  <span className="flex flex-wrap items-center gap-2 text-caption text-ink-2">
                    <span className={`rounded-s px-2 py-0.5 text-caption ${tag.cls}`}>{tag.text}</span>
                    {rowSummary(it, tag.text)}{it.listenCount > 0 ? ` · ${it.listenCount} ${it.listenCount === 1 ? "listen" : "listens"}` : ""}
                  </span>
                  {what ? (
                    <span className="mt-2 block text-label">
                      {it.questionText ? `${what} on “${it.questionText}”` : what}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {next ? (
              <div className="p-3 text-center">
                <Button variant="ghost" onClick={more}>Show more</Button>
              </div>
            ) : null}
          </div>

          <Card className="!p-6">
            {!selected ? (
              <p className="m-0 text-ink-2">Pick an item to read it.</p>
            ) : detailError ? (
              <ErrorLine>{detailError}</ErrorLine>
            ) : !detail ? (
              <ListSkeleton rows={2} />
            ) : (
              <Panel
                d={detail}
                choices={choices}
                choice={choice}
                setChoice={setChoice}
                reason={reason}
                setReason={setReason}
                busy={act.busy}
                error={act.error}
                disabled={!reasonOk}
                cur={cur}
                appeal={queue === "APPEAL"}
                onDecide={decide}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Panel(p: {
  d: ModerationItemDetail;
  choices: Choice[];
  choice: string;
  setChoice: (s: string) => void;
  reason: string;
  setReason: (s: string) => void;
  busy: boolean;
  error: string | null;
  disabled: boolean;
  cur: Choice;
  appeal: boolean;
  onDecide: (c: Choice) => void;
}) {
  const { d } = p;
  const c = contentOf(d);
  const keep = p.choices.find((x) => x.id === "keep") ?? p.choices[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={d.author?.handle ?? "?"} size="m" />
          <div className="min-w-0">
            <div className="text-body-strong">{d.author ? `@${d.author.handle}` : "Account removed"}</div>
            {d.author ? (
              <div className="text-caption text-ink-2">
                {`Joined ${dayMonth(d.author.joinedAt)} · ${d.author.postCount} ${d.author.postCount === 1 ? "post" : "posts"} · ${d.author.strikeCount === 0 ? "no past strikes" : `${d.author.strikeCount} past ${d.author.strikeCount === 1 ? "strike" : "strikes"}`}`}
              </div>
            ) : null}
          </div>
        </div>
        {d.item.targetType === "USER" ? (
          <span className="flex-none text-caption text-ink-2">{`Reported ${ago(d.item.createdAt)} ago`}</span>
        ) : c.createdAt ? (
          <span className="flex-none text-caption text-ink-2">{`Posted ${ago(c.createdAt)} ago`}</span>
        ) : null}
      </div>

      {d.playUrl ? <AdminPlayer url={d.playUrl} label="the voice reply" /> : null}

      {d.transcript || c.body ? (
        <div className="rounded-l bg-surface-2 p-4">
          <Eyebrow className="mb-2">{d.transcript ? "Transcript" : "The post"}</Eyebrow>
          <p className="m-0 text-body text-ink">{d.transcript ?? c.body}</p>
        </div>
      ) : null}

      {(d.appeals ?? []).map((a) => (
        <div key={a.id} className="rounded-l border border-line bg-surface p-4">
          <Eyebrow className="mb-1">{a.status === "DECIDED" ? "Appeal (decided)" : "Appeal"}</Eyebrow>
          <div className="mb-2 text-caption text-ink-2">{`${d.author ? `@${d.author.handle}` : "The poster"} · ${dayMonth(a.createdAt)}, ${clock(a.createdAt)}`}</div>
          <p className="m-0 whitespace-pre-wrap text-body text-ink">{a.note}</p>
        </div>
      ))}

      {d.screening.length ? (
        <div className="flex flex-wrap gap-2">
          {d.screening.map((s, i) => (
            <span key={i} className={`rounded-pill px-3 py-1.5 text-count ${screenCls(s)}`}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
          ))}
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-label">Action</div>
        <Tabs variant="segmented" block label="Moderation action" items={p.choices.map((x) => ({ id: x.id, label: x.label }))} value={p.choice} onChange={p.setChoice} />
      </div>

      <TextField label={p.appeal ? "Reason (the poster sees this)" : "Reason (the poster sees this and can appeal)"} multiline value={p.reason} onChange={p.setReason} hint="Required. Say what was wrong and what is fine." />
      <ErrorLine>{p.error}</ErrorLine>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant={p.cur.action === "KEEP" || p.cur.action === "RESTORE" ? "primary" : "destructive"} icon={p.cur.action === "KEEP" ? "check" : p.cur.action === "RESTORE" ? "rotate-ccw" : "trash-2"} loading={p.busy} disabled={p.disabled || p.busy} onClick={() => p.onDecide(p.cur)}>
          {p.cur.button}
        </Button>
        {p.cur.action !== "KEEP" ? (
          <Button variant="secondary" disabled={p.disabled || p.busy} onClick={() => p.onDecide(keep)}>
            {keep.button}
          </Button>
        ) : null}
      </div>

      <AuditList title="Audit trail" lines={d.audit.map((a) => ({ ...a, text: `${clock(a.at)} · ${a.text}` }))} />
    </div>
  );
}

export function AdminModerationPage() {
  return (
    <Gated page="moderation">
      <ModerationBody />
    </Gated>
  );
}
