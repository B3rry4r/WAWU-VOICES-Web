// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { FixPanel, diffView } from "@/features/talk/FixPanel";
import { WriteScreen } from "@/features/talk/WriteScreen";
import { postPrice } from "@/features/talk/lib";
import { countChars, textCostMilli, tokensLabel } from "@/lib/shared/text-price";
import type { Allowances } from "@/lib/api/talk";

type Call = { url: string; method: string; headers: Headers; body?: { text?: string } };
let calls: Call[] = [];
function stub(routes: (c: Call) => Response | undefined) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const c: Call = { url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    return routes(c) ?? new Response("{}", { status: 404 });
  }));
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const FIXED = { fixedText: "If they can, the country can too.", changes: [{ from: "cna,", to: "can,", start: 8 }, { from: "cna", to: "can", start: 25 }], changed: true, charge: { costMilli: 5000, balanceMilli: 15000 } };

beforeEach(() => { calls = []; push.mockReset(); window.localStorage.clear(); window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("the text price (the same count and rounding as the server)", () => {
  it("counts a character the same way: an emoji is one", () => {
    expect(countChars("😀😀")).toBe(2);
    expect(countChars("é")).toBe(2);
  });
  it("is proportional to the hundredth of a token at 149, 150, 151 and 5,000 characters", () => {
    const c = (n: number) => textCostMilli(n, 5000, 150);
    expect([c(149), c(150), c(151), c(500), c(5000)]).toEqual([4970, 5000, 5030, 16670, 166670]);
    expect(tokensLabel(c(20))).toBe("0.67");
    expect(tokensLabel(100000)).toBe("100");
  });
  it("postPrice: free for a short text with free posts left, paid in full for a long one", () => {
    const allow = (free: number) => ({ freePostsRemaining: free, balanceMilli: 0, costs: { textPostMilli: 5000, textPriceChars: 150, freePostTextChars: 500, baseKoboPerUnit: 100 } }) as unknown as Allowances;
    expect(postPrice("a".repeat(500), allow(3))).toMatchObject({ covered: true, paid: false, label: "Post" });
    const long = postPrice("a".repeat(501), allow(3));
    expect(long).toMatchObject({ covered: false, paid: true, cost: 16700, label: "Post · 16.7 tokens" });
    expect(postPrice("a".repeat(100), allow(0))).toMatchObject({ paid: false, label: "Post · 3.33 tokens", text: "3.33 tokens (₦3.33)" });
    expect(postPrice("   ", allow(0)).label).toBe("Post");
  });
});

describe("Fix my text", () => {
  it("draws the changes as the board does and lets the person use the fix or keep their own", async () => {
    stub((c) => (c.url.endsWith("/text/fix") ? json(FIXED) : undefined));
    const onUse = vi.fn();
    render(<FixPanel text="If they cna, the country cna too." costMilli={5000} buyHref="/units/buy" onUse={onUse} />);
    expect(screen.getByRole("button", { name: "Fix my text · 5 tokens" })).toBeTruthy();
    expect(screen.getByText(/Your text is sent to our AI provider to be corrected, and is used for nothing else\./)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Fix my text · 5 tokens" }));
    const diff = await screen.findByTestId("fix-diff");
    expect(screen.getByText("Suggested fix")).toBeTruthy();
    expect(screen.getByText("2 changes")).toBeTruthy();
    expect(Array.from(diff.querySelectorAll("del")).map((d) => d.textContent)).toEqual(["cna,", "cna"]);
    expect(Array.from(diff.querySelectorAll("ins")).map((d) => d.textContent)).toEqual(["can,", "can"]);
    expect(screen.getByText("Only spelling and typos change, never what you mean.")).toBeTruthy();
    const post = calls.find((c) => c.url.endsWith("/text/fix"))!;
    expect(post.method).toBe("POST");
    expect(post.headers.get("Idempotency-Key")).toBeTruthy();
    expect(post.body).toEqual({ text: "If they cna, the country cna too." });
    await userEvent.click(screen.getByRole("button", { name: "Use the fix" }));
    expect(onUse).toHaveBeenCalledWith("If they can, the country can too.");
    expect(screen.queryByText("Suggested fix")).toBeNull();
  });

  it("Keep mine leaves the text alone", async () => {
    stub((c) => (c.url.endsWith("/text/fix") ? json(FIXED) : undefined));
    const onUse = vi.fn();
    render(<FixPanel text="If they cna, the country cna too." costMilli={5000} buyHref="/units/buy" onUse={onUse} />);
    await userEvent.click(screen.getByRole("button", { name: /Fix my text/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Keep mine" }));
    expect(onUse).not.toHaveBeenCalled();
    expect(screen.queryByText("Suggested fix")).toBeNull();
  });

  it("asking again for the same text reuses the Idempotency-Key, so a retry is never charged twice; new text, new key", async () => {
    let fail = true;
    stub((c) => {
      if (!c.url.endsWith("/text/fix")) return undefined;
      if (fail) { fail = false; return json({ error: { code: "TEXT_FIX_FAILED", message: "We could not fix your text just now. You have not been charged.", requestId: "r" } }, 502); }
      return json(FIXED);
    });
    const { rerender } = render(<FixPanel text="same words cna" costMilli={5000} buyHref="/units/buy" onUse={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: /Fix my text/ }));
    expect(await screen.findByText("We could not fix your text just now. You have not been charged.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Fix my text/ }));
    await screen.findByText("Suggested fix");
    const keys = calls.filter((c) => c.url.endsWith("/text/fix")).map((c) => c.headers.get("Idempotency-Key"));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await userEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    rerender(<FixPanel text="other words cna" costMilli={5000} buyHref="/units/buy" onUse={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: /Fix my text/ }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/text/fix")).length).toBe(3));
    expect(calls.filter((c) => c.url.endsWith("/text/fix"))[2].headers.get("Idempotency-Key")).not.toBe(keys[0]);
  });

  it("nothing to fix says so and no tokens were used; not enough tokens offers Get tokens", async () => {
    stub((c) => (c.url.endsWith("/text/fix") ? json({ fixedText: "Fine.", changes: [], changed: false, charge: { costMilli: 0, balanceMilli: 20000 } }) : undefined));
    render(<FixPanel text="Fine." costMilli={5000} buyHref="/units/buy" onUse={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: /Fix my text/ }));
    expect(await screen.findByText("Nothing to fix. No tokens were used.")).toBeTruthy();
    cleanup();
    stub((c) => (c.url.endsWith("/text/fix") ? json({ error: { code: "INSUFFICIENT_UNITS", message: "x", requestId: "r" } }, 402) : undefined));
    render(<FixPanel text="Fine." costMilli={5000} buyHref="/units/buy" onUse={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: /Fix my text/ }));
    const banner = await screen.findByText("You need more tokens to fix your text.");
    expect(within(banner.closest("[role]") as HTMLElement).getByRole("button", { name: "Get tokens" })).toBeTruthy();
  });

  it("holds the button while the text is empty", () => {
    stub(() => undefined);
    render(<FixPanel text="  " costMilli={5000} buyHref="/units/buy" onUse={() => undefined} />);
    expect(screen.getByRole("button", { name: /Fix my text/ }).hasAttribute("disabled")).toBe(true);
  });

  it("the diff keeps the text between changes and counts an emoji as one character", () => {
    const parts = diffView("😀 teh end", [{ from: "teh", to: "the", start: 2 }]);
    expect(parts[0]).toBe("😀 ");
    expect(parts[parts.length - 1]).toBe(" end");
  });
});

const question = { id: "q1", status: "LIVE", kind: "DAILY", text: "How do you feel about Nigeria right now?", hint: null, category: null, recentVoices: [], voiceCount: 1, answerCount: 1, proposalCount: 0, hasOpenPoll: false, iSaved: false };
const allowance = (over: Record<string, unknown> = {}, free = 0) => ({
  freePostsRemaining: free, balanceMilli: 100000, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, extraVoiceTokens: [],
  costs: { textPostMilli: 5000, voicePostMilli: 78000, baseKoboPerUnit: 100, textMaxChars: 5000, textPriceChars: 150, freePostTextChars: 500, messagesPerDay: 20, textFixMilli: 5000, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60, freeVoiceSeconds: 10, ...over },
}) as unknown;

describe("the Write screen as FixText-390 draws it", () => {
  const open = async (a: unknown) => {
    stub((c) => (c.url.endsWith("/questions/q1") ? json(question) : c.url.endsWith("/me/allowance") ? json(a) : undefined));
    render(<WriteScreen qid="q1" />);
    return (await screen.findByRole("textbox")) as HTMLTextAreaElement;
  };
  it("shows the live price on the Post button, the counter, and the fix button with its privacy line", async () => {
    const box = await open(allowance());
    await userEvent.type(box, "a".repeat(100));
    expect(screen.getByRole("button", { name: "Post · 3.33 tokens" })).toBeTruthy();
    expect(screen.getByText("100 / 5,000")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fix my text · 5 tokens" })).toBeTruthy();
    expect(screen.getByText(/Charged only when a fix comes back\./)).toBeTruthy();
  });
  it("a free post shows plain Post for a short text and the full price once it is too long", async () => {
    const box = await open(allowance({}, 3));
    await userEvent.click(box);
    await userEvent.paste("a".repeat(500));
    expect(screen.getByRole("button", { name: "Post" })).toBeTruthy();
    await userEvent.paste("b");
    expect(screen.getByRole("button", { name: "Post · 16.7 tokens" })).toBeTruthy();
    expect(screen.getByText(/This post uses/).textContent).toContain("16.7 tokens");
  });
  it("Use the fix replaces the text in the box", async () => {
    const box = await open(allowance());
    stub((c) => (c.url.endsWith("/questions/q1") ? json(question) : c.url.endsWith("/me/allowance") ? json(allowance()) : c.url.endsWith("/text/fix") ? json(FIXED) : undefined));
    await userEvent.type(box, "If they cna, the country cna too.");
    await userEvent.click(screen.getByRole("button", { name: /Fix my text/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Use the fix" }));
    expect(box.value).toBe("If they can, the country can too.");
  });
  it("at 20 messages a day the Post button is held and the page says why", async () => {
    const box = await open(allowance({}, 0) && { ...(allowance() as object), messagesLeftToday: 0 });
    await userEvent.type(box, "hello");
    expect(screen.getByText("That is today’s limit")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Post/ }).hasAttribute("disabled")).toBe(true);
  });
});
