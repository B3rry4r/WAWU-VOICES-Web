// @vitest-environment jsdom
// V-SURVEYS round 6, H1: nothing of a recording goes out as another person (create, bytes, complete, ready check, delete),
// for every use of the recorder.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const puts: string[] = [];
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/q/q1/speak", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/audio-ref/upload", () => ({ putWithRetry: async (p: { url: string }) => { puts.push(p.url); } }));
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

import { VoiceBox } from "@/features/speak/VoiceBox";
import { SpeakScreen } from "@/features/speak/SpeakScreen";
import { currentOwner, clearDraft } from "@/features/speak/draft";

const KEY = "voices-web-session";
const jwt = (sub: string, n: string) => `h.${btoa(JSON.stringify({ sub, n })).replace(/=+$/, "")}.s`;
const A_OLD = jwt("userA", "old");
const A_NEW = jwt("userA", "new");
const B1 = jwt("userB", "1");
const setSession = (a: string, r: string) => window.localStorage.setItem(KEY, JSON.stringify({ accessToken: a, refreshToken: r }));
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as { accessToken?: string | null; refreshToken?: string | null };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const who = (h: string | null) => (h ? `${JSON.parse(atob(h.replace("Bearer ", "").split(".")[1])).sub}:${JSON.parse(atob(h.replace("Bearer ", "").split(".")[1])).n}` : "none");

const question = { id: "q1", text: "Salary?", hint: null, status: "LIVE", category: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, kind: "DAILY", moodOptions: [], pinned: false, sensitive: false, hasOpenPoll: false, topicId: null };
const config = { currency: "NGN", freePosts: 10, voiceFreeSeconds: 10, costs: { freeVoiceSeconds: 10, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 }, tiers: [], extraVoice: [] };

let log: string[] = [];
let refreshGate: Promise<void> = Promise.resolve();
let rejectAt: "create" | "complete" | null = null;
beforeEach(() => {
  log = []; puts.length = 0; refreshGate = Promise.resolve(); rejectAt = null;
  URL.createObjectURL = () => "blob:x"; URL.revokeObjectURL = () => undefined;
  window.localStorage.clear(); window.sessionStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const u = String(url);
    const h = new Headers(init.headers);
    if (u.endsWith("/auth/refresh")) {
      const rt = (JSON.parse(String(init.body)) as { refreshToken: string }).refreshToken;
      log.push(`refresh ${rt}`);
      await refreshGate;
      return json({ data: { accessToken: A_NEW, refreshToken: "rA-new" } });
    }
    const auth = h.get("Authorization");
    const path = u.replace(/^.*\/api\/v1/, "");
    const m = (init.method ?? "GET").toUpperCase();
    if (path.startsWith("/voice-clips")) log.push(`${who(auth)} ${m} ${path}`);
    // A's old token has run out on the clip route named in rejectAt; the new one is accepted.
    const dead = auth === `Bearer ${A_OLD}`;
    if (path === "/voice-clips" && m === "POST") return rejectAt === "create" && dead ? json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401) : json({ clip: { id: "c1" }, putUrl: "http://x/put" }, 201);
    if (path.endsWith("/complete")) return rejectAt === "complete" && dead ? json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401) : json({ id: "c1", status: "PROCESSING" });
    if (path === "/voice-clips/c1" && m === "GET") return json({ id: "c1", status: "READY" });
    if (path === "/questions/q1") return json(question);
    if (path === "/config/public") return json(config);
    if (path.includes("/me/allowance")) return json({ freePostsRemaining: 5, maxVoiceSeconds: 60, costs: config.costs });
    return json({}, 404);
  }));
});
afterEach(async () => { cleanup(); await clearDraft(currentOwner()); await clearDraft("userA"); await clearDraft("userB"); vi.unstubAllGlobals(); window.localStorage.clear(); });

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
function openGate() { let open!: () => void; refreshGate = new Promise<void>((r) => { open = r; }); return open; }

async function recordAndStop(_box: "box" | "screen") {
  await userEvent.click(await screen.findByRole("button", { name: "Start recording" }));
  await tick(800);
  await userEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
}
const asBox = () => <VoiceBox purpose="REPLY" maxSeconds={30} freeSeconds={30} sendLabel={() => "Send"} onSend={async () => { log.push("POSTED"); }} />;
const STALE = /signed in as someone else in another tab/;

describe("H1: a recording made by A is never created, uploaded, completed or deleted with B's token", () => {
  for (const [name, ui, flow] of [["voice box (reply, explain my vote, survey)", asBox, "box"], ["record screen", () => <SpeakScreen questionId="q1" />, "screen"]] as const) {
    it(`${name}: B signs in while A's create-clip call waits on a refresh: no clip, no bytes, B's tokens untouched`, async () => {
      setSession(A_OLD, "rA-old");
      rejectAt = "create";
      render(ui());
      if (flow === "screen") await screen.findByRole("button", { name: "Start recording" });
      const open = openGate();
      await recordAndStop(flow);
      await userEvent.click(await screen.findByRole("button", { name: /^Send/ }));
      await waitFor(() => expect(log).toContain("refresh rA-old"), { timeout: 4000 });
      setSession(B1, "rB-1"); // B signs in in another tab during the wait
      open();
      await screen.findByText(STALE, undefined, { timeout: 4000 });
      expect(log.filter((l) => l.startsWith("userB"))).toEqual([]);
      expect(log).toEqual(["userA:old POST /voice-clips", "refresh rA-old"]);
      expect(puts).toEqual([]);
      expect(log).not.toContain("POSTED");
      expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB-1" });
    });

    it(`${name}: A's token runs out at complete and B signs in then: nothing goes out as B`, async () => {
      setSession(A_OLD, "rA-old");
      rejectAt = "complete";
      render(ui());
      if (flow === "screen") await screen.findByRole("button", { name: "Start recording" });
      const open = openGate();
      await recordAndStop(flow);
      await userEvent.click(await screen.findByRole("button", { name: /^Send/ }));
      await waitFor(() => expect(log).toContain("refresh rA-old"), { timeout: 4000 });
      setSession(B1, "rB-1");
      open();
      await screen.findByText(STALE, undefined, { timeout: 4000 });
      expect(log.filter((l) => l.startsWith("userB"))).toEqual([]);
      expect(log).not.toContain("POSTED");
      expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB-1" });
    });
  }

  it("B is already signed in when A taps Send: nothing at all goes out", async () => {
    setSession(A_OLD, "rA-old");
    render(asBox());
    await recordAndStop("box");
    setSession(B1, "rB-1");
    await userEvent.click(await screen.findByRole("button", { name: /^Send/ }));
    await screen.findByText(STALE);
    expect(log).toEqual([]);
    expect(puts).toEqual([]);
  });

  it("A alone with a run-out token: one refresh, one clip, the bytes, complete, as A", async () => {
    setSession(A_OLD, "rA-old");
    rejectAt = "create";
    render(asBox());
    await recordAndStop("box");
    await userEvent.click(await screen.findByRole("button", { name: /^Send/ }));
    await waitFor(() => expect(log).toContain("POSTED"), { timeout: 5000 });
    expect(log.slice(0, 5)).toEqual(["userA:old POST /voice-clips", "refresh rA-old", "userA:new POST /voice-clips", "userA:new POST /voice-clips/c1/complete", "userA:new GET /voice-clips/c1"]);
    expect(puts).toEqual(["http://x/put"]);
  });
});
