// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let search = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams(search), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => true }));
vi.mock("@/lib/audio-ref/upload", () => ({ putWithRetry: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/api/reach", () => ({ recordShareEvent: () => Promise.resolve() }));
vi.mock("@/lib/audio-ref/recorder", () => {
  class VoiceRecorder {
    private done?: (r: unknown) => void;
    private p = new Promise((res) => { this.done = res; });
    start() { return Promise.resolve(null); }
    result() { return this.p; }
    stop() { this.done?.({ blob: new Blob(["v"], { type: "audio/webm" }), mime: "audio/webm", seconds: 5, realSeconds: 5, stoppedBy: "user", overLimit: false }); }
    cancel() { /* nothing held */ }
  }
  return { VoiceRecorder };
});
const talk = vi.hoisted(() => ({ createVoiceReply: vi.fn() }));
vi.mock("@/lib/api/talk", async (orig) => ({ ...(await orig<typeof import("@/lib/api/talk")>()), createVoiceReply: (...a: unknown[]) => talk.createVoiceReply(...a) }));
const speak = vi.hoisted(() => ({
  getQuestion: vi.fn(), getPublicConfig: vi.fn(), getAllowance: vi.fn(),
  createVoiceClip: vi.fn(), completeVoiceClip: vi.fn(), getVoiceClip: vi.fn(), deleteVoiceClip: vi.fn(), createVoiceAnswer: vi.fn(),
}));
vi.mock("@/lib/api/speak", async (orig) => ({ ...(await orig<typeof import("@/lib/api/speak")>()), ...Object.fromEntries(Object.entries(speak).map(([k, f]) => [k, (...a: unknown[]) => (f as (...x: unknown[]) => unknown)(...a)])) }));

import { WriteScreen } from "@/features/talk/WriteScreen";
import { VoiceReplySheet } from "@/features/talk/VoiceReply";
import { Outbox } from "@/features/speak/Outbox";
import { clearDraft, loadDraft, saveDraft, type Draft } from "@/features/speak/draft";
import { sendKeptRecording } from "@/features/speak/outbox";
import { ApiError } from "@/lib/api/client";


/** A small in-memory IndexedDB: enough for the on-device store (one object store, put / get / delete), so "kept on the device" is tested for real. */
function fakeIndexedDb() {
  const data = new Map<string, unknown>();
  const store = (tx: { oncomplete?: () => void }) => {
    const op = <T,>(fn: () => T) => { const req: { result?: T; onsuccess?: () => void } = {}; req.result = fn(); setTimeout(() => tx.oncomplete?.(), 0); return req; };
    return { put: (v: unknown, k: string) => op(() => { data.set(k, v); return k; }), get: (k: string) => op(() => data.get(k)), delete: (k: string) => op(() => { data.delete(k); return undefined; }) };
  };
  return {
    open: () => {
      const req: { result: unknown; onsuccess?: () => void; onupgradeneeded?: () => void; onerror?: () => void } = { result: undefined };
      req.result = { createObjectStore: () => undefined, close: () => undefined, transaction: () => { const tx: { oncomplete?: () => void; objectStore?: () => unknown } = {}; tx.objectStore = () => store(tx); return tx; } };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
  };
}

const COSTS = { freeVoiceSeconds: 10, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, textPostMilli: 1000, textMaxChars: 1000 };
const allow = { freePostsRemaining: 5, messagesLeftToday: 20, balanceMilli: 0, extraVoiceTokens: [], maxVoiceSeconds: 60, costs: COSTS } as never;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const token = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, "")}.s`;
const signInAs = (sub: string) => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: token(sub), refreshToken: "r" }));
const setOnline = (v: boolean) => Object.defineProperty(navigator, "onLine", { value: v, configurable: true });

beforeEach(async () => {
  search = "";
  window.HTMLMediaElement.prototype.pause = () => undefined;
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  window.localStorage.clear(); window.sessionStorage.clear();
  signInAs("u1");
  setOnline(true);
  vi.stubGlobal("indexedDB", fakeIndexedDb());
  await clearDraft();
  Object.values(speak).forEach((f) => f.mockReset());
  talk.createVoiceReply.mockReset().mockResolvedValue({ reply: { id: "r9" } });
  speak.getQuestion.mockResolvedValue({ id: "q1", status: "LIVE" });
  speak.getPublicConfig.mockResolvedValue({ voiceFreeSeconds: 10 });
  speak.getAllowance.mockResolvedValue({ freePostsRemaining: 5, costs: COSTS, extraVoiceTokens: [] });
  speak.createVoiceClip.mockResolvedValue({ clip: { id: "clip1" }, putUrl: "https://put.test/x" });
  speak.completeVoiceClip.mockResolvedValue({});
  speak.getVoiceClip.mockResolvedValue({ status: "READY" });
  speak.createVoiceAnswer.mockResolvedValue({ answer: { id: "ans1" } });
});
afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, "locks"); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function record() {
  const t0 = Date.now();
  const now = vi.spyOn(Date, "now");
  let n = 0;
  now.mockImplementation(() => t0 + (n++) * 400);
  await userEvent.click(screen.getByRole("button", { name: "Start recording" }));
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  await userEvent.click(screen.getByRole("button", { name: "Stop recording" }));
  await screen.findByRole("button", { name: /^Send/ });
  now.mockRestore();
}

describe("M1: a changed stance gets a new Idempotency-Key", () => {
  it("write screen: 500, then another stance, then send: two keys; a retry with nothing changed: the same key", async () => {
    search = "reply=r1&stance=AGREE";
    const keys: string[] = [];
    const stances: string[] = [];
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === "POST" && u.endsWith("/answers/r1/replies")) {
        keys.push(new Headers(init.headers).get("Idempotency-Key") ?? "");
        stances.push(JSON.parse(String(init.body)).stance);
        return fail ? json({ error: { code: "INTERNAL", message: "no" } }, 500) : json({ reply: { id: "x" } }, 201);
      }
      if (u.endsWith("/answers/r1")) return json({ id: "r1", questionId: "q1", author: { id: "u2", handle: "tunde", displayName: "T", state: null, avatarUrl: null }, kind: "TEXT", body: "Hello", isMine: false, labels: [], status: "PUBLISHED" });
      if (u.endsWith("/questions/q1")) return json({ id: "q1", status: "LIVE", text: "Today?", hint: null, moodOptions: [] });
      if (u.includes("/me/allowance")) return json({ freePostsRemaining: 5, balanceMilli: 0, costs: COSTS });
      return json({}, 404);
    }));
    render(<WriteScreen qid="q1" />);
    await userEvent.type(await screen.findByRole("textbox"), "Same words");
    const post = () => screen.getByRole("button", { name: /^(Post|Send|Reply)/ });
    await userEvent.click(post());
    await waitFor(() => expect(keys.length).toBe(1));
    await screen.findAllByText(/did not post|Something went wrong/i);
    await userEvent.click(post()); // nothing changed
    await waitFor(() => expect(keys.length).toBe(2));
    expect(keys[1]).toBe(keys[0]);
    await userEvent.click(screen.getByRole("button", { name: /I disagree/ }));
    await userEvent.click(post());
    await waitFor(() => expect(keys.length).toBe(3));
    expect(stances).toEqual(["AGREE", "AGREE", "DISAGREE"]);
    expect(keys[2]).not.toBe(keys[0]);
    fail = false;
  });

  it("voice reply: 500, then another stance, then send: two keys; a retry with nothing changed: the same key", async () => {
    talk.createVoiceReply.mockRejectedValue(new ApiError(500, "INTERNAL", "x", false));
    render(<VoiceReplySheet aid="a1" qid="q1" who="@tunde" stance="AGREE" allow={allow} onClose={() => undefined} onPosted={() => undefined} onBuy={() => undefined} />);
    await record();
    const send = () => screen.getByRole("button", { name: /^Send/ });
    await userEvent.click(send());
    await waitFor(() => expect(talk.createVoiceReply).toHaveBeenCalledTimes(1));
    await screen.findByText(/Something went wrong/);
    await userEvent.click(send()); // nothing changed
    await waitFor(() => expect(talk.createVoiceReply).toHaveBeenCalledTimes(2));
    await screen.findByText(/Something went wrong/);
    await userEvent.click(screen.getByRole("button", { name: "I disagree" }));
    await userEvent.click(send());
    await waitFor(() => expect(talk.createVoiceReply).toHaveBeenCalledTimes(3));
    const calls = talk.createVoiceReply.mock.calls;
    expect(calls.map((c) => c[1])).toEqual(["AGREE", "AGREE", "DISAGREE"]);
    expect(calls[1][3]).toBe(calls[0][3]);
    expect(calls[2][3]).not.toBe(calls[0][3]);
  });
});

const draft = (over: Partial<Draft> = {}): Draft => ({ questionId: "q1", blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", seconds: 8, peaks: [], key: "key-r3", savedAt: Date.now(), queued: true, ...over });

describe("M2: two callers on one kept recording post it once", () => {
  function fakeLocks() {
    const held = new Map<string, Promise<unknown>>();
    return {
      request: async (name: string, a: unknown, b?: (l: unknown) => Promise<unknown>) => {
        const opts = typeof a === "object" && a ? (a as { ifAvailable?: boolean }) : {};
        const cb = (typeof a === "function" ? a : b) as (l: unknown) => Promise<unknown>;
        while (held.has(name)) {
          if (opts.ifAvailable) return cb(null);
          await held.get(name)!.catch(() => undefined);
        }
        const p = cb({ name });
        held.set(name, p);
        try { return await p; } finally { held.delete(name); }
      },
    };
  }

  it("the slower caller takes the lock after the first finished, looks again, finds nothing, and sends nothing", async () => {
    Object.defineProperty(navigator, "locks", { value: fakeLocks(), configurable: true });
    const d = draft();
    await saveDraft(d);
    // Both read the kept recording first (it was there), then race for the lock.
    const stillKept = async () => (await loadDraft())?.key === d.key;
    const onPosted = async () => { await clearDraft(); };
    const [a, b] = await Promise.all([sendKeptRecording(d, undefined, stillKept, onPosted, stillKept), sendKeptRecording(d, undefined, stillKept, onPosted, stillKept)]);
    expect([a, b].filter((r) => r.ok && r.answerId === "ans1").length).toBe(1);
    expect([a, b].filter((r) => r.ok && r.answerId === null && "byOtherTab" in r).length).toBe(1);
    expect(speak.createVoiceClip).toHaveBeenCalledTimes(1);
    expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1);
  });

  it("a caller that gets the lock after the recording was posted and cleared sends nothing and is told so (not a second post)", async () => {
    Object.defineProperty(navigator, "locks", { value: fakeLocks(), configurable: true });
    const d = draft();
    // the kept copy is already gone when the lock is taken
    const r = await sendKeptRecording(d, undefined, async () => false, async () => undefined, async () => false);
    expect(r).toMatchObject({ ok: true, answerId: null, byOtherTab: true });
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(speak.createVoiceAnswer).not.toHaveBeenCalled();
  });

  it("the outbox shows nothing for the second caller", async () => {
    const d = draft();
    await saveDraft(d);
    // Another tab posts it and clears it just after this one read it: loadDraft() inside the lock then finds nothing.
    const real = speak.getAllowance.getMockImplementation();
    speak.getAllowance.mockImplementation(async (...a: unknown[]) => { await clearDraft(); return real ? real(...a) : { freePostsRemaining: 5, costs: COSTS, extraVoiceTokens: [] }; });
    render(<Outbox />);
    await waitFor(() => expect(speak.getAllowance).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByText(/Your saved voice was posted/)).toBeNull();
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
  });
});

describe("M3: a voice reply sent offline is really kept", () => {
  async function sendOffline(stanceName: string, anon = false) {
    setOnline(false);
    const onKept = vi.fn();
    const onClose = vi.fn();
    const view = render(<VoiceReplySheet aid="a1" qid="q1" who="@tunde" allow={allow} onClose={onClose} onPosted={() => undefined} onBuy={() => undefined} onKept={onKept} />);
    await userEvent.click(screen.getByRole("button", { name: stanceName }));
    await record();
    if (anon) await userEvent.click(screen.getByRole("switch", { name: "Post without my name" }));
    await userEvent.click(screen.getByRole("button", { name: /^Send/ }));
    await waitFor(() => expect(onKept).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    view.unmount(); // the sheet is closed
    return view;
  }

  it("offline Send keeps it on the device with its parent, stance, name switch and key; nothing is sent yet", async () => {
    await sendOffline("I disagree", true);
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(talk.createVoiceReply).not.toHaveBeenCalled();
    const d = await loadDraft();
    expect(d).toMatchObject({ queued: true, anonymous: true, questionId: "q1", reply: { answerId: "a1", stance: "DISAGREE" } });
    expect(d?.key).toMatch(/-DISAGREE-anon$/);
  });

  it("after the sheet is closed and the connection is back, the outbox posts one reply with the right parent, stance, switch and key", async () => {
    await sendOffline("I disagree", true);
    const kept = await loadDraft();
    setOnline(true);
    render(<Outbox />);
    await screen.findByText(/Your saved voice reply was posted/);
    expect(talk.createVoiceReply).toHaveBeenCalledTimes(1);
    expect(talk.createVoiceReply.mock.calls[0]).toEqual(["a1", "DISAGREE", "clip1", kept!.key, undefined, true, "u1"]);
    expect(speak.createVoiceClip.mock.calls[0][0]).toMatchObject({ purpose: "REPLY" });
    expect(speak.createVoiceAnswer).not.toHaveBeenCalled();
    expect(await loadDraft()).toBeNull();
  });

  it("it goes out on the online event, with no reload", async () => {
    await sendOffline("I agree");
    render(<Outbox />);
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(talk.createVoiceReply).not.toHaveBeenCalled(); // still offline
    setOnline(true);
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await screen.findByText(/Your saved voice reply was posted/);
    expect(talk.createVoiceReply).toHaveBeenCalledTimes(1);
    expect(talk.createVoiceReply.mock.calls[0][5]).toBe(false);
  });

  it("signed in as someone else, nothing is sent and the other person's recording is not shown", async () => {
    await sendOffline("I agree");
    signInAs("u2");
    setOnline(true);
    render(<Outbox />);
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    expect(talk.createVoiceReply).not.toHaveBeenCalled();
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(screen.queryByTestId("outbox")).toBeNull();
  });

  it("a second waiting recording does not replace the first until the person says so", async () => {
    await sendOffline("I agree");
    const first = await loadDraft();
    setOnline(false);
    const onKept = vi.fn();
    render(<VoiceReplySheet aid="a2" qid="q1" who="@ada" allow={allow} onClose={() => undefined} onPosted={() => undefined} onBuy={() => undefined} onKept={onKept} />);
    await userEvent.click(screen.getByRole("button", { name: "I disagree" }));
    await record();
    await userEvent.click(screen.getByRole("button", { name: /^Send/ }));
    await screen.findByText(/already waiting to be sent/);
    expect(onKept).not.toHaveBeenCalled();
    expect((await loadDraft())?.reply?.answerId).toBe("a1");
    expect((await loadDraft())?.key).toBe(first!.key);
    await userEvent.click(screen.getByRole("button", { name: "Replace it" }));
    await waitFor(() => expect(onKept).toHaveBeenCalledTimes(1));
    expect((await loadDraft())?.reply).toEqual({ answerId: "a2", stance: "DISAGREE" });
  });
});
