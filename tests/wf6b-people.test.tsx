// @vitest-environment jsdom
// WF-6b (last fix batch, people's screens): RX1 not-found words, RX2 suspended banner, RX5 /s counts, A-N2, B-N1, B-N4, A-L6.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { ThreadScreen } from "@/features/talk/ThreadScreen";
import { Problem, failText } from "@/features/talk/lib";
import { postingLine } from "@/features/talk/QuestionScreen";
import { useToast } from "@/features/talk/TalkCard";
import { SuspendedBanner, untilFromNoticeTitle, untilLabel } from "@/features/profile/SuspendedBanner";
import { AppealSheet } from "@/features/notifications/AppealSheet";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { WeeklyPage } from "@/features/reach/WeeklyPage";
import { SpeakScreen } from "@/features/speak/SpeakScreen";
import { SharePageView, updatedAgo } from "@/features/share/SharePageView";
import { withAutopost } from "@/lib/auth/entry-draft";
import { saveDraft } from "@/features/speak/draft";
import { ApiError } from "@/lib/api/client";
import { ProposalCard } from "@/components/vx";
import type { SharePage } from "@/lib/api/reach";

const push = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, back: vi.fn() }), usePathname: () => "/speak", useSearchParams: () => new URLSearchParams(search) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let routes: (url: string, method: string, body: unknown) => Response | null;
let calls: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  calls = [];
  push.mockClear();
  replace.mockClear();
  search = "";
  routes = () => null;
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => undefined;
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (u: string, init: RequestInit = {}) => {
    const body = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url: u, method: init.method ?? "GET", body });
    return routes(u, init.method ?? "GET", body) ?? json(404, { error: { code: "NOT_FOUND", message: "We could not find that." } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("RX1: a missing thing says We could not find that.", () => {
  it("a 404 is the not-found words with Back and Home, no error words, no Try again", () => {
    render(<Problem error={new ApiError(404, "NOT_FOUND", "no", true)} onRetry={() => undefined} />);
    expect(screen.getByText("We could not find that.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    expect(screen.queryByText(/Try again/)).toBeNull();
    expect(screen.queryByText(/went wrong/)).toBeNull();
  });
  it("a real server error keeps the error words and Try again", () => {
    const retry = vi.fn();
    render(<Problem error={new ApiError(500, "HTTP_500", "x", false)} onRetry={retry} />);
    expect(screen.getByText("This did not load")).toBeTruthy();
    expect(screen.getByText(/Something went wrong on our side/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("We could not find that.")).toBeNull();
  });
  it("a lost connection keeps the offline words and Try again", () => {
    render(<Problem error={new ApiError(0, "OFFLINE", "x", false)} onRetry={() => undefined} />);
    expect(screen.getByText("You are offline")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
  it("a blocked or removed answer opened by its link (API 404) shows the words, not the error screen", async () => {
    routes = (u) => (u.includes("/answers/a1") ? json(404, { error: { code: "NOT_FOUND", message: "We could not find that." } }) : null);
    render(<ThreadScreen qid="q1" aid="a1" />);
    expect(await screen.findByText("We could not find that.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByText("This did not load")).toBeNull();
  });
  it("the same thread with a 503 says the busy words (G1) and offers Try again; a 500 still says it did not load", async () => {
    routes = (u) => (u.includes("/answers/a1") ? json(503, { error: { code: "UNAVAILABLE", message: "x" } }) : null);
    render(<ThreadScreen qid="q1" aid="a1" />);
    expect(await screen.findByText("We are busy.")).toBeTruthy();
    expect(screen.getByText("Try again in a minute.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
  it("the same thread with a 500 still says it did not load and offers Try again", async () => {
    routes = (u) => (u.includes("/answers/a1") ? json(500, { error: { code: "INTERNAL", message: "x" } }) : null);
    render(<ThreadScreen qid="q1" aid="a1" />);
    expect(await screen.findByText("This did not load")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("RX2: one word, suspended", () => {
  it("a refused post from a suspended account says suspended", () => {
    expect(failText(new ApiError(403, "ACCOUNT_SUSPENDED", "x", true))).toBe("Your account is suspended, so you cannot post right now.");
  });
  it("reads the end day from the suspension notice title, without this year", () => {
    expect(untilFromNoticeTitle("Your account is suspended until 13 Nov 2026", new Date("2026-11-06T10:00:00Z"))).toBe("13 Nov");
    expect(untilFromNoticeTitle("Your account is suspended until 3 Jan 2027", new Date("2026-11-06T10:00:00Z"))).toBe("3 Jan 2027");
    expect(untilFromNoticeTitle("Your account is suspended", new Date())).toBeNull();
    expect(untilLabel("2026-11-30T10:00:00Z", new Date("2026-11-06T10:00:00Z"))).toBe("30 Nov");
  });
  it("the banner names the day, links to Notifications, and shows only for a suspended account", () => {
    const { container, rerender } = render(<SuspendedBanner status="SUSPENDED" until="2099-11-30T10:00:00Z" />);
    // the day keeps its words together (no-break spaces), so the date never splits across two lines
    expect((container.textContent ?? "").replace(/\u00A0/g, " ")).toContain("Your account is suspended until 30 Nov 2099.");
    expect(container.textContent).toContain("You can still read, and appeal from your notifications.");
    expect(screen.getByRole("link", { name: "notifications" }).getAttribute("href")).toBe("/notifications");
    rerender(<SuspendedBanner status="ACTIVE" until={null} />);
    expect(container.textContent).toBe("");
  });
  it("without a date field it reads the day from the notice", async () => {
    routes = (u) => (u.includes("/notifications") ? json(200, { items: [{ id: "n", type: "MODERATION_NOTICE", title: "Your account is suspended until 30 Nov 2099", body: null, targetType: null, targetId: null, actorCount: 1, read: false, createdAt: "2026-11-06T10:00:00Z" }], nextCursor: null, unread: 1 }) : null);
    render(<SuspendedBanner status="SUSPENDED" />);
    expect(await screen.findByText((t) => t.replace(/\u00A0/g, " ") === "Your account is suspended until 30 Nov 2099.")).toBeTruthy();
  });
  it("a notice whose appeal is resolved offers no Appeal action", async () => {
    const n = { id: "m1", type: "MODERATION_NOTICE", title: "Your account is suspended until 13 Nov 2026", body: null, targetType: "user", targetId: "u", questionId: null, actorCount: 1, read: true, createdAt: new Date().toISOString(), appeal: { state: "RESOLVED", targetType: "USER", targetId: "u" } };
    routes = (u) => (u.includes("/notifications") ? json(200, { items: [n], nextCursor: null, unread: 0 }) : null);
    render(<NotificationsPage />);
    await screen.findByText(/suspended until 13 Nov 2026/);
    expect(screen.queryByRole("button", { name: "Appeal" })).toBeNull();
  });
});

describe("RX2 wiring: Notification.resolved", () => {
  it("a resolved notice shows Decided and no Appeal, even with an AVAILABLE appeal", async () => {
    const n = { id: "m2", type: "MODERATION_NOTICE", title: "Your account is suspended until 13 Nov 2026", body: null, targetType: "user", targetId: "u", questionId: null, actorCount: 1, read: true, createdAt: new Date().toISOString(), resolved: true, appeal: { state: "AVAILABLE", targetType: "USER", targetId: "u" } };
    routes = (u) => (u.includes("/notifications") ? json(200, { items: [n], nextCursor: null, unread: 0 }) : null);
    render(<NotificationsPage />);
    expect(await screen.findByText("Decided")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Appeal" })).toBeNull();
  });
});

describe("C-N7 withdrawn: an unchecked result still shows Not verified (V-7)", () => {
  it("NOT_VERIFIED with no checkedAt keeps its pill", async () => {
    const { toComment } = await import("@/features/results/map");
    const { ResultComment } = await import("@/components/vx");
    const p = { id: "p", author: { handle: "a", displayName: null }, createdAt: "2027-01-16T17:42:00Z", accredited: 1, votesCast: 1, rejected: 0, state: "Lagos", lga: "Ikeja", ward: "3", pollingUnit: "PU 1", status: "NOT_VERIFIED", checkedAt: null, checkedLine: null } as never;
    expect(render(<ResultComment {...toComment(p)} />).container.textContent).toContain("Not verified");
  });
});

describe("A-N2: /weekly with no published report", () => {
  it("a 200 with null is the empty state, not an error", async () => {
    routes = (u) => (u.endsWith("/weekly-reports/latest") ? new Response("null", { status: 200, headers: { "content-type": "application/json" } }) : null);
    render(<WeeklyPage />);
    expect(await screen.findByText("No weekly report yet")).toBeTruthy();
    expect(screen.queryByText("We could not load the report")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

const sp = (over: Record<string, unknown>) => ({ code: "abc1234", objectType: "QUESTION", topicLine: "Are you really fine?", countryAndTheme: "Nigeria · Week 1", arguments: [], leanLine: null, poll: null, proposalCount: null, topProposal: null, news: null, basedOnVoices: 4, summaryUpdatedAt: new Date().toISOString(), summaryLabel: "label", featuredVoice: null, transcript: null, question: null, report: null, cardFallback: false, ctaLabel: "Add your voice", openGraph: { title: "t", description: "d", imageUrl: "https://v.test/c.png", url: "https://v.test/s/abc1234" }, ...over }) as unknown as SharePage;
const poll = { pollId: "p1", status: "OPEN", totalVotes: 4, options: [{ id: "o1", label: "Yes", votes: 3, percent: 75 }, { id: "o2", label: "No", votes: 1, percent: 25 }], leadingOptionId: "o1", asOf: new Date().toISOString(), myVote: null };

describe("RX5 and B-N1: /s counts, poll title, updated just now", () => {
  it("a question page counts its voicesCount and shows the poll's own title", () => {
    const html = renderToString(<SharePageView page={sp({ question: { voicesCount: 3, text: "Q text" }, poll })} now={Date.now()} extras={{ pollTitle: "What would make you feel truly fine again?" }} />);
    expect(html).toContain("3 voices · 4 votes so far");
    expect(html).toContain("What would make you feel truly fine again?");
  });
  it("a poll page says votes, never voices, and uses the poll's title", () => {
    const html = renderToString(<SharePageView page={sp({ objectType: "POLL_RESULT", topicLine: "What would make you feel truly fine again?", poll, leanLine: "Most lean towards Yes", basedOnVoices: 4 })} now={Date.now()} />);
    expect(html).toContain("4 votes so far");
    expect(html).toContain("Based on 4 votes");
    expect(html).not.toMatch(/voices/);
    expect(html).toContain("What would make you feel truly fine again?");
  });
  it("a profile page shows that person's voicesCount, and no count when it could not be read", () => {
    const page = sp({ objectType: "PROFILE", topicLine: "@cara.l on VOICES", basedOnVoices: 0 });
    expect(renderToString(<SharePageView page={page} now={Date.now()} extras={{ profileVoices: 1 }} />)).toContain("1 voice");
    const none = renderToString(<SharePageView page={page} now={Date.now()} extras={{ profileVoices: null }} />);
    expect(none).not.toMatch(/\b0 voices/);
  });
  it("a just-updated summary reads 'updated just now', an older one 'updated 12 min ago'", () => {
    expect(updatedAgo(new Date().toISOString())).toBe("updated just now");
    expect(updatedAgo(new Date(Date.now() - 12 * 60000).toISOString())).toBe("updated 12 min ago");
    const html = renderToString(<SharePageView page={sp({ objectType: "WEEKLY_REPORT", leanLine: "Angry about prices" })} now={Date.now()} />);
    expect(html).toContain("updated just now");
    expect(html).not.toContain("now ago");
  });
});

describe("B-N4: no free post line for a person with none left", () => {
  const allow = (free: number, balanceMilli: number) => ({ freePostsRemaining: free, balanceMilli, maxVoiceSeconds: 10, freeReactionsLeftToday: 0, freeVotesLeftToday: 0, costs: { voicePostMilli: 78000, textPostMilli: 5000, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000 }, extraVoiceTokens: [] }) as never;
  it("with free posts it says so", () => {
    expect(postingLine(60, allow(3, 0))).toBe("You have 60 seconds on a free post. Longer is charged when you send. Reading and listening are always free.");
    expect(postingLine(10, null)).toContain("on a free post");
  });
  it("with none left it says what they have: units, or Out of free posts", () => {
    expect(postingLine(60, allow(0, 100000))).toBe("You have 100 tokens. A voice message of up to 30 seconds is 78 tokens, up to 60 seconds is 100 tokens. Reading and listening are always free.");
    expect(postingLine(10, allow(0, 0))).toBe("Out of free posts. Get tokens to post. Reading and listening are always free.");
    expect(postingLine(60, allow(0, 100000))).not.toContain("free post.");
  });
});

describe("A-L6: Appeal sheet", () => {
  it("Send is disabled while the box is empty and enabled once there is text", async () => {
    render(<AppealSheet target={{ targetType: "ANSWER", targetId: "a1" }} onSent={() => undefined} onClose={() => undefined} />);
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Tell us why we got it wrong"), "x");
    expect(send.disabled).toBe(false);
    await userEvent.clear(screen.getByLabelText("Tell us why we got it wrong"));
    expect(send.disabled).toBe(true);
  });
  it("a failed send shows a red line that goes as soon as the person types", async () => {
    routes = (u) => (u.endsWith("/appeals") ? json(500, { error: { code: "INTERNAL", message: "x" } }) : null);
    render(<AppealSheet target={{ targetType: "ANSWER", targetId: "a1" }} onSent={() => undefined} onClose={() => undefined} />);
    const box = screen.getByLabelText("Tell us why we got it wrong");
    await userEvent.type(box, "Please look again");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("We could not send your appeal. Try again in a moment.")).toBeTruthy();
    await userEvent.type(box, "!");
    expect(screen.queryByText("We could not send your appeal. Try again in a moment.")).toBeNull();
  });
  it("the sent line shows once while the sheet is open: the notice behind it updates only after it closes", async () => {
    const n = { id: "m1", type: "MODERATION_NOTICE", title: "A post of yours was taken down", body: "It attacks people.", targetType: "answer", targetId: "a9", questionId: null, actorCount: 1, read: true, createdAt: new Date().toISOString(), appeal: { state: "AVAILABLE", targetType: "ANSWER", targetId: "a9" } };
    routes = (u, m) => (m === "POST" && u.endsWith("/appeals") ? json(201, { id: "ap", status: "OPEN" }) : u.includes("/notifications") ? json(200, { items: [n], nextCursor: null, unread: 0 }) : null);
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.click(await screen.findByRole("button", { name: "Appeal" }));
    await user.type(await screen.findByLabelText("Tell us why we got it wrong"), "Please look again");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("button", { name: "Done" });
    expect(screen.getAllByText("Appeal sent. Another moderator will look again.").length).toBe(1);
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.getAllByText("Appeal sent. Another moderator will look again.").length).toBe(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("A-L6: block shows an Undo toast", () => {
  function Harness({ onUndo }: { onUndo: () => void }) {
    const [node, pushToast] = useToast();
    return <><button onClick={() => pushToast("You blocked @ngozi.e.", "success", { label: "Undo", run: onUndo })}>block</button>{node}</>;
  }
  it("the toast carries Undo, which runs once and closes the toast", async () => {
    const undo = vi.fn();
    render(<Harness onUndo={undo} />);
    await userEvent.click(screen.getByRole("button", { name: "block" }));
    expect(screen.getByText("You blocked @ngozi.e.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("You blocked @ngozi.e.")).toBeNull();
  });
  it("the Undo toast goes by itself after a few seconds", () => {
    vi.useFakeTimers();
    try {
      render(<Harness onUndo={() => undefined} />);
      act(() => { screen.getByRole("button", { name: "block" }).click(); });
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      act(() => { vi.advanceTimersByTime(6100); });
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});

describe("A-L6: Propose shows the handle", () => {
  it("the proposal card names the person by handle", () => {
    render(<ProposalCard author="@bola.ade" avatarName="Bola Ade" time="1m" text="t" />);
    expect(screen.getByText("@bola.ade")).toBeTruthy();
    expect(screen.queryByText("Bola Ade")).toBeNull();
  });
});

describe("A-L6: Finish and post my voice posts in one tap", () => {
  it("the return path carries autopost=1", () => {
    expect(withAutopost("/speak")).toBe("/speak?autopost=1");
    expect(withAutopost("/speak?q=q1")).toBe("/speak?q=q1&autopost=1");
  });
  it("the recorder sends a held voice by itself when it opens with autopost=1", async () => {
    search = "autopost=1";
    const question = { id: "q1", text: "Q?", hint: null, status: "LIVE", category: null, topicTitle: null, voiceCount: 0, answerCount: 0, voicesCount: 0, proposalCount: 0, recentVoices: [], iSaved: false, kind: "DAILY", scheduledFor: null, startsAt: null, endsAt: null, pinned: false, sensitive: false, hasOpenPoll: false, topicId: null, weekNumber: null };
    const costs = { freeVoiceSeconds: 10, voicePostMilli: 1000, textPostMilli: 500, baseKoboPerUnit: 1380 };
    routes = (u, m) => {
      if (u.endsWith("/questions/today") || u.endsWith("/questions/q1")) return json(200, question);
      if (u.endsWith("/config/public")) return json(200, { currency: "NGN", freePosts: 10, unitBaseKobo: 1380, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] });
      if (u.endsWith("/me/allowance")) return json(200, { freePostsRemaining: 10, balanceMilli: 0, maxVoiceSeconds: 10, freeReactionsLeftToday: 5, freeVotesLeftToday: 1, costs, extraVoiceTokens: [] });
      if (m === "POST" && u.endsWith("/voice-clips")) return json(500, { error: { code: "INTERNAL", message: "stop here" } });
      return null;
    };
    await saveDraft({ questionId: "q1", blob: new Blob(["abc"], { type: "audio/webm" }), mime: "audio/webm", seconds: 4, peaks: [1, 2], key: "k1", savedAt: Date.now() });
    render(<SpeakScreen questionId="q1" />);
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/voice-clips"))).toBe(true));
  });
  it("without autopost the held voice waits for the person's Send", async () => {
    const question = { id: "q1", text: "Q?", hint: null, status: "LIVE", category: null, topicTitle: null, voiceCount: 0, answerCount: 0, proposalCount: 0, recentVoices: [], iSaved: false, kind: "DAILY", scheduledFor: null, startsAt: null, endsAt: null, pinned: false, sensitive: false, hasOpenPoll: false, topicId: null, weekNumber: null };
    const costs = { freeVoiceSeconds: 10, voicePostMilli: 1000, textPostMilli: 500, baseKoboPerUnit: 1380 };
    routes = (u) => {
      if (u.endsWith("/questions/today") || u.endsWith("/questions/q1")) return json(200, question);
      if (u.endsWith("/config/public")) return json(200, { currency: "NGN", freePosts: 10, unitBaseKobo: 1380, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] });
      if (u.endsWith("/me/allowance")) return json(200, { freePostsRemaining: 10, balanceMilli: 0, maxVoiceSeconds: 10, freeReactionsLeftToday: 5, freeVotesLeftToday: 1, costs, extraVoiceTokens: [] });
      return null;
    };
    await saveDraft({ questionId: "q1", blob: new Blob(["abc"], { type: "audio/webm" }), mime: "audio/webm", seconds: 4, peaks: [1, 2], key: "k2", savedAt: Date.now() });
    render(<SpeakScreen questionId="q1" />);
    await screen.findByRole("button", { name: /^Send/ });
    await new Promise((r) => setTimeout(r, 150));
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/voice-clips"))).toBe(false);
  });
});
