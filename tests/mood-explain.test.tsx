// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsPage } from "@/features/vote/ResultsPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let calls: { url: string; method: string; body: unknown }[] = [];

function stub(moodOptions: string[]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith("/questions/q1")) return json({ id: "q1", topicId: null, text: "How do you feel about Nigeria right now?", voiceCount: 0, answerCount: 0, proposalCount: 0, weekNumber: 4, topicTitle: null, moodOptions });
    if (url.endsWith("/questions/q1/polls")) return json({ items: [{ id: "p1", kind: "QUESTION", title: "Poll?", choiceMode: "SINGLE", status: "OPEN", publicInterest: false, startsAt: "2026-11-01T00:00:00Z", endsAt: new Date(Date.now() + 86400000).toISOString(), questionId: "q1", topicId: null, totalVotes: 1, options: [{ id: "a", label: "Pay on time" }, { id: "b", label: "Pay a bonus" }], myVote: ["a"], costToVoteMilli: 0, label: "Open poll" }] });
    if (url.endsWith("/polls/p1/results")) return json({ pollId: "p1", status: "OPEN", totalVotes: 1, options: [{ id: "a", label: "Pay on time", votes: 1 }, { id: "b", label: "Pay a bonus", votes: 0 }], leadingOptionId: "a", asOf: "x", myVote: ["a"] });
    if (url.endsWith("/polls/p1/explanation")) return json({ answer: {}, charge: {}, allowances: {} }, 201);
    if (url.includes("/ads/placement")) return json({ ad: null });
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
}
beforeEach(() => {
  calls = [];
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("explain my vote on a mood question (LCH-02)", () => {
  it("asks for the word, refuses to send without one, and sends it with the reason", async () => {
    stub(["ANGRY", "TIRED", "PROUD", "HOPEFUL"]);
    render(<ResultsPage questionId="q1" />);
    await screen.findByText("Explain my vote");
    await userEvent.click(screen.getByRole("button", { name: "In words" }));
    expect(screen.getByTestId("mood-word-picker")).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox"), "Rent is too high.");
    await userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
    expect(await screen.findByText("Pick one word first.")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "TIRED" }));
    await userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/polls/p1/explanation"))).toBe(true));
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ kind: "TEXT", mood: "TIRED" });
  });

  it("shows no word picker and sends no word on an ordinary question", async () => {
    stub([]);
    render(<ResultsPage questionId="q1" />);
    await screen.findByText("Explain my vote");
    await userEvent.click(screen.getByRole("button", { name: "In words" }));
    expect(screen.queryByTestId("mood-word-picker")).toBeNull();
    await userEvent.type(screen.getByRole("textbox"), "Rent.");
    await userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect((calls.find((c) => c.method === "POST")!.body as Record<string, unknown>).mood).toBeUndefined();
  });
});
