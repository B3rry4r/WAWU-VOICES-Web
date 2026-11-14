"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, TextField } from "@/components/vx";
import { draftSummary, getSummary, saveSummary } from "@/lib/api/admin";
import type { AdminSummary, SummaryDraft } from "@/lib/api/admin";
import { Card, CardTitle, ErrorLine, Eyebrow, Pill, SavedLine, useAction } from "./ui";
import { slot } from "./time";

type Fields = { mainView: string; mainViewVoices: string; opposingView: string; opposingViewVoices: string; pollLine: string; nextStepsLine: string };

const EMPTY: Fields = { mainView: "", mainViewVoices: "", opposingView: "", opposingViewVoices: "", pollLine: "", nextStepsLine: "" };
const WORDS: Record<string, string> = { ANGRY: "Angry", TIRED: "Tired", PROUD: "Proud", HOPEFUL: "Hopeful" };

const num = (v: string): number => {
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? Math.min(n, 2_000_000_000) : 0;
};

function fromDraft(d: SummaryDraft["draft"]): Fields {
  return {
    mainView: d.mainView,
    // The counts start empty in every draft: they are voices an editor counted, never poll votes.
    mainViewVoices: "",
    opposingView: d.opposingView,
    opposingViewVoices: "",
    pollLine: d.pollLine,
    nextStepsLine: d.nextStepsLine,
  };
}

/**
 * The What Next? summary of one week, on the calendar panel (V-FIX-C). The two views are the argument chips on What Next,
 * the share cards and the share page; "Based on N voices" is counted by the API when it saves. A draft from the data always
 * works; the AI draft is offered only when the server has a key, and the page says so plainly when it has not.
 */
export function SummaryPanel({ topicId }: { topicId: string }) {
  const [info, setInfo] = useState<AdminSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Fields>(EMPTY);
  const [basis, setBasis] = useState<SummaryDraft | null>(null);
  const [fromAi, setFromAi] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const draftAct = useAction();
  const saveAct = useAction();

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      setInfo(await getSummary(topicId));
    } catch {
      setLoadError("The summary did not load.");
    } finally {
      setLoading(false);
    }
  }, [topicId]);
  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: keyof Fields) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  function edit() {
    const s = info?.summary;
    setF(
      s
        ? { mainView: s.mainView, mainViewVoices: String(s.mainViewVoices), opposingView: s.opposingView, opposingViewVoices: String(s.opposingViewVoices), pollLine: s.pollLine, nextStepsLine: s.nextStepsLine }
        : EMPTY,
    );
    setFromAi(s?.aiDrafted ?? false);
    setBasis(null);
    setSaved(null);
    setOpen(true);
    // A first summary starts from the data, so the editor is never facing an empty form.
    if (!s) void draft(false);
  }

  async function draft(ai: boolean) {
    const out = await draftAct.run(() => draftSummary(topicId, ai));
    if (!out) return;
    setF(fromDraft(out.draft));
    setBasis(out);
    setFromAi(out.source === "AI");
  }

  async function save(approve: boolean) {
    const out = await saveAct.run(() =>
      saveSummary(topicId, {
        mainView: f.mainView.trim(),
        mainViewVoices: num(f.mainViewVoices),
        opposingView: f.opposingView.trim(),
        opposingViewVoices: num(f.opposingViewVoices),
        pollLine: f.pollLine.trim(),
        nextStepsLine: f.nextStepsLine.trim(),
        approve,
        aiDrafted: fromAi,
      }),
    );
    if (out) {
      setOpen(false);
      setSaved(approve ? "Saved. It is now shown on What Next, the share cards and the share page." : "Draft saved. It is not shown to anyone yet.");
      void load();
    }
  }

  const s = info?.summary ?? null;
  const countsOk = num(f.mainViewVoices) >= 1 && num(f.opposingViewVoices) >= 1;
  const ready = f.mainView.trim().length >= 3 && f.opposingView.trim().length >= 3 && f.pollLine.trim().length >= 3 && f.nextStepsLine.trim().length >= 3;

  return (
    <Card className="mt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>What Next? summary</Eyebrow>
          <CardTitle>Argument chips and “Based on N voices”</CardTitle>
        </div>
        {!open ? (
          <Button size="s" variant="secondary" disabled={!info} onClick={edit}>
            {s ? "Edit the summary" : "Write the summary"}
          </Button>
        ) : null}
      </div>
      {loadError ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ErrorLine>{loadError}</ErrorLine>
          <Button size="s" variant="secondary" icon="refresh-cw" loading={loading} disabled={loading} onClick={() => void load()}>Try again</Button>
        </div>
      ) : null}
      {saved ? <SavedLine>{saved}</SavedLine> : null}

      {!open ? (
        s ? (
          <div className="mt-2 flex flex-col gap-2 text-body">
            <div className="flex flex-wrap items-center gap-2">
              {s.reviewedByEditor ? <Pill tone="green">Shown on What Next</Pill> : <Pill tone="sun">Draft, not shown</Pill>}
              {s.aiDrafted ? <Pill tone="neutral">AI-assisted</Pill> : null}
              <span className="text-caption text-ink-2">{`Based on ${s.basedOnVoices.toLocaleString("en-NG")} voices and ${s.basedOnVotes.toLocaleString("en-NG")} votes. Updated ${slot(s.updatedAt)}.`}</span>
            </div>
            <p className="m-0">{`Most voices so far lean towards: ${s.mainView} (${s.mainViewVoices.toLocaleString("en-NG")})`}</p>
            <p className="m-0">{`The main opposing view: ${s.opposingView} (${s.opposingViewVoices.toLocaleString("en-NG")})`}</p>
          </div>
        ) : info ? (
          <p className="m-0 mt-2 text-body text-ink-2">No summary yet. What Next, the share cards and the share page show no argument chips until one is saved and shown.</p>
        ) : null
      ) : (
        <div className="mt-3 flex flex-col gap-4" role="group" aria-label="Write the summary">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="s" variant="secondary" icon="chart-column" loading={draftAct.busy} disabled={draftAct.busy} onClick={() => void draft(false)}>
              Draft from the data
            </Button>
            <Button size="s" variant="secondary" icon="refresh-cw" loading={draftAct.busy} disabled={draftAct.busy || !info?.aiAvailable} onClick={() => void draft(true)}>
              Draft with AI
            </Button>
            <span className="text-caption text-ink-2" role="status">
              {info?.aiAvailable ? "The AI draft proposes the two views from this week’s voices. Check every line and count the voices yourself." : "AI drafting is off here. The draft from the data still works."}
            </span>
          </div>
          <p className="m-0 text-caption text-ink-2">Drafting replaces the words below. Nothing is saved until you save.</p>
          <ErrorLine>{draftAct.error}</ErrorLine>
          {basis?.aiNote ? <p role="status" className="m-0 rounded-m bg-warning-bg px-3 py-2 text-caption text-warning">{basis.aiNote}</p> : null}

          <TextField label="Main view" value={f.mainView} onChange={set("mainView")} maxLength={600} hint="Finishes “Most voices so far lean towards: …”. Say “lean towards” or “split”, never that everyone agrees." />
          <TextField label="Voices behind the main view: count them from the voices" inputMode="numeric" value={f.mainViewVoices} onChange={set("mainViewVoices")} />
          <TextField label="Main opposing view" value={f.opposingView} onChange={set("opposingView")} maxLength={600} />
          <TextField label="Voices behind the opposing view: count them from the voices" inputMode="numeric" value={f.opposingViewVoices} onChange={set("opposingViewVoices")} />
          <TextField label="The poll so far" multiline value={f.pollLine} onChange={set("pollLine")} maxLength={600} />
          <TextField label="Proposed next steps" multiline value={f.nextStepsLine} onChange={set("nextStepsLine")} maxLength={600} />

          {basis ? <Basis b={basis} /> : null}

          {!countsOk ? <p role="status" className="m-0 text-caption text-ink-2">To show it on What Next, count the voices behind each view and enter at least 1 for both. You can save a draft without them.</p> : null}
          <ErrorLine>{saveAct.error}</ErrorLine>
          <div className="flex flex-wrap gap-3">
            <Button icon="check" loading={saveAct.busy} disabled={!ready || !countsOk || saveAct.busy} onClick={() => void save(true)}>Save and show on What Next</Button>
            <Button variant="secondary" disabled={!ready || saveAct.busy} onClick={() => void save(false)}>Save as a draft</Button>
            <Button variant="ghost" disabled={saveAct.busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          <p className="m-0 text-caption text-ink-2">The numbers “Based on N voices and N votes” are counted from the week when you save.</p>
        </div>
      )}
    </Card>
  );
}

