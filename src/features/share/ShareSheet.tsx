"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon, Sheet } from "@/components/vx";
import type { IconName } from "@/components/vx";
import { createShareLink, recordShareEvent } from "@/lib/api/reach";
import type { ShareLink, ShareObjectType, ShareTarget } from "@/lib/api/reach";
import { sessionStorage } from "@/lib/auth/session-storage";
import { useDesktop } from "@/features/reach/shared";

const COPY: Record<ShareObjectType, { title: string; subtitle: string }> = {
  ANSWER: { title: "Share this voice", subtitle: "A card and a link go out. The audio file never does." },
  QUESTION: { title: "Share this question", subtitle: "A card and a link go out." },
  POLL_RESULT: { title: "Share these results", subtitle: "A card and a link go out." },
  WEEKLY_REPORT: { title: "Share this week", subtitle: "A card and a link go out." },
  PROFILE: { title: "Share this profile", subtitle: "A card and a link go out." },
  CATEGORY: { title: "Share this topic", subtitle: "A card and a link go out." },
  RESULT_THREAD: { title: "Share this thread", subtitle: "A card and a link go out." },
  WHAT_NEXT_SUMMARY: { title: "Share this summary", subtitle: "A card and a link go out." },
};

interface Row {
  id: string;
  label: string;
  target: ShareTarget;
  abbr?: string;
  icon?: IconName;
  /** `full` is the text with the link in it (for targets with no separate url); `body` is the text without the link. One link per message. */
  href?: (url: string, full: string, body: string) => string;
}

