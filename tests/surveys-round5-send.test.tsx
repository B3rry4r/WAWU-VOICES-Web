// @vitest-environment jsdom
// V-SURVEYS round 5: a survey send is only ever made with the sign-in of the person the screen loaded for (H1);
// the survey's own words when a send fails (M2); the failure line sits beside Send and is announced (M3).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyScreen } from "@/features/surveys/SurveyScreen";
import { apiFetch, tokenSubject, WrongPersonError } from "@/lib/api/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), usePathname: () => "/surveys/s1" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const KEY = "voices-web-session";
const jwt = (sub: string, n = "1") => `h.${btoa(JSON.stringify({ sub, n })).replace(/=+$/, "")}.s`;
const A1 = jwt("userA", "old"); // run out
const A2 = jwt("userA", "new");
const B1 = jwt("userB", "1");
const setSession = (a: string, r: string) => window.localStorage.setItem(KEY, JSON.stringify({ accessToken: a, refreshToken: r }));
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as { accessToken: string | null; refreshToken: string | null };

interface Req { path: string; auth: string | null; body: unknown }
let log: Req[] = [];
const subjectOf = (h: string | null) => (h ? (tokenSubject(h.replace("Bearer ", "")) ?? "none") + ":" + (JSON.parse(atob(h.replace("Bearer ", "").split(".")[1])).n as string) : "none");

const opt = (id: string, label: string) => ({ id, label });
const survey = {
  id: "s1", label: "Sponsored Survey", brandName: "Zobo Fresh", brandSlug: "zobo-fresh", brandWebsite: null, title: "t", questionCount: 2,
  note: "n", myStatus: "OPEN", voiceMaxSeconds: 30, ageBands: ["18-24"],
  questions: [
    { id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", options: [opt("o1", "A fan on battery"), opt("o2", "Cold drinks")] },
    { id: "q2", position: 2, kind: "SINGLE_CHOICE", prompt: "And at night?", options: [opt("p1", "Window"), opt("p2", "Fan")] },
  ],
};
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const err = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

type Post = (r: Req, headers: Headers) => Promise<Response> | Response;
type Refresh = (refreshToken: string) => Promise<Response> | Response;
function server(post: Post, refresh: Refresh = () => json({ data: { accessToken: A2, refreshToken: "rA2" } })) {
  log = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    const headers = new Headers(init.headers);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    if (url.endsWith("/auth/refresh")) {
      log.push({ path: "/auth/refresh", auth: null, body });
      return refresh((body as { refreshToken: string }).refreshToken);
    }
    const path = url.replace(/^.*\/api\/v1/, "").split("?")[0];
    const auth = headers.get("Authorization");
    const r = { path: `${(init.method ?? "GET").toUpperCase()} ${path}`, auth: auth ? subjectOf(auth) : null, body };
    log.push(r);
    if (r.path === "GET /surveys/s1") return json(survey);
    if (r.path === "POST /surveys/s1/events") return new Response(null, { status: 204 });
    if (r.path === "POST /surveys/s1/responses") return post(r, headers);
    return err(404, "NOT_FOUND", "We could not find that.");
  }));
}
const sends = () => log.filter((r) => r.path === "POST /surveys/s1/responses");
const sendsAs = (who: string) => sends().filter((r) => r.auth?.startsWith(who));

async function toLast(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
  await u.click(screen.getByRole("button", { name: "Send answer" }));
  await screen.findByText("Question 2 of 2");
  await u.click(screen.getByRole("radio", { name: "Fan" }));
}
const STALE = "You are signed in as someone else in another tab. Reload to carry on.";

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); setSession(A1, "rA1"); });
afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 5)); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

describe("H1: the send, and its retry after a refresh, carry only the sign-in of the person the screen loaded for", () => {
  it("A's token has run out and A alone refreshes: one send goes through, as A", async () => {
    server((_r, h) => (h.get("Authorization") === `Bearer ${A1}` ? err(401, "UNAUTHORIZED", "x") : json({ ok: true, note: "" })));
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    expect(log.filter((r) => r.path === "/auth/refresh").map((r) => (r.body as { refreshToken: string }).refreshToken)).toEqual(["rA1"]);
    expect(sends().map((r) => r.auth)).toEqual(["userA:old", "userA:new"]);
    expect(stored()).toEqual({ accessToken: A2, refreshToken: "rA2" });
  });

  it("A's send gets a 401 after a wait and B signs in meanwhile: nothing is sent after it, no refresh, B's sign-in is intact, A's tab shows the stale notice", async () => {
    let release: (r: Response) => void = () => undefined;
    server(() => new Promise<Response>((res) => { release = res; }));
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await waitFor(() => expect(sends().length).toBe(1));
    expect(sends()[0].auth).toBe("userA:old");
    setSession(B1, "rB1"); // tab 2: B signs in during the wait (no storage event reaches this tab on purpose: the client itself must hold)
    release(err(401, "UNAUTHORIZED", "x"));
    expect(await screen.findByText(STALE)).toBeTruthy();
    expect(sends().length).toBe(1); // only A's first try
    expect(sendsAs("userB")).toEqual([]);
    expect(log.some((r) => r.path === "/auth/refresh")).toBe(false); // B's refresh token was never used
    expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB1" });
    expect(JSON.stringify(log.filter((r) => r.auth?.startsWith("userB")))).not.toContain("o2"); // no request under B carries A's answers
  });

  it("B signs in while A's refresh is on the wire: A's tokens are not written over B, and nothing is sent again", async () => {
    server(() => err(401, "UNAUTHORIZED", "x"), async () => {
      setSession(B1, "rB1"); // B signs in while the refresh call is in flight
      return json({ data: { accessToken: A2, refreshToken: "rA2" } });
    });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByText(STALE)).toBeTruthy();
    expect(sends().length).toBe(1);
    expect(sendsAs("userB")).toEqual([]);
    expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB1" });
  });

  it("a refresh that is refused while B has signed in does not clear B's sign-in", async () => {
    server(() => err(401, "UNAUTHORIZED", "x"), () => {
      setSession(B1, "rB1");
      return err(401, "UNAUTHORIZED", "refused");
    });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByText(STALE)).toBeTruthy();
    expect(sendsAs("userB")).toEqual([]);
    expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB1" });
  });

  it("B is already signed in when A presses Send: nothing is sent at all", async () => {
    server(() => json({ ok: true, note: "" }));
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    const before = sends().length;
    setSession(B1, "rB1");
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByText(STALE)).toBeTruthy();
    expect(sends().length).toBe(before);
  });
});

