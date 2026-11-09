"use client";

import { BUSY_TEXT, BUSY_TITLE, isBusy } from "@/lib/api/busy";
import { useRouter } from "next/navigation";
import { signInHref } from "@/lib/auth/entry-draft";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Button, EmptyState, NotificationRow, Skeleton, Tabs } from "@/components/vx";
import type { NotificationRowProps } from "@/components/vx";
import { listNotifications, markNotificationsRead } from "@/lib/api/reach";
import { listResultThreads } from "@/lib/api/results";
import type { Notification, NotificationFilter } from "@/lib/api/reach";
import { announceUnread } from "@/components/shell/unread";
import { AppBar, isToday, useSignedIn, whenLabel } from "@/features/reach/shared";
import { APPEAL_SENT, AppealSheet } from "./AppealSheet";

type Load = "loading" | "error" | "ready";

const TABS: { id: NotificationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "replies", label: "Replies" },
  { id: "reactions", label: "Reactions" },
  { id: "polls", label: "Polls" },
];

const ROW_TYPE: Record<Notification["type"], NonNullable<NotificationRowProps["type"]>> = {
  DAILY_QUESTION: "daily",
  CATEGORY_ALERT: "daily",
  REPLY: "reply",
  REACTIONS: "reaction",
  POLL_CLOSED: "poll",
  FLASH_POLL: "poll",
  WEEKLY_REPORT: "poll",
  TAG_FOLLOW: "tag",
  TAG_CHANGED: "tag",
  OVERRIDE_ALERT: "tag",
  MODERATION_NOTICE: "tag",
  UNITS_ADDED: "units",
  EXTRA_VOICE_ADDED: "units",
  RESULT_CHECKED: "verified",
  VIDEO_READY: "verified",
};

/**
 * Where a notification opens (lead ruling WF, 6 Nov, RW7): an answer or a reply opens its thread, a question its page,
 * tokens their screen, the weekly report its page. A result post has no page of its own (resolved on tap, see
 * resultsHref); a decision about someone's own post or account opens nothing, because the post is gone and the
 * notice carries the Appeal action instead.
 */
export function targetHref(n: Pick<Notification, "targetType" | "targetId"> & { type?: Notification["type"]; questionId?: string | null }): string | null {
  if (n.type === "MODERATION_NOTICE") return null;
  const t = (n.targetType ?? "").toLowerCase();
  if (t === "wallet") return "/units";
  if (!n.targetId) return null;
  if (t === "weekly_report") return `/weekly/${n.targetId}`;
  if (t === "question") return `/q/${n.targetId}`;
  if (t === "poll" && n.type === "FLASH_POLL") return "/"; // the open flash poll sits on Home
  // LCH-07: a video notice opens that answer's share screen, where the video is
  if (t === "answer" && n.type === "VIDEO_READY") return n.questionId ? `/q/${n.questionId}/posted?a=${n.targetId}` : null;
  if (t === "answer") return n.questionId ? `/q/${n.questionId}/a/${n.targetId}` : null;
  return null;
}

/** A result post opens the live results thread it belongs to: the open one, else the latest. */
async function resultsHref(): Promise<string | null> {
  try {
    const page = await listResultThreads();
    const t = page.items.find((x) => x.status === "OPEN") ?? page.items[0];
    return t ? `/live/${t.id}` : null;
  } catch {
    return null;
  }
}

/** "@kemi.b" is bold, the rest is plain, as the board draws. A reply carries its quote after a colon. */
export function noticeWords(n: Pick<Notification, "type" | "title" | "body">): ReactNode {
  const named = /^(@\S+)(.*)$/.exec(n.title);
  if (named && (n.type === "REPLY" || n.type === "REACTIONS")) {
    const quote = n.type === "REPLY" && n.body ? `: ${n.body}` : "";
    return <><b>{named[1]}</b>{named[2] + quote}</>;
  }
  if (n.body) return <><b>{/[.!?:]$/.test(n.title) ? n.title : n.title + "."}</b>{" " + n.body}</>;
  return <>{n.title}</>;
}

const EMPTY: Record<NotificationFilter, { title: string; body: string }> = {
  all: { title: "Nothing new yet", body: "Replies, reactions, poll results and the daily question show up here." },
  replies: { title: "No replies yet", body: "When someone replies to your voice, you will see it here." },
  reactions: { title: "No reactions yet", body: "When people react to your voice, you will see it here." },
  polls: { title: "No poll alerts yet", body: "When a poll you voted in closes, you will see it here." },
};

