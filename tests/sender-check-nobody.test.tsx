// @vitest-environment jsdom
// Round 9 fix 1: the sender check refuses ONLY when a DIFFERENT person is signed in. Nobody signed in (signed out here or in another
// tab, a session that ended) is not someone else: the call goes out as it does without the check. A token with no subject is the same.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const puts: string[] = [];
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

import { apiFetch, ApiError, isOtherPerson, WrongPersonError } from "@/lib/api/client";
import { VoiceBox } from "@/features/speak/VoiceBox";
import { clearDraft, leaveTab, OTHER_TAB_NOTE } from "@/features/speak/draft";
import { sendKeptRecording } from "@/features/speak/outbox";

const KEY = "voices-web-session";
const jwt = (payload: object) => `h.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.s`;
const A = jwt({ sub: "userA" });
const B = jwt({ sub: "userB" });
const setSession = (a: string) => window.localStorage.setItem(KEY, JSON.stringify({ accessToken: a, refreshToken: "r" }));
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

let seen: { path: string; auth: string | null }[] = [];
beforeEach(async () => {
  leaveTab(); await clearDraft("userA"); await clearDraft("userB"); await clearDraft(null);
  puts.length = 0; seen = [];
  window.localStorage.clear(); window.sessionStorage.clear();
  URL.createObjectURL = () => "blob:x"; URL.revokeObjectURL = () => undefined;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = String(url).replace(/^.*\/api\/v1/, "");
    const auth = new Headers(init.headers).get("Authorization");
    seen.push({ path: `${(init.method ?? "GET")} ${path}`, auth });
    if (!auth && path !== "/questions/q1") return json({ error: { code: "UNAUTHORIZED", message: "sign in" } }, 401);
    if (path === "/voice-clips") return json({ clip: { id: "c1" }, putUrl: "http://x/put" }, 201);
    if (path.endsWith("/complete")) return json({ id: "c1", status: "PROCESSING" });
    if (path === "/voice-clips/c1") return json({ id: "c1", status: "READY" });
    if (path.endsWith("/answers")) return json({ answer: { id: "a9" } }, 201);
    return json({});
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("the rule at the wire (client.ts)", () => {
  it("isOtherPerson: only a different person with a subject", () => {
    expect(isOtherPerson(B, "userA")).toBe(true);
    expect(isOtherPerson(A, "userA")).toBe(false);
    expect(isOtherPerson(null, "userA")).toBe(false);
    expect(isOtherPerson(undefined, "userA")).toBe(false);
    expect(isOtherPerson(jwt({ n: 1 }), "userA")).toBe(false); // no subject
    expect(isOtherPerson(jwt({ sub: 7 }), "userA")).toBe(false); // not a string
    expect(isOtherPerson("not-a-token", "userA")).toBe(false);
  });
  it("(1) A alone, nobody in storage: the call goes out with no bearer, the 401 comes back as a plain ApiError, no WrongPersonError", async () => {
    const r = await apiFetch("/x", { authed: true, expectSubject: "userA" }).catch((e: unknown) => e);
    expect(r).toBeInstanceOf(ApiError);
    expect(r).not.toBeInstanceOf(WrongPersonError);
    expect(seen).toEqual([{ path: "GET /x", auth: null }]);
  });
  it("(1b) A's session is removed while the call waits on a 401: no WrongPersonError, no second send", async () => {
    setSession(A);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      seen.push({ path: String(url), auth: new Headers(init.headers).get("Authorization") });
      window.localStorage.removeItem(KEY); // signed out in another tab while the request is on the wire
      return json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401);
    }));
    const r = await apiFetch("/x", { authed: true, expectSubject: "userA" }).catch((e: unknown) => e);
    expect(r).not.toBeInstanceOf(WrongPersonError);
    expect(seen.length).toBe(1);
  });
  it("(2) B is signed in instead: refused, nothing sent", async () => {
    setSession(B);
    const r = await apiFetch("/x", { authed: true, expectSubject: "userA" }).catch((e: unknown) => e);
    expect(r).toBeInstanceOf(WrongPersonError);
    expect(seen).toEqual([]);
  });
  it("(3) a token with no subject, or a subject that is not a string: goes out as without the check", async () => {
    for (const t of [jwt({ n: 1 }), jwt({ sub: 7 })]) {
      seen = []; setSession(t);
      const r = await apiFetch("/x", { authed: true, expectSubject: "userA" }).catch((e: unknown) => e);
      expect(r).not.toBeInstanceOf(WrongPersonError);
      expect(seen.length).toBe(1);
      expect(seen[0].auth).toBe(`Bearer ${t}`);
    }
  });
});

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function recordAndStop() {
  await userEvent.click(await screen.findByRole("button", { name: "Start recording" }));
  await tick(800);
  await userEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
}
const asBox = (posted: string[]) => <VoiceBox purpose="REPLY" maxSeconds={30} freeSeconds={30} sendLabel={() => "Send"} onSend={async () => { posted.push("POSTED"); }} />;

describe("a voice box (reply, explain my vote, survey answer)", () => {
  it("(1) A alone, signed out in another tab, taps Send: the call goes out as on main, the someone-else line is never shown", async () => {
    setSession(A);
    render(asBox([]));
    await recordAndStop();
    window.localStorage.removeItem(KEY); // A signs out in tab 2
    await userEvent.click(await screen.findByRole("button", { name: /^Send/ }));
    await waitFor(() => expect(seen.some((s) => s.path === "POST /voice-clips")).toBe(true));
    await tick(200);
    expect(seen.filter((s) => s.path === "POST /voice-clips")).toEqual([{ path: "POST /voice-clips", auth: null }]);
    expect(screen.queryByText(OTHER_TAB_NOTE)).toBeNull();
  });
  it("(2) B signed in instead: nothing goes out, the line is shown", async () => {
    setSession(A);
    render(asBox([]));
    await recordAndStop();
    setSession(B);
    await userEvent.click(await screen.findByRole("button", { name: /^Send/ }));
    expect(await screen.findByText(OTHER_TAB_NOTE)).toBeTruthy();
    expect(seen.filter((s) => s.path.startsWith("POST /voice-clips"))).toEqual([]);
  });
  it("a guest box that became A's (A signed in elsewhere before Send) sends as A", async () => {
    render(asBox([]));
    await recordAndStop();
    setSession(A);
    await userEvent.click(await screen.findByRole("button", { name: /^Send/ }));
    await waitFor(() => expect(seen.some((s) => s.path === "POST /voice-clips")).toBe(true));
    expect(seen.find((s) => s.path === "POST /voice-clips")?.auth).toBe(`Bearer ${A}`);
  });
});

describe("the outbox", () => {
  const draft = { questionId: "q1", blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", seconds: 3, peaks: [], key: "k1", savedAt: Date.now(), queued: true, owner: "userA" };
  it("(1) A alone, session removed: the call goes out as on main (no bearer), the answer is not the someone-else line", async () => {
    const r = await sendKeptRecording(draft);
    expect(seen[0]).toEqual({ path: "POST /voice-clips", auth: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).not.toBe(OTHER_TAB_NOTE);
  });
  it("(2) B signed in: nothing goes out", async () => {
    setSession(B);
    const r = await sendKeptRecording(draft);
    expect(r.ok).toBe(false);
    expect(seen).toEqual([]);
  });
});
