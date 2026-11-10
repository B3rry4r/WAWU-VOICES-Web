// @vitest-environment jsdom
// Bundle H (the last walk's fixes), web side: H2 Explain my vote carries its question, H3 the delete sheet words, H5 the
// published weekly page, H6 the busy heading on a person page, the receipt button and the answered Home card.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/admin/weekly",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { explainMyVote } from "@/lib/api/vote";
import { DELETE_WORDS } from "@/features/profile/DeletionPending";
import { LoadError } from "@/features/profile/states";
import { ApiError } from "@/lib/api/client";
import { HomeScreen } from "@/components/feed/HomeScreen";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminWeeklyPage } from "@/features/admin/WeeklyPage";
import { PaymentDoneScreen } from "@/features/units/PaymentDoneScreen";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const SESSION = JSON.stringify({ accessToken: "t", refreshToken: "r" });
beforeEach(() => { search = ""; push.mockReset(); window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("H2 Explain my vote posts under the question the person came from", () => {
  it("sends questionId with the reason and the word", async () => {
    window.localStorage.setItem("voices-web-session", SESSION);
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => { sent.push({ url: String(u), body: JSON.parse(String(init?.body ?? "{}")) }); return json({ answer: { id: "a" } }, 201); }));
    await explainMyVote("p1", "Because prices keep rising.", "key-1", "TIRED", "q-launch");
    expect(sent[0].url.endsWith("/polls/p1/explanation")).toBe(true);
    expect(sent[0].body).toEqual({ kind: "TEXT", body: "Because prices keep rising.", mood: "TIRED", questionId: "q-launch" });
    await explainMyVote("p1", "Plain reason", "key-2");
    expect(sent[1].body).toEqual({ kind: "TEXT", body: "Plain reason" });
  });
});

describe("H3 the delete account sheet says what will happen, not that it has", () => {
  const sheet = [DELETE_WORDS.ask, DELETE_WORDS.lost, DELETE_WORDS.askKeep];
  it("sentence case, no repeated word, matches the Terms", () => {
    expect(DELETE_WORDS.lost).toBe("After that, your posts, recordings and any unspent tokens are gone. Tokens are never paid back as cash.");
    for (const s of Object.values(DELETE_WORDS)) {
      expect(s).not.toMatch(/(^|\. )[a-z]/);
      expect(s).not.toMatch(/\b(\w+) \1\b/i);
      expect(s).not.toContain("—");
    }
  });
  it("the words before confirming do not say it is already set to be deleted", () => {
    for (const s of sheet) expect(s).not.toMatch(/is set to be deleted/);
    expect(DELETE_WORDS.ask).toContain("14 days");
    expect(DELETE_WORDS.ask).toMatch(/^If you delete your account/);
    // docs/legal/terms.md: kept 14 days, then unspent tokens are lost, not paid out
    expect(DELETE_WORDS.lost).toContain("unspent tokens are gone");
  });
});

describe("H6 the busy words are the heading on a person page", () => {
  it("busy: the heading is the busy title and the busy line sits under it", () => {
    render(<LoadError error={new ApiError(503, "UNAVAILABLE", "x", false)} onRetry={() => undefined} />);
    expect(screen.getByText("We are busy.")).toBeTruthy();
    expect(screen.getByText("Try again in a minute.")).toBeTruthy();
    expect(screen.queryByText("We could not load this")).toBeNull();
  });
  it("another failure keeps its own heading", () => {
    render(<LoadError error={new ApiError(500, "X", "x", false)} onRetry={() => undefined} />);
    expect(screen.getByText("We could not load this")).toBeTruthy();
  });
});

