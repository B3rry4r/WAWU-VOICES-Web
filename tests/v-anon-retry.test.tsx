// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/q/q1/speak", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/audio-ref/upload", () => ({ putWithRetry: async () => undefined }));
vi.mock("@/lib/audio-ref/recorder", () => ({
  VoiceRecorder: class {
    private done: ((r: unknown) => void) | null = null;
    private out: unknown = null;
    async start() { return null; }
    result() { return this.out ? Promise.resolve(this.out) : new Promise((res) => { this.done = res; }); }
    stop() { this.out = { blob: new Blob(["abc"], { type: "audio/webm" }), mime: "audio/webm", seconds: 3, realSeconds: 3, overLimit: false, stoppedBy: "user" }; this.done?.(this.out); }
    cancel() { /* nothing */ }
  },
}));

import { SpeakScreen } from "@/features/speak/SpeakScreen";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const question = { id: "q1", text: "Salary?", hint: null, status: "LIVE", category: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, kind: "DAILY", moodOptions: [], pinned: false, sensitive: false, hasOpenPoll: false, topicId: null };
const config = { currency: "NGN", freePosts: 10, voiceFreeSeconds: 10, costs: { freeVoiceSeconds: 10, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 }, tiers: [], extraVoice: [] };

let bodies: Record<string, unknown>[] = [];
let fail = true;
beforeEach(() => {
  bodies = []; fail = true; push.mockReset();
  URL.createObjectURL = () => "blob:x"; URL.revokeObjectURL = () => undefined;
  window.localStorage.clear(); window.sessionStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === "POST" && u.endsWith("/questions/q1/answers")) {
      bodies.push(JSON.parse(String(init.body)));
      return fail ? json({ error: { code: "INTERNAL", message: "no" } }, 500) : json({ answer: { id: "new1" } }, 201);
    }
    if (u.endsWith("/questions/q1")) return json(question);
    if (u.endsWith("/config/public")) return json(config);
    if (u.includes("/me/allowance")) return json({ freePostsRemaining: 5, maxVoiceSeconds: 60, costs: config.costs });
    if (u.endsWith("/voice-clips")) return json({ clip: { id: "c1" }, putUrl: "http://x/put" }, 201);
    if (u.endsWith("/complete")) return json({ id: "c1", status: "PROCESSING" });
    if (u.endsWith("/voice-clips/c1")) return json({ id: "c1", status: "READY" });
    return json({}, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("the retry button on the record screen reads the switch now", () => {
  it("a failed send, then the switch turned on, then Try again, posts anonymous true", async () => {
    render(<SpeakScreen questionId="q1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Start recording" }));
    await new Promise((r) => setTimeout(r, 800));
    await userEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Send/ }));
    await waitFor(() => expect(bodies.length).toBe(1), { timeout: 5000 });
    expect(bodies[0]).not.toHaveProperty("anonymous");
    const retry = await screen.findByRole("button", { name: "Try again" });
    fail = false;
    await userEvent.click(screen.getByRole("switch", { name: "Post without my name" }));
    await userEvent.click(retry);
    await waitFor(() => expect(bodies.length).toBe(2), { timeout: 5000 });
    expect(bodies[1]).toMatchObject({ kind: "VOICE", anonymous: true });
  });
});
