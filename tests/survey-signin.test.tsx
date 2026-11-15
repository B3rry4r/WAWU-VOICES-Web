// @vitest-environment jsdom
// The survey screen when nobody is signed in any more: it shows its own "Sign in to answer" state, sends nothing and keeps the draft.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { leaveTab, OTHER_TAB_NOTE } from "@/features/speak/draft";
import { SurveyScreen } from "@/features/surveys/SurveyScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), usePathname: () => "/surveys/s1" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/audio-ref/upload", () => ({ putWithRetry: vi.fn(() => Promise.resolve()) }));
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

const KEY = "voices-web-session";
const jwt = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, "")}.s`;
const A = jwt("userA");
const B = jwt("userB");
const setSession = (a: string) => window.localStorage.setItem(KEY, JSON.stringify({ accessToken: a, refreshToken: "r" }));
const signOut = () => { window.localStorage.removeItem(KEY); window.dispatchEvent(new Event("storage")); };
const draftKeys = () => Object.keys(window.sessionStorage).filter((k) => k.endsWith(".draft"));

const opt = (id: string, label: string) => ({ id, label });
const survey = {
  id: "s1", label: "Sponsored Survey", brandName: "Zobo Fresh", brandSlug: "zobo-fresh", brandWebsite: null, title: "t", questionCount: 3,
  note: "n", myStatus: "OPEN", voiceMaxSeconds: 30, ageBands: ["18-24"],
  questions: [
    { id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", options: [opt("o1", "A fan on battery"), opt("o2", "Cold drinks")] },
    { id: "q2", position: 2, kind: "SINGLE_CHOICE", prompt: "And at night?", options: [opt("p1", "Window"), opt("p2", "Fan")] },
    { id: "q3", position: 3, kind: "VOICE", prompt: "Say more", options: [] },
  ],
};
const textLast = { ...survey, questions: survey.questions.slice(0, 2) };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
let calls: string[] = [];
let shown: unknown = survey;
function server() {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const path = `${(init.method ?? "GET").toUpperCase()} ${String(input).replace(/^.*\/api\/v1/, "").split("?")[0]}`;
    calls.push(path);
    const tok = new Headers(init.headers).get("Authorization");
    if (path === "POST /auth/refresh") return json({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } }, 401);
    if (path === "GET /surveys/s1") return json(shown);
    if (path === "POST /surveys/s1/events") return new Response(null, { status: 204 });
    if (!tok) return json({ code: "UNAUTHENTICATED", message: "Sign in to continue." }, 401);
    if (path === "POST /surveys/s1/responses") return json({ ok: true, note: "" });
    if (path === "POST /voice-clips") return json({ clip: { id: "c1" }, putUrl: "https://put.test" });
    if (path === "POST /voice-clips/c1/complete") return json({ id: "c1", status: "PROCESSING" });
    if (path === "GET /voice-clips/c1") return json({ id: "c1", status: "READY" });
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
}
const responses = () => calls.filter((c) => c === "POST /surveys/s1/responses");
const SIGN_IN = "Sign in to answer";

async function toLast(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
  await u.click(screen.getByRole("button", { name: "Send answer" }));
  await screen.findByText(/Question 2 of/);
  await u.click(screen.getByRole("radio", { name: "Fan" }));
}

beforeEach(() => {
  leaveTab(); window.localStorage.clear(); window.sessionStorage.clear(); setSession(A); shown = survey;
  window.HTMLMediaElement.prototype.pause = () => undefined;
  URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn();
});
afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 5)); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("survey: nobody is signed in any more", () => {
  it("1: the session is removed on a question: the sign-in state shows, nothing is sent, the draft stays", async () => {
    server();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText(/Question 2 of/);
    const before = draftKeys();
    expect(before.length).toBe(1);
    const n = calls.length;
    act(() => signOut());
    expect(await screen.findByText(SIGN_IN)).toBeTruthy();
    expect(screen.queryByText(OTHER_TAB_NOTE)).toBeNull();
    expect(calls.length).toBe(n);
    expect(draftKeys()).toEqual(before);
  });

  it("2: Send with the session gone and a 401: the sign-in state shows, not Thanks, not the someone-else line; the draft stays", async () => {
    server();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    window.localStorage.removeItem(KEY); // the session ends with no event reaching this tab
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByText(SIGN_IN)).toBeTruthy();
    expect(screen.queryByText(/Thanks/)).toBeNull();
    expect(screen.queryByText(OTHER_TAB_NOTE)).toBeNull();
    expect(responses().length).toBeLessThanOrEqual(1);
    expect(draftKeys().length).toBe(1);
  });

  it("3: the voice question with the session gone before recording: the sign-in state shows", async () => {
    server();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await u.click(await screen.findByRole("radio", { name: "Fan" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText(/Question 3 of/);
    window.localStorage.removeItem(KEY); // no event reaches this tab
    const t0 = Date.now();
    let n = 0;
    vi.spyOn(Date, "now").mockImplementation(() => t0 + (n++) * 400);
    await u.click(await screen.findByRole("button", { name: "Start recording" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    await u.click(screen.getByRole("button", { name: "Stop recording" }));
    expect(await screen.findByText(SIGN_IN)).toBeTruthy();
    expect(responses().length).toBe(0);
    expect(draftKeys().length).toBe(1);
  });

  it("4: the same person signs in again: the draft is restored and sent once", async () => {
    shown = textLast;
    server();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    act(() => signOut());
    await screen.findByText(SIGN_IN);
    cleanup();
    setSession(A);
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText(/Question 2 of/)).toBeTruthy();
    await u.click(screen.getByRole("radio", { name: "Fan" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    expect(responses().length).toBe(1);
  });

  it("5: a different person signs in: nothing of the first person's is shown or sent", async () => {
    shown = textLast;
    server();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    act(() => signOut());
    await screen.findByText(SIGN_IN);
    cleanup();
    setSession(B);
    render(<SurveyScreen id="s1" />);
    // today's rule: this tab belongs to A, so B gets the someone-else notice and none of A's answers
    expect(await screen.findByText(OTHER_TAB_NOTE)).toBeTruthy();
    expect(screen.queryByText(/Question \d of/)).toBeNull();
    expect(screen.queryByText("Fan")).toBeNull();
    expect(responses().length).toBe(0);
  });

  it("6: a person whose session is fine answers once", async () => {
    shown = textLast;
    server();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    await waitFor(() => expect(responses().length).toBe(1));
    expect(screen.queryByText(SIGN_IN)).toBeNull();
  });
});
