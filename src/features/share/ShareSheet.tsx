"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Icon, Sheet } from "@/components/vx";
import type { IconName } from "@/components/vx";
import { apiFetch } from "@/lib/api/client";
import { API_BASE } from "@/lib/api/config";
import { createShareLink, recordShareEvent } from "@/lib/api/reach";
import type { ShareLink, ShareObjectType, ShareTarget } from "@/lib/api/reach";
import { sessionStorage } from "@/lib/auth/session-storage";
import { useDesktop } from "@/features/reach/shared";
import { canShareCard, cardFile, downloadCard, fetchCard, type CardSize } from "./save-card";

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
  /** Status opens WhatsApp with the words; where the device can share a picture file it hands the story card over instead. */
  status?: boolean;
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
  { id: "status", label: "Status", target: "WHATSAPP_STATUS", abbr: "WS", status: true, href: (_u, full) => `https://wa.me/?text=${enc(full)}` },
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

function Round({ children, label, onClick, href, tone, disabled }: { children: ReactNode; label: string; onClick?: (e: MouseEvent) => void; href?: string; tone?: "mint"; disabled?: boolean }) {
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
  const [canFiles, setCanFiles] = useState(false);
  // Stories and TikTok: which app the saved card is for, the size just saved, and whether a save is running or failed.
  const [saved, setSaved] = useState<{ app: "Instagram" | "TikTok" | "WhatsApp"; size: CardSize } | null>(null);
  // The story and square pictures, fetched once the card is ready: shown small before anything is saved, and ready for the phone's share sheet.
  const [pics, setPics] = useState<Partial<Record<CardSize, { blob: Blob; url: string }>>>({});
  const panel = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const signedIn = useRef(false);
  const copy = COPY[objectType];

  useEffect(() => {
    signedIn.current = !!sessionStorage.getToken();
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
    setCanFiles(canShareCard(new File(["x"], "voices-card.png", { type: "image/png" })));
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

  useEffect(() => {
    if (!link || card.state !== "ready") return undefined;
    let live = true;
    const made: string[] = [];
    for (const size of ["story", "square"] as const)
      fetchCard(size === "story" ? link.storyImageUrl : link.squareImageUrl).then(
        (blob) => {
          const url = URL.createObjectURL(blob);
          made.push(url);
          if (live) setPics((p) => ({ ...p, [size]: { blob, url } }));
          else URL.revokeObjectURL(url);
        },
        () => undefined,
      );
    return () => { live = false; made.forEach((u) => URL.revokeObjectURL(u)); };
  }, [link, card.state]);
  useEffect(() => { if (saved) panel.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, [saved]);

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

  /**
   * Hands the picture over: to the phone's own share sheet where the device can share a file, else it is saved to the downloads and
   * the panel says only that. A cancelled share sheet is not an error.
   */
  async function handOver(size: CardSize, app: "Instagram" | "TikTok" | "WhatsApp", target: ShareTarget) {
    if (!link || saving) return;
    intent(target);
    setSaving(true);
    setSaveFailed(false);
    try {
      const blob = pics[size]?.blob ?? (await fetchCard(size === "story" ? link.storyImageUrl : link.squareImageUrl));
      const file = cardFile(blob, size);
      if (canShareCard(file)) {
        try { await navigator.share({ files: [file], title: "VOICES" }); } catch { /* the person closed the phone's share sheet */ }
        setSaved(null);
      } else {
        downloadCard(blob, size);
        setSaved({ app, size });
      }
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
              onClick={
                link
                  ? (e) => {
                      if (r.saves) void handOver("story", r.saves, r.target);
                      else if (r.status && canFiles && pics.story) { e.preventDefault(); void handOver("story", "WhatsApp", r.target); }
                      else intent(r.target);
                    }
                  : undefined
              }
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
        {pics.story || pics.square ? (
          <div className="flex items-end gap-4" data-testid="card-previews">
            {(["story", "square"] as const).map((size) =>
              pics[size] ? (
                <figure key={size} className="m-0 grid justify-items-start gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pics[size]!.url} alt={size === "story" ? "The story version of the card" : "The square version of the card"} className={"block rounded-s border border-line " + (size === "story" ? "h-24 w-auto" : "h-[68px] w-[68px]")} />
                  <figcaption className="text-caption text-ink-2">{size === "story" ? "Story" : "Square"}</figcaption>
                </figure>
              ) : null,
            )}
          </div>
        ) : null}
        {saved ? (
          <div ref={panel} className="grid gap-2 rounded-m bg-surface-2 p-3" role="status" data-testid="card-saved">
            <p className="m-0 text-body-strong text-ink">{saved.size === "story" ? "Your story card is saved" : "Your square version is saved"}</p>
            <p className="m-0 text-caption text-ink-2">Saved to your downloads. Open the app and add it from there.</p>
            {saved.size === "story" ? (
              <button type="button" className="justify-self-start border-0 bg-transparent p-0 text-label text-green-text underline" disabled={saving} onClick={() => void handOver("square", saved.app, saved.app === "Instagram" ? "INSTAGRAM_STORIES" : saved.app === "TikTok" ? "TIKTOK" : "WHATSAPP_STATUS")}>
                Save the square version instead
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
