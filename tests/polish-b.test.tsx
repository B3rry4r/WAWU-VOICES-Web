// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams("a=a1"),
}));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { VoicePlayer } from "@/components/vx";
import { TalkCard } from "@/features/talk/TalkCard";
import { PostedScreen } from "@/features/talk/PostedScreen";
import { ReportSheet } from "@/features/results/ReportSheet";
import { applyAccountTheme, applyTheme, chooseTheme, deviceChoice } from "@/features/profile/theme";
import type { Answer } from "@/lib/api/talk";

const answer = (over: Partial<Answer> = {}): Answer => ({
  id: "a1", questionId: "q1", author: { id: "u1", handle: "tunde.a", displayName: "Tunde", state: "Ibadan", avatarUrl: null }, kind: "TEXT", body: "Two hours.", clip: null,
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 3, replyCount: 2, agreeCount: 1, disagreeCount: 1, reactionCount: 0,
  reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [],
  ...over,
}) as Answer;
const clip = (status: "PENDING" | "READY" | "FAILED") => ({ id: "c1", status: "READY", durationMs: 9000, maxDurationMs: 10000, peaks: null, transcript: { status, language: "en", text: "Two hours. I counted." } });

type Call = { url: string; method: string; body?: unknown };
let calls: Call[] = [];
function stub(routes: (c: Call) => Response | undefined) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const c: Call = { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    return routes(c) ?? new Response("{}", { status: 404 });
  }));
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

