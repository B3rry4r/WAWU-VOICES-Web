"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon, Tabs } from "@/components/vx";
import { FreePosts } from "@/components/vx";
import { listMyAnswers, listSaved, type Me } from "@/lib/api/profile";
import { PagedList } from "./PostList";
import { PostRow } from "./PostRow";
import { ProfileCard } from "./ProfileCard";
import { Rail } from "@/components/shell/ShellSlots";
import { DeletionPending } from "./DeletionPending";
import { SuspendedBanner } from "./SuspendedBanner";
import { LoadError, LoadingBlock, NeedsProfileNotice, SignedOutNotice } from "./states";
import { applyAccountTheme } from "./theme";
import { useMe } from "./useMe";
import { unitsFigure } from "./format";
import { QuestionRow } from "./SavedRow";
import "./profile.css";
import { voicesOf } from "@/lib/feed-format";

function LinkRow({ href, icon, children, detail }: { href: string; icon: Parameters<typeof Icon>[0]["name"]; children: string; detail?: string }) {
  return (
    <Link href={href} className="pf-linkrow">
      <Icon name={icon} size={22} />
      <span className="pf-linkrow__txt"><b>{children}</b>{detail ? <span>{detail}</span> : null}</span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="pf-copy" aria-label="Copy referral code" onClick={async () => { try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); } }}>
      <Icon name={done ? "check" : "copy"} size={20} />
    </button>
  );
}

function Aside({ me }: { me: Me }) {
  const a = me.allowances;
  return (
    <>
      <section className="pf-panel" aria-label="Voice Units">
        <h2 className="vx-eyebrow pf-eyebrow">Voice Units</h2>
        <p className="pf-big"><b>{unitsFigure(a.balanceMilli)}</b> <span>{a.balanceMilli === 1000 ? "Voice Unit" : "Voice Units"}</span></p>
        <FreePosts left={a.freePostsRemaining} />
        <Link href="/units" className="vx-link pf-panel__link">Open Voice Units</Link>
      </section>
      <section className="pf-panel" aria-label="Your referral code">
        <h2 className="vx-eyebrow pf-eyebrow">Your referral code</h2>
        <div className="pf-code"><b>{me.referralCode}</b><CopyCode code={me.referralCode} /></div>
        <p className="pf-hint">It rides on every link you share, so friends who join from it are counted for you.</p>
      </section>
      <div className="pf-linkpanel">
        <LinkRow href="/settings" icon="settings">Settings</LinkRow>
        <LinkRow href="/profile/edit" icon="user">Edit profile</LinkRow>
        <LinkRow href="/settings/legal/rules" icon="shield-check">Community rules</LinkRow>
      </div>
    </>
  );
}

export function MePage() {
  const { state, reload } = useMe();
  const [tab, setTab] = useState<"voices" | "saved">("voices");
  const theme = state.status === "ready" ? state.me.settings.theme : null;
  useEffect(() => { if (theme) applyAccountTheme(theme); }, [theme]);
  const loadMine = useCallback((c?: string) => listMyAnswers(c).then((p) => ({ items: p.items.filter((i) => i.type === "answer" && i.answer).map((i) => i.answer!), nextCursor: p.nextCursor })), []);
  const loadSaved = useCallback((c?: string) => listSaved(c), []);

  if (state.status === "loading") return <><h1 className="pf-h1">Profile</h1><LoadingBlock /></>;
  if (state.status === "guest") return <><h1 className="pf-h1">Profile</h1><SignedOutNotice what="your profile" /></>;
  if (state.status === "error") return <><h1 className="pf-h1">Profile</h1><LoadError error={state.error} onRetry={reload} /></>;
  if (state.status === "needs-profile") return <><h1 className="pf-h1">Profile</h1><NeedsProfileNotice /></>;
  const { me } = state;
  if (me.status === "DELETION_PENDING") return <DeletionPending scheduledFor={me.deletionScheduledFor ?? null} onUndone={() => reload()} />;
  const profile = me.profile!;
  const a = me.allowances;
  return (
    <div className="pf-page">
      <h1 className="pf-h1">Profile</h1>
      {/* Me carries no suspendedUntil (checked against 6a): the banner reads the end day from the suspension notice. */}
      <SuspendedBanner status={me.status} until={(me as { suspendedUntil?: string | null }).suspendedUntil ?? null} />
      <ProfileCard
        own
        profile={profile}
        stats={[{ label: "Voices", value: voicesOf(profile) }, { label: "Reactions", value: me.reactionsReceived }, { label: "Saved", value: me.savedCount }]}
        unitsMilli={a.balanceMilli}
        freePosts={a.freePostsRemaining}
        referral={me.referralCode}
      />
      <div className="pf-phone-only">
        <div className="pf-linkpanel">
          <LinkRow href="/units" icon="wallet" detail={`${unitsFigure(a.balanceMilli)} ${a.balanceMilli === 1000 ? "unit" : "units"} · ${a.freePostsRemaining} free posts left`}>Voice Units</LinkRow>
          <LinkRow href="/settings" icon="settings">Settings</LinkRow>
          <LinkRow href="/settings/legal/rules" icon="shield-check">Community rules</LinkRow>
        </div>
        <p className="pf-hint">{`Your code ${me.referralCode} rides on every link you share, so friends who join from it are counted for you.`}</p>
      </div>
      <Tabs
        label="Your posts"
        value={tab}
        onChange={(v) => setTab(v as "voices" | "saved")}
        items={[{ id: "voices", label: "My voices", count: voicesOf(profile) }, { id: "saved", label: "Saved", count: me.savedCount }]}
      />
      <div role="tabpanel" className="pf-panelbody">
        {tab === "voices" ? (
          <PagedList load={loadMine} row={(x) => <PostRow a={x} />} empty={{ title: "No voices yet", body: "Answer today’s question and your voice shows up here.", icon: "mic" }} />
        ) : (
          <PagedList
            load={loadSaved}
            row={(s) => (s.kind === "ANSWER" && s.answer ? <PostRow a={s.answer} /> : s.question ? <QuestionRow q={s.question} /> : null)}
            empty={{ title: "Nothing saved yet", body: "Save a voice or a question and you will find it here.", icon: "bookmark" }}
          />
        )}
      </div>
      <Rail><Aside me={me} /></Rail>
    </div>
  );
}


