"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Badge, Banner, Button, Dialog, EmptyState, Icon, IconButton, Sheet, Skeleton, SponsoredSurvey, Switch, TextField } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { Rail } from "@/components/shell/ShellSlots";
import { VoiceBox } from "@/features/speak/VoiceBox";
import { refusalText } from "@/features/speak/logic";
import { ApiError } from "@/lib/api/client";
import { deleteVoiceClip } from "@/lib/api/speak";
import { answerSurvey, getSurvey, recordSurveyEvent, type Survey, type SurveyQuestionView } from "@/lib/api/surveys";
import { useSameWho, whoNow } from "./who";
import { aboutMinutes, clearDraft, clock, loadDraft, markSkipped, markStarted, recapLine, saveDraft, TEXT_MAX, toInputs, wasSkipped, wasStarted, type Given, type GivenByQuestion } from "./logic";

/** The Sponsored Survey, one question at a time (Survey boards), then the Done screen. Answering is free; nothing here touches tokens or a free post. */
export function SurveyScreen({ id }: { id: string }) {
  // The tab knows who it belongs to: the person signed in when it loaded. Every write compares this with the session in storage (see who.ts).
  const [who, setWho] = useState<string | null | undefined>(undefined);
  useEffect(() => setWho(whoNow()), []);
  const same = useSameWho(who);
  const signed = who === undefined ? null : who !== null;
  const load = useLoad<Survey | null>(async () => {
    if (!signed) return null;
    return getSurvey(id);
  }, [id, signed]);

  // Another tab signed someone else in (or out): nothing of this person is shown or sent, and nothing is kept or cleared.
  if (same.stale) return <StaleTab signedOut={whoNow() === null} />;
  if (signed === null || load.state === "loading") return <SurveySkeleton />;
  if (!signed) {
    return (
      <Centre>
        <EmptyState icon="lock" title="Sign in to answer" body="Surveys are for people with a VOICES account. Listening stays free without one." action="Sign in" onAction={() => window.location.assign(`/sign-in?next=${encodeURIComponent(`/surveys/${id}`)}`)} />
      </Centre>
    );
  }
  if (load.state === "error") {
    const e = load.error;
    if (e instanceof ApiError && e.status === 404) {
      return (
        <Centre>
          <EmptyState icon="clipboard-list" title="This survey is not open" body="It may have ended, or it is not for your area. Go back to Home." action="Go to Home" onAction={() => window.location.assign("/")} />
        </Centre>
      );
    }
    const offline = e instanceof ApiError && e.status === 0;
    return (
      <Centre>
        <Banner tone={offline ? "offline" : "danger"} title={offline ? "You are offline" : "This did not load"} action="Try again" onAction={load.retry}>
          {offline ? "Check your connection and try again." : refusalText(e)}
        </Banner>
      </Centre>
    );
  }
  const survey = load.data as Survey;
  if (survey.myStatus === "ANSWERED" || survey.questions.length === 0) return <Done survey={survey} recap={null} />;
  return <Ask survey={survey} owner={who as string} check={same.check} />;
}

function StaleTab({ signedOut }: { signedOut: boolean }) {
  return (
    <Centre>
      <div data-testid="survey-stale" role="alert">
        <EmptyState
          icon="user"
          title={signedOut ? "You are signed out in another tab. Reload to carry on." : "You are signed in as someone else in another tab. Reload to carry on."}
          body="Nothing was sent. Your answers stay with the person who gave them."
          action="Reload"
          onAction={() => window.location.reload()}
        />
      </div>
    </Centre>
  );
}

function Centre({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center">{children}</div>;
}

function SurveySkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton variant="tile" />
      <Skeleton variant="tile" />
    </div>
  );
}

