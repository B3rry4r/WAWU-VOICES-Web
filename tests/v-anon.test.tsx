// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/q/q1/write",
}));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { WriteScreen } from "@/features/talk/WriteScreen";
import { PostedScreen } from "@/features/talk/PostedScreen";
import { ANON_NOTE } from "@/features/talk/AnonymousSwitch";
import { PostRow } from "@/features/profile/PostRow";
import { createAnswer, createReply, createVoiceReply } from "@/lib/api/talk";
import { createVoiceAnswer } from "@/lib/api/speak";
import { postHeldAnswer } from "@/lib/api/units";
import { readAnonPref, writeAnonPref } from "@/lib/anon-pref";

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[] = [];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const me = { id: "u1", handle: "me", displayName: "Me", state: null, avatarUrl: null };
const base = { id: "a1", questionId: "q1", author: me, kind: "TEXT", body: "Salary goes in two hours.", clip: null, createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null };
let posted: unknown = base;
const sit = { answerId: "a1", questionId: "q1", mood: "HOPEFUL", showNameOnCard: false, defaultScope: "NIGERIA", showSwitch: false, nigeria: { percent: null, count: 3 }, world: { percent: null, count: 3 }, cardLine: "You’re one of the first.", updatedAt: "x" };
function stub() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const c: Call = { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const u = c.url;
    if (c.method === "POST" && u.endsWith("/questions/q1/answers")) return json({ answer: { ...base, id: "new1" } }, 201);
    if (c.method === "POST" && u.endsWith("/answers/a1/replies")) return json({ reply: { id: "r1" } }, 201);
    if (u.endsWith("/answers/a1")) return json(posted);
    if (u.endsWith("/where-you-sit")) return json(sit);
    if (u.includes("/me/allowance")) return json({ freePostsRemaining: 5, balanceMilli: 0, costs: { textPostMilli: 1000, textMaxChars: 1000 } });
    if (u.endsWith("/share/links")) return json({ code: "c1", url: "x", cardStatus: "PENDING" });
    if (u.endsWith("/questions/q1")) return json({ id: "q1", status: "LIVE", text: "Today?", hint: null, moodOptions: [] });
    return new Response("{}", { status: 404 });
  }));
}
const post = () => calls.find((c) => c.method === "POST" && c.url.endsWith("/questions/q1/answers"))!;

beforeEach(() => {
  calls = []; push.mockReset(); search = ""; posted = base;
  window.localStorage.clear(); window.sessionStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  stub();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Post without my name on the write screen", () => {
  it("is off by default, says what stays hidden, and sends no anonymous when off", async () => {
    render(<WriteScreen qid="q1" />);
    const sw = await screen.findByRole("switch", { name: "Post without my name" });
    expect((sw as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(ANON_NOTE)).toBeTruthy();
    expect(ANON_NOTE).toBe("Your name and photo stay hidden. Admins can still see who posted, to keep Voices safe.");
    expect(ANON_NOTE).not.toContain("—");
    await userEvent.type(screen.getByRole("textbox"), "Salary goes in two hours.");
    await userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
    await waitFor(() => expect(post()).toBeTruthy());
    expect(post().body).not.toHaveProperty("anonymous");
    expect(post().body).not.toHaveProperty("showNameOnCard");
  });

  it("sends anonymous true and no showNameOnCard when on, then forgets the choice", async () => {
    render(<WriteScreen qid="q1" />);
    await userEvent.click(await screen.findByRole("switch", { name: "Post without my name" }));
    expect(readAnonPref("q1")).toBe(true);
    await userEvent.type(screen.getByRole("textbox"), "Salary goes in two hours.");
    await userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
    await waitFor(() => expect(post()).toBeTruthy());
    expect(post().body).toMatchObject({ kind: "TEXT", anonymous: true });
    expect(post().body).not.toHaveProperty("showNameOnCard");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/q/q1/posted?a=new1"));
    expect(readAnonPref("q1")).toBe(false);
  });

  it("is offered on a reply too, off until turned on (V-FIX-D: the API now takes anonymous on a reply)", async () => {
    search = "reply=r1&stance=AGREE";
    stub();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).endsWith("/answers/r1") ? json({ ...base, id: "r1" }) : String(url).endsWith("/questions/q1") ? json({ id: "q1", status: "LIVE", text: "Today?", hint: null, moodOptions: [] }) : String(url).includes("/me/allowance") ? json({ freePostsRemaining: 5, balanceMilli: 0, costs: { textPostMilli: 1000 } }) : new Response("{}", { status: 404 }))));
    render(<WriteScreen qid="q1" />);
    await screen.findByRole("textbox");
    const sw = screen.getByRole("switch", { name: "Post without my name" }) as HTMLInputElement;
    expect(sw.checked).toBe(false);
  });
});