const enc = encodeURIComponent;
/** What a browser can really do. Status, Stories and TikTok only exist inside their own apps, so a web page cannot open them. */
const ROWS: Row[] = [
  { id: "whatsapp", label: "WhatsApp", target: "WHATSAPP", abbr: "WA", href: (_u, full) => `https://wa.me/?text=${enc(full)}` },
  { id: "facebook", label: "Facebook", target: "FACEBOOK", abbr: "FB", href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { id: "x", label: "X", target: "X", abbr: "X", href: (u, _f, body) => `https://twitter.com/intent/tweet?text=${enc(body)}&url=${enc(u)}` },
  { id: "telegram", label: "Telegram", target: "TELEGRAM", abbr: "TG", href: (u, _f, body) => `https://t.me/share/url?url=${enc(u)}&text=${enc(body)}` },
  { id: "sms", label: "SMS", target: "SMS", icon: "message-circle", href: (_u, full) => `sms:?&body=${enc(full)}` },
];

type Card = { state: "making" } | { state: "ready"; url: string } | { state: "none" };

function cardOf(l: ShareLink): Card {
  if (l.imageUrl && (l.cardStatus === "READY" || l.cardStatus === "FALLBACK")) return { state: "ready", url: l.imageUrl };
  if (l.cardStatus === "PENDING") return { state: "making" };
  return { state: "none" };
}

function Round({ children, label, onClick, href, tone, disabled }: { children: ReactNode; label: string; onClick?: () => void; href?: string; tone?: "mint"; disabled?: boolean }) {
  const body = (
    <>
      <span className={"flex h-14 w-14 items-center justify-center rounded-pill border border-line text-[16px] font-extrabold text-ink " + (tone === "mint" ? "bg-mint text-green-text" : "bg-surface-2")}>{children}</span>
      <span className="text-[14px] font-semibold leading-5 text-ink">{label}</span>
    </>
  );
  const cls = "flex w-[72px] flex-col items-center gap-1 border-0 bg-transparent p-0 text-center no-underline disabled:opacity-50";
  return href ? (
    <a className={cls} href={href} target="_blank" rel="noreferrer noopener" onClick={onClick} aria-label={label}>{body}</a>
  ) : (
    <button type="button" className={cls} onClick={onClick} aria-label={label} disabled={disabled}>{body}</button>
  );
}

/**
 * The share sheet any page opens. It makes the link and the 1200 x 630 card (POST /share/links), shows the card, and
 * offers the targets a browser can reach: WhatsApp, Facebook, X, Telegram, SMS, Copy link and the phone's own share sheet.
 * Every tap records an intent (POST /share/{code}/events).
 */
/** The preview text without the line that carries the link, for targets that take the link as a separate parameter. */
export function textWithoutLink(previewText: string, url: string): string {
  return previewText.split("\n").filter((l) => !l.includes(url)).join("\n").trim();
}

export function ShareSheet({ objectType, objectId, onClose }: { objectType: ShareObjectType; objectId: string; onClose: () => void }) {
  const desktop = useDesktop();
  const [link, setLink] = useState<ShareLink | null>(null);
  const [card, setCard] = useState<Card>({ state: "making" });
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const signedIn = useRef(false);
  const copy = COPY[objectType];

  useEffect(() => {
    signedIn.current = !!sessionStorage.getToken();
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const make = (n: number) =>
      createShareLink(objectType, objectId, signedIn.current)
        .then((l) => {
          if (stop) return;
          setLink(l);
          const c = cardOf(l);
          setCard(c);
          if (c.state === "making" && n < 10) timer = setTimeout(() => make(n + 1), 1500);
          else if (c.state === "making") setCard({ state: "none" });
        })
        .catch(() => {
          if (!stop) setFailed(true);
        });
    void make(0);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [objectType, objectId]);

  const text = link?.previewText ?? "";
  const body = link ? textWithoutLink(text, link.url) : "";
  const intent = (t: ShareTarget) => {
    if (link) void recordShareEvent(link.code, "intent", t);
  };

  async function copyLink() {
    if (!link) return;
    intent("COPY_LINK");
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", link.url);
    }
  }

  async function more() {
    if (!link) return;
    intent("SYSTEM_SHEET");
    try {
      await navigator.share({ title: "VOICES", text: body, url: link.url });
    } catch {
      /* the person closed the phone's share sheet */
    }
  }

  return (
    <Sheet title={copy.title} subtitle={copy.subtitle} variant={desktop ? "dialog" : "sheet"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {failed ? (
          <p className="m-0 rounded-m bg-danger-bg p-3 text-[14px] leading-5 text-danger" role="alert">We could not make your link. Close this and try again.</p>
        ) : card.state === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.url} alt="The card that goes out with your link" width={1200} height={630} className="block h-auto w-full rounded-m border border-line" />
        ) : card.state === "making" ? (
          <div className="vx-skel flex aspect-[1200/630] w-full items-center justify-center rounded-m bg-surface-2 text-[14px] text-ink-2" aria-busy="true">Making your card</div>
        ) : (
          <p className="m-0 rounded-m bg-surface-2 p-3 text-[14px] leading-5 text-ink-2">{text}</p>
        )}
        <div className="flex flex-wrap justify-center gap-x-1 gap-y-4" role="group" aria-label="Share to">
          {ROWS.map((r) => (
            <Round key={r.id} label={r.label} disabled={!link} href={link && r.href ? r.href(link.url, text, body) : undefined} onClick={link ? () => intent(r.target) : undefined}>
              {r.icon ? <Icon name={r.icon} size={24} /> : r.abbr}
            </Round>
          ))}
          <Round label={copied ? "Copied" : "Copy link"} tone="mint" disabled={!link} onClick={() => void copyLink()}>
            <Icon name={copied ? "check" : "link"} size={24} />
          </Round>
          {canNative ? (
            <Round label="More" disabled={!link} onClick={() => void more()}>
              <Icon name="ellipsis" size={24} />
            </Round>
          ) : null}
        </div>
        <p className="m-0 text-center text-[14px] leading-5 text-ink-2">
          {signedIn.current ? "Sharing is free. Your link carries your referral code." : "Sharing is free."}
        </p>
      </div>
    </Sheet>
  );
}
