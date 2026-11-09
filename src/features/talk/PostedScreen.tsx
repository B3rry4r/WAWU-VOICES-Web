"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, FreePosts, Icon, Sheet, Skeleton } from "@/components/vx";
import { recordShareEvent, type ShareTarget } from "@/lib/api/reach";
import * as api from "@/lib/api/talk";
import { API_BASE } from "@/lib/api/config";
import type { Allowances, Answer, ShareLink } from "@/lib/api/talk";
import { useLoad } from "@/components/feed/useLoad";
import { AppBar, Problem, SignInNote, failText, useSignedIn } from "./lib";
import { TalkCard, useShareSheet, useToast } from "./TalkCard";
import { getWhereYouSit, setCardName, type WhereYouSit } from "@/lib/api/mood";
import { CardNameSwitch, MoodCardPreview, WhereYouSitCard } from "@/features/mood/WhereYouSitCard";
import { TONE } from "@/features/mood/mood";

export function PostedScreen({ qid }: { qid: string }) {
  const aid = useSearchParams().get("a");
  const signedIn = useSignedIn();
  const [toast, push] = useToast();
  const [shareNode, share] = useShareSheet();
  const a = useLoad<Answer | null>(() => (aid ? api.getAnswer(aid) : Promise.resolve(null)), [aid, signedIn]);
  const [allow, setAllow] = useState<Allowances | null>(null);
  const [link, setLink] = useState<ShareLink | null>(null);
  const [storyHelp, setStoryHelp] = useState(false);
  // LCH-04 and LCH-03: on a mood answer, where the person sits and the "Show my name on the card" switch.
  const mood = a.state === "ready" ? a.data?.mood ?? null : null;
  const [sit, setSit] = useState<WhereYouSit | null>(null);
  const [nameOn, setNameOn] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  useEffect(() => {
    if (!aid || !signedIn || !mood) return undefined;
    let live = true;
    getWhereYouSit(aid).then((s) => { if (live) { setSit(s); setNameOn(s.showNameOnCard); } }, () => undefined);
    return () => { live = false; };
  }, [aid, signedIn, mood]);
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
  }, [aid, signedIn, nameOn]);

  const header = <><AppBar title="Posted" sub="Today’s question" close={`/q/${qid}`} /></>;
  if (signedIn === false) return <>{header}<div className="mt-4"><SignInNote>Sign in to see your posts.</SignInNote></div></>;
  if (a.state === "loading") return <>{header}<div className="mt-4 grid gap-3" aria-busy="true"><Skeleton variant="answer" /></div></>;
  if (a.state === "error") return <>{header}<div className="mt-4"><Problem error={a.error} onRetry={a.retry} /></div></>;
  const ans = a.data;
  const url = link?.url;
  async function copy() {
    if (!url || !link) return;
    try { await navigator.clipboard.writeText(url); void recordShareEvent(link.code, "intent", "COPY_LINK"); push("Link copied.", "success"); } catch (e) { push(failText(e), "danger"); }
  }
  const intent = (t: ShareTarget) => { if (link) void recordShareEvent(link.code, "intent", t); };
  /** WhatsApp Status cannot be posted from a web page: the link opens in WhatsApp, where the person picks Status or a chat. */
  // lead ruling WF, 6 Nov (B-L9): "Share to WhatsApp" and "WhatsApp Status" send the same words.
  const statusHref = link ? `https://wa.me/?text=${encodeURIComponent(link.previewText || link.url)}` : undefined;
  /** Instagram Stories cannot be posted from a web page either: the 1080x1920 story card (the link's storyImageUrl) is saved to the phone and a short how-to shows. */
  async function saveStoryCard(square = false) {
    if (!link) return;
    intent(square ? "SYSTEM_SHEET" : "INSTAGRAM_STORIES");
    try {
      const from = square ? link.squareImageUrl : link.storyImageUrl;
      if (!from) throw new Error("no card");
      const r = await fetch(from);
      if (!r.ok) throw new Error("card not ready");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = square ? "voices-card.png" : "voices-story-card.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      if (!square) setStoryHelp(true); else push("Your card is saved.", "success");
    } catch {
      push("The card is still being made. Try again in a moment.", "danger");
    }
  }
  async function toggleName(v: boolean) {
    if (!aid || nameBusy) return;
    setNameBusy(true);
    try { await setCardName(aid, v); setNameOn(v); } catch (e) { push(failText(e), "danger"); } finally { setNameBusy(false); }
  }
  return (
    <>
      {header}
      <div className="mt-4 grid gap-4 dt:max-w-[640px]">
        {mood ? (
          <div className="flex items-center gap-[14px]">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[var(--mint)] text-[var(--green-text)]"><Icon name="circle-check" size={30} /></span>
            <div className="flex flex-col gap-[2px]">
              <h1 className="m-0 font-display text-[28px] leading-8 tracking-[-0.01em]">You’re live</h1>
              <p className="m-0 text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">Your word: <b className={TONE[mood].text}>{mood}</b></p>
            </div>
          </div>
        ) : null}
        {mood && sit ? <WhereYouSitCard key={sit.updatedAt} sit={sit} /> : null}
        {mood ? null : <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[var(--mint)] text-[var(--green-text)]"><Icon name="circle-check" size={28} /></span>
          <div>
            <h1 className="m-0 font-display text-display-l">Your voice is live</h1>
            <p className="m-0 mt-1 text-body text-[var(--ink-2)]">It is under New. We will tell you when people reply.</p>
          </div>
        </div>}
        {allow ? <FreePosts left={allow.freePostsRemaining} /> : null}
        <section className="grid gap-3" aria-label="Share">
          <span className="hidden text-body-strong dt:block">Now let people hear you</span>
          <Button size="l" block icon="share-2" disabled={!url} href={statusHref} target="_blank" rel="noopener noreferrer" onClick={() => intent("WHATSAPP")}>Share to WhatsApp</Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" disabled={!url} href={statusHref} target="_blank" rel="noopener noreferrer" onClick={() => intent("WHATSAPP_STATUS")}>WhatsApp Status</Button>
            <Button variant="secondary" disabled={!url} onClick={() => void saveStoryCard(false)}>Instagram Stories</Button>
            <Button variant="secondary" icon="copy" disabled={!url} onClick={copy}>Copy link</Button>
            <Button variant="secondary" icon="ellipsis" disabled={!aid} onClick={() => aid && share("ANSWER", aid)}>More apps</Button>
          </div>
        </section>
        {mood && sit ? (
          <section aria-label="Your share card" className="grid gap-3">
            <MoodCardPreview word={mood} line={sit.cardLine} />
            <CardNameSwitch on={nameOn} busy={nameBusy} onChange={(v) => void toggleName(v)} />
            <Button variant="secondary" disabled={!link?.squareImageUrl} onClick={() => void saveStoryCard(true)}>Save the card as a picture</Button>
          </section>
        ) : null}
        {ans ? <TalkCard answer={ans} signedIn push={push} /> : null}
        {link?.imageUrl && link.cardStatus === "READY" ? (
          <>
            <p className="m-0 text-caption text-[var(--ink-2)]">{ans?.clip ? "People get this card and a link. Your recording itself is never shared as a file." : "People get this card and a link."}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${API_BASE}/share/${link.code}/card?v=${nameOn ? "n" : "a"}`} alt="The share card for your voice" className="w-full rounded-[var(--radius-l)]" />
          </>
        ) : null}
        <Link href={`/q/${qid}`} className="link-more justify-center text-label">Back to the conversation</Link>
      </div>
      {storyHelp ? (
        <Sheet title="Your card is saved" onClose={() => setStoryHelp(false)} footer={<Button size="l" block onClick={() => setStoryHelp(false)}>Done</Button>}>
          <ol className="m-0 grid list-decimal gap-2 pl-6 text-body marker:font-semibold">
            <li>Open Instagram and tap Your story.</li>
            <li>Pick the VOICES card from your photos.</li>
            <li>Add a link sticker with your link, then share.</li>
          </ol>
        </Sheet>
      ) : null}
      {/* lead ruling WF, 6 Nov (B-L3): no toast over the sheet. */}
      {storyHelp ? null : toast}
      {shareNode}
    </>
  );
}