describe("H6 Home after the person answered", () => {
  const topic = { id: "t1", weekNumber: 1, title: "Week one", blurb: "b", sensitive: false };
  const q = { id: "q1", kind: "DAILY", status: "LIVE", text: "How do you feel about Nigeria right now?", scheduledFor: null, startsAt: null, endsAt: null, pinned: false, sensitive: false, voiceCount: 3, answerCount: 3, hasOpenPoll: false, proposalCount: 0, recentVoices: [], override: null };
  function stub(mine: unknown[]) {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/home")) return json({ topicOfWeek: topic, dailyQuestion: q, flashPoll: null, trending: [], newConversations: [], greetingName: null });
      if (url.includes("/me/answers")) return json({ items: mine, nextCursor: null });
      if (url.endsWith("/me")) return json({ id: "u", handle: "ada.o", status: "ACTIVE", profile: { displayName: "Ada Okoro" }, profileComplete: true });
      return json({ items: [] });
    }));
  }
  it("has Speak before an answer and offers listening after", async () => {
    window.localStorage.setItem("voices-web-session", SESSION);
    stub([]);
    const a = render(<HomeScreen />);
    await screen.findByText("How do you feel about Nigeria right now?");
    expect(screen.getByRole("button", { name: /Speak/ })).toBeTruthy();
    a.unmount();
    stub([{ type: "answer", answer: { id: "a1", questionId: "q1" } }]);
    render(<HomeScreen />);
    await screen.findByText("You have answered");
    expect(screen.queryByRole("button", { name: /^Speak$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Listen to answers/ })).toBeTruthy();
  });
});

describe("H5 the weekly page says it is published", () => {
  const me = { id: "u", handle: "ngozi.e", roles: ["EDITOR"], profile: { displayName: "Ngozi Eze" } };
  const report = (status: string) => ({ id: "r1", topicId: "t1", weekNumber: 2, status, draftedAt: "2026-11-05T17:00:00Z", pollClosedAt: null, publishAt: "2026-11-09T17:00:00Z", headline: "H", mood: "M", summary: "S", themes: [], sentiment: null, pollSummary: null, quotes: [], basedOnVoices: 10, basedOnVotes: 5, languagesRead: ["English"], checks: [], emotions: [], cardTitle: null, editorNote: null });
  function stub(status: string) {
    window.localStorage.setItem("voices-web-session", SESSION);
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(me);
      if (u.includes("/admin/today")) return json(null);
      if (u.includes("/admin/weekly-reports")) return json({ items: [report(status)], nextCursor: null });
      return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
    }));
  }
  it("a published report is not headed approval and is not called an AI draft", async () => {
    stub("PUBLISHED");
    const { container } = render(<AdminFrame><AdminWeeklyPage /></AdminFrame>);
    await screen.findByText("Published, reviewed by a person");
    expect(within(container).queryByText("Weekly report approval")).toBeNull();
    expect(container.textContent).not.toContain("AI draft, edit before publishing");
    expect(within(container).getAllByText("Weekly report").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/publishes/i);
    expect(container.textContent).toMatch(/published 9 Nov/i);
  });
  it("a draft keeps the approval heading and the AI draft line", async () => {
    stub("DRAFT");
    const { container } = render(<AdminFrame><AdminWeeklyPage /></AdminFrame>);
    await screen.findByText("AI draft, edit before publishing");
    expect(within(container).getAllByText("Weekly report approval").length).toBeGreaterThan(0);
  });
});

describe("H6 the payment done page keeps the board's receipt words", () => {
  it("390 says Download receipt, 1440 says Receipt (boards/PaymentDone.md)", async () => {
    search = "paymentId=01a1ad10-f09a-73fc-9902-42da40d26dec";
    window.localStorage.setItem("voices-web-session", SESSION);
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (String(u).includes("/payments/")) return json({ id: "01a1ad10-f09a-73fc-9902-42da40d26dec", kind: "UNITS", status: "SUCCEEDED", amountKobo: 73200, txRef: "voices-1", title: "Standard pack", unitsMilli: 732000, bonusMilli: 0, method: "card", cardLast4: "4412", receiptNo: "VU-261202-48213", failureReason: null, balanceMilli: 744500, createdAt: "2026-12-02T17:10:00Z", verifiedAt: "2026-12-02T17:14:00Z", token: null });
      return json({ items: [] });
    }));
    render(<PaymentDoneScreen />);
    const link = await screen.findByRole("link", { name: /receipt/i }, { timeout: 4000 });
    expect(link.querySelector(".dt\\:hidden")?.textContent).toBe("Download receipt");
    expect(link.querySelector(".dt\\:inline")?.textContent).toBe("Receipt");
  });
});
