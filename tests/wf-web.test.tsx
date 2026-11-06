// @vitest-environment jsdom
// WALK-FIX batch WF-2 (lead ruling WF, 6 Nov): the people's screens that need no API change.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { Poll, ShareCard, WeeklyReportCard } from "@/components/vx";
import { HomeScreen } from "@/components/feed/HomeScreen";
import { DeletionPending } from "@/features/profile/DeletionPending";
import { TalkCard } from "@/features/talk/TalkCard";
import { GuestOnly, SignInOrOpen } from "@/features/share/ShareActions";
import { ApiError, NetworkError } from "@/lib/api/client";
import { photoUploadWords } from "@/lib/api/me";
import { ago, uniqueVoices } from "@/lib/feed-format";
import { leaderFirst } from "@/lib/format/plural";
import { useWhatNextPrompt } from "@/features/vote/prompt";
import { unitLabel } from "@/lib/format/place";
import { toComment } from "@/features/results/map";
import type { Answer } from "@/lib/api/talk";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const SESSION = JSON.stringify({ accessToken: "t", refreshToken: "r" });
beforeEach(() => { push.mockReset(); replace.mockReset(); window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const topic = { id: "t1", weekNumber: 1, title: "Week one", blurb: "b", sensitive: false };
const question = (override: unknown) => ({
  id: "q1", kind: "DAILY", status: "LIVE", text: "The normal question?", scheduledFor: null, startsAt: null, endsAt: null, pinned: false, sensitive: false,
  voiceCount: 3, answerCount: 3, hasOpenPoll: false, proposalCount: 0, recentVoices: [], override,
});

describe("C-H5 override message on Home", () => {
  it("shows the live override's message under the headline", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/home")) return json({ topicOfWeek: topic, dailyQuestion: question({ contentKind: "TEXT", body: "Power is out in Lekki. Tell us what you see.", endsAt: "2999-01-01T00:00:00Z" }), flashPoll: null, trending: [], newConversations: [], greetingName: null });
      return json({ items: [] });
    }));
    render(<HomeScreen />);
    const msg = await screen.findByTestId("override-message");
    expect(msg.textContent).toBe("Power is out in Lekki. Tell us what you see.");
    // lead ruling WF, 6 Nov (LOW "as drawn"): the message sits right under the override headline, the question in the hero.
    expect(msg.previousElementSibling?.textContent).toContain("The normal question?");
  });
  it("shows nothing extra when no override is live", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("/home") ? json({ topicOfWeek: topic, dailyQuestion: question(null), flashPoll: null, trending: [], newConversations: [], greetingName: null }) : json({ items: [] }))));
    render(<HomeScreen />);
    await screen.findByText("The normal question?");
    expect(screen.queryByTestId("override-message")).toBeNull();
  });
});

describe("C-H4 weekly card", () => {
  const base = { week: "Week 2 · 23 to 29 Nov 2026", moodLine: "Angry about prices.", mood: [{ label: "Anger", pct: 44, delta: 6 }], voices: 10, votes: 5 };
  it("shows the approved headline and summary, and Main arguments only when there are arguments", () => {
    const { rerender } = render(<WeeklyReportCard {...base} title="Prices bite" summary="People say prices rise faster than pay." themes={[]} />);
    expect(screen.getByRole("heading", { name: "Prices bite" })).toBeTruthy();
    expect(screen.getByText("People say prices rise faster than pay.")).toBeTruthy();
    expect(screen.queryByText("Main arguments")).toBeNull();
    rerender(<WeeklyReportCard {...base} title="Prices bite" themes={[{ text: "Prices rise faster than pay", voices: 32 }]} />);
    expect(screen.getByText("Main arguments")).toBeTruthy();
  });
});

describe("A-M1 What Next prompt", () => {
  function Probe({ id }: { id: string | null }) {
    const p = useWhatNextPrompt(id);
    return <p data-testid="p">{p === undefined ? "loading" : p === null ? "none" : p}</p>;
  }
  it("reads topic.whatNextPrompt; none when the week has none", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => json(url.endsWith("/topics/t1") ? { ...topic, whatNextPrompt: "What is one small, practical change?" } : { ...topic })));
    const { rerender } = render(<Probe id="t1" />);
    expect(screen.getByTestId("p").textContent).toBe("loading");
    await waitFor(() => expect(screen.getByTestId("p").textContent).toBe("What is one small, practical change?"));
    rerender(<Probe id="t2" />);
    await waitFor(() => expect(screen.getByTestId("p").textContent).toBe("none"));
    rerender(<Probe id={null} />);
    expect(screen.getByTestId("p").textContent).toBe("none");
  });
});

describe("A-M5 photo words", () => {
  it("plain words for a failed upload, the 503 words, and offline", () => {
    expect(photoUploadWords(new ApiError(0, "UPLOAD_FAILED", "x", false))).toBe("We could not upload your photo. Check your connection and try again, or choose another photo.");
    expect(photoUploadWords(new ApiError(503, "UNAVAILABLE", "Uploads are not available right now. Try again in a minute.", true))).toBe("Uploads are not available right now. Try again in a minute.");
    expect(photoUploadWords(new NetworkError("offline"))).toMatch(/Could not reach VOICES/);
  });
});

