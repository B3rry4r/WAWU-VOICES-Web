"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Icon } from "@/components/vx";
import { qrMatrix, qrSvgPath } from "@/lib/qr";
import type { ShareTarget } from "@/lib/api/reach";
import { friendsLine, inviteMessage, smsHref, smsKindFor, whatsappHref, type SmsKind } from "./invite-share";

/**
 * "Send it to 3 people." (YoureLive boards): WhatsApp first, then SMS, Copy link and More, the message exactly as it will
 * go, and a line on what we never do. Every one of these is a tap of the person's own; nothing opens, copies or sends
 * on its own, and nothing here reads contacts.
 */
export function InviteShare({ word, url, onIntent, onCopied, onFail }: {
  word: string;
  url: string | null;
  onIntent?: (t: ShareTarget) => void;
  onCopied: () => void;
  onFail: () => void;
}) {
  const [kind, setKind] = useState<SmsKind>("android");
  useEffect(() => { setKind(smsKindFor(navigator)); }, []);
  const text = url ? inviteMessage(word, url) : null;
  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); onIntent?.("COPY_LINK"); onCopied(); } catch { onFail(); }
  }
  async function more() {
    if (!text) return;
    onIntent?.("SYSTEM_SHEET");
    if (typeof navigator.share === "function") {
      try { await navigator.share({ text }); } catch { /* the person closed the sheet */ }
    } else {
      try { await navigator.clipboard.writeText(text); onCopied(); } catch { onFail(); }
    }
  }
  return (
    <section aria-labelledby="share-h" className="flex flex-col gap-[10px]">
      <h2 id="share-h" className="m-0 font-display text-[22px] leading-[27px]">Send it to 3 people.</h2>
      <Button size="l" block icon="send" disabled={!url} href={text ? whatsappHref(text) : undefined} target="_blank" rel="noopener noreferrer" onClick={() => onIntent?.("WHATSAPP")}>Share on WhatsApp</Button>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" size="m" icon="message-square" disabled={!url} href={text ? smsHref(text, kind) : undefined} onClick={() => onIntent?.("SMS")}>SMS</Button>
        <Button variant="secondary" size="m" icon="copy" disabled={!url} onClick={() => void copy()}>Copy link</Button>
        <Button variant="secondary" size="m" icon="share-2" disabled={!url} onClick={() => void more()}>More</Button>
      </div>
      <div className="flex flex-col gap-2 rounded-[var(--radius-l)] bg-[var(--surface-2)] px-4 py-[14px]">
        <span className="text-[12px] font-bold leading-4 uppercase tracking-[0.08em] text-[var(--ink-2)]">Your message</span>
        <p data-testid="invite-message" className="m-0 whitespace-pre-line break-words text-[15px] font-medium leading-[22px]">{text ?? inviteMessage(word, "…")}</p>
      </div>
      <p className="m-0 flex gap-2 text-[13px] font-medium leading-[18px] text-[var(--ink-2)]"><Icon name="lock" size={16} />SMS opens your own messages app. We never read your contacts and never send anything for you.</p>
    </section>
  );
}

/** The row under the card: how many friends have answered, and a way into the list. */
export function FriendsRow({ count, firstName }: { count: number; firstName?: string | null }) {
  return (
    <Link href="/friends" data-testid="friends-row" className="flex items-center gap-3 rounded-[var(--radius-l)] bg-[var(--surface)] px-4 py-[14px] text-[var(--ink)] no-underline shadow-[inset_0_0_0_1px_var(--line)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none">
      {firstName ? <Avatar name={firstName} size="m" /> : <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--mint)] text-[var(--green-text)]"><Icon name="user-check" size={20} /></span>}
      <span className="flex flex-1 flex-col">
        <span className="text-[15px] font-bold leading-5">{friendsLine(count)}</span>
        <span className="text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">{count > 0 ? "Tap to see their words" : "Tap to see your link"}</span>
      </span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

/** The QR code of the invite link, drawn here from the link itself: nothing is sent anywhere to make it. */
export function InviteQr({ url }: { url: string | null }) {
  const path = useMemo(() => (url ? qrSvgPath(qrMatrix(url)) : ""), [url]);
  const n = useMemo(() => (url ? qrMatrix(url).length : 0), [url]);
  return (
    <section aria-labelledby="ip-h" className="flex items-center gap-4 rounded-[var(--radius-l)] bg-[var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--line)]">
      <div role="img" aria-label="QR code of your invite link" data-testid="invite-qr" data-link={url ?? ""} className="box-border h-[105px] w-[105px] flex-none rounded-[10px] bg-white p-[6px] text-black">
        {url ? (
          <svg viewBox={`0 0 ${n} ${n}`} className="block h-full w-full text-black" shapeRendering="crispEdges" aria-hidden="true">
            <path d={path} fill="currentColor" />
          </svg>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h2 id="ip-h" className="m-0 font-display text-[20px] leading-6">Ask the person next to you, then compare</h2>
        <p className="m-0 text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">They scan this, say their word, and you both see where you sit.</p>
      </div>
    </section>
  );
}
