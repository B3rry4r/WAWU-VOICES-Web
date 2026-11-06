"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Dialog, EmptyState, Tabs, TextField } from "@/components/vx";
import { cancelOverride, createOverride, listOverrides, previewOverride } from "@/lib/api/admin";
import type { AdminOverride, CreateOverrideRequest, OverridePreview } from "@/lib/api/admin";
import { useAdmin } from "./AdminFrame";
import { dayKey } from "@/lib/format/date";
import { clock, dayClock, dayStringWeekday, fromLocalInput, longDate, toLocalInput, weekdayDay } from "./time";
import { Card, CardTitle, ErrorLine, Eyebrow, ListSkeleton, PageHead, SavedLine, StatePill, Switch, useAction, Gated, DateTimeField } from "./ui";

const HEADLINE_MAX = 120;

function nowLocal(addHours = 0): string {
  return toLocalInput(new Date(Date.now() + addHours * 3600_000));
}

function OverrideBody() {
  const { today, reloadToday } = useAdmin();
  const [kind, setKind] = useState<"TEXT" | "LINK">("TEXT");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [starts, setStarts] = useState(nowLocal());
  const [ends, setEnds] = useState(nowLocal(24));
  const [drop, setDrop] = useState(false);
  const [keepTheme, setKeepTheme] = useState(true);
  const [emergency, setEmergency] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<OverridePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [log, setLog] = useState<AdminOverride[] | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const act = useAction();

  const loadLog = useCallback(() => {
    listOverrides().then((p) => setLog(p.items), () => setLog([]));
  }, []);
  useEffect(loadLog, [loadLog]);

  const request = useMemo<CreateOverrideRequest>(
    () => ({
      contentKind: kind,
      headline: headline.trim() || undefined,
      body: body.trim() || undefined,
      linkUrl: link.trim() || undefined,
      startsAt: fromLocalInput(starts),
      endsAt: fromLocalInput(ends),
      emergency,
      notifyAlert: alertOn,
      keepWeeklyTheme: keepTheme,
      dropReplaced: drop,
    }),
    [kind, headline, body, link, starts, ends, emergency, alertOn, keepTheme, drop],
  );
  const filled = headline.trim().length > 0 && (kind === "LINK" ? link.trim().length > 0 : true);
  const timesOk = !Number.isNaN(Date.parse(request.startsAt)) && !Number.isNaN(Date.parse(request.endsAt)) && Date.parse(request.endsAt) > Date.parse(request.startsAt);

  // "What happens next" is the API's own preview of the week, asked again when the form changes.
  useEffect(() => {
    if (!filled || !timesOk) {
      setPreview(null);
      return;
    }
    const t = window.setTimeout(() => {
      previewOverride(request).then(
        (p) => {
          setPreview(p);
          setPreviewError(null);
        },
        () => {
          setPreview(null);
          setPreviewError("The preview is not available right now.");
        },
      );
    }, 400);
    return () => window.clearTimeout(t);
  }, [request, filled, timesOk]);


  const q = today?.todaysQuestion;
  const live = today?.flowState === "OVERRIDE_LIVE";

  async function submit(emergencyNow: boolean) {
    setConfirm(false);
    setSaved(null);
    const body0: CreateOverrideRequest = { ...request, emergency: emergencyNow ? true : emergency };
    const out = await act.run(() => createOverride(body0));
    if (out) {
      setSaved(emergencyNow || emergency ? "The override is live." : `Scheduled for ${dayClock(out.startsAt)}.`);
      setHeadline("");
      setBody("");
      setLink("");
      reloadToday();
      loadLog();
    }
  }

  function reset() {
    setHeadline("");
    setBody("");
    setLink("");
    setKind("TEXT");
    setStarts(nowLocal());
    setEnds(nowLocal(24));
    setSaved(null);
    act.clear();
  }

  const mayGo = filled && timesOk && !act.busy;

  return (
    <div>
      <PageHead
        eyebrow={today ? `${longDate(today.date + "T12:00:00+01:00")} · Week ${today.weekNumber}` : undefined}
        title="Override the day"
        right={live ? <StatePill tone="red" icon="radio">Override live</StatePill> : <StatePill tone="green" icon="circle-check">Normal flow running</StatePill>}
      />
      {saved ? (
        <div className="mb-4">
          <SavedLine>{saved}</SavedLine>
        </div>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-5">
        <div className="flex flex-col gap-5">
          {q?.id ? (
            <Card tone="mint">
              <Eyebrow>Scheduled for today</Eyebrow>
              <h2 className="m-0 mt-2 font-display text-display-m">{q.text}</h2>
              <p className="m-0 mt-2 text-caption text-ink-2">
                {`${q.startsAt ? `Live since ${clock(q.startsAt)} with ${q.voiceCount.toLocaleString("en-NG")} ${q.voiceCount === 1 ? "voice" : "voices"}. ` : ""}If you override, it is not lost: it moves to the next free slot.`}
              </p>
            </Card>
          ) : null}
          <Card>
            <CardTitle>What goes up instead</CardTitle>
            <div className="flex flex-col gap-4">
              <Tabs variant="segmented" block label="Content type" items={[{ id: "TEXT", label: "Text", icon: "message-square" }, { id: "LINK", label: "Link", icon: "link" }]} value={kind} onChange={(v) => setKind(v as "TEXT" | "LINK")} />
              <TextField label="Headline (120 max)" value={headline} onChange={setHeadline} maxLength={HEADLINE_MAX} />
              <TextField label="Message" multiline value={body} onChange={setBody} hint="Shown under the headline on Home and on the share card." />
              <TextField label={kind === "LINK" ? "Link" : "Link (optional)"} value={link} onChange={setLink} placeholder="https://" inputMode="url" hint="Opens from a button under the message." />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle>When and how</CardTitle>
            <div className="grid grid-cols-2 gap-4">
              <DateTimeField label="Starts" value={starts} onChange={setStarts} />
              <DateTimeField label="Ends" value={ends} onChange={setEnds} hint="Lagos time. You can change it." error={timesOk ? undefined : "The end has to be after the start."} />
            </div>
            <div className="mb-2 mt-4 text-label">The question it replaces</div>
            <Tabs variant="segmented" block label="The question it replaces" items={[{ id: "move", label: "Move to next slot" }, { id: "drop", label: "Drop it" }]} value={drop ? "drop" : "move"} onChange={(v) => setDrop(v === "drop")} />
            <div className="mt-3">
              <Switch checked={keepTheme} onChange={setKeepTheme} label="Keep the weekly theme and poll" hint={today?.topic?.title ? `${today.topic.title} and its poll stay as they are` : "The theme and its poll stay as they are"} />
              <Switch checked={emergency} onChange={setEmergency} label="Emergency: apply now" hint="Skips the schedule and goes live at once" />
              <Switch checked={alertOn} onChange={setAlertOn} label="Send an in-app alert" hint="To everyone in Nigeria who allows alerts" />
            </div>
          </Card>

          <Card>
            <Eyebrow>What happens next</Eyebrow>
            {preview ? (
              <ul className="m-0 mt-2 list-none p-0">
                <li className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-3 text-body">
                  <span className="text-body-strong">{weekdayDay(request.startsAt)}</span>
                  <span className="font-semibold text-green-text">{`Your override, ${clock(request.startsAt)} to ${clock(request.endsAt)}${dayKey(request.startsAt) === dayKey(request.endsAt) ? "" : ` (${weekdayDay(request.endsAt)})`}`}</span>
                </li>
                {preview.schedule.slice(0, 2).map((s) => (
                  <li key={s.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-t border-line py-3 text-body">
                    <span className="text-body-strong">{s.day ? dayStringWeekday(s.day) : ""}</span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-2 text-caption text-ink-2">{previewError ?? "Fill in the headline and times to see how the week moves."}</p>
            )}
            <p className="m-0 mt-3 border-t border-line pt-3 text-caption text-ink-2">The rest of the week moves forward one day. The flow resumes by itself when the override ends. Every override is logged with who, what, when and what it replaced.</p>
          </Card>

          <ErrorLine>{act.error}</ErrorLine>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="destructive" icon="radio" disabled={!mayGo} loading={act.busy} onClick={() => setConfirm(true)}>Go live now</Button>
            <Button variant="secondary" icon="clock" disabled={!mayGo || emergency} onClick={() => submit(false)}>Schedule instead</Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Eyebrow className="mb-2">Override log</Eyebrow>
        {log === null ? (
          <ListSkeleton rows={2} />
        ) : log.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-5 text-caption text-ink-2">No overrides yet. Every one will be listed here.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <table className="w-full border-collapse text-left text-caption">
              <thead>
                <tr className="text-ink-2">
                  {["When", "What went up", "It replaced", "By", "Result"].map((h) => (
                    <th key={h} className="vx-eyebrow px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map((o) => (
                  <LogRow key={o.id} o={o} onChanged={() => { loadLog(); reloadToday(); }} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={confirm} title="Go live now?" confirmLabel="Go live now" destructive confirmIcon="radio" onClose={() => setConfirm(false)} onConfirm={() => submit(true)}>
        This replaces today’s question for everyone straight away. The replaced question is not lost. You can cancel the override from the log.
      </Dialog>
    </div>
  );
}

function resultWords(o: AdminOverride): string {
  if (o.result) return o.result;
  if (o.status === "LIVE") return "Live now";
  if (o.status === "SCHEDULED") return "Scheduled";
  if (o.status === "CANCELLED") return "Cancelled";
  return "Ended";
}

function LogRow({ o, onChanged }: { o: AdminOverride; onChanged: () => void }) {
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState("");
  const act = useAction();
  const open = o.status === "LIVE" || o.status === "SCHEDULED";
  async function cancel() {
    const ok = await act.run(async () => {
      await cancelOverride(o.id, why.trim());
      return true;
    });
    if (ok) {
      setAsking(false);
      onChanged();
    }
  }
  return (
    <>
      <tr className="border-t border-line align-top">
        <td className="whitespace-nowrap px-4 py-3">{dayClock(o.startsAt)}</td>
        <td className="px-4 py-3">{o.headline || o.body || "An override"}</td>
        <td className="px-4 py-3">{o.replaced ? o.replaced.text : "Nothing"}</td>
        <td className="px-4 py-3">{o.by}</td>
        <td className="px-4 py-3">
          {resultWords(o)}
          {open ? (
            <div>
              <Button variant="ghost" size="s" onClick={() => setAsking(true)}>Cancel early</Button>
            </div>
          ) : null}
        </td>
      </tr>
      {asking ? (
        <tr className="border-t border-line bg-surface-2">
          <td colSpan={5} className="px-4 py-3">
            <div className="flex items-end gap-3">
              <TextField label="Why are you cancelling it? (kept in the log)" value={why} onChange={setWhy} className="flex-1" />
              <Button variant="destructive" loading={act.busy} disabled={!why.trim() || act.busy} onClick={cancel}>Cancel the override</Button>
              <Button variant="secondary" onClick={() => setAsking(false)}>Keep it</Button>
            </div>
            <div className="mt-2"><ErrorLine>{act.error}</ErrorLine></div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AdminOverridePage() {
  return (
    <Gated page="override">
      <OverrideBody />
    </Gated>
  );
}
