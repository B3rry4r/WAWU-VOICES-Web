"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Icon, Sheet, Skeleton, TopicChip } from "@/components/vx";
import { listNews, listNewsTags, setTagFollows } from "@/lib/api/news";
import type { NewsAnswer, NewsTag, TagInfo } from "@/lib/api/news";
import { RailPortal, useSignedIn } from "@/features/results/shared";
import { NewsCard } from "./NewsCard";
import { SERVED } from "./served";
import { Switch, TAGS, TagMeanings, useDesktop } from "./tags";

type Load = "loading" | "error" | "ready";

export function NewsroomPage() {
  const signedIn = useSignedIn();
  const desktop = useDesktop();
  const [tag, setTag] = useState<NewsTag | null>(null);
  const [posts, setPosts] = useState<NewsAnswer[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [more, setMore] = useState(false);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [info, setInfo] = useState(false);
  const [change, setChange] = useState(false);
  const [followNote, setFollowNote] = useState<string | null>(null);

  const fetchTags = useCallback(() => listNewsTags().then((r) => setTags(r.items)).catch(() => undefined), []);
  useEffect(() => { void fetchTags(); }, [fetchTags, signedIn]);

  const fetchPosts = useCallback((t: NewsTag | null) => {
    setLoad("loading");
    listNews({ tag: t })
      .then((p) => { setPosts(p.items); setNext(p.nextCursor); setLoad("ready"); })
      .catch(() => setLoad("error"));
  }, []);
  useEffect(() => { fetchPosts(tag); }, [tag, fetchPosts, signedIn]);

  async function loadMore() {
    if (!next) return;
    setMore(true);
    try {
      const p = await listNews({ tag, cursor: next });
      setPosts((old) => old.concat(p.items));
      setNext(p.nextCursor);
    } catch { /* the button stays */ } finally { setMore(false); }
  }

  const followed = (t: NewsTag) => tags.find((x) => x.tag === t)?.followed ?? t === "VERIFIED_NEWS";
  async function toggle(t: NewsTag, on: boolean) {
    setFollowNote(null);
    const want = new Set(tags.filter((x) => x.followed).map((x) => x.tag));
    want.add("VERIFIED_NEWS");
    if (on) want.add(t); else want.delete(t);
    const before = tags;
    setTags((old) => old.map((x) => ({ ...x, followed: want.has(x.tag) })));
    try {
      await setTagFollows([...want]);
      await fetchTags();
    } catch {
      setTags(before);
      setFollowNote("Could not save. Try again.");
    }
  }

  const allCount = tags.reduce((n, t) => n + t.count, 0);
  const allNew = tags.reduce((n, t) => n + t.newCount, 0);
  const followedLabels = TAGS.filter((t) => followed(t.tag)).map((t) => t.label);
  const followText = followedLabels.length === 1 ? followedLabels[0] : followedLabels.slice(0, -1).join(", ") + " and " + followedLabels[followedLabels.length - 1];

  const switches = (
    <div className="flex flex-col gap-3">
      {TAGS.map((t) => (
        <div key={t.tag} className="flex items-center justify-between gap-3">
          <span className="text-[16px] font-semibold leading-5">{t.label}</span>
          <Switch on={followed(t.tag)} disabled={t.tag === "VERIFIED_NEWS"} label={t.label} onChange={(on) => void toggle(t.tag, on)} />
        </div>
      ))}
      {followNote ? <p className="m-0 text-[13px] leading-4 text-danger" role="alert">{followNote}</p> : null}
    </div>
  );

  return (
    <>
      <div className="flex items-center gap-2 pb-1 pt-1">
        <Link href="/discover" aria-label="Back to Discover" className="flex h-11 w-11 flex-none items-center justify-center rounded-pill bg-surface text-ink no-underline shadow-1 dt:hidden">
          <Icon name="arrow-left" size={24} />
        </Link>
        <Link href="/discover" className="mr-1 hidden items-center gap-1 text-[14px] font-semibold text-green-text no-underline hover:text-ink dt:inline-flex">
          <Icon name="arrow-left" size={18} />
          Discover
        </Link>
        <h1 className="m-0 mr-auto font-display text-[28px] font-normal leading-8 dt:hidden">Newsroom</h1>
        <button type="button" aria-label="What the tags mean" onClick={() => setInfo(true)} className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-pill border-0 bg-surface p-0 text-ink shadow-1 dt:hidden">
          <Icon name="info" size={24} />
        </button>
      </div>
      <h1 className="m-0 mb-1 hidden font-display text-[32px] font-normal leading-9 dt:block">Newsroom</h1>
      <p className="m-0 mb-3 text-[16px] leading-6 text-ink-2">Every news post shows one tag, so you know what is confirmed and what is talk. Only WAWU editors can mark a post Verified News.</p>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
        <TopicChip label="All" selected={tag === null} count={desktop && tags.length ? allCount : undefined} newCount={desktop && allNew ? allNew : undefined} onClick={() => setTag(null)} />
        {TAGS.map((t) => {
          const i = tags.find((x) => x.tag === t.tag);
          return <TopicChip key={t.tag} label={t.label} icon={t.icon} selected={tag === t.tag} count={desktop && i ? i.count : undefined} newCount={desktop && i?.newCount ? i.newCount : undefined} onClick={() => setTag(tag === t.tag ? null : t.tag)} />;
        })}
      </div>

      {SERVED.tagFollows && signedIn && tags.length ? (
        <div className="mb-4 flex items-center gap-3 rounded-l bg-surface-2 p-3 dt:hidden">
          <Icon name="bell" size={20} />
          <span className="flex-1 text-[14px] leading-5">You follow <b>{followText}</b></span>
          <button type="button" className="vx-link" onClick={() => setChange(true)}>Change</button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 pb-6">
        {load === "loading" ? (
          <><Skeleton variant="answer" /><Skeleton variant="answer" /></>
        ) : load === "error" ? (
          <EmptyState icon="wifi-off" title="Could not load the Newsroom" body="Check your connection and try again." action="Try again" actionIcon="refresh-cw" onAction={() => fetchPosts(tag)} />
        ) : posts.length === 0 ? (
          <EmptyState icon="radio" title={tag ? "No posts with this tag yet" : "No news posts yet"} />
        ) : (
          posts.map((p) => <NewsCard key={p.id} post={p} signedIn={signedIn === true} repliesHref={`/news/${p.id}`} />)
        )}
        {load === "ready" && next ? <Button variant="secondary" block loading={more} onClick={loadMore}>Show more</Button> : null}
      </div>

      {info ? (
        <Sheet title="What the tags mean" onClose={() => setInfo(false)}>
          <TagMeanings withFlagHint />
        </Sheet>
      ) : null}
      {change ? (
        <Sheet title="Follow by tag" onClose={() => setChange(false)}>
          {switches}
          <p className="m-0 mt-3 text-[14px] leading-5 text-ink-2">We tell you when a post with that tag goes up. Never on the lock screen.</p>
        </Sheet>
      ) : null}

      <RailPortal>
        <section className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-1" aria-label="What the tags mean">
          <h2 className="m-0 font-display text-[18px] font-normal leading-6">What the tags mean</h2>
          <TagMeanings withFlagHint />
        </section>
        {SERVED.tagFollows && signedIn && tags.length ? (
          <section className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-1" aria-label="Follow by tag">
            <h2 className="m-0 font-display text-[18px] font-normal leading-6">Follow by tag</h2>
            {switches}
            <p className="m-0 text-[14px] leading-5 text-ink-2">We tell you when a post with that tag goes up. Never on the lock screen.</p>
          </section>
        ) : null}
      </RailPortal>
    </>
  );
}
