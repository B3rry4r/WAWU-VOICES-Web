// @vitest-environment jsdom
// Bundle G (walk fixes): G1 busy words, G3 Suspend says the post comes down, G4 receipt says Tokens, G9 onboarding words and
// Explain my vote keeps the word.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, NetworkError } from "@/lib/api/client";
import { isBusy } from "@/lib/api/busy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const NOT_FOUND = { error: { code: "NOT_FOUND", message: "no" } };

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("G1: where the API cannot be reached or is busy, the person sees the busy words", () => {
  it("isBusy is true for 502, 503 and 504 only", () => {
    for (const s of [502, 503, 504]) expect(isBusy(new ApiError(s, "HTTP_" + s, "x", false))).toBe(true);
    for (const s of [400, 404, 429, 500]) expect(isBusy(new ApiError(s, "E", "x", false))).toBe(false);
    expect(isBusy(new NetworkError("offline"))).toBe(false);
    expect(isBusy(new Error("x"))).toBe(false);
  });

  it("the feed and vote load failures say 'We are busy. Try again in a minute.', and other errors keep their words", async () => {
    const { Failed } = await import("@/components/feed/parts");
    const retry = () => undefined;
    for (const status of [502, 503, 504]) {
      const { unmount } = render(<Failed load={{ state: "error", error: new ApiError(status, "HTTP_" + status, "Request failed", false), retry }} />);
      expect(screen.getByText("We are busy.")).toBeTruthy();
      expect(screen.getByText("Try again in a minute.")).toBeTruthy();
      expect(screen.queryByText(/went wrong on our side/)).toBeNull();
      unmount();
    }
    render(<Failed load={{ state: "error", error: new ApiError(500, "INTERNAL", "x", false), retry }} />);
    expect(screen.getByText("This did not load")).toBeTruthy();
    expect(screen.getByText(/went wrong on our side/)).toBeTruthy();
    cleanup();
    const { LoadFailed } = await import("@/features/vote/chrome");
    render(<LoadFailed error={new ApiError(502, "HTTP_502", "x", false)} retry={retry} what="x" />);
    expect(screen.getByText("We are busy.")).toBeTruthy();
    expect(screen.getByText("Try again in a minute.")).toBeTruthy();
  });

  it("the entry and units load words are the busy words too, and a failed save keeps its own", async () => {
    const e = new ApiError(503, "HTTP_503", "Request failed (503)", false);
    const { refusalWords } = await import("@/features/entry/ui");
    expect(refusalWords(e, "fallback")).toBe("We are busy. Try again in a minute.");
    expect((await import("@/features/units/hooks")).readErrorText(e)).toBe("We are busy. Try again in a minute.");
    // a failed save or send keeps its own words: only pages and loads say the busy words
    expect((await import("@/features/profile/states")).errorLine(e, "Could not save that change. Try again.")).toBe("Could not save that change. Try again.");
    const { LoadError } = await import("@/features/profile/states");
    render(<LoadError error={e} onRetry={() => undefined} />);
    // H6: the busy title is the heading and the busy line sits under it (it was one line under "We could not load this")
    expect(screen.getByRole("heading", { name: "We are busy." })).toBeTruthy();
    expect(screen.getByText("Try again in a minute.")).toBeTruthy();
    cleanup();
    expect((await import("@/features/units/checkout")).startErrorText(e)).toBe("Something went wrong. Nothing was charged. Try again.");
  });
});

describe("G4: the receipt says Tokens", () => {
  it("labels the count 'Tokens', never 'Units'", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.includes("/payments/p1/receipt")) return json(200, { paymentId: "p1", receiptNo: "VT-261109-0A1B2C3D", reference: "VT-261109-0A1B2C3D", title: "Standard pack", unitsMilli: 732000, amountKobo: 73200, method: "card", cardLast4: "4412", paidAt: "2026-11-09T10:00:00Z", buyerHandle: "@ada" });
      return json(404, NOT_FOUND);
    }));
    const { ReceiptScreen } = await import("@/features/units/ReceiptScreen");
    const { container } = render(<ReceiptScreen paymentId="p1" />);
    expect(await screen.findByText("VT-261109-0A1B2C3D")).toBeTruthy();
    const labels = [...container.querySelectorAll("dt")].map((x) => x.textContent);
    expect(labels).toContain("Tokens");
    expect(labels).not.toContain("Units");
    expect(container.textContent).not.toMatch(/Voice Units?|\bUnits\b|VU-/);
  });
});

const me = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
const modItem = (id: string, over: Record<string, unknown> = {}) => ({ id, queue: "REPORTED", targetType: "ANSWER", targetId: id, reasons: ["threat"], reportCount: 1, priority: false, summary: "Reported 1 time", createdAt: "2026-11-05T10:00:00Z", status: "OPEN", questionText: null, listenCount: 0, postKind: "TEXT", ...over });
const modDetail = (item: unknown) => ({ listenCount: 0, item, author: null, content: { kind: "TEXT", body: "Words", createdAt: "2026-11-05T10:00:00Z" }, transcript: null, playUrl: null, screening: [], context: null, audit: [] });

