"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Icon, Skeleton } from "@/components/vx";
import { getMyInvite, listFriends, type Friend, type MyInvite } from "@/lib/api/invite";
import { AppBar, Problem, SignInNote, failText, useSignedIn } from "@/features/talk/lib";
import { useToast } from "@/features/talk/TalkCard";
import { TONE, isMood } from "@/features/mood/mood";
import { answeredAgo, friendsLine, whatsappHref } from "@/features/share/invite-share";

/** Friends board: who came through my link and answered; a word only for a friend who keeps "Share my word" on. */
export function FriendsScreen() {
  const signedIn = useSignedIn();
  const [toast, push] = useToast();
  const [invite, setInvite] = useState<MyInvite | null>(null);
  const [items, setItems] = useState<Friend[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    setErr(null);
    Promise.all([getMyInvite(), listFriends()]).then(([i, f]) => {
      if (!live) return;
      setInvite(i); setItems(f.items); setCount(f.count); setNext(f.nextCursor);
    }, (e) => { if (live) setErr(e); });
    return () => { live = false; };
  }, [signedIn, tries]);

  const loadMore = useCallback(async () => {
    if (!next || more) return;
    setMore(true);
    try { const f = await listFriends(next); setItems((x) => [...x, ...f.items]); setNext(f.nextCursor); setCount(f.count); }
    catch (e) { push(failText(e), "danger"); } finally { setMore(false); }
  }, [next, more, push]);

  const header = <AppBar title="Your friends" back="/profile" />;
  if (signedIn === false) return <>{header}<div className="mt-4"><SignInNote>Sign in to see your friends.</SignInNote></div></>;
  if (err) return <>{header}<div className="mt-4"><Problem error={err} onRetry={() => setTries((n) => n + 1)} /></div></>;
  if (signedIn === null || count === null || !invite) return <>{header}<div className="mt-4 grid gap-3" aria-busy="true"><Skeleton variant="tile" /></div></>;

  async function copy() {
    try { await navigator.clipboard.writeText(invite!.url); push("Link copied.", "success"); } catch { push("We could not copy that. Try again.", "danger"); }
  }
  // The board's WhatsApp button here sends the same words as the You’re live screen, without a word of the person's own
  // (this screen does not know it), so it is the plain invitation.
  const text = inviteMessageNoWord(invite.url);
  return (
    <>
      {header}
      <div className="mt-5 grid gap-[18px] dt:max-w-[640px]">
        <section className="flex flex-col gap-[6px]">
          <h1 className="m-0 font-display text-[30px] leading-[34px] tracking-[-0.01em]">{friendsLine(count)}</h1>
          <p className="m-0 text-[15px] leading-[22px] text-[var(--ink-2)]">People who came through your link. You see a friend’s word only if they keep “Share my word” on.</p>
        </section>
        {items.length ? (
          <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
            {items.map((f) => (
              <li key={f.handle} className="flex items-center gap-3 rounded-[var(--radius-l)] bg-[var(--surface)] px-4 py-[14px] shadow-[inset_0_0_0_1px_var(--line)]">
                <Avatar name={f.displayName || f.handle} size="m" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold leading-5">{`@${f.handle}`}</span>
                  <span className="text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">{answeredAgo(f.answeredAt)}</span>
                </span>
                {f.word && isMood(f.word) ? (
                  <span className={`inline-flex h-7 flex-none items-center rounded-full px-[10px] text-[12px] font-extrabold leading-4 tracking-[0.06em] ${TONE[f.word].chip}`}>{f.word}</span>
                ) : f.wordShared ? null : (
                  <span className="inline-flex h-7 flex-none items-center gap-[6px] rounded-full bg-[var(--surface-2)] px-[10px] text-[12px] font-bold leading-4 text-[var(--ink-2)]"><Icon name="lock" size={14} />Word kept private</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {next ? <Button variant="secondary" loading={more} onClick={() => void loadMore()}>Show more</Button> : null}
        {items.length ? <p className="m-0 -mt-2 text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">A friend who keeps their word private still counts as answered.</p> : null}
        <section aria-labelledby="inv-h" className="flex flex-col gap-[10px] rounded-[var(--radius-l)] bg-[var(--forest)] px-4 py-[18px] text-[var(--on-forest)]">
          <h2 id="inv-h" className="m-0 font-display text-[22px] leading-[27px]">Send it to 3 people.</h2>
          <div className="flex items-center gap-2 rounded-[var(--radius-m)] bg-[var(--forest-2)] px-3 py-[10px]">
            <Icon name="link" size={18} />
            <span data-testid="friends-link" className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-5">{invite.url.replace(/^https?:\/\//, "")}</span>
            <Button variant="onforest" size="s" icon="copy" onClick={() => void copy()}>Copy</Button>
          </div>
          <Button size="l" block icon="send" href={whatsappHref(text)} target="_blank" rel="noopener noreferrer">Share on WhatsApp</Button>
          <p className="m-0 text-[13px] font-medium leading-[18px] text-[var(--on-forest-2)]">This link is yours. A friend who answers through it shows up here.</p>
        </section>
        <p className="m-0 text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">Your own word is shared with the friend who invited you. Change this in <Link href="/settings" className="text-[var(--green-text)]">Settings</Link>.</p>
      </div>
      {toast}
    </>
  );
}

/** This screen does not know the person's own word, so its WhatsApp message is the plain invitation. */
function inviteMessageNoWord(link: string): string {
  return `How do you feel about Nigeria?\n\nAdd your voice in a minute or less: ${link}`;
}
