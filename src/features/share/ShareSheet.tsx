"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon, Sheet } from "@/components/vx";
import type { IconName } from "@/components/vx";
import { apiFetch } from "@/lib/api/client";
import { API_BASE } from "@/lib/api/config";
import { createShareLink, recordShareEvent } from "@/lib/api/reach";
import type { ShareLink, ShareObjectType, ShareTarget } from "@/lib/api/reach";
import { sessionStorage } from "@/lib/auth/session-storage";
import { useDesktop } from "@/features/reach/shared";
import { saveCardPicture, type CardSize } from "./save-card";

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
  /** Stories and TikTok have no web address to open: the card is saved to the phone and the person adds it in the app. */
  saves?: "Instagram" | "TikTok";
}

const enc = encodeURIComponent;
/**
 * The targets the ShareSheet boards draw, in the drawn order (WhatsApp, Status, Stories, Facebook, X, TikTok, Telegram, SMS, then Copy link
 * and More below). What a browser can really do: Status cannot be posted from a web page, so it opens WhatsApp where the person picks Status
 * or a chat (lead ruling WF, 6 Nov: the same words as WhatsApp); Stories and TikTok cannot be opened either, so the story card (1080 x 1920)
 * is saved to the phone and a short how-to shows, with the square card (1080 x 1080) one tap away.
 */