describe("G2 and G3: moderation", () => {
  async function open(item: ReturnType<typeof modItem>) {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/admin/moderation/items/")) return json(200, modDetail(item));
      if (u.includes("/admin/moderation/items")) return json(200, { items: [item], nextCursor: null, counts: { REPORTED: 1, open: 1, oldestOpenAt: null } });
      return json(404, NOT_FOUND);
    }));
    const { AdminFrame } = await import("@/features/admin/AdminFrame");
    const { AdminModerationPage } = await import("@/features/admin/ModerationPage");
    render(<AdminFrame><AdminModerationPage /></AdminFrame>);
    await screen.findByRole("tablist", { name: "Moderation queues" });
  }
  it("Suspend on a reported post says the post comes down, and the button says so", async () => {
    await open(modItem("a"));
    await userEvent.click(await screen.findByRole("tab", { name: "Suspend" }));
    expect(screen.getByText("Suspending this person also takes this post down.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Suspend and take it down" })).toBeTruthy();
  });
  it("Suspend on an account item does not say a post comes down", async () => {
    await open(modItem("u", { targetType: "USER", postKind: null, summary: "" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Suspend" }));
    expect(screen.queryByText(/takes this post down/)).toBeNull();
    expect(screen.getByRole("button", { name: "Suspend" })).toBeTruthy();
  });
  it("a result sent to moderation shows its readable row: the chip and the numbers, never Result_review", async () => {
    await open(modItem("r", { targetType: "RESULT_POST", postKind: null, reasons: ["result check"], reportCount: 0, summary: "Sent from Posted results · PU 007, Ward 9, Yaba, Lagos · accredited 420 · votes cast 380 · rejected 12" }));
    expect((await screen.findAllByText("Result check")).length).toBeGreaterThan(0);
    expect(screen.getByText(/accredited 420 · votes cast 380 · rejected 12/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/result_review/i);
  });
});

describe("G9: onboarding words at 1440 are the landing words", () => {
  it("the desktop card carries the eyebrow, the headline and the intro of LCH-01", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const cfg = { freePosts: 10, costs: { textPriceChars: 150, textPostMilli: 5000, voicePostMilli: 78000 }, minPackKobo: 18300, baseKoboPerUnit: 100 };
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.includes("/questions/today")) return json(200, { id: "q1", text: "How do you feel?", answerCount: 3, voiceCount: 2, endsAt: new Date(Date.now() + 3600_000).toISOString(), moodOptions: [] });
      if (u.includes("/config/public") || u.includes("/public-config")) return json(200, cfg);
      if (u.includes("/polls/current")) return json(200, null);
      return json(404, NOT_FOUND);
    }));
    window.localStorage.clear();
    const { LANDING_EYEBROW, LANDING_HEADLINE, LANDING_INTRO } = await import("@/features/entry/landing-words");
    const { Onboarding } = await import("@/features/entry/Onboarding");
    const { container } = render(<Onboarding />);
    await waitFor(() => expect(container.textContent).toContain(LANDING_HEADLINE));
    const desk = container.querySelector(".dt\\:flex") as HTMLElement;
    expect(desk.textContent).toContain(LANDING_EYEBROW);
    expect(desk.textContent).toContain(LANDING_HEADLINE);
    expect(desk.textContent).toContain(LANDING_INTRO);
    expect(desk.querySelector("h1")?.textContent).toBe(LANDING_HEADLINE);
  });
});

describe("G9: Explain my vote keeps the word the person already gave", () => {
  const poll = { id: "p1", kind: "QUESTION", title: "Poll?", choiceMode: "SINGLE", status: "OPEN", publicInterest: false, startsAt: "2026-11-01T00:00:00Z", endsAt: new Date(Date.now() + 86400000).toISOString(), questionId: "q1", topicId: null, totalVotes: 1, options: [{ id: "a", label: "Pay on time" }, { id: "b", label: "Pay a bonus" }], myVote: ["a"], costToVoteMilli: 0, label: "Open poll" };
  function stub(mine: unknown[], sent: unknown[]) {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.endsWith("/questions/q1")) return json(200, { id: "q1", topicId: null, text: "How do you feel?", voiceCount: 0, answerCount: 0, proposalCount: 0, weekNumber: 4, topicTitle: null, moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"] });
      if (url.endsWith("/questions/q1/polls")) return json(200, { items: [poll] });
      if (url.endsWith("/polls/p1/results")) return json(200, { pollId: "p1", status: "OPEN", totalVotes: 1, options: [{ id: "a", label: "Pay on time", votes: 1 }, { id: "b", label: "Pay a bonus", votes: 0 }], leadingOptionId: "a", asOf: "x", myVote: ["a"] });
      if (url.includes("/me/answers")) return json(200, { items: mine, nextCursor: null });
      if (url.endsWith("/polls/p1/explanation")) { sent.push(JSON.parse(String(init.body))); return json(201, { answer: {}, charge: {}, allowances: {} }); }
      if (url.includes("/ads/placement")) return json(200, { ad: null });
      return json(404, NOT_FOUND);
    }));
  }
  it("sends the word from the person's own answer without asking again", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const sent: unknown[] = [];
    stub([{ type: "answer", answer: { id: "x", questionId: "q1", mood: "TIRED" } }], sent);
    const { ResultsPage } = await import("@/features/vote/ResultsPage");
    render(<ResultsPage questionId="q1" />);
    await screen.findByText("Explain my vote");
    await userEvent.click(screen.getByRole("button", { name: "In words" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "TIRED" }).getAttribute("aria-pressed")).toBe("true"));
    await userEvent.type(screen.getByRole("textbox"), "Rent is too high.");
    await userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ kind: "TEXT", mood: "TIRED" });
    expect(screen.queryByText("Pick one word first.")).toBeNull();
  });
  it("says the word is needed only when there is none to find", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    stub([], []);
    const { ResultsPage } = await import("@/features/vote/ResultsPage");
    render(<ResultsPage questionId="q1" />);
    await screen.findByText("Explain my vote");
    await userEvent.click(screen.getByRole("button", { name: "In words" }));
    expect(screen.getByText("Pick one word to go with your reason.")).toBeTruthy();
  });
});
