"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banner, Button, EmptyState, Icon, Skeleton } from "@/components/vx";
import type { IconName } from "@/components/vx";
import { getTopic } from "@/lib/api/admin";
import type { AdminToday, Role } from "@/lib/api/admin";
import { useAdmin } from "./AdminFrame";
import { canOpen } from "./roles";
import type { AdminPageId } from "./roles";
import { dayKey, longSlot, weekday } from "@/lib/format/date";
import { clock, dayClock, longDate, minutesWords, slot } from "./time";
import { Card, Eyebrow, LoadFailed, PageHead, Pill, StatePill } from "./ui";

const TARGET_WORDS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  WHATSAPP_STATUS: "WhatsApp Status",
  INSTAGRAM_STORIES: "Instagram Stories",
  FACEBOOK: "Facebook",
  X: "X",
  TIKTOK: "TikTok",
  TELEGRAM: "Telegram",
  SMS: "SMS",
  COPY_LINK: "Copied links",
  SYSTEM_SHEET: "The share sheet",
};

/** "8:48am" when it closes today, "20 Nov, 8:48am" when the window runs on (C-L1). */
function closesAt(iso: string): string {
  return dayKey(iso) === dayKey(new Date()) ? clock(iso) : dayClock(iso);
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 font-display text-num-l text-ink">{value}</div>
      <div className={`mt-1 ${warn ? "text-count text-warning" : "text-caption text-ink-2"}`}>{sub}</div>
    </div>
  );
}

interface Row {
  page: AdminPageId;
  href: string;
  icon: IconName;
  tone: string;
  title: string;
  sub: string;
  count: number;
}

function attentionRows(t: AdminToday, roles: Role[]): Row[] {
  const a = t.needsAttention;
  const rows: Row[] = [
    { page: "news", href: "/admin/news", icon: "shield-check", tone: "bg-verified-bg text-verified", title: "News tags to review", sub: `${a.newsFlagged} flagged as misleading`, count: a.newsTags },
    { page: "results", href: "/admin/results", icon: "circle-check", tone: "bg-verified-bg text-verified", title: "Posted results to check", sub: "Mark each Verified or Not verified", count: a.resultPosts },
    { page: "ads", href: "/admin/ads", icon: "megaphone", tone: "bg-sponsor-bg text-sponsor", title: "Adverts to approve", sub: `${a.adsAwaiting} ${a.adsAwaiting === 1 ? "advert" : "adverts"} waiting`, count: a.ads },
    { page: "weekly", href: "/admin/weekly", icon: "chart-column", tone: "bg-success-bg text-success", title: "Weekly report draft", sub: "Ready to review before it goes out", count: a.weeklyReports },
    { page: "moderation", href: "/admin/moderation", icon: "shield-alert", tone: "bg-warning-bg text-warning", title: "Reports and screening", sub: "Held until a moderator checks them", count: a.moderation },
    { page: "moderation", href: "/admin/moderation", icon: "shield-alert", tone: "bg-danger-bg text-danger", title: "Sensitive-topic queue", sub: "Extra review", count: a.sensitive },
  ];
  return rows.filter((r) => canOpen(roles, r.page) && r.count > 0);
}

