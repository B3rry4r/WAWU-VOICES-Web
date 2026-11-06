"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, EmptyState, Icon, IconButton, NotFoundState, Sheet, Tabs } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { isSignedIn } from "@/lib/api/auth";
import { blockUser, createReport, getPerson, listPersonReplies, searchPeople, unblockUser, type PublicProfile, type ReportReason } from "@/lib/api/profile";
import { ShareSheet } from "@/features/share";
import { PagedList } from "./PostList";
import { PostRow, ReplyRow } from "./PostRow";
import { ProfileCard } from "./ProfileCard";
import { LoadError, LoadingBlock, errorLine } from "./states";
import { isUuid } from "./format";
import "./profile.css";
import { voicesOf } from "@/lib/feed-format";

type Resolved = { status: "loading" } | { status: "missing" } | { status: "error"; error: unknown } | { status: "ok"; id: string };

/** The URL carries a handle (or, until a handle lookup route exists, a user id). */
async function resolveId(segment: string): Promise<string | null> {
  if (isUuid(segment)) return segment;
  const handle = segment.replace(/^@/, "").toLowerCase();
  if (handle.length < 2) return null;
  const r = await searchPeople(handle);
  return r.people.find((p) => p.handle.toLowerCase() === handle)?.id ?? null;
}

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "HATE_OR_HARASSMENT", label: "Hate or harassment" },
  { id: "THREAT_OR_VIOLENCE", label: "Threat or violence" },
  { id: "SCAM_OR_SPAM", label: "Scam or spam" },
  { id: "PERSONAL_DETAILS", label: "Shares personal details" },
  { id: "OTHER", label: "Something else" },
];

