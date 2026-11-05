"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Icon, Sheet, Skeleton, TextField } from "@/components/vx";
import * as api from "@/lib/api/talk";
import type { Answer, ReportReason, ReportReceipt } from "@/lib/api/talk";
import { AppBar, Problem, ShellTweaks, SignInNote, failText, useSignedIn } from "./lib";
import { ApiError } from "@/lib/api/client";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "HATE_OR_HARASSMENT", label: "Hate or harassment" },
  { id: "THREAT_OR_VIOLENCE", label: "Threat or violence" },
  { id: "SCAM_OR_SPAM", label: "Scam or spam" },
  { id: "PERSONAL_DETAILS", label: "Shares personal details" },
  { id: "MISLEADING_NEWS_TAG", label: "Misleading news tag" },
  { id: "OTHER", label: "Something else" },
];

const clock = (d: Date) => d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).replace(/\s/g, "").toLowerCase();

export function ReportScreen({ type, id }: { type: string; id: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const target = type.toUpperCase() === "REPLY" ? "REPLY" : "ANSWER";
  const [ans, setAns] = useState<Answer | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [tries, setTries] = useState(0);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ r: ReportReceipt; at: Date } | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (target !== "ANSWER") return;
    setErr(null);
    api.getAnswer(id).then(setAns, setErr);
  }, [id, target, tries]);

  const handle = ans?.author?.handle;
  const back = ans ? `/q/${ans.questionId}` : "/";
  const noun = target === "REPLY" ? "reply" : "voice";
  const header = <><ShellTweaks tabBar={false} /><AppBar title={`Report this ${noun}`} sub={handle ? `From @${handle}` : undefined} close={back} /></>;
  if (signedIn === false) return <>{header}<div className="mt-4"><SignInNote>Sign in to report. Reading and listening stay free.</SignInNote></div></>;
  if (err) return <>{header}<div className="mt-4"><Problem error={err} onRetry={() => setTries((n) => n + 1)} /></div></>;
  if (signedIn === null || (target === "ANSWER" && !ans)) return <>{header}<div className="mt-4 grid gap-3" aria-busy="true"><Skeleton variant="answer" /></div></>;

  async function send() {
    if (!reason || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.createReport({ targetType: target, targetId: id, reason, note: note.trim() || undefined, alsoBlock: block && !!handle });
      setBlocked(r.blocked);
      setDone({ r, at: new Date() });
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 409 ? "You already reported this. Our team has it." : failText(e));
    } finally {
      setBusy(false);
    }
  }
  async function undo() {
    if (!ans?.author) return;
    try { await api.unblockUser(ans.author.id); setBlocked(false); } catch (e) { setMsg(failText(e)); }
  }

  return (
    <>
      {header}
      <div className="mt-4 grid gap-4 pb-6 dt:max-w-[560px]">
        <p className="m-0 text-[17px] leading-6 text-[var(--ink-2)]">Strong opinions are welcome. We act on harassment, threats, scams and private details.</p>
        <div role="radiogroup" aria-label="Why are you reporting this voice?" className="grid gap-3">
          {REASONS.map((r) => {
            const on = reason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setReason(r.id)}
                className={`flex min-h-14 items-center gap-3 rounded-[var(--radius-m)] border px-4 text-left text-[16px] font-bold ${on ? "border-[var(--green-text)] bg-[var(--mint)] text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--green-text)]" : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]"}`}
              >
                <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${on ? "bg-[var(--green)] text-[var(--on-green)]" : "border-2 border-[var(--line-strong)]"}`}>{on ? <Icon name="check" size={16} strokeWidth={3} /> : null}</span>
                {r.label}
              </button>
            );
          })}
        </div>
        <TextField label="Add a note (optional)" multiline maxLength={280} placeholder="What should our team look at?" value={note} onChange={setNote} />
        {handle ? (
          <label className="flex items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--green)]" checked={block} onChange={(e) => setBlock(e.target.checked)} />
            <span><b className="block">{`Also block @${handle}`}</b><span className="text-[var(--ink-2)]">You will not see their voices or replies.</span></span>
          </label>
        ) : null}
        {msg ? <p role="alert" className="m-0 text-[14px] font-semibold text-[var(--danger)]">{msg}</p> : null}
        <div className="sticky bottom-0 -mx-4 grid gap-2 bg-[var(--bg)] px-4 pb-3 pt-2 dt:static dt:mx-0 dt:px-0">
          <Button size="l" block icon="flag" disabled={!reason} loading={busy} onClick={send}>Send report</Button>
          <p className="m-0 text-center text-[13px] text-[var(--ink-2)]">The person is not told who reported them.</p>
        </div>
      </div>
      {done ? (
        <Sheet
          variant="dialog"
          title="Thanks. We got your report."
          onClose={() => router.push(back)}
          footer={<div className="vx-dialog__btns"><Button size="l" block onClick={() => router.push(back)}>Back to the conversation</Button></div>}
        >
          <div className="grid gap-3">
            <span className="vx-eyebrow text-[var(--green-text)]">{`Report sent at ${clock(done.at)}`}</span>
            <p className="m-0 text-[16px] leading-6">{`Our moderators will look at this ${noun}${handle ? ` from @${handle}` : ""} and act if it breaks the community rules.${handle ? ` @${handle} is not told who reported it.` : ""}`}</p>
            {handle && (blocked || block) ? (
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-m)] bg-[var(--surface-2)] p-3">
                <span className="text-[15px] font-semibold">{blocked ? `You blocked @${handle}` : `You unblocked @${handle}`}</span>
                {blocked ? <Button variant="secondary" size="s" onClick={undo}>Undo</Button> : null}
              </div>
            ) : null}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