const ROWS: Row[] = [
  { id: "whatsapp", label: "WhatsApp", target: "WHATSAPP", abbr: "WA", href: (_u, full) => `https://wa.me/?text=${enc(full)}` },
  { id: "status", label: "Status", target: "WHATSAPP_STATUS", abbr: "WS", href: (_u, full) => `https://wa.me/?text=${enc(full)}` },
  { id: "stories", label: "Stories", target: "INSTAGRAM_STORIES", abbr: "IG", saves: "Instagram" },
  { id: "facebook", label: "Facebook", target: "FACEBOOK", abbr: "FB", href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { id: "x", label: "X", target: "X", abbr: "X", href: (u, _f, body) => `https://twitter.com/intent/tweet?text=${enc(body)}&url=${enc(u)}` },
  { id: "tiktok", label: "TikTok", target: "TIKTOK", abbr: "TT", saves: "TikTok" },
  { id: "telegram", label: "Telegram", target: "TELEGRAM", abbr: "TG", href: (u, _f, body) => `https://t.me/share/url?url=${enc(u)}&text=${enc(body)}` },
  { id: "sms", label: "SMS", target: "SMS", icon: "message-circle", href: (_u, full) => `sms:?&body=${enc(full)}` },
];

type Card = { state: "making" } | { state: "ready"; url: string } | { state: "none" };

function cardOf(l: ShareLink): Card {
  if (l.imageUrl && (l.cardStatus === "READY" || l.cardStatus === "FALLBACK")) return { state: "ready", url: l.imageUrl };
  if (l.cardStatus === "PENDING") return { state: "making" };
  return { state: "none" };
}

/** One link per open: React runs an effect twice in development, and both runs share the one request in flight. */
const inFlight = new Map<string, Promise<ShareLink>>();
export function makeLinkOnce(objectType: ShareObjectType, objectId: string, signedIn: boolean): Promise<ShareLink> {
  const key = `${objectType}:${objectId}:${signedIn}`;
  const have = inFlight.get(key);
  if (have) return have;
  const p = createShareLink(objectType, objectId, signedIn).finally(() => {
    setTimeout(() => inFlight.delete(key), 0);
  });
  inFlight.set(key, p);
  return p;
}

/** Where the card is while it is being made: GET /share/{code}/card answers 202 until the image exists (then 200, an image). */
export async function cardIsReady(code: string): Promise<boolean> {
  try {
    const r = await apiFetch<unknown>(`/share/${encodeURIComponent(code)}/card`);
    return r !== undefined;
  } catch (e) {
    return e instanceof SyntaxError; // a 200 carries an image, not JSON: the card is there
  }
}

function Round({ children, label, onClick, href, tone, disabled }: { children: ReactNode; label: string; onClick?: () => void; href?: string; tone?: "mint"; disabled?: boolean }) {
  const body = (
    <>
      <span className={"flex h-[52px] w-[52px] items-center justify-center rounded-pill border border-line text-[15px] font-extrabold leading-none text-ink " + (tone === "mint" ? "bg-mint text-green-text" : "bg-surface-2")}>{children}</span>
      <span className="text-[12px] font-semibold leading-4 text-ink">{label}</span>
    </>
  );
  const cls = "flex w-full flex-col items-center gap-[6px] border-0 bg-transparent p-0 text-center no-underline disabled:opacity-50";
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
  // Stories and TikTok: which app the saved card is for, the size just saved, and whether a save is running or failed.
  const [saved, setSaved] = useState<{ app: "Instagram" | "TikTok"; size: CardSize } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const signedIn = useRef(false);
  const copy = COPY[objectType];

  useEffect(() => {
    signedIn.current = !!sessionStorage.getToken();
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watch = (l: ShareLink, n: number) => {
      cardIsReady(l.code).then((ready) => {
        if (stop) return;
        if (ready) setCard({ state: "ready", url: `${API_BASE}/share/${encodeURIComponent(l.code)}/card` });
        else if (n < 10) timer = setTimeout(() => watch(l, n + 1), 1500);
        else setCard({ state: "none" });
      });
    };
    makeLinkOnce(objectType, objectId, signedIn.current)
      .then((l) => {
        if (stop) return;
        setLink(l);
        const c = cardOf(l);
        setCard(c);
        if (c.state === "making") watch(l, 0);
      })
      .catch(() => {
        if (!stop) setFailed(true);
      });
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

  async function saveCard(size: CardSize, app: "Instagram" | "TikTok", target: ShareTarget) {
    if (!link || saving) return;
    intent(target);
    setSaving(true);
    setSaveFailed(false);
    try {
      await saveCardPicture(size === "story" ? link.storyImageUrl : link.squareImageUrl, size);
      setSaved({ app, size });
    } catch {
      setSaved(null);
      setSaveFailed(true);
    } finally {
      setSaving(false);
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
          <p className="m-0 rounded-m bg-danger-bg p-3 text-caption text-danger" role="alert">We could not make your link. Close this and try again.</p>
        ) : card.state === "ready" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.url} alt="The card that goes out with your link" width={1200} height={630} className="block h-auto w-full rounded-m border border-line" />
        ) : card.state === "making" ? (
          <div className="vx-skel flex aspect-[1200/630] w-full items-center justify-center rounded-m bg-surface-2 text-caption text-ink-2" aria-busy="true">Making your card</div>
        ) : (
          <p className="m-0 rounded-m bg-surface-2 p-3 text-caption text-ink-2">{text}</p>
        )}
        <div className="grid grid-cols-5 gap-x-1 gap-y-3" role="group" aria-label="Share to">
          {ROWS.map((r) => (
            <Round
              key={r.id}
              label={r.label}
              disabled={!link || (!!r.saves && saving)}
              href={link && r.href ? r.href(link.url, text, body) : undefined}
              onClick={link ? (r.saves ? () => void saveCard("story", r.saves!, r.target) : () => intent(r.target)) : undefined}
            >
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
        {saved ? (
          <div className="grid gap-2 rounded-m bg-surface-2 p-3" role="status" data-testid="card-saved">
            <p className="m-0 text-body-strong text-ink">{saved.size === "story" ? "Your story card is saved" : "Your square card is saved"}</p>
            <ol className="m-0 grid list-decimal gap-1 pl-5 text-caption text-ink-2">
              <li>{saved.app === "Instagram" ? "Open Instagram and tap Your story." : "Open TikTok and tap the plus button."}</li>
              <li>Pick the VOICES card from your photos.</li>
              <li>{saved.app === "Instagram" ? "Add a link sticker with your link, then share." : "Add the link to your caption, then post."}</li>
            </ol>
            {saved.size === "story" ? (
              <button type="button" className="justify-self-start border-0 bg-transparent p-0 text-label text-green-text underline" disabled={saving} onClick={() => void saveCard("square", saved.app, saved.app === "Instagram" ? "INSTAGRAM_STORIES" : "TIKTOK")}>
                Save the square card instead (1080 x 1080)
              </button>
            ) : null}
          </div>
        ) : null}
        {saveFailed ? <p className="m-0 rounded-m bg-danger-bg p-3 text-caption text-danger" role="alert">The card is still being made. Try again in a moment.</p> : null}
        <p className="m-0 mx-auto text-center text-caption text-ink-2">
          {signedIn.current ? "Sharing is free. Your link carries your referral code." : "Sharing is free."}
        </p>
      </div>
    </Sheet>
  );
}