function MoreSheet({ person, onClose, onBlocked }: { person: PublicProfile["profile"]; onClose: () => void; onBlocked: () => void }) {
  const [step, setStep] = useState<"menu" | "report" | "sent">("menu");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = "@" + person.handle;

  async function block() {
    setBusy(true); setError(null);
    try { await blockUser(person.id); onBlocked(); onClose(); } catch (e) { setError(errorLine(e)); } finally { setBusy(false); }
  }
  async function send() {
    if (!reason) return;
    setBusy(true); setError(null);
    try {
      const r = await createReport({ targetType: "USER", targetId: person.id, reason, ...(note.trim() ? { note: note.trim() } : {}), alsoBlock });
      setStep("sent");
      if (r.blocked) onBlocked();
    } catch (e) { setError(errorLine(e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title={step === "report" ? "Report " + handle : step === "sent" ? "Thanks. We got your report." : handle} onClose={onClose}>
      {step === "menu" ? (
        <div className="pf-menu">
          <button type="button" className="pf-menu__row" onClick={() => setStep("report")}><Icon name="flag" size={22} />{"Report " + handle}</button>
          <button type="button" className="pf-menu__row" onClick={block} disabled={busy}><Icon name="shield-alert" size={22} />{"Block " + handle}</button>
          <p className="pf-hint">Blocking hides you and them from each other.</p>
        </div>
      ) : null}
      {step === "report" ? (
        <div className="pf-menu">
          <p className="pf-hint">Strong opinions are welcome. We act on harassment, threats, scams and private details.</p>
          <div role="radiogroup" aria-label="Why are you reporting this person?" className="pf-radios">
            {REASONS.map((r) => (
              <label key={r.id} className="pf-radio"><input type="radio" name="reason" checked={reason === r.id} onChange={() => setReason(r.id)} />{r.label}</label>
            ))}
          </div>
          <label className="pf-field"><span>Add a note (optional)</span>
            <textarea maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should our team look at?" rows={3} />
          </label>
          <label className="pf-radio"><input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />{"Also block " + handle}</label>
          {error ? <p className="pf-note pf-note--err" role="alert">{error}</p> : null}
          <Button block loading={busy} disabled={!reason} onClick={send}>Send report</Button>
          <p className="pf-hint">The person is not told who reported them.</p>
        </div>
      ) : null}
      {step === "sent" ? (
        <div className="pf-menu">
          <p className="pf-body">{"Our moderators will look at " + handle + " and act if it breaks the community rules. " + handle + " is not told who reported them."}</p>
          <Button block variant="secondary" onClick={onClose}>Done</Button>
        </div>
      ) : null}
      {step === "menu" && error ? <p className="pf-note pf-note--err" role="alert">{error}</p> : null}
    </Sheet>
  );
}

export function PersonPage({ segment }: { segment: string }) {
  const router = useRouter();
  // Read in an effect: the server render and the first client render must match.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(isSignedIn()), []);
  const [who, setWho] = useState<Resolved>({ status: "loading" });
  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<"voices" | "replies">("voices");
  const [more, setMore] = useState(false);
  const [share, setShare] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    setWho({ status: "loading" }); setData(null); setError(null);
    resolveId(decodeURIComponent(segment)).then(
      (id) => {
        if (!id) { setWho({ status: "missing" }); return; }
        setWho({ status: "ok", id });
        getPerson(id, isSignedIn()).then(setData, (e: unknown) => (e instanceof ApiError && (e.status === 404 || e.status === 403) ? setWho({ status: "missing" }) : setError(e)));
      },
      (e: unknown) => setWho({ status: "error", error: e }),
    );
  }, [segment]);
  useEffect(() => { load(); }, [load, version]);

  const id = who.status === "ok" ? who.id : "";
  const loadVoices = useCallback((c?: string) => (c ? getPerson(id, isSignedIn(), c).then((p) => ({ items: p.recentAnswers, nextCursor: p.nextCursor })) : Promise.resolve({ items: data?.recentAnswers ?? [], nextCursor: data?.nextCursor ?? null })), [id, data]);
  const loadReplies = useCallback((c?: string) => listPersonReplies(id, isSignedIn(), c), [id]);

  const back = (
    <header className="pf-bar">
      <IconButton icon="arrow-left" label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} />
      <span className="pf-bar__sp" />
    </header>
  );

  if (who.status === "missing") return <div className="pf-page">{back}<NotFoundState body="The handle may have changed, or the account is gone." /></div>;
  if (who.status === "error") return <div className="pf-page">{back}<LoadError error={who.error} onRetry={load} /></div>;
  if (error) return <div className="pf-page">{back}<LoadError error={error} onRetry={load} /></div>;
  if (who.status === "loading" || !data) return <div className="pf-page">{back}<LoadingBlock /></div>;

  const profile = data.profile;
  const handle = "@" + profile.handle;
  return (
    <div className="pf-page">
      <header className="pf-bar">
        <IconButton icon="arrow-left" label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} />
        <span className="pf-bar__sp" />
        {/* lead ruling WF, 6 Nov (B-M5): the share icon (390) and "Share profile" (1440), with PROFILE links. */}
        {data.isBlockedByMe ? null : <IconButton className="pf-only-phone" icon="share-2" label={`Share ${handle}’s profile`} onClick={() => setShare(true)} />}
        {data.isBlockedByMe ? null : <Button className="pf-only-desk" variant="secondary" icon="share-2" onClick={() => setShare(true)}>Share profile</Button>}
        {signedIn ? <IconButton icon="ellipsis" label={`More: report or block ${handle}`} onClick={() => setMore(true)} /> : null}
      </header>
      <ProfileCard profile={profile} stats={[{ label: "Voices", value: voicesOf(profile) }, { label: "Reactions", value: profile.reactionsReceived }, { label: "Replies", value: profile.replyCount }]} />
      {data.isBlockedByMe ? (
        <div className="pf-blocked" data-testid="blocked">
          <Banner tone="info" title={`You blocked ${handle}`}>You do not see their posts, and they do not see yours.</Banner>
          <Button block variant="secondary" onClick={async () => { try { await unblockUser(profile.id); setVersion((v) => v + 1); } catch (e) { setError(e); } }}>{"Unblock " + handle}</Button>
        </div>
      ) : (
        <>
          <Tabs label={`${handle}'s posts`} value={tab} onChange={(v) => setTab(v as "voices" | "replies")} items={[{ id: "voices", label: "Voices", count: voicesOf(profile) }, { id: "replies", label: "Replies", count: profile.replyCount }]} />
          <div role="tabpanel" className="pf-panelbody">
            {tab === "voices"
              ? <PagedList load={loadVoices} reloadKey={String(version)} row={(a) => <PostRow a={a} />} empty={{ title: "No voices yet", body: `${handle} has not posted a voice yet.`, icon: "mic" }} />
              : <PagedList load={loadReplies} row={(r) => <ReplyRow r={r} />} empty={{ title: "No replies yet", body: `${handle} has not replied yet.`, icon: "message-circle" }} />}
          </div>
        </>
      )}
      {share ? <ShareSheet objectType="PROFILE" objectId={profile.id} onClose={() => setShare(false)} /> : null}
      {more ? <MoreSheet person={profile} onClose={() => setMore(false)} onBlocked={() => setVersion((v) => v + 1)} /> : null}
    </div>
  );
}


