"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, EmptyState, Icon, IconButton, Sheet, Skeleton, Tabs } from "@/components/vx";
import * as api from "@/lib/api/dm";
import { AppBar, Problem, SignInNote, useSignedIn } from "@/features/talk/lib";
import { announceDmUnread } from "@/components/shell/Messages";
import { personName, when } from "./dm-logic";
import "./dm.css";

/** New message: find a person by handle or name, then open the chat. */
function NewMessage({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<{ id: string; handle: string; displayName?: string | null; state?: string | null }[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const text = q.trim().replace(/^@/, "");
    if (text.length < 2) { setPeople(null); setFailed(false); return; }
    let stop = false;
    const t = setTimeout(() => {
      api.searchPeople(text).then((r) => { if (!stop) { setPeople(r.people); setFailed(false); } }, () => { if (!stop) setFailed(true); });
    }, 250);
    return () => { stop = true; clearTimeout(t); };
  }, [q]);
  return (
    <Sheet title="New message" onClose={onClose}>
      <div className="dm-menu">
        <label className="dm-search">
          <Icon name="search" size={20} />
          <span className="vx-sr">Search people by handle or name</span>
          <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by handle or name" />
        </label>
        {failed ? <p className="dm-note dm-note--err" role="alert">Could not search. Try again.</p> : null}
        {people && people.length === 0 ? <p className="dm-note">No one found. Check the handle.</p> : null}
        <div className="dm-people">
          {(people ?? []).map((p) => (
            <button key={p.id} type="button" className="dm-menu__row" onClick={() => router.push(`/messages/new/${p.id}`)}>
              <Avatar name={p.displayName ?? p.handle} size="s" />
              <span className="dm-head__who">
                <span className="dm-head__name">{p.displayName ?? `@${p.handle}`}</span>
                <span className="dm-head__sub">{`@${p.handle}${p.state ? ` · ${p.state}` : ""}`}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/** Messages: every conversation, the latest first. Unread rows are mint with a count; voice shows a mic and its length. */
export function InboxPage() {
  const signedIn = useSignedIn();
  const [items, setItems] = useState<api.DmConversation[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [find, setFind] = useState("");
  const [finding, setFinding] = useState(false);
  const [compose, setCompose] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.listConversations().then((p) => { setItems(p.items); setNext(p.nextCursor); }, setError);
    api.getDmUnread().then((r) => announceDmUnread(r.unread), () => undefined);
  }, []);
  useEffect(() => { if (signedIn) load(); }, [signedIn, load]);

  async function older() {
    if (!next || more) return;
    setMore(true);
    try {
      const p = await api.listConversations(next);
      setItems((cur) => [...(cur ?? []), ...p.items]);
      setNext(p.nextCursor);
    } catch (e) { setError(e); } finally { setMore(false); }
  }

  const unreadCount = useMemo(() => (items ?? []).filter((c) => c.unread > 0 && !c.muted).length, [items]);
  const shown = useMemo(() => {
    const t = find.trim().toLowerCase().replace(/^@/, "");
    return (items ?? []).filter((c) => (tab === "all" || (c.unread > 0 && !c.muted)) && (!t || c.person.handle.toLowerCase().includes(t) || (c.person.displayName ?? "").toLowerCase().includes(t) || (c.lastMessage?.preview ?? "").toLowerCase().includes(t)));
  }, [items, tab, find]);

  const bar = (
    <AppBar title="Messages" back="/profile" phoneOnly>
      <IconButton icon="search" label="Search messages" variant="ghost" iconSize={24} pressed={finding} onClick={() => setFinding((v) => !v)} />
      <IconButton icon="plus" label="New message" variant="ghost" iconSize={24} onClick={() => setCompose(true)} />
    </AppBar>
  );
  const head = (
    <div className="dm-deskhead dm-only-desk">
      <h1>Messages</h1>
      <Button icon="plus" onClick={() => setCompose(true)}>New message</Button>
    </div>
  );
  if (signedIn === false) return <div className="dm-page">{bar}<SignInNote from="/messages">Sign in to read your messages.</SignInNote></div>;
  if (error && !items) return <div className="dm-page">{bar}{head}<Problem error={error} onRetry={load} /></div>;
  if (!items) return <div className="dm-page" aria-busy="true">{bar}{head}<Skeleton variant="answer" /><Skeleton variant="answer" /></div>;

  return (
    <div className="dm-page">
      {bar}
      {head}
      <label className={"dm-search" + (finding ? "" : " dm-only-desk")}>
        <Icon name="search" size={20} />
        <span className="vx-sr">Search messages</span>
        <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search messages" />
      </label>
      <div className="dm-tabs">
        <Tabs label="Show messages" variant="segmented" block value={tab} onChange={(v) => setTab(v as "all" | "unread")} items={[{ id: "all", label: "All" }, { id: "unread", label: "Unread", count: unreadCount }]} />
      </div>
      {items.length === 0 ? (
        <EmptyState icon="message-circle" title="No messages yet" body="When someone writes to you, it shows here. Tap New message to write to someone." action="New message" onAction={() => setCompose(true)} />
      ) : shown.length === 0 ? (
        <EmptyState icon="message-circle" title={tab === "unread" ? "Nothing unread" : "No messages match"} body={tab === "unread" ? "You are all caught up." : "Try another name or handle."} />
      ) : (
        <ul className="dm-list" aria-label="Conversations">
          {shown.map((c) => {
            const last = c.lastMessage;
            const voice = last?.kind === "VOICE" && last.preview.startsWith("Voice message");
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className={"dm-row" + (c.unread > 0 && !c.muted ? " dm-row--unread" : "")} aria-label={`${personName(c.person)}${c.unread > 0 ? `, ${c.unread} unread` : ""}`}>
                  <Avatar name={personName(c.person)} />
                  <span className="dm-row__txt">
                    <span className="dm-row__top">
                      <span className="dm-row__name">{personName(c.person)}</span>
                      {c.person.deleted ? null : <span className="dm-row__handle">{`@${c.person.handle}`}</span>}
                      <span className="dm-row__time">{when(c.updatedAt)}</span>
                    </span>
                    <span className="dm-row__line">
                      {voice ? <Icon name="mic" size={16} /> : null}
                      <span>{last ? `${last.mine && !voice ? "You: " : ""}${voice ? last.preview : last.preview}` : ""}</span>
                      {c.unread > 0 && !c.muted ? <span className="dm-row__badge" data-testid="row-unread"><Badge tone="count">{c.unread}</Badge></span> : c.muted ? <span className="dm-row__badge"><Icon name="bell" size={16} label="Muted" /></span> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {next ? <Button variant="secondary" block loading={more} onClick={() => void older()}>Show older conversations</Button> : null}
      <p className="dm-foot">Messages are private between you and the other person. You can report or block from any chat.</p>
      {compose ? <NewMessage onClose={() => setCompose(false)} /> : null}
    </div>
  );
}
