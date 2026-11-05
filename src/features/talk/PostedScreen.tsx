"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, FreePosts, Icon, Skeleton } from "@/components/vx";
import * as api from "@/lib/api/talk";
import { API_BASE } from "@/lib/api/config";
import type { Allowances, Answer, ShareLink } from "@/lib/api/talk";
import { useLoad } from "@/components/feed/useLoad";
import { AppBar, Problem, ShellTweaks, SignInNote, failText, useSignedIn } from "./lib";
import { TalkCard, useShareSheet, useToast } from "./TalkCard";

export function PostedScreen({ qid }: { qid: string }) {
  const aid = useSearchParams().get("a");
  const signedIn = useSignedIn();
  const [toast, push] = useToast();
  const [shareNode, share] = useShareSheet();
  const a = useLoad<Answer | null>(() => (aid ? api.getAnswer(aid) : Promise.resolve(null)), [aid, signedIn]);
  const [allow, setAllow] = useState<Allowances | null>(null);
  const [link, setLink] = useState<ShareLink | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    api.getAllowance().then(setAllow, () => undefined);
  }, [signedIn]);
  useEffect(() => {
    if (!aid || !signedIn) return;
    let live = true;
    let n = 0;
    const go = async () => {
      try {
        const l = await api.createShareLink("ANSWER", aid);
        if (!live) return;
        setLink(l);
        if (l.cardStatus === "PENDING" && n++ < 5) setTimeout(go, 2000);
      } catch { /* the buttons stay hidden until a link exists */ }
    };
    void go();
    return () => { live = false; };
  }, [aid, signedIn]);

  const header = <><ShellTweaks tabBar /><AppBar title="Posted" sub="Today’s question" close={`/q/${qid}`} /></>;
  if (signedIn === false) return <>{header}<div className="mt-4"><SignInNote>Sign in to see your posts.</SignInNote></div></>;
  if (a.state === "loading") return <>{header}<div className="mt-4 grid gap-3" aria-busy="true"><Skeleton variant="answer" /></div></>;
  if (a.state === "error") return <>{header}<div className="mt-4"><Problem error={a.error} onRetry={a.retry} /></div></>;
  const ans = a.data;
  const url = link?.url;
  async function copy() {
    if (!url || !link) return;
    try { await navigator.clipboard.writeText(url); void api.shareEvent(link.code, "intent"); push("Link copied.", "success"); } catch (e) { push(failText(e), "danger"); }
  }
  return (
    <>
      {header}
      <div className="mt-4 grid gap-4 dt:max-w-[640px]">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[var(--mint)] text-[var(--green-text)]"><Icon name="circle-check" size={28} /></span>
          <div>
            <h1 className="m-0 font-display text-[28px] font-normal leading-8">Your voice is live</h1>
            <p className="m-0 mt-1 text-[15px] leading-5 text-[var(--ink-2)]">It is under New. We will tell you when people reply.</p>
          </div>
        </div>
        {allow ? <FreePosts left={allow.freePostsRemaining} /> : null}
        <section className="grid gap-3" aria-label="Share">
          <span className="hidden text-[16px] font-bold dt:block">Now let people hear you</span>
          <Button size="l" block icon="share-2" disabled={!url} href={url ? `https://wa.me/?text=${encodeURIComponent(url)}` : undefined} target="_blank" rel="noopener noreferrer" onClick={() => link && void api.shareEvent(link.code, "intent")}>Share to WhatsApp</Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" icon="copy" disabled={!url} onClick={copy}>Copy link</Button>
            <Button variant="secondary" icon="ellipsis" disabled={!aid} onClick={() => aid && share("ANSWER", aid)}>More apps</Button>
          </div>
        </section>
        {ans ? <TalkCard answer={ans} signedIn push={push} /> : null}
        {link?.imageUrl && link.cardStatus === "READY" ? (
          <>
            <p className="m-0 text-[14px] leading-5 text-[var(--ink-2)]">People get this card and a link. Your recording itself is never shared as a file.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${API_BASE}/share/${link.code}/card`} alt="The share card for your voice" className="w-full rounded-[var(--radius-l)]" />
          </>
        ) : null}
        <Link href={`/q/${qid}`} className="text-center text-[15px] font-semibold">Back to the conversation</Link>
      </div>
      {toast}
      {shareNode}
    </>
  );
}