describe("A-M6 deletion pending", () => {
  it("shows the day, Sign out lands on /welcome, Undo calls the cancel route (no sign-out) and returns to the profile", async () => {
    window.localStorage.setItem("voices-web-session", SESSION);
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, method: init?.method ?? "GET" }); return json({ status: "ACTIVE" }); }));
    const u = userEvent.setup();
    render(<DeletionPending scheduledFor="2026-11-20" />);
    expect(screen.getByText("Your account will be deleted on 20 Nov 2026.")).toBeTruthy();
    expect(screen.getByText("To keep your account, tap Undo before 20 Nov 2026.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("sign in again");
    await u.click(screen.getByRole("button", { name: "Sign out" }));
    expect(replace).toHaveBeenCalledWith("/welcome");
    expect(JSON.parse(window.localStorage.getItem("voices-web-session") ?? "{}").accessToken ?? null).toBeNull();
    cleanup(); replace.mockReset();
    window.localStorage.setItem("voices-web-session", SESSION);
    render(<DeletionPending scheduledFor="2026-11-20" />);
    await u.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/me/deletion/cancel"))).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("voices-web-session") ?? "{}").accessToken).toBeTruthy();
  });
  it("a 409 after the purge says so in plain words", async () => {
    window.localStorage.setItem("voices-web-session", SESSION);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "CONFLICT", message: "gone" } }), { status: 409, headers: { "content-type": "application/json" } })));
    render(<DeletionPending scheduledFor="2026-11-20" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("This account has already been deleted, so it cannot be kept.")).toBeTruthy();
  });
});

describe("B-M1 share page for a signed-in person", () => {
  it("a guest sees Sign in and the record note; a signed-in person sees neither", async () => {
    const { unmount } = render(<><SignInOrOpen code="abc" /><GuestOnly><p>Sign in only when you publish.</p></GuestOnly></>);
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByText("Sign in only when you publish.")).toBeTruthy();
    unmount();
    window.localStorage.setItem("voices-web-session", SESSION);
    render(<><SignInOrOpen code="abc" /><GuestOnly><p>Sign in only when you publish.</p></GuestOnly></>);
    expect(await screen.findByRole("link", { name: "Open VOICES" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByText("Sign in only when you publish.")).toBeNull();
  });
});

describe("C-M5 polling unit and ward labels", () => {
  it("never doubles a typed PU or Ward prefix", () => {
    const base = { lga: "Ikeja", state: "Lagos" };
    expect(unitLabel({ ...base, pollingUnit: "PU 012", ward: "Ward 3" })).toBe("PU 012, Ward 3, Ikeja, Lagos");
    expect(unitLabel({ ...base, pollingUnit: "012", ward: "3" })).toBe("PU 012, Ward 3, Ikeja, Lagos");
    expect(unitLabel({ ...base, pollingUnit: "Polling unit: 012", ward: "ward-3" })).toBe("PU 012, Ward 3, Ikeja, Lagos");
  });
  it("the public result comment uses it", () => {
    const c = toComment({ id: "r", author: { handle: "a", displayName: null }, createdAt: "2026-11-06T10:00:00Z", pollingUnit: "PU 012", ward: "Ward 3", lga: "Ikeja", state: "Lagos", accredited: 1, votesCast: 1, rejected: 0, status: "UNVERIFIED", checkedLine: null } as never);
    expect(c.place).toBe("PU 012, Ward 3, Ikeja, Lagos");
  });
});

describe("Lows", () => {
  it("A-L3 a post of this minute reads Just now", () => {
    expect(ago(new Date().toISOString())).toBe("Just now");
  });
  it("A-L4 the leader comes first, ties keep their order", () => {
    expect(leaderFirst([{ id: "a", votes: 1 }, { id: "b", votes: 5 }, { id: "c", votes: 5 }, { id: "d" }]).map((o) => o.id)).toEqual(["b", "c", "a", "d"]);
  });
  it("A-L5 no person twice in an avatar stack", () => {
    expect(uniqueVoices([{ handle: "ao" }, { handle: "ao" }, { handle: "mb" }]).map((v) => v.handle)).toEqual(["ao", "mb"]);
  });
  it("B-L4 a poll with no votes marks no leader; with votes it does", () => {
    const { rerender } = render(<Poll question="Q?" state="results" live={false} onExplain={false} total={0} options={[{ id: "a", label: "Yes", votes: 0 }, { id: "b", label: "No", votes: 0 }]} />);
    expect(screen.queryByText("Leading")).toBeNull();
    rerender(<Poll question="Q?" state="results" live={false} onExplain={false} total={3} options={[{ id: "a", label: "Yes", votes: 3 }, { id: "b", label: "No", votes: 0 }]} />);
    expect(screen.getByText("Leading")).toBeTruthy();
  });
  it("B-L4 a share card with no votes does not say people are split", () => {
    render(<ShareCard kind="poll" topic="T" question="Q?" poll={[{ label: "Yes", pct: 0 }, { label: "No", pct: 0 }]} voices={0} />);
    expect(screen.queryByText("People are split so far.")).toBeNull();
  });
});

describe("Held: Escape closes the reaction tray", () => {
  it("opens with React, closes with Escape", async () => {
    window.localStorage.setItem("voices-web-session", SESSION);
    const a = { id: "a1", questionId: "q1", author: { id: "u1", handle: "tunde.a", displayName: "Tunde", state: "Ibadan", avatarUrl: null }, kind: "TEXT", body: "Two hours.", clip: null, createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [] } as unknown as Answer;
    const u = userEvent.setup();
    render(<TalkCard answer={a} signedIn push={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: "React" }));
    expect(screen.queryAllByRole("radio").length).toBeGreaterThan(0);
    await u.keyboard("{Escape}");
    expect(screen.queryAllByRole("radio").length).toBe(0);
  });
});

describe("Held: Topics back arrow", () => {
  it("the step header draws the back arrow when it has somewhere to go", async () => {
    const { StepHeader } = await import("@/features/entry/ui");
    render(<StepHeader step={1} back="/join/country" />);
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/join/country");
  });
});
