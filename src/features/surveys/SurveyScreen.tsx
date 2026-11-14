"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Badge, Banner, Button, Dialog, EmptyState, Icon, IconButton, Skeleton, SponsoredSurvey, Switch, TextField } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { Rail } from "@/components/shell/ShellSlots";
import { VoiceBox } from "@/features/speak/VoiceBox";
import { refusalText } from "@/features/speak/logic";
import { isSignedIn } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { answerSurvey, getSurvey, recordSurveyEvent, type Survey, type SurveyQuestionView } from "@/lib/api/surveys";
import { aboutMinutes, recapLine, TEXT_MAX, toInputs, type Given, type GivenByQuestion } from "./logic";

/** The Sponsored Survey, one question at a time (Survey boards), then the Done screen. Answering is free; nothing here touches tokens or a free post. */
export function SurveyScreen({ id }: { id: string }) {
  const [signed, setSigned] = useState<boolean | null>(null);
  useEffect(() => setSigned(isSignedIn()), []);
  const load = useLoad<Survey | null>(async () => {
    if (!signed) return null;
    return getSurvey(id);
  }, [id, signed]);

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
  return <Ask survey={survey} />;
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

function Ask({ survey }: { survey: Survey }) {
  const router = useRouter();
  const qs = survey.questions;
  const total = qs.length;
  const [idx, setIdx] = useState(0);
  const [given, setGiven] = useState<GivenByQuestion>({});
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [shareState, setShareState] = useState(false);
  const [ageBand, setAgeBand] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [recap, setRecap] = useState<{ prompt: string; line: string }[] | null | undefined>(undefined);
  const started = useRef(false);
  const q = qs[idx];
  const last = idx === total - 1;
  const minutes = aboutMinutes(total);

  // START is counted once, when the first question is shown.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void recordSurveyEvent(survey.id, "START");
  }, [survey.id]);

  // A question opens with what the person gave before (Back), or empty.
  useEffect(() => {
    const g = given[q.id];
    setChoice(g?.kind === "choice" ? g.optionId : null);
    setText(g?.kind === "text" ? g.text : "");
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const leave = useCallback(() => {
    void recordSurveyEvent(survey.id, "SKIP");
    router.push("/");
  }, [router, survey.id]);

  const submit = useCallback(
    async (all: GivenByQuestion) => {
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
        setRecap(qs.filter((x) => all[x.id]).map((x) => ({ prompt: x.prompt, line: recapLine(all[x.id]) })));
      } catch (e) {
        // A second answer is not an error: the survey is already answered, so the Done screen shows.
        if (e instanceof ApiError && e.status === 409) setRecap(null);
        else setProblem(refusalText(e));
      } finally {
        setBusy(false);
      }
    },
    [anonymous, ageBand, leave, qs, shareState, survey.id],
  );

  function keep(g: Given | null) {
    const next = { ...given };
    if (g) next[q.id] = g;
    else delete next[q.id];
    setGiven(next);
    if (last) void submit(next);
    else setIdx(idx + 1);
  }

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
          onVoice={async (clip) => keep({ kind: "voice", clipId: clip.clipId, seconds: clip.seconds })}
          last={last}
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
          <span>{`${survey.brandName} paid for this survey and WAWU approved it. Answering is free, optional, and never uses a free post.`}</span>
        </p>
      </div>

      <Rail>
        <AboutRail survey={survey} />
      </Rail>

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
  last: boolean;
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
        <p className="m-0 text-count text-ink-2">The brand chose who to ask by place and topic. Nothing else about you was used.</p>
      </section>
    </>
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
