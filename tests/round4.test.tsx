// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { sharePageBody, SHARE_OPENS as OPENS } from "./support/share-page";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useParams: () => ({ code: "c1" }),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/lib/api/forward-server", () => ({ requestForward: () => ({}) }));
const getSharePage = vi.fn();
vi.mock("@/lib/api/reach", async (orig) => ({ ...(await orig<object>()), getSharePage: (...a: unknown[]) => getSharePage(...a), getPollTitle: vi.fn(), getProfileVoices: vi.fn() }));

import { ShareGate } from "@/features/share/ShareGate";
import ShareError from "@/app/s/[code]/error";
import { resetServerClock } from "@/lib/api/server-clock";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

let mode: "500" | "503" | "open" | "closed" | "404" = "500";
let asks = 0;
beforeEach(() => {
  mode = "500"; asks = 0; resetServerClock(); refresh.mockClear();
  vi.stubGlobal("fetch", vi.fn(async (u: string) => {
    if (!/\/share\/c1$/.test(String(u))) return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
    asks += 1;
    if (mode === "500" || mode === "503") return json({ error: { code: "X", message: "no" } }, Number(mode));
    if (mode === "404") return json({ error: { code: "NOT_FOUND", message: "gone" } }, 404);
    return json(sharePageBody(mode === "open"));
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("round 4: a share page never ends on an error page because of a failed draw", () => {
  it("waiting page at the instant: the server's own refresh is never used, the page is drawn from the browser's answer", async () => {
    vi.useFakeTimers({ now: OPENS - 10_000 });
    render(<ShareGate code="c1" opensAt={OPENS} serverNow={Date.now()}><p>COMING UP</p></ShareGate>);
    mode = "503";
    await tick(40_000);
    expect(document.body.textContent).toContain("COMING UP");
    expect(document.body.textContent).not.toMatch(/We could not open that link|We are busy/);
    mode = "open";
    await tick(61_000);
    expect(screen.getByTestId("share-page")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    const after = asks;
    await tick(120_000);
    expect(asks).toBe(after); // no polling once open
  });

  it("a link opened fresh while the server draw fails: 'Opening. One moment.', retried on 5, 15, 30, 60, then the page", async () => {
    vi.useFakeTimers({ now: OPENS + 2_000 });
    render(<ShareGate code="c1" />);
    expect(screen.getByTestId("share-waiting").textContent).toContain("Opening.One moment.");
    expect(screen.getByRole("status")).toBeTruthy();
    await tick(5_100); // the 0 to 5 s spread
    const first = asks;
    expect(first).toBe(1);
    await tick(5_000); expect(asks).toBe(2);
    await tick(15_000); expect(asks).toBe(3);
    await tick(30_000); expect(asks).toBe(4);
    await tick(60_000); expect(asks).toBe(5);
    expect(screen.getByTestId("share-waiting")).toBeTruthy();
    mode = "open";
    await tick(60_000);
    expect(screen.getByTestId("share-page")).toBeTruthy();
    expect(document.body.textContent).toContain("Add your voice");
  });

  it("the waiting state turns into the coming-up page when the API says the question has not opened, and then watches the instant", async () => {
    vi.useFakeTimers({ now: OPENS - 60_000 });
    mode = "closed";
    render(<ShareGate code="c1" />);
    await tick(5_100);
    expect(screen.getByTestId("share-page")).toBeTruthy();
    expect(document.body.textContent).toContain("Opens Sunday 15 November");
    mode = "open";
    await tick(66_000);
    expect(document.body.textContent).not.toContain("Opens Sunday 15 November");
    expect(document.body.textContent).toContain("Add your voice");
  });

  it("a link that is gone (404) shows the not-found page, from the waiting state and from the waiting page", async () => {
    vi.useFakeTimers({ now: OPENS + 2_000 });
    mode = "404";
    render(<ShareGate code="c1" />);
    await tick(5_100);
    expect(screen.getByTestId("share-not-found")).toBeTruthy();
    cleanup();
    render(<ShareGate code="c1" opensAt={OPENS} serverNow={Date.now()}><p>COMING UP</p></ShareGate>);
    await tick(5_100);
    expect(screen.getByTestId("share-not-found")).toBeTruthy();
  });

  it("the route's error boundary shows the waiting state and retries by itself", async () => {
    vi.useFakeTimers({ now: OPENS + 2_000 });
    render(<ShareError />);
    expect(screen.getByTestId("share-waiting")).toBeTruthy();
    await tick(5_100);
    mode = "open";
    await tick(5_000);
    expect(screen.getByTestId("share-page")).toBeTruthy();
  });

  it("the page: a server fault (500, 503, no answer) draws the waiting state, never the error words; 404 is not-found", async () => {
    const { default: Page } = await import("@/app/s/[code]/page");
    for (const e of [new ApiError(500, "INTERNAL", "x", false), new ApiError(503, "UNAVAILABLE", "busy", true), new TypeError("fetch failed")]) {
      getSharePage.mockRejectedValueOnce(e);
      vi.useFakeTimers({ now: OPENS + 2_000 });
      const { unmount } = render(await Page({ params: { code: "c1" } }));
      expect(screen.getByTestId("share-waiting")).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/We could not open that link|We are busy/);
      unmount(); vi.useRealTimers();
    }
    getSharePage.mockRejectedValueOnce(new ApiError(404, "NOT_FOUND", "gone", false));
    await expect(Page({ params: { code: "c1" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("the page: a question that has not opened is drawn by the server inside the gate (picture tags and all), an open one is not", async () => {
    const { default: Page } = await import("@/app/s/[code]/page");
    vi.useFakeTimers({ now: OPENS - 3_600_000 });
    getSharePage.mockResolvedValueOnce(sharePageBody(false));
    const { unmount } = render(await Page({ params: { code: "c1" } }));
    expect(document.body.textContent).toContain("Opens Sunday 15 November");
    expect(asks).toBe(0);
    unmount();
    getSharePage.mockResolvedValueOnce(sharePageBody(true));
    render(await Page({ params: { code: "c1" } }));
    expect(screen.getByTestId("share-page")).toBeTruthy();
  });
});

describe("round 4 MEDIUM: a 409 'start again with a new key' is answered with a new key", () => {
  it("the next Post tap after it goes out with a different Idempotency-Key, with the same words", async () => {
    vi.useRealTimers();
    window.localStorage.clear();
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    const keys: string[] = [];
    const costs = { freeReactionsPerDay: 20, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000 };
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      const url = String(u);
      const method = init?.method ?? "GET";
      if (method === "POST" && /\/questions\/q1\/answers$/.test(url)) { keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? ""); return json({ error: { code: "CONFLICT", message: "Start again with a new key", requestId: "r" } }, 409); }
      if (/\/questions\/q1$/.test(url)) return json({ id: "q1", status: "LIVE", text: "Q", hint: null, moodOptions: [] });
      if (/\/me\/allowance$/.test(url)) return json({ freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] });
      return json({ items: [], nextCursor: null });
    }));
    const { WriteScreen } = await import("@/features/talk/WriteScreen");
    const userEvent = (await import("@testing-library/user-event")).default;
    render(<WriteScreen qid="q1" />);
    await userEvent.type(await screen.findByRole("textbox"), "Same words");
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole("button", { name: /^Post/ }));
      await screen.findByText("That did not post. Tap Post to try again.");
    }
    expect(keys.length).toBe(3);
    expect(new Set(keys).size).toBe(3);
  });
});