/** /notifications: the in-app alerts (V-10: no phone push at launch), with type tabs and mark as read. */
export function NotificationsPage() {
  const signedIn = useSignedIn();
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [items, setItems] = useState<Notification[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [load, setLoad] = useState<Load>("loading");
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [appealing, setAppealing] = useState<Notification | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  // The sheet says "Appeal sent" itself; the notice row behind it updates only once the sheet has closed (WF-6b), so the words show once.
  const justSent = useRef<string | null>(null);

  useEffect(() => {
    if (signedIn !== true) return;
    let stop = false;
    setLoad("loading");
    listNotifications({ filter })
      .then((p) => {
        if (stop) return;
        setItems(p.items);
        setNext(p.nextCursor);
        setUnread(p.unread);
        announceUnread(p.unread);
        setLoad("ready");
      })
      .catch((e) => { if (!stop) { setBusy(isBusy(e)); setLoad("error"); } });
    return () => { stop = true; };
  }, [filter, signedIn, tick]);

  const loadMore = useCallback(async () => {
    if (!next) return;
    setMore(true);
    try {
      const p = await listNotifications({ filter, cursor: next });
      setItems((old) => old.concat(p.items));
      setNext(p.nextCursor);
    } catch {
      setNote("Could not load more. Try again.");
    } finally {
      setMore(false);
    }
  }, [filter, next]);

  async function readAll() {
    setNote(null);
    const before = items;
    setItems((old) => old.map((n) => ({ ...n, read: true })));
    try {
      const r = await markNotificationsRead([]);
      setUnread(r.unread);
      announceUnread(r.unread);
    } catch {
      setItems(before);
      setNote("Could not mark them as read. Try again.");
    }
  }

  async function open(n: Notification, e: MouseEvent) {
    e.preventDefault();
    const href = n.targetType === "result_post" ? await resultsHref() : targetHref(n);
    if (!n.read) {
      setItems((old) => old.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      try {
        const r = await markNotificationsRead([n.id]);
        setUnread(r.unread);
        announceUnread(r.unread);
      } catch {
        setItems((old) => old.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
        setNote("Could not mark it as read. Try again.");
      }
    }
    if (href) router.push(href);
  }

  const bar = <AppBar href="/" backLabel="Back to Home" title="Notifications" big />;
  const title = <h1 className="m-0 hidden font-display text-display-l dt:block">Notifications</h1>;

  if (signedIn === null) return <div>{bar}{title}</div>;
  if (signedIn === false) {
    return (
      <div className="flex flex-col gap-4">
        {bar}
        {title}
        <EmptyState icon="bell" title="Sign in to see your notifications" body="Replies, reactions and poll results show up here once you have an account." action="Sign in" onAction={() => router.push(signInHref("/notifications"))} />
      </div>
    );
  }

  const today = items.filter((n) => isToday(n.createdAt));
  const earlier = items.filter((n) => !isToday(n.createdAt));
  const group = (label: string, rows: Notification[], withReadAll: boolean) =>
    rows.length ? (
      <section key={label} className="flex flex-col gap-2" aria-label={label}>
        <div className="flex items-center justify-between">
          <h2 className="vx-eyebrow m-0 text-ink-2">{label}</h2>
          {withReadAll && unread > 0 ? (
            <button type="button" className="vx-link border-0 bg-transparent p-0" onClick={() => void readAll()}>Mark all as read</button>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-l bg-surface shadow-1">
          {rows.map((n) => (
            <div key={n.id}>
              <div onClick={(e) => void open(n, e)}>
                <NotificationRow type={ROW_TYPE[n.type]} unread={!n.read} time={whenLabel(n.createdAt)} href={targetHref(n) ?? "#"}>
                  {noticeWords(n)}
                </NotificationRow>
              </div>
              {n.resolved ? (
                // lead ruling WF-6 (RX2): its appeal was decided since: no Appeal action, a quiet caption
                <p className={`m-0 px-4 pb-3 pl-[calc(var(--space-4)+40px+var(--space-3))] text-caption text-[var(--ink-2)] ${n.read ? "" : "bg-[var(--mint)]"}`}>Decided</p>
              ) : n.appeal ? (
                <div className={`px-4 pb-3 pl-[calc(var(--space-4)+40px+var(--space-3))] ${n.read ? "" : "bg-[var(--mint)]"}`}>
                  {n.appeal.state === "SENT" || sent.includes(n.id) ? (
                    <p className="m-0 text-caption text-[var(--ink-2)]" role="status">{APPEAL_SENT}</p>
                  ) : n.appeal.state === "AVAILABLE" ? (
                    <button type="button" className="vx-link" onClick={() => setAppealing(n)}>Appeal</button>
                  ) : null /* any other state offers no Appeal (fallback to Notification.resolved above) */}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {bar}
      {title}
      <Tabs items={TABS} value={filter} onChange={(id) => setFilter(id as NotificationFilter)} label="Notification types" />
      {load === "loading" ? (
        <div className="flex flex-col gap-2"><Skeleton variant="line" /><Skeleton variant="answer" /></div>
      ) : load === "error" ? (
        <EmptyState icon={busy ? "triangle-alert" : "wifi-off"} title={busy ? BUSY_TITLE : "We could not load your notifications"} body={busy ? BUSY_TEXT : "Check your connection and try again."} action="Try again" actionIcon="refresh-cw" onAction={() => setTick((n) => n + 1)} />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title={EMPTY[filter].title} body={EMPTY[filter].body} />
      ) : (
        <>
          {group("Today", today, true)}
          {group("Earlier", earlier, today.length === 0)}
        </>
      )}
      {note ? <p className="m-0 text-caption text-danger" role="alert">{note}</p> : null}
      {appealing && appealing.appeal ? (
        <AppealSheet target={{ targetType: appealing.appeal.targetType, targetId: appealing.appeal.targetId }} onSent={() => { justSent.current = appealing.id; }} onClose={() => { const id = justSent.current; justSent.current = null; if (id) setSent((old) => old.concat(id)); setAppealing(null); }} />
      ) : null}
      {next && load === "ready" ? (
        <div className="flex justify-center"><Button variant="secondary" loading={more} onClick={() => void loadMore()}>Show older</Button></div>
      ) : null}
    </div>
  );
}
