// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  usePathname: () => "/go",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { Go } from "@/features/entry/Go";
import { Landing } from "@/features/entry/Landing";
import { LANDING_HEADLINE, LANDING_INTRO } from "@/features/entry/landing-words";
import { metadata as welcomeMeta } from "@/app/welcome/page";
import { metadata as goMeta } from "@/app/go/page";
import { isChromeless } from "@/components/shell/nav";
import { readPick } from "@/features/mood/mood";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const END = () => new Date(Date.now() + 9 * 3600e3 + 60e3).toISOString();
const MOOD_Q = { id: "q9", text: "How do you feel about Nigeria right now?", hint: "With everything going on, say it in your voice. 10 seconds.", voiceCount: 3, voicesCount: 3, endsAt: END(), category: null, recentVoices: [], moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"] };
const PLAIN_Q = { id: "q1", text: "When salary arrives, how many hours pass before it disappears?", voiceCount: 12, voicesCount: 12, endsAt: END(), category: null, recentVoices: [] };
const CONFIG = { currency: "NGN", freePosts: 10, unitBaseKobo: 100, costs: {}, tiers: [], extraVoice: [], voiceFreeSeconds: 10 };

let today: unknown;
beforeEach(() => {
  today = MOOD_Q;
  push.mockClear(); replace.mockClear();
  window.localStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const u = String(input);
    if (u.endsWith("/questions/today")) return json(today);
    if (u.endsWith("/config/public")) return json(CONFIG);
    if (u.includes("/feed/trending")) return json({ items: [], nextCursor: null });
    if (u.endsWith("/me")) return json({ id: "u1", handle: "ada.o", profileComplete: true });
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("LCH-01 landing words", () => {
  it("/welcome shows the new headline and intro and none of the old words", async () => {
    const { container } = render(<Landing />);
    expect(await screen.findByRole("heading", { level: 1, name: LANDING_HEADLINE })).toBeTruthy();
    expect(screen.getByText(LANDING_INTRO)).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).not.toContain("Nigeria is talking. Add your voice.");
    expect(text).not.toContain("Every day our editors ask one question");
    expect(text).not.toMatch(/—/);
  });
  it("the words are the ones in LAUNCH-SPEC section 1", () => {
    expect(LANDING_HEADLINE).toBe("Finally, a place to say it. And be heard.");
    expect(LANDING_INTRO).toBe("One question a day about life in Nigeria. Say your answer in 10 seconds, or type it. Hear people who agree and people who don’t. Vote. Then back the ideas that could actually help.");
  });
  it("the page title and share metadata use the new headline", () => {
    for (const m of [welcomeMeta, goMeta]) {
      expect((m.title as { absolute: string }).absolute).toContain(LANDING_HEADLINE);
      expect(m.openGraph?.title).toBe(LANDING_HEADLINE);
      expect(m.description).toBe(LANDING_INTRO);
    }
  });
});

describe("LCH-08 /go", () => {
  it("is a page of its own, without the app shell", () => {
    expect(isChromeless("/go")).toBe(true);
    expect(isChromeless("/go/ab12cd3")).toBe(true);
    expect(isChromeless("/gone")).toBe(false);
  });
  it("renders for a guest: words, question, four word buttons, listen, add your voice, bottom bar", async () => {
    render(<Go />);
    expect(await screen.findByRole("heading", { level: 1, name: LANDING_HEADLINE })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: MOOD_Q.text })).toBeTruthy();
    for (const w of ["ANGRY", "TIRED", "PROUD", "HOPEFUL"]) expect(screen.getByRole("button", { name: w })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Listen as a guest" }).getAttribute("href")).toBe("/q/q9");
    expect(screen.getAllByRole("link", { name: "Add your voice" }).every((a) => a.getAttribute("href") === "/q/q9/mood")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Sign in" }).every((a) => a.getAttribute("href") === "/sign-in")).toBe(true);
    expect(screen.queryByText(/asked how you feel/)).toBeNull();
  });
  it("renders signed in, with no Sign in and no redirect", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    render(<Go />);
    expect(await screen.findByRole("heading", { level: 1, name: LANDING_HEADLINE })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull());
    expect(screen.getAllByRole("link", { name: "Add your voice" }).length).toBeGreaterThan(0);
    expect(replace).not.toHaveBeenCalled();
  });
  it("a word tap opens the pick screen with that word kept for the sign-up round trip", async () => {
    const user = userEvent.setup();
    render(<Go />);
    await user.click(await screen.findByRole("button", { name: "PROUD" }));
    expect(push).toHaveBeenCalledWith("/q/q9/mood?mood=PROUD");
    expect(readPick("q9")).toBe("PROUD"); // the pick screen and Speak read this after sign-up
  });
  it("an ordinary question shows as Home shows it, with Add your voice going to Speak", async () => {
    today = PLAIN_Q;
    const user = userEvent.setup();
    render(<Go />);
    expect(await screen.findByText(PLAIN_Q.text)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ANGRY" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Add your voice" }).every((a) => a.getAttribute("href") === "/speak")).toBe(true);
    await user.click(screen.getAllByRole("button", { name: /Add your voice/ })[0]);
    expect(push).toHaveBeenCalledWith("/speak");
  });
});

describe("VOICES address (V-35)", () => {
  const SKIP = new Set(["node_modules", ".next", ".git", "out", "coverage"]);
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const n of readdirSync(dir)) {
      if (SKIP.has(n)) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx|js|json|md|yml|yaml|example|css|html)$/.test(n) || n === ".env.example") out.push(p);
    }
    return out;
  };
  it("no file in the web repo names voices.wawuafrica.com", () => {
    const root = join(__dirname, "..");
    const hits = walk(root).filter((f) => !f.endsWith("lch-a-go.test.tsx") && readFileSync(f, "utf8").includes("voices.wawuafrica.com"));
    expect(hits).toEqual([]);
  });
});