describe("the option is opt-in: other calls keep the client behaviour", () => {
  it("without expectSubject a 401 still refreshes with the stored token and retries as whoever is signed in", async () => {
    server(() => json({ ok: true }), () => json({ data: { accessToken: A2, refreshToken: "rA2" } }));
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
      if (String(input).endsWith("/auth/refresh")) return json({ data: { accessToken: B1, refreshToken: "rB" } });
      n += 1;
      return n === 1 ? err(401, "UNAUTHORIZED", "x") : json({ ok: true, auth: new Headers(init.headers).get("Authorization") });
    }));
    const r = await apiFetch<{ ok: boolean; auth: string }>("/anything", { authed: true });
    expect(r.auth).toBe(`Bearer ${B1}`);
    expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB" });
  });
  it("with expectSubject a mismatch throws WrongPersonError and sends nothing", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(apiFetch("/x", { authed: true, expectSubject: "userB" })).rejects.toBeInstanceOf(WrongPersonError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("M2 and M3: the survey's own words, beside Send, announced", () => {
  const fail = async (post: Post) => {
    server(post);
    setSession(A2, "rA2");
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    const scroll = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scroll;
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    const box = await screen.findByTestId("survey-problem");
    const card = screen.getByRole("region", { name: /Sponsored Survey from/ });
    expect(card.contains(box)).toBe(true); // inside the card, in the same card as the Send button
    expect(within(box).getByRole("alert")).toBeTruthy(); // announced
    expect(scroll).toHaveBeenCalled(); // scrolled into view
    expect(box.compareDocumentPosition(screen.getByRole("button", { name: "Send answer" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // directly above Send
    return box.textContent ?? "";
  };
  const SAFE = "Tap Send again: it is safe, your answers are only counted once.";
  it("offline", async () => {
    const t = await fail(() => { throw new TypeError("net"); });
    expect(t).toContain("You look offline");
    expect(t).toContain(SAFE);
    expect(t).not.toMatch(/recording|not sent/i);
  });
  it("no answer in time", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
    try {
      server(() => new Promise<Response>(() => undefined));
      // a hung request is aborted by the client's own timer; the stub honours the abort
      vi.stubGlobal("fetch", vi.fn((input: string, init: RequestInit = {}) => {
        const path = String(input).replace(/^.*\/api\/v1/, "");
        if (path === "/surveys/s1") return Promise.resolve(json(survey));
        if (path.endsWith("/events")) return Promise.resolve(new Response(null, { status: 204 }));
        return new Promise<Response>((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
      }));
      setSession(A2, "rA2");
      const u = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      render(<SurveyScreen id="s1" />);
      await toLast(u);
      await u.click(screen.getByRole("button", { name: "Send answer" }));
      await vi.advanceTimersByTimeAsync(10_500);
      const box = await screen.findByTestId("survey-problem");
      expect(box.textContent).toContain(`We could not confirm your answers were received. ${SAFE}`);
      expect(box.textContent).not.toMatch(/not sent|recording/i);
    } finally {
      vi.useRealTimers();
    }
  });
  it("server fault", async () => {
    const t = await fail(() => err(500, "INTERNAL", "boom"));
    expect(t).toContain("Something went wrong on our side");
    expect(t).toContain(SAFE);
    expect(t).not.toMatch(/boom|recording/i);
  });
  it("refused: the server's own words", async () => {
    const t = await fail(() => err(422, "INVALID", "Pick one of the choices."));
    expect(t).toContain("Pick one of the choices.");
    expect(t).not.toMatch(/recording/i);
  });
  it("no em-dash or en-dash in any of the lines", async () => {
    const t = await fail(() => err(500, "INTERNAL", "boom"));
    expect(t).not.toMatch(/[–—]/);
  });
});
