// @vitest-environment jsdom
// C22: the vote explanation and the proposal keep the SAME Idempotency-Key after a server error, a rate limit or a lost
// connection, and take a new one only after success or when the server says "start again with a new key".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsPage } from "@/features/vote/ResultsPage";
import { ProposePage } from "@/features/vote/ProposePage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (status: number, code: string, message: string) => json({ error: { code, message, requestId: "r" } }, status);
type Step = "network" | Response;
let keys: string[] = [];
let script: Step[] = [];

function stub(postUrl: RegExp) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    if ((init.method ?? "GET") === "POST" && postUrl.test(String(url))) {
      keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
      const s = script.shift();
      if (s === "network") throw new TypeError("Failed to fetch");
      return s ? s.clone() : json({ answer: {}, proposal: {}, charge: {}, allowances: {}, similar: [] }, 201);
    }
    if (url.endsWith("/questions/q1")) return json({ id: "q1", topicId: null, text: "Q?", voiceCount: 0, answerCount: 0, proposalCount: 0, weekNumber: 4, topicTitle: null });
    if (url.endsWith("/questions/q1/polls")) return json({ items: [{ id: "p1", kind: "QUESTION", title: "Poll?", choiceMode: "SINGLE", status: "OPEN", publicInterest: false, startsAt: "2026-11-01T00:00:00Z", endsAt: new Date(Date.now() + 86400000).toISOString(), questionId: "q1", topicId: null, totalVotes: 1, options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], myVote: ["a"], costToVoteMilli: 0, label: "Open poll" }] });
    if (url.endsWith("/polls/p1/results")) return json({ pollId: "p1", status: "OPEN", totalVotes: 1, options: [{ id: "a", label: "A", votes: 1 }, { id: "b", label: "B", votes: 0 }], leadingOptionId: "a", asOf: "x", myVote: ["a"] });
    if (url.endsWith("/config/public")) return json({ costs: { textMaxChars: 500 } });
    if (url.includes("/similar")) return json({ items: [] });
    if (url.includes("/ads/placement")) return json({ ad: null });
    if (url.includes("/feed/trending-questions")) return json({ items: [], nextCursor: null });
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
}
beforeEach(() => {
  keys = []; script = [];
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

async function explain() {
  render(<ResultsPage questionId="q1" />);
  await screen.findByText("Explain my vote");
  await userEvent.click(screen.getByRole("button", { name: "In words" }));
  await userEvent.type(screen.getByRole("textbox"), "Rent is too high.");
  return () => userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
}
async function propose() {
  render(<ProposePage questionId="q1" />);
  await userEvent.type(await screen.findByPlaceholderText("Who should do what, and by when?"), "Pay on the 25th");
  return () => userEvent.click(screen.getByRole("button", { name: "Post" }));
}
const writers = [
  { name: "explain my vote", url: /\/polls\/p1\/explanation$/, open: explain },
  { name: "proposal", url: /\/questions\/q1\/proposals$/, open: propose },
];
const same: [string, () => Step][] = [
  ["500", () => err(500, "INTERNAL", "Boom")],
  ["502", () => err(502, "BAD_GATEWAY", "Bad gateway")],
  ["504", () => err(504, "GATEWAY_TIMEOUT", "Timeout")],
  ["429", () => err(429, "RATE_LIMITED", "Slow down.")],
  ["offline", () => "network"],
];

for (const w of writers) {
  describe(`${w.name}: the Idempotency-Key`, () => {
    for (const [label, mk] of same) {
      it(`${label} then 201: the same key twice`, async () => {
        stub(w.url); script = [mk()];
        const tap = await w.open();
        await tap();
        await waitFor(() => expect(keys.length).toBe(1));
        await waitFor(() => expect(screen.getByRole("button", { name: /^(Post|Send)/ }).hasAttribute("disabled")).toBe(false));
        await tap();
        await waitFor(() => expect(keys.length).toBe(2));
        expect(keys[0]).toBeTruthy();
        expect(keys[1]).toBe(keys[0]);
      }, 15000);
    }
    it("a 409 CONFLICT 'new key' answer then 201: a different key the second time", async () => {
      stub(w.url); script = [err(409, "CONFLICT", "Start again with a new key")];
      const tap = await w.open();
      await tap();
      await waitFor(() => expect(keys.length).toBe(1));
      await waitFor(() => expect(screen.getByRole("button", { name: /^(Post|Send)/ }).hasAttribute("disabled")).toBe(false));
      await tap();
      await waitFor(() => expect(keys.length).toBe(2));
      expect(keys[1]).not.toBe(keys[0]);
    }, 15000);
  });
}

describe("after a success the next post uses a different key", () => {
  it("proposal", async () => {
    stub(writers[1].url);
    const tap = await propose();
    await tap();
    await waitFor(() => expect(keys.length).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Post" }).hasAttribute("disabled")).toBe(false));
    await tap();
    await waitFor(() => expect(keys.length).toBe(2));
    expect(keys[1]).not.toBe(keys[0]);
  }, 15000);
});
