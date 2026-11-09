// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/go",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { Go } from "@/features/entry/Go";
import { Onboarding } from "@/features/entry/Onboarding";
import { WriteScreen } from "@/features/talk/WriteScreen";
import { LANDING_HEADLINE, LANDING_INTRO } from "@/features/entry/landing-words";
import { INVITE_COOKIE } from "@/lib/invite";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const END = () => new Date(Date.now() + 9 * 3600e3 + 60e3).toISOString();
const MOOD_Q = { id: "q9", text: "How do you feel about Nigeria right now?", status: "LIVE", voiceCount: 3, voicesCount: 3, endsAt: END(), category: null, recentVoices: [], moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"] };
const CONFIG = { currency: "NGN", freePosts: 10, unitBaseKobo: 100, costs: {}, tiers: [], extraVoice: [], voiceFreeSeconds: 10 };

let calls: string[] = [];
let inviter: () => Response;
beforeEach(() => {
  calls = []; search = ""; push.mockClear();
  inviter = () => json({ handle: "ada.okafor" });
  window.localStorage.clear();
  document.cookie = `${INVITE_COOKIE}=; Max-Age=0; Path=/`;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const u = String(input);
    calls.push(u);
    if (u.includes("/invites/")) return inviter();
    if (u.endsWith("/questions/today") || u.endsWith("/questions/q9")) return json(MOOD_Q);
    if (u.endsWith("/config/public")) return json(CONFIG);
    if (u.includes("/feed/trending")) return json({ items: [], nextCursor: null });
    if (u.includes("/polls/current")) return json(null);
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = `${INVITE_COOKIE}=; Max-Age=0; Path=/`; });

describe("LCH-A2 fix 5: the invited-by line on /go", () => {
  it("a kept good code shows '@handle asked how you feel.' with the inviter's avatar", async () => {
    document.cookie = `${INVITE_COOKIE}=ada4k2x; Path=/`;
    render(<Go />);
    const line = await screen.findByTestId("go-inviter");
    expect(line.textContent).toContain("@ada.okafor asked how you feel.");
    expect(line.querySelector("[aria-label]")?.getAttribute("aria-label")).toBe("ada okafor");
    expect(calls.filter((u) => u.includes("/invites/")).length).toBe(1);
    expect(calls.find((u) => u.includes("/invites/"))).toMatch(/\/invites\/ada4k2x$/);
  });
  it("a bad or expired code (handle null) shows no line", async () => {
    document.cookie = `${INVITE_COOKIE}=zzzzzzz; Path=/`;
    inviter = () => json({ handle: null });
    render(<Go />);
    expect(await screen.findByRole("heading", { level: 1, name: LANDING_HEADLINE })).toBeTruthy();
    await waitFor(() => expect(calls.some((u) => u.includes("/invites/"))).toBe(true));
    expect(screen.queryByTestId("go-inviter")).toBeNull();
    expect(screen.queryByText(/asked how you feel/)).toBeNull();
  });
  it("a failed lookup (429 or offline) shows no line and no error", async () => {
    document.cookie = `${INVITE_COOKIE}=ada4k2x; Path=/`;
    inviter = () => json({ error: { code: "RATE_LIMITED", message: "x" } }, 429);
    render(<Go />);
    expect(await screen.findByRole("heading", { level: 1, name: LANDING_HEADLINE })).toBeTruthy();
    await waitFor(() => expect(calls.some((u) => u.includes("/invites/"))).toBe(true));
    expect(screen.queryByTestId("go-inviter")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("no kept code: the lookup is never called", async () => {
    render(<Go />);
    expect(await screen.findByRole("heading", { level: 1, name: LANDING_HEADLINE })).toBeTruthy();
    expect(calls.some((u) => u.includes("/invites/"))).toBe(false);
  });
  it("a code with the wrong shape in the cookie is never sent", async () => {
    document.cookie = `${INVITE_COOKIE}=../../me; Path=/`;
    render(<Go />);
    expect(await screen.findByRole("heading", { level: 1, name: LANDING_HEADLINE })).toBeTruthy();
    expect(calls.some((u) => u.includes("/invites/"))).toBe(false);
  });
});

describe("LCH-A2 fix 3: a guest on Write", () => {
  it("sees a Sign in button that returns to the same Write screen with the word", async () => {
    search = "mood=HOPEFUL";
    render(<WriteScreen qid="q9" />);
    const btn = await screen.findByRole("link", { name: "Sign in" });
    expect(btn.getAttribute("href")).toBe(`/sign-in?next=${encodeURIComponent("/q/q9/write?mood=HOPEFUL")}`);
    expect(screen.getByText(/Reading and listening are free\. Sign in to post your answer\./)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("keeps the reply and stance on the way back", async () => {
    search = "reply=a1&stance=AGREE";
    render(<WriteScreen qid="q9" />);
    const btn = await screen.findByRole("link", { name: "Sign in" });
    expect(btn.getAttribute("href")).toBe(`/sign-in?next=${encodeURIComponent("/q/q9/write?reply=a1&stance=AGREE")}`);
  });
});

describe("LCH-A2 fix 4: the onboarding slide", () => {
  it("slide one carries the landing words, not 'Nigeria is talking'", async () => {
    const { container } = render(<Onboarding />);
    expect(await screen.findAllByRole("heading", { level: 1, name: LANDING_HEADLINE })).toBeTruthy();
    expect(screen.getAllByText(LANDING_INTRO)).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).not.toContain("Nigeria is talking");
    expect(text).not.toContain("One question from our editors");
    expect(text).not.toMatch(/—/);
  });
});