export function AdminTodayPage() {
  const { today, todayError, reloadToday, roles } = useAdmin();
  const [poll, setPoll] = useState<{ title: string; endsAt: string } | null>(null);
  const topicId = today?.topic?.id;
  const mayCalendar = canOpen(roles, "calendar");

  useEffect(() => {
    setPoll(null);
    if (!topicId || !mayCalendar) return;
    let live = true;
    getTopic(topicId).then(
      (d) => live && d.poll && setPoll({ title: d.poll.title, endsAt: d.poll.endsAt }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [topicId, mayCalendar]);

  if (todayError && !today) return <LoadFailed error={todayError} retry={reloadToday} />;
  if (!today) {
    return (
      <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
        <Skeleton variant="line" width="30%" />
        <Skeleton variant="tile" />
        <Skeleton variant="tile" />
      </div>
    );
  }

  const t = today;
  const live = t.flowState === "OVERRIDE_LIVE";
  const q = t.todaysQuestion;
  const top = [...t.stats.sharesByTarget].sort((a, b) => b.count - a.count)[0];
  const rows = attentionRows(t, roles);
  const mayOverride = canOpen(roles, "override");
  const hasQuestion = !!q?.id;

  return (
    <div>
      <PageHead
        eyebrow={`${longDate(t.date + "T12:00:00+01:00")} · Week ${t.weekNumber}`}
        title="Today"
        right={
          <>
            {live ? <StatePill tone="red" icon="radio">Override live</StatePill> : <StatePill tone="green" icon="circle-check">Normal flow running</StatePill>}
            {mayOverride ? (
              <Button variant="secondary" icon="clock" href="/admin/override">
                Override the day
              </Button>
            ) : null}
          </>
        }
      />
      {live ? (
        <Banner tone="warning" title="An override is live" className="mb-4">
          Today’s question is paused. The normal flow comes back by itself when the override ends.
        </Banner>
      ) : null}

      <div className="mb-5 grid grid-cols-4 gap-5">
        <Tile label="Voices today" value={t.stats.voicesToday.toLocaleString("en-NG")} sub={`${t.stats.voicePercent}% voice, ${100 - t.stats.voicePercent}% text`} />
        <Tile label="Poll votes" value={t.stats.pollVotes.toLocaleString("en-NG")} sub={`Week ${t.weekNumber} poll`} />
        <Tile label="Shares" value={t.stats.shares.toLocaleString("en-NG")} sub={top && top.count > 0 ? `${TARGET_WORDS[top.target] ?? top.target} leads` : "None yet"} />
        <Tile
          label="Open reports"
          value={String(t.needsAttention.moderationOpen)}
          sub={t.stats.oldestReportMinutes != null ? `Oldest waiting ${minutesWords(t.stats.oldestReportMinutes)}` : "None waiting"}
          warn={t.stats.oldestReportMinutes != null}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start gap-5">
        <div className="flex flex-col gap-5">
          {hasQuestion ? (
            <section className="rounded-xl bg-green p-6 text-green-on">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-xs bg-forest px-2.5 py-1 text-eyebrow uppercase text-forest-on">Today’s question</span>
                {q.startsAt && q.endsAt ? <span className="text-count">{`Live since ${clock(q.startsAt)} · closes ${closesAt(q.endsAt)}`}</span> : null}
              </div>
              <h2 className="m-0 mt-4 font-display text-display-l">{q.text}</h2>
              <p className="m-0 mt-4 text-count">
                {[`${q.voiceCount.toLocaleString("en-NG")} ${q.voiceCount === 1 ? "voice" : "voices"}`, q.category?.name, q.sensitive ? "Sensitive topic: ads are kept away" : null].filter(Boolean).join("  ·  ")}
              </p>
            </section>
          ) : (
            <EmptyState icon="clock" title="No question is live" body="Nothing is scheduled for today. Add one in the topic calendar." />
          )}

          {t.topic?.id ? (
            <Card>
              <Eyebrow>Topic of the week</Eyebrow>
              <h2 className="m-0 mt-2 font-display text-display-m">{t.topic.title}</h2>
              {poll ? (
                <p className="m-0 mt-2 text-body text-ink-2">{`Poll: ${poll.title} Closes ${longSlot(poll.endsAt)}. The weekly report drafts itself after.`}</p>
              ) : null}
            </Card>
          ) : null}

          {t.schedule.length || t.nextQuestion ? (
            <Card>
              <Eyebrow>Today’s schedule</Eyebrow>
              <ul className="m-0 mt-2 list-none p-0">
                {t.schedule.map((s, i) => (
                  <li key={i} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-3 first:border-t-0">
                    <span className="text-label">{clock(s.at)}</span>
                    <span className="text-body">{s.title}</span>
                    {s.state === "DONE" ? <Icon name="circle-check" size={20} label="Done" /> : s.state === "NEEDS_YOU" ? <Pill tone="sun">Needs you</Pill> : <Pill>Scheduled</Pill>}
                  </li>
                ))}
                {t.nextQuestion ? (
                  <li className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 border-t border-line py-3">
                    <span className="text-label">{t.nextQuestion.startsAt ? slot(t.nextQuestion.startsAt) : t.nextQuestion.scheduledFor ? weekday(t.nextQuestion.scheduledFor + "T12:00:00+01:00") : "Next"}</span>
                    <span className="text-body">{t.nextQuestion.text}</span>
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}
        </div>

        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="p-5 pb-3">
            <Eyebrow>Needs your attention</Eyebrow>
          </div>
          {rows.length === 0 ? (
            <div className="px-5 pb-6 pt-2 text-body text-ink-2">Nothing is waiting for you.</div>
          ) : (
            <ul className="m-0 list-none p-0">
              {rows.map((r, i) => (
                <li key={i} className="border-t border-line">
                  <Link href={r.href} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-ink no-underline a-plain hover:bg-surface-2">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-pill ${r.tone}`}>
                      <Icon name={r.icon} size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-label">{r.title}</span>
                      <span className="block text-caption text-ink-2">{r.sub}</span>
                    </span>
                    <span className="font-display text-num-m">{r.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