/** The material the draft was built from: so the editor can check the two views against what people said. */
function Basis({ b }: { b: SummaryDraft }) {
  return (
    <div className="rounded-l bg-surface-2 p-4" aria-label="What the draft is built from">
      <Eyebrow className="mb-2">{`Built from ${b.basedOnVoices.toLocaleString("en-NG")} voices and ${b.basedOnVotes.toLocaleString("en-NG")} votes`}</Eyebrow>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-caption">
        <dt className="text-ink-2">Mood</dt>
        <dd className="m-0">{b.moods.length ? b.moods.map((m) => `${WORDS[m.mood] ?? m.mood} ${m.count.toLocaleString("en-NG")} (${m.percent}%)`).join(", ") : "No mood answers this week."}</dd>
        <dt className="text-ink-2">Top categories</dt>
        <dd className="m-0">{b.categories.length ? b.categories.map((c) => `${c.name} ${c.voices.toLocaleString("en-NG")}`).join(", ") : "None yet."}</dd>
      </dl>
      <div className="mt-3 text-caption text-ink-2">Most-reacted voices, as material to quote from (no names)</div>
      {b.quotes.length ? (
        <ul className="m-0 mt-1 flex list-none flex-col gap-2 p-0 text-body">
          {b.quotes.map((q) => (
            <li key={q.answerId} className="border-l-2 border-line pl-3">
              {q.excerpt}
              <span className="ml-2 text-caption text-ink-2">{`${q.reactions} ${q.reactions === 1 ? "reaction" : "reactions"}${q.kind === "VOICE" ? ", spoken" : ""}`}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-1 text-caption text-ink-2">No voice has a reaction yet.</p>
      )}
      <p className="m-0 mt-3 text-caption text-ink-2">The two views are yours to write from the voices, and the counts are yours to count. Poll numbers are votes and appear only in the poll line.</p>
    </div>
  );
}