beforeEach(() => {
  calls = [];
  push.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("P1 theme: the device's saved choice wins", () => {
  it("the account setting applies only when the device has no choice, and never saves over it", () => {
    applyAccountTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(deviceChoice()).toBeNull();
  });
  it("an account of system does not wipe a device choice of dark or light", () => {
    window.localStorage.setItem("voices-theme", "dark");
    applyTheme("dark");
    applyAccountTheme("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    window.localStorage.setItem("voices-theme", "light");
    applyAccountTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
  it("choosing in Settings applies now and saves on the device", () => {
    chooseTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("voices-theme")).toBe("dark");
    chooseTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(deviceChoice()).toBe("system");
  });
});

describe("P3 VoicePlayer progress is live and the bars are the clip's peaks", () => {
  it("follows the progress it is given and asks to seek on a tap", () => {
    const seek = vi.fn();
    render(<VoicePlayer duration={10} peaks={Array.from({ length: 10 }, (_, i) => (i + 1) * 25)} progress={0.5} playing={false} onSeek={seek} />);
    const bars = document.querySelectorAll(".vx-player__track i");
    expect(bars.length).toBe(10);
    expect(document.querySelectorAll(".vx-player__track i.on").length).toBe(5);
    expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("5");
    const track = screen.getByRole("slider");
    track.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, right: 200, bottom: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(track, { clientX: 150 });
    expect(seek).toHaveBeenCalledWith(0.75);
    // the bar heights come from the peaks: the last (255-ish) is taller than the first
    const h = (i: number) => parseInt((bars[i] as HTMLElement).style.height, 10);
    expect(h(9)).toBeGreaterThan(h(0));
  });
});

describe("T1 transcript row only when the transcript is READY", () => {
  it("READY shows Read transcript", () => {
    render(<TalkCard answer={answer({ kind: "VOICE", body: null, clip: clip("READY") } as Partial<Answer>)} signedIn push={vi.fn()} />);
    expect(screen.getByRole("button", { name: /read transcript/i })).toBeTruthy();
  });
  it("PENDING does not", () => {
    render(<TalkCard answer={answer({ kind: "VOICE", body: null, clip: clip("PENDING") } as Partial<Answer>)} signedIn push={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /read transcript/i })).toBeNull();
  });
});

describe("T5 Posted share buttons", () => {
  const link = { code: "abc12345", url: "https://voices.example/s/abc12345", previewText: "A voice from @ada\nhttps://voices.example/s/abc12345", cardStatus: "READY", imageUrl: "https://x/card.png" };
  function routes(c: Call) {
    if (c.url.endsWith("/answers/a1")) return json(answer());
    if (c.url.endsWith("/me/allowance")) return json({ freePostsRemaining: 6, balanceMilli: 0, maxVoiceSeconds: 10, freeReactionsLeftToday: 1, costs: {}, extraVoiceTokens: [] });
    if (c.url.endsWith("/share/links")) return json(link);
    if (c.url.includes("/events")) return new Response(null, { status: 204 });
    return undefined;
  }
  it("WhatsApp Status opens wa.me with the share text and records WHATSAPP_STATUS", async () => {
    stub(routes);
    render(<PostedScreen qid="q1" />);
    const b = await screen.findByRole("link", { name: "WhatsApp Status" });
    await waitFor(() => expect(b.getAttribute("href")).toContain("https://wa.me/?text="));
    expect(decodeURIComponent(b.getAttribute("href")!)).toContain(link.url);
    await userEvent.click(b);
    await waitFor(() => expect(calls.some((c) => c.url.includes("/share/abc12345/events") && (c.body as { target?: string })?.target === "WHATSAPP_STATUS")).toBe(true));
  });
  it("Instagram Stories downloads the story card and shows the how-to", async () => {
    stub((c) => (c.url.includes("/card") ? new Response(new Blob(["png"], { type: "image/png" }), { status: 200 }) : routes(c)));
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:x";
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<PostedScreen qid="q1" />);
    const b = await screen.findByRole("button", { name: "Instagram Stories" });
    await waitFor(() => expect((b as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(b);
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(calls.some((c) => c.url.includes("/card?size=story"))).toBe(true);
    expect(await screen.findByText(/Open Instagram and tap Your story/)).toBeTruthy();
    expect(calls.some((c) => c.url.includes("/events") && (c.body as { target?: string })?.target === "INSTAGRAM_STORIES")).toBe(true);
  });
});

describe("R1 result post Report is wired; Reply is not offered", () => {
  it("sends a RESULT_POST report", async () => {
    stub((c) => (c.url.endsWith("/reports") && c.method === "POST" ? json({ id: "r1", blocked: false }) : undefined));
    render(<ReportSheet postId="p1" signedIn onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "The numbers look wrong" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("We got your report"));
    expect(calls[0].body).toEqual({ targetType: "RESULT_POST", targetId: "p1", reason: "OTHER", note: "Wrong numbers" });
  });
  it("a repeat report says so", async () => {
    stub(() => json({ error: { code: "CONFLICT", message: "x", requestId: "r" } }, 409));
    render(<ReportSheet postId="p1" signedIn onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Spam or a scam" }));
    expect((await screen.findByRole("alert")).textContent).toContain("already reported");
  });
});

describe("T7 /s/<code> when the API cannot be reached", () => {
  it("renders a plain page, never throws (a throw is a 500)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const mod = await import("@/app/s/[code]/page");
    const el = await mod.default({ params: { code: "abc" } });
    const { container } = render(el as React.ReactElement);
    expect(container.querySelector('[data-testid="share-unavailable"]')).toBeTruthy();
    const meta = await mod.generateMetadata({ params: { code: "abc" } });
    expect((meta.robots as { index: boolean }).index).toBe(false);
  });
  it("a 5xx from the API is the same plain page; a 404 is still not-found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "INTERNAL", message: "x", requestId: "r" } }, 500)));
    const mod = await import("@/app/s/[code]/page");
    const el = await mod.default({ params: { code: "abc" } });
    expect(render(el as React.ReactElement).container.querySelector('[data-testid="share-unavailable"]')).toBeTruthy();
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "NOT_FOUND", message: "x", requestId: "r" } }, 404)));
    await expect(mod.default({ params: { code: "abc" } })).rejects.toThrow();
  });
});