function Ask({ survey, owner, check }: { survey: Survey; owner: string; check: () => boolean }) {
  const router = useRouter();
  const qs = survey.questions;
  const total = qs.length;
  // A reload brings back the position, the answers (voice clip ids too) and the sharing choices kept for this survey in this tab.
  const [saved] = useState(() => loadDraft(survey.id, qs, survey.ageBands, owner));
  const [idx, setIdx] = useState(saved?.idx ?? 0);
  const [given, setGiven] = useState<GivenByQuestion>(saved?.given ?? {});
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(saved?.anonymous ?? false);
  const [shareState, setShareState] = useState(saved?.shareState ?? false);
  const [ageBand, setAgeBand] = useState(saved?.ageBand ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [why, setWhy] = useState(false);
  const [recap, setRecap] = useState<{ prompt: string; line: string }[] | null | undefined>(undefined);
  const [closed, setClosed] = useState<string | null>(null); // the server's words when the survey closed before the answers went in
  const canGoBack = useRef(typeof window !== "undefined" && window.history.length > 1); // the person came from inside the app, so Back lands on their place in the feed
  const finished = useRef(false); // the answers were sent (or the survey was already answered): nothing more to count
  const skipSent = useRef(false); // SKIP goes once
  const alive = useRef(false);
  const guard = useRef(false); // the history entry that lets Back ask first is in place
  const hasAnswers = useRef(false);
  hasAnswers.current = Object.keys(given).length > 0;
  const q = qs[idx];
  const qid = q.id;
  const last = idx === total - 1;
  const minutes = aboutMinutes(total);

  // START is counted once per person per survey: the flag lives in this tab's session storage, so a reload or a second open does not send it again.
  useEffect(() => {
    if (wasStarted(survey.id, owner)) return;
    if (!check()) return;
    markStarted(survey.id, owner);
    void recordSurveyEvent(survey.id, "START");
  }, [survey.id, owner, check]);

  // What a reload must bring back is written as it changes.
  useEffect(() => {
    if (!finished.current) saveDraft(survey.id, { idx, given, anonymous, shareState, ageBand }, owner);
  }, [survey.id, owner, idx, given, anonymous, shareState, ageBand]);

  // SKIP is for a real choice to leave: Skip, Leave, Back with no answers, or a link away inside the app. A reload, a hidden tab, switching app and closing the tab send nothing.
  // At most once per survey per person per tab (the flag is in session storage, keyed by person), and leaving by any of these routes also removes the draft.
  const sendSkip = useCallback(() => {
    if (finished.current) return;
    if (!check()) return; // another person is signed in now: nothing is sent and nothing of theirs is touched
    clearDraft(survey.id, owner);
    if (skipSent.current || wasSkipped(survey.id, owner)) return;
    skipSent.current = true;
    markSkipped(survey.id, owner);
    void recordSurveyEvent(survey.id, "SKIP", { keepalive: true });
  }, [survey.id, owner, check]);

  const releaseGuard = useCallback(() => {
    if (!guard.current) return;
    guard.current = false;
    try {
      window.history.back();
    } catch {
      /* nothing to undo */
    }
  }, []);

  // A question opens with what the person gave before (Back), or empty.
  useEffect(() => {
    const g = given[q.id];
    setChoice(g?.kind === "choice" ? g.optionId : null);
    setText(g?.kind === "text" ? g.text : "");
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const leave = useCallback(() => {
    sendSkip();
    guard.current = false;
    router.push("/");
  }, [router, sendSkip]);

  useEffect(() => {
    alive.current = true;
    // Back asks first (the browser's own box does not show here): one extra history entry is kept on top, and a Back press lands on it.
    const onPop = () => {
      if (!guard.current || finished.current) return;
      if (hasAnswers.current) {
        window.history.pushState(window.history.state, "", window.location.href);
        setLeaving(true);
      } else {
        guard.current = false;
        sendSkip();
        window.history.back();
      }
    };
    try {
      window.history.pushState(window.history.state, "", window.location.href);
      guard.current = true;
    } catch {
      guard.current = false;
    }
    window.addEventListener("popstate", onPop);
    return () => {
      alive.current = false;
      window.removeEventListener("popstate", onPop);
      // Gone from the page by a link inside the app (a reload or a closed tab never gets here): count the skip, unless the page came straight back (a development double mount).
      setTimeout(() => {
        if (!alive.current) sendSkip();
      }, 0);
    };
  }, [sendSkip]);

  const submit = useCallback(
    async (all: GivenByQuestion) => {
      if (!check()) return;
      const answers = toInputs(qs, all);
      // Every question skipped: nothing to send. The person has skipped the survey.
      if (answers.length === 0) return leave();
      setBusy(true);
      setProblem(null);
      try {
        await answerSurvey(survey.id, {
          answers,
          ...(anonymous ? { anonymous: true } : { ...(shareState ? { shareState: true } : {}), ...(ageBand ? { ageBand: ageBand as "18-24" } : {}) }),
        });
        finished.current = true;
        clearDraft(survey.id, owner);
        releaseGuard();
        setRecap(qs.filter((x) => all[x.id]).map((x) => ({ prompt: x.prompt, line: recapLine(all[x.id]) })));
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && /closed/i.test(e.message)) {
          // The survey ended before this answer arrived: say so in the server's words. Nothing more to count, and the draft goes.
          finished.current = true;
          clearDraft(survey.id, owner);
          releaseGuard();
          setClosed(e.message);
        } else if (e instanceof ApiError && e.status === 409) {
          // A second answer is not an error: the survey is already answered, so the Done screen shows.
          finished.current = true;
          clearDraft(survey.id, owner);
          releaseGuard();
          setRecap(null);
        } else setProblem(refusalText(e));
      } finally {
        setBusy(false);
      }
    },
    [anonymous, ageBand, check, leave, owner, qs, releaseGuard, shareState, survey.id],
  );

  function keep(g: Given | null) {
    const next = { ...given };
    if (g) next[q.id] = g;
    else delete next[q.id];
    // A voice answer is in the draft the moment its clip is ready, before anything is sent, so a reload (or a failed send) finds it ready.
    if (g?.kind === "voice") saveDraft(survey.id, { idx, given: next, anonymous, shareState, ageBand }, owner);
    setGiven(next);
    if (last) void submit(next);
    else setIdx(idx + 1);
  }

  if (closed !== null) return <Closed words={closed} canGoBack={canGoBack.current} />;
  if (recap !== undefined) return <Done survey={survey} recap={recap} />;

  const options = q.kind === "SINGLE_CHOICE" ? q.options : [];
  const sendDisabled = q.kind === "SINGLE_CHOICE" ? choice === null : q.kind === "TEXT" ? text.trim().length === 0 : true;
  const send = () => {
    if (q.kind === "SINGLE_CHOICE") {
      const o = options.find((x) => x.id === choice);
      if (o) keep({ kind: "choice", optionId: o.id, label: o.label });
    } else if (q.kind === "TEXT") keep({ kind: "text", text: text.trim() });
  };
  const askLeave = () => (Object.keys(given).length ? setLeaving(true) : leave());

  return (
    <>
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 dt:gap-6" data-testid="survey-ask">
        <div className="flex items-center gap-2 dt:h-[76px]">
          <span className="-ml-2 dt:hidden"><IconButton icon="x" label="Leave the survey" onClick={askLeave} /></span>
          <button type="button" onClick={askLeave} className="hidden min-h-[44px] flex-1 cursor-pointer items-center gap-[6px] border-0 bg-transparent p-0 text-label text-ink-2 dt:inline-flex">
            <Icon name="x" size={18} />Leave the survey
          </button>
          <span className="flex flex-1 justify-center dt:flex-none"><Badge tone="sponsored" icon="clipboard-list">Sponsored Survey</Badge></span>
          <button type="button" onClick={() => keep(null)} disabled={busy} className="inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent px-2 text-label text-green-text dt:hidden">Skip</button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-count text-ink-2">
            <span>{`Question ${idx + 1} of ${total}`}</span>
            <span>{`About ${minutes} min`}</span>
          </div>
          <div role="progressbar" aria-label="Survey progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={idx + 1} className="h-2 overflow-hidden rounded-pill bg-surface-2">
            <div className="h-full rounded-pill bg-green" style={{ width: `${Math.round(((idx + 1) / total) * 100)}%` }} />
          </div>
        </div>

        <QuestionCard
          key={q.id}
          survey={survey}
          q={q}
          choice={choice}
          onChoice={setChoice}
          text={text}
          onText={setText}
          sendDisabled={sendDisabled}
          busy={busy}
          onSend={send}
          onVoice={async (clip) => { if (check()) keep({ kind: "voice", clipId: clip.clipId, seconds: clip.seconds }); }}
          onVoiceReady={(clip) => setGiven((g) => ({ ...g, [qid]: { kind: "voice" as const, clipId: clip.clipId, seconds: clip.seconds } }))}
          voice={given[q.id]?.kind === "voice" ? (given[q.id] as Extract<Given, { kind: "voice" }>) : null}
          onSendVoice={() => keep(given[q.id])}
          onRerecord={() => {
            const g = given[q.id];
            if (g?.kind === "voice" && check()) void deleteVoiceClip(g.clipId).catch(() => undefined);
            const next = { ...given };
            delete next[q.id];
            setGiven(next);
          }}
          last={last}
          check={check}
        />

        {last ? (
          <section aria-label="What you share" className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]" data-testid="survey-share">
            <h2 className="m-0 text-body-strong">What the brand can see</h2>
            <p className="m-0 text-caption text-ink-2">{`${survey.brandName} sees totals only. You can add your state and age band to those totals. Both are optional.`}</p>
            <label className="flex items-center justify-between gap-3 text-label">
              <span>Answer without my name</span>
              <Switch checked={anonymous} onChange={setAnonymous} label="Answer without my name" />
            </label>
            <label className={`flex items-center justify-between gap-3 text-label ${anonymous ? "opacity-50" : ""}`}>
              <span>Share my state</span>
              <Switch checked={shareState && !anonymous} onChange={setShareState} disabled={anonymous} label="Share my state" />
            </label>
            <div className={`vx-field ${anonymous ? "opacity-50" : ""}`}>
              <label className="vx-field__label" htmlFor="sv-age">Share my age band</label>
              <div className="vx-field__box">
                <select id="sv-age" className="vx-field__input" value={anonymous ? "" : ageBand} disabled={anonymous} onChange={(e) => setAgeBand(e.target.value)}>
                  <option value="">Do not share</option>
                  {survey.ageBands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
            {anonymous ? <p className="m-0 text-caption text-ink-2">Nothing about you is kept with this answer.</p> : null}
          </section>
        ) : null}

        {problem ? <Banner tone="danger" title="Your answers were not sent" onClose={() => setProblem(null)}>{problem}</Banner> : null}

        <div className="hidden justify-between gap-2 dt:flex">
          <Button variant="ghost" icon="chevron-left" disabled={idx === 0 || busy} onClick={() => setIdx(idx - 1)}>Back</Button>
          <Button variant="ghost" disabled={busy} onClick={() => keep(null)}>Skip this question</Button>
        </div>

        <p className="m-0 flex items-start gap-[10px] rounded-l bg-surface-2 px-4 py-[14px] text-count dt:hidden">
          <Icon name="info" size={18} className="mt-[1px] flex-none" />
          <span>
            {`${survey.brandName} paid for this survey and WAWU approved it. Answering is free, optional, and never uses a free post. `}
            <button type="button" onClick={() => setWhy(true)} className="inline cursor-pointer border-0 bg-transparent p-0 text-count font-bold text-green-text">Why am I seeing this?</button>
          </span>
        </p>
      </div>

      <Rail>
        <AboutRail survey={survey} />
      </Rail>

      <Sheet title="Why am I seeing this?" open={why} onClose={() => setWhy(false)}>
        <p className="m-0 px-5 pb-6 text-body text-ink-2">{WHY_TEXT}</p>
      </Sheet>

      <Dialog title="Leave the survey?" open={leaving} confirmLabel="Leave" cancelLabel="Keep going" destructive onConfirm={leave} onClose={() => setLeaving(false)}>
        Your answers so far have not been sent. They are lost if you leave.
      </Dialog>
    </>
  );
}

function QuestionCard(p: {
  survey: Survey;
  q: SurveyQuestionView;
  choice: string | null;
  onChoice: (id: string) => void;
  text: string;
  onText: (v: string) => void;
  sendDisabled: boolean;
  busy: boolean;
  onSend: () => void;
  onVoice: (clip: { clipId: string; seconds: number }) => Promise<void>;
  /** The recording is uploaded and READY: kept in the draft now, shown ready to send. */
  onVoiceReady: (clip: { clipId: string; seconds: number }) => void;
  /** A recording already made and ready for this question (kept across a reload or a failed send). */
  voice: Extract<Given, { kind: "voice" }> | null;
  onSendVoice: () => void;
  onRerecord: () => void;
  last: boolean;
  /** True while the person is the one this tab loaded for; asked before every voice upload call. */
  check: () => boolean;
}) {
  const { survey, q } = p;
  const total = survey.questions.length;
  if (q.kind === "SINGLE_CHOICE") {
    const sel = q.options.findIndex((o) => o.id === p.choice);
    return (
      <SponsoredSurveyCard
        survey={survey}
        question={q.prompt}
        options={q.options.map((o) => o.label)}
        selected={sel < 0 ? null : sel}
        onSelect={(i) => p.onChoice(q.options[i].id)}
        sendDisabled={p.sendDisabled}
        sendBusy={p.busy}
        onSend={p.onSend}
        total={total}
      />
    );
  }
  if (q.kind === "TEXT") {
    return (
      <SponsoredSurveyCard survey={survey} question={q.prompt} sendDisabled={p.sendDisabled} sendBusy={p.busy} onSend={p.onSend} total={total} sendLabel="Send answer">
        <TextField label="Your answer" multiline value={p.text} onChange={p.onText} maxLength={TEXT_MAX} hint={`Up to ${TEXT_MAX} characters. Please leave out phone numbers and email addresses.`} />
      </SponsoredSurveyCard>
    );
  }
  if (p.voice) {
    return (
      <SponsoredSurveyCard survey={survey} question={q.prompt} hideActions total={total}>
        <section className="vx-rec flex flex-col gap-3" aria-label="Voice answer ready" data-testid="voice-ready">
          <p className="m-0 text-body-strong">{`Your voice answer is ready, ${clock(p.voice.seconds)}.`}</p>
          <p className="vx-rec__hint m-0">It is saved. Nothing is sent until you tap Send answer.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="rotate-ccw" disabled={p.busy} onClick={p.onRerecord}>Record again</Button>
            <Button size="l" icon="send" loading={p.busy} disabled={p.busy} onClick={p.onSendVoice}>Send answer</Button>
          </div>
        </section>
      </SponsoredSurveyCard>
    );
  }
  return (
    <SponsoredSurveyCard survey={survey} question={q.prompt} hideActions total={total}>
      <VoiceBox
        purpose="SURVEY_ANSWER"
        maxSeconds={survey.voiceMaxSeconds}
        freeSeconds={survey.voiceMaxSeconds}
        hint={<p className="vx-rec__hint">{"Tap to record. You have "}<b>{`${survey.voiceMaxSeconds} seconds`}</b>{". You can skip this question."}</p>}
        previewHint="Listen back. Nothing is sent until you tap Send answer."
        postingText="Saving"
        sendLabel={() => "Send answer"}
        onSend={(c) => p.onVoice({ clipId: c.clipId, seconds: c.seconds })}
        canWrite={p.check}
        onReady={(c) => p.onVoiceReady({ clipId: c.clipId, seconds: c.seconds })}
      />
    </SponsoredSurveyCard>
  );
}

function SponsoredSurveyCard(p: {
  survey: Survey;
  question: string;
  options?: string[];
  selected?: number | null;
  onSelect?: (i: number) => void;
  sendDisabled?: boolean;
  sendBusy?: boolean;
  onSend?: () => void;
  sendLabel?: string;
  hideActions?: boolean;
  total: number;
  children?: React.ReactNode;
}) {
  return (
    <SponsoredSurvey
      brand={p.survey.brandName}
      question={p.question}
      options={p.options}
      selected={p.selected}
      onSelect={p.options ? p.onSelect : undefined}
      sendDisabled={p.sendDisabled}
      sendBusy={p.sendBusy}
      onSend={p.onSend}
      sendLabel={p.sendLabel}
      hideActions={p.hideActions}
      questions={p.total}
      minutes={aboutMinutes(p.total)}
    >
      {p.children}
    </SponsoredSurvey>
  );
}

/** The server does not say what a brand aimed at, so this says only what is true of every survey. */
const WHY_TEXT = "The brand chose who to ask by topic, and sometimes by state. A state is used only if you turned on \u201CUse my state to choose surveys for me\u201D in Settings. Nothing else about you was used.";

/** The desktop right rail of the Survey screen: who is asking, and what they can and cannot see. */
function AboutRail({ survey }: { survey: Survey }) {
  return (
    <>
      <section aria-labelledby="sv-about" className="flex flex-col gap-[14px] rounded-l bg-surface p-5 shadow-[inset_0_0_0_1px_var(--line)]">
        <h2 id="sv-about" className="vx-eyebrow m-0 text-ink-2">About this survey</h2>
        <div className="flex items-center gap-3">
          <Avatar name={survey.brandName} tone="sun" />
          <span className="flex flex-col">
            <b className="text-body-strong">{survey.brandName}</b>
            {survey.brandSlug ? <Link href={`/brands/${survey.brandSlug}`} className="text-count text-green-text">See the brand page</Link> : null}
          </span>
        </div>
        <p className="m-0 flex gap-[10px] text-count"><Icon name="lock" size={18} className="flex-none" /><span>The brand sees totals only, never your name, handle or number.</span></p>
        <p className="m-0 flex gap-[10px] text-count"><Icon name="shield-check" size={18} className="flex-none" /><span>Checked and approved by WAWU before it ran.</span></p>
        <p className="m-0 flex gap-[10px] text-count"><Icon name="coins" size={18} className="flex-none" /><span>Free and optional. It never uses a free post.</span></p>
      </section>
      <section aria-labelledby="sv-why" className="flex flex-col gap-2 rounded-l bg-surface-2 p-5">
        <h2 id="sv-why" className="m-0 text-body-strong">Why am I seeing this?</h2>
        <p className="m-0 text-count text-ink-2">{WHY_TEXT}</p>
      </section>
    </>
  );
}

/** The survey closed before the answers arrived. The server's words, and a way back to where the person was in the feed. */
function Closed({ words, canGoBack }: { words: string; canGoBack: boolean }) {
  const router = useRouter();
  return (
    <Centre>
      <div data-testid="survey-closed">
        <EmptyState icon="clipboard-list" title={words} body="Thank you for trying. Your answers were not sent." action="Back to where you were" onAction={() => (canGoBack ? router.back() : router.push("/"))} />
      </div>
    </Centre>
  );
}

/** The Done screen (SurveyDone boards). `recap` is the person's own answers when they just sent them; null when the survey was already answered. */
function Done({ survey, recap }: { survey: Survey; recap: { prompt: string; line: string }[] | null }) {
  const router = useRouter();
  const visit = survey.brandWebsite ? { href: survey.brandWebsite, external: true } : survey.brandSlug ? { href: `/brands/${survey.brandSlug}`, external: false } : null;
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 dt:mt-[40px] dt:gap-6 dt:rounded-xl dt:bg-surface dt:p-10 dt:shadow-[inset_0_0_0_1px_var(--line)]" data-testid="survey-done">
      <div className="flex items-center justify-between dt:justify-center">
        <Badge tone="sponsored" icon="clipboard-list">Sponsored Survey</Badge>
        <span className="-mr-2 dt:hidden"><IconButton icon="x" label="Close" onClick={() => router.push("/")} /></span>
      </div>
      <div className="flex flex-col items-center gap-[10px] text-center dt:gap-3">
        <span className="relative flex h-24 w-24 items-center justify-center rounded-pill bg-mint text-green-text dt:h-28 dt:w-28">
          <Icon name="circle-check" size={48} />
          <span aria-hidden="true" className="absolute right-0 top-1 h-[14px] w-[14px] rounded-pill bg-sun" />
          <span aria-hidden="true" className="absolute bottom-2 left-0 h-[9px] w-[9px] rounded-pill bg-green" />
        </span>
        <h1 className="m-0 mt-1 font-display text-display-l dt:text-display-xl">Thanks. Your answers are in.</h1>
        <p className="m-0 text-body-l text-ink-2">{`${survey.brandName} sees the totals only, never your name, handle or number.`}</p>
      </div>
      {recap && recap.length ? (
        <section aria-label="Your answers" className="flex flex-col rounded-l bg-surface px-4 py-1 shadow-[inset_0_0_0_1px_var(--line)] dt:bg-surface-2 dt:shadow-none">
          {recap.map((r, i) => (
            <div key={i} className="flex flex-col gap-[2px] border-b border-line py-3 last:border-b-0">
              <span className="text-caption text-ink-2">{r.prompt}</span>
              <span className="text-body-strong">{r.line}</span>
            </div>
          ))}
        </section>
      ) : null}
      <div className="flex flex-col items-stretch gap-[10px] dt:flex-row dt:flex-wrap dt:items-center dt:justify-center">
        <Button size="l" icon="mic" onClick={() => router.push("/")}>Back to today&rsquo;s question</Button>
        {visit ? (
          visit.external ? (
            <a href={visit.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center px-3 text-label text-green-text no-underline">{`Visit ${survey.brandName}`}</a>
          ) : (
            <Link href={visit.href} className="inline-flex min-h-[44px] items-center justify-center px-3 text-label text-green-text no-underline">{`Visit ${survey.brandName}`}</Link>
          )
        ) : null}
      </div>
    </div>
  );
}