describe("the payloads", () => {
  it("createAnswer and createVoiceAnswer add anonymous true only when asked", async () => {
    await createAnswer("q1", "hi", { isNews: false }, "k1");
    await createAnswer("q1", "hi", { isNews: false }, "k2", null, true);
    await createVoiceAnswer("q1", "c1", "k3");
    await createVoiceAnswer("q1", "c1", "k4", undefined, null, true);
    const bodies = calls.filter((c) => c.method === "POST").map((c) => c.body!);
    expect(bodies[0]).not.toHaveProperty("anonymous");
    expect(bodies[1]).toMatchObject({ kind: "TEXT", anonymous: true });
    expect(bodies[2]).not.toHaveProperty("anonymous");
    expect(bodies[3]).toMatchObject({ kind: "VOICE", clipId: "c1", anonymous: true });
    for (const b of bodies) expect(b).not.toHaveProperty("showNameOnCard");
  });

  it("V-FIX-D: createReply and createVoiceReply add anonymous true only when asked", async () => {
    await createReply("a1", "AGREE", "yes", "k1");
    await createReply("a1", "AGREE", "yes", "k2", true);
    await createVoiceReply("a1", "AGREE", "c1", "k3");
    await createVoiceReply("a1", "AGREE", "c1", "k4", "t1", true);
    const bodies = calls.filter((c) => c.method === "POST").map((c) => c.body!);
    expect(bodies[0]).toEqual({ stance: "AGREE", kind: "TEXT", body: "yes" });
    expect(bodies[1]).toEqual({ stance: "AGREE", kind: "TEXT", body: "yes", anonymous: true });
    expect(bodies[2]).toEqual({ stance: "AGREE", kind: "VOICE", clipId: "c1" });
    expect(bodies[3]).toEqual({ stance: "AGREE", kind: "VOICE", clipId: "c1", extraVoiceTokenId: "t1", anonymous: true });
  });

  it("a held draft posted after buying tokens keeps the choice, and only then", async () => {
    await postHeldAnswer("q1", "hi", "k1");
    writeAnonPref("q1", true);
    await postHeldAnswer("q1", "hi", "k2");
    const bodies = calls.filter((c) => c.method === "POST").map((c) => c.body!);
    expect(bodies[0]).not.toHaveProperty("anonymous");
    expect(bodies[1]).toMatchObject({ anonymous: true });
    expect(readAnonPref("q1")).toBe(false);
  });
});

describe("after posting anonymously", () => {
  it("the posted screen shows no name and no name-on-card switch on a mood answer", async () => {
    posted = { ...base, author: null, mood: "HOPEFUL" };
    search = "a=a1";
    render(<PostedScreen qid="q1" />);
    await screen.findByTestId("anon-posted");
    expect(screen.queryByRole("switch", { name: "Show my name on the card" })).toBeNull();
    expect(document.body.textContent).not.toContain("@me");
  });
  it("the posted screen shows no name on an ordinary answer", async () => {
    posted = { ...base, author: null };
    search = "a=a1";
    render(<PostedScreen qid="q1" />);
    await screen.findByText("Your voice is live");
    expect(document.body.textContent).not.toContain("@me");
    expect(document.body.textContent).toContain("Anonymous");
  });
  it("a named mood answer still offers the name-on-card switch", async () => {
    posted = { ...base, mood: "HOPEFUL" };
    search = "a=a1";
    render(<PostedScreen qid="q1" />);
    await screen.findByRole("switch", { name: "Show my name on the card" });
  });
});

describe("the profile tag", () => {
  it("shows Posted without your name on your own anonymous post only", () => {
    const { rerender } = render(<PostRow a={{ ...base, author: null, isMine: true } as never} />);
    expect(screen.getByTestId("anon-tag").textContent).toBe("Posted without your name");
    rerender(<PostRow a={{ ...base, author: null, isMine: false } as never} />);
    expect(screen.queryByTestId("anon-tag")).toBeNull();
    rerender(<PostRow a={{ ...base } as never} />);
    expect(screen.queryByTestId("anon-tag")).toBeNull();
  });
});

describe("an anonymous mood answer offers no invite link", () => {
  it("shows no Send it to 3 people, no invite QR, and asks for no invite link", async () => {
    posted = { ...base, author: null, mood: "HOPEFUL" };
    search = "a=a1";
    render(<PostedScreen qid="q1" />);
    await screen.findByTestId("anon-posted");
    expect(screen.queryByText("Send it to 3 people.")).toBeNull();
    expect(screen.queryByTestId("invite-qr")).toBeNull();
    expect(calls.some((c) => c.url.endsWith("/me/invite"))).toBe(false);
  });
  it("a named mood answer still does", async () => {
    posted = { ...base, mood: "HOPEFUL" };
    search = "a=a1";
    render(<PostedScreen qid="q1" />);
    await screen.findByText("Send it to 3 people.");
  });
});
