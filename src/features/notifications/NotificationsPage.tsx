"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Button, EmptyState, NotificationRow, Skeleton, Tabs } from "@/components/vx";
import type { NotificationRowProps } from "@/components/vx";
import { listNotifications, markNotificationsRead } from "@/lib/api/reach";
import type { Notification, NotificationFilter } from "@/lib/api/reach";
import { announceUnread } from "@/components/shell/unread";
import { AppBar, isToday, useSignedIn, whenLabel } from "@/features/reach/shared";

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
};

/** Where a notification opens. Only screens that exist are linked; a row with no screen yet just marks itself read. */
export function targetHref(n: Pick<Notification, "targetType" | "targetId">): string | null {
  if (!n.targetId) return null;
  const t = (n.targetType ?? "").toLowerCase();
  if (t === "weekly_report") return `/weekly/${n.targetId}`;
  if (t === "question") return `/q/${n.targetId}`;
  return null;
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
  const [more, setMore] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

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
      .catch(() => { if (!stop) setLoad("error"); });
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
    const href = targetHref(n);
    if (!n.read) {
      setItems((old) => old.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      try {
        const r = await markNotificationsRead([n.id]);
        setUnread(r.unread);
        announceUnread(r.unread);
      } catch {
        setItems((old) => old.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
        setNote("Could not mark it as read. Try again.");
        return;
      }
    }
    if (href) router.push(href);
  }

  const bar = <AppBar href="/" backLabel="Back to Home" title="Notifications" big />;
  const title = <h1 className="m-0 hidden font-display text-[32px] font-normal leading-9 dt:block">Notifications</h1>;

  if (signedIn === null) return <div>{bar}{title}</div>;
  if (signedIn === false) {
    return (
      <div className="flex flex-col gap-4">
        {bar}
        {title}
        <EmptyState icon="bell" title="Sign in to see your notifications" body="Replies, reactions and poll results show up here once you have an account." />
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
            <div key={n.id} onClick={(e) => void open(n, e)}>
              <NotificationRow type={ROW_TYPE[n.type]} unread={!n.read} time={whenLabel(n.createdAt)} href={targetHref(n) ?? "#"}>
                {n.body ? <><b>{n.title}</b>{" " + n.body}</> : <>{n.title}</>}
              </NotificationRow>
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
        <EmptyState icon="wifi-off" title="We could not load your notifications" body="Check your connection and try again." action="Try again" actionIcon="refresh-cw" onAction={() => setTick((n) => n + 1)} />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title={EMPTY[filter].title} body={EMPTY[filter].body} />
      ) : (
        <>
          {group("Today", today, true)}
          {group("Earlier", earlier, today.length === 0)}
        </>
      )}
      {note ? <p className="m-0 text-[13px] leading-4 text-danger" role="alert">{note}</p> : null}
      {next && load === "ready" ? (
        <div className="flex justify-center"><Button variant="secondary" loading={more} onClick={() => void loadMore()}>Show older</Button></div>
      ) : null}
    </div>
  );
}
