// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const ID_PORT = 14305;
vi.hoisted(() => { process.env.NEXT_PUBLIC_WAWU_ID_BASE = "http://127.0.0.1:14305"; });

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { WawuIdStandIn, RIGHT_CODE } from "./support/wawu-id-standin";
import { Landing } from "@/features/entry/Landing";
import { Onboarding } from "@/features/entry/Onboarding";
import { Country } from "@/features/entry/Country";
import { SignIn } from "@/features/entry/SignIn";
import { Verify } from "@/features/entry/Verify";
import { Topics } from "@/features/entry/Topics";
import { ProfileSetup } from "@/features/entry/ProfileSetup";
import { nationalPhone, signOut } from "@/lib/api/auth";
import { apiFetch } from "@/lib/api/client";
import { holdReturn, peekReturn, readDraft, safeReturn, saveDraft, takeReturn } from "@/lib/auth/entry-draft";

const idp = new WawuIdStandIn(ID_PORT);
beforeAll(async () => { await idp.start(); });
afterAll(async () => { await idp.stop(); });

const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (status: number, code: string, message: string) => json({ error: { code, message } }, status);
let calls: { url: string; method: string; body: unknown; headers: Headers }[];
let api: (url: string, method: string, body: unknown) => Response | null;

const CONFIG = { currency: "NGN", freePosts: 10, unitBaseKobo: 1380, costs: { baseKoboPerUnit: 1380, textPostMilli: 500, voicePostMilli: 1000, minPackKobo: 13800, freeReactionsPerDay: 3, freeVotesPerDay: 1, reactionAfterFreeMilli: 500, voteAfterFreeMilli: 500, extraVoice30Kobo: 0 }, tiers: [], extraVoice: [], voiceFreeSeconds: 10 };
const QUESTION = { id: "q1", text: "When salary arrives, how many hours pass before it disappears?", voiceCount: 12480, endsAt: new Date(Date.now() + 9 * 3600e3 + 60e3).toISOString(), category: null, recentVoices: [] };
const CATS = ["Money", "Work", "Power", "Family", "Love", "Faith"].map((name, i) => ({ id: `c${i}`, slug: name.toLowerCase(), name, blurb: null, voicesThisWeek: 0, questionCount: 0 }));
const ME_NEW = { id: "u1", wawuId: "w1", handle: null, profileComplete: false };
const ME_DONE = { ...ME_NEW, handle: "ada.o", profileComplete: true };

beforeEach(() => {
  calls = [];
  search = "";
  push.mockClear(); replace.mockClear(); back.mockClear();
  api = () => null;
  window.sessionStorage.clear();
  window.localStorage.clear();
  URL.createObjectURL = () => "blob:preview";
  URL.revokeObjectURL = () => undefined;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    if (String(input).startsWith(idp.url)) return realFetch(input, init); // the WAWU ID stand-in, over real HTTP
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body ?? null;
    const method = init.method ?? "GET";
    calls.push({ url: String(input), method, body, headers: new Headers(init.headers) });
    return api(String(input), method, body)
      ?? (String(input).endsWith("/questions/today") ? json(QUESTION)
        : String(input).endsWith("/config/public") ? json(CONFIG)
        : String(input).endsWith("/categories") ? json({ items: CATS })
        : String(input).endsWith("/feed/trending?limit=1") ? json({ items: [], nextCursor: null })
        : String(input).endsWith("/polls/current") ? json(null)
        : err(404, "NOT_FOUND", "no"));
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); idp.users.clear(); idp.calls.length = 0; });

const stored = () => JSON.parse(window.localStorage.getItem("voices-web-session") ?? "null") as { accessToken: string | null; refreshToken: string | null } | null;
const idCalls = (path: string) => idp.calls.filter((c) => c.path === path);

describe("return paths and phone numbers", () => {
  it("only keeps a path inside this app and never an entry screen", () => {
    expect(safeReturn("/q/abc")).toBe("/q/abc");
    expect(safeReturn("/speak?draft=1")).toBe("/speak?draft=1");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "/sign-in", "/join/topics", "/welcome", "", null, undefined, "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/%09/evil.example", "/%0A/evil.example", "/%0D/evil.example", "/%2F/evil.example", "/%5Cevil.example", "/ /evil", "/a\u0000b", "/\u00a0/evil", "/%E2%80%A8/evil"]) expect(safeReturn(bad as string)).toBeNull();
    holdReturn("//evil.com");
    expect(peekReturn()).toBeNull();
    holdReturn("/q/abc");
    expect(takeReturn()).toBe("/q/abc");
    expect(takeReturn()).toBeNull();
  });
  it("turns a typed phone into digits after +234", () => {
    expect(nationalPhone("0803 214 7720")).toBe("8032147720");
    expect(nationalPhone("+234 803-214-7720")).toBe("8032147720");
    expect(nationalPhone("2348032147720")).toBe("8032147720");
    expect(nationalPhone("803 214 7720")).toBe("8032147720");
  });
});

describe("Landing", () => {
  it("draws the board words and points the buttons", async () => {
    render(<Landing />);
    expect(await screen.findByText("Nigeria is talking. Add your voice.")).toBeTruthy();
    expect(screen.getByText("Every topic, four steps. Join at any one.")).toBeTruthy();
    expect(screen.getByText("Your first 10 posts are free.")).toBeTruthy();
    expect(screen.getByText(/Voice Units from ₦138\. Every price shows before you tap\. Ads are always labelled/)).toBeTruthy();
    const href = (name: string) => screen.getAllByRole("link", { name }).map((a) => a.getAttribute("href"));
    expect(href("Sign in")).toContain("/sign-in");
    expect(href("Join VOICES")).toContain("/join");
    expect(href("Listen as a guest")).toContain("/");
    expect(screen.queryByText(/—/)).toBeNull();
  });
  it("sends a signed-in person Home", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    render(<Landing />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
  it("shows the retry banner when the question will not load", async () => {
    api = (u) => (u.endsWith("/questions/today") ? err(500, "INTERNAL", "boom") : null);
    render(<Landing />);
    expect(await screen.findByText("This did not load")).toBeTruthy();
  });
});

describe("Onboarding and Country", () => {
  it("walks three slides and reads the prices from config", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    expect(await screen.findByText("Nigeria is talking")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getAllByText("Hear the country").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Your first 10 posts are free")).toBeTruthy();
    expect(screen.getByText("Then Voice Units from ₦138. A text post uses 0.5 unit (₦6.90).")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start" }).getAttribute("href")).toBe("/join/country");
    expect(screen.getAllByRole("link", { name: "Skip" })[0].getAttribute("href")).toBe("/join/country");
  });
  it("Country: Nigeria live and chosen, others coming, languages saved", async () => {
    api = (u) => (u.endsWith("/countries") ? json({ items: [{ code: "NG", name: "Nigeria", currency: "NGN", status: "live" }, { code: "GH", name: "Ghana", currency: "GHS", status: "coming" }] }) : null);
    const user = userEvent.setup();
    render(<Country />);
    const ng = await screen.findByRole("radio", { name: /Nigeria/ });
    expect(ng.getAttribute("aria-checked")).toBe("true");
    const gh = screen.getByRole("radio", { name: /Ghana/ });
    expect(gh.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Coming soon")).toBeTruthy();
    await user.click(gh);
    expect(gh.getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Hausa" }));
    await user.click(screen.getAllByRole("button", { name: "Continue" })[0]);
    expect(readDraft()).toMatchObject({ countryCode: "NG", languages: ["en", "pcm", "ha"] });
    expect(push).toHaveBeenCalledWith("/sign-in?mode=join");
  });
});

describe("Join (register) through the WAWU ID stand-in", () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, over: Partial<Record<string, string>> = {}) => {
    await user.type(screen.getByLabelText("Full name"), over.name ?? "Ada Okafor");
    await user.type(screen.getByLabelText("Email"), over.email ?? "ada@example.com");
    await user.type(screen.getByLabelText("Phone number"), over.phone ?? "0803 214 7720");
    await user.type(screen.getByLabelText("Password"), over.password ?? "longenough1");
  };
  it("checks the form before it calls anything", async () => {
    search = "mode=join";
    const user = userEvent.setup();
    render(<SignIn />);
    await fill(user, { password: "short" });
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Use at least 8 characters.")).toBeTruthy();
    expect(screen.getByText("Confirm you are 18 or older and accept the rules.")).toBeTruthy();
    expect(idp.calls.length).toBe(0);
  });
  it("registers with +234 digits, sends the code and moves to the code step", async () => {
    search = "mode=join";
    const user = userEvent.setup();
    render(<SignIn />);
    await fill(user);
    await user.click(screen.getByLabelText(/I am 18 or older/));
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/verify"));
    expect(idCalls("/auth/register")[0].body).toMatchObject({ email: "ada@example.com", phone: "+2348032147720", country: "Nigeria", fullName: "Ada Okafor", dialCode: "+234" });
    expect(idCalls("/auth/email/verify/start")).toHaveLength(1);
    expect(stored()?.accessToken ?? null).toBeNull(); // the tokens from register are dropped until the code is confirmed
    expect(readDraft()).toMatchObject({ email: "ada@example.com", ageConfirmed: true, codeLifeSec: 300 });
  });
  it("says so when the email is taken, and offers sign in", async () => {
    search = "mode=join";
    const user = userEvent.setup();
    render(<SignIn />);
    await fill(user, { email: "taken@example.com" });
    await user.click(screen.getByLabelText(/I am 18 or older/));
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("An account with this email or phone already exists. Sign in instead.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
  it("shows the offline banner when WAWU ID cannot be reached", async () => {
    search = "mode=join";
    idp.failNext = null;
    vi.stubGlobal("fetch", vi.fn(async (input: string) => { if (String(input).includes("/questions/today")) return json(QUESTION); throw new TypeError("offline"); }));
    const user = userEvent.setup();
    render(<SignIn />);
    await fill(user);
    await user.click(screen.getByLabelText(/I am 18 or older/));
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("You are offline")).toBeTruthy();
    expect(screen.getByText(/Could not reach VOICES/)).toBeTruthy();
  });
});

describe("Sign in", () => {
  const seeded = (verified = true) => { const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720"); u.verified = verified; return u; };
  const typeIn = async (user: ReturnType<typeof userEvent.setup>, id = "ada@example.com", pw = "longenough1") => {
    await user.type(screen.getByLabelText("Email or phone number"), id);
    await user.type(screen.getByLabelText("Password"), pw);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
  };
  it("refuses a wrong password in plain words and keeps no session", async () => {
    seeded();
    const user = userEvent.setup();
    render(<SignIn />);
    await typeIn(user, "ada@example.com", "wrongpass");
    expect(await screen.findByText("That email, phone or password is not right.")).toBeTruthy();
    expect(stored()?.accessToken ?? null).toBeNull();
  });
  it("sends an unverified person to the code step with a new code", async () => {
    seeded(false);
    const user = userEvent.setup();
    render(<SignIn />);
    await typeIn(user);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/verify"));
    expect(idCalls("/auth/email/verify/start")).toHaveLength(1);
    expect(readDraft().email).toBe("ada@example.com");
    expect(stored()?.accessToken ?? null).toBeNull();
  });
  it("puts a finished profile back where it was (held draft path), and a new person on topics", async () => {
    seeded();
    search = "next=%2Fspeak%3Fdraft%3D1&held=1";
    api = (u) => (u.endsWith("/me") ? json(ME_DONE) : null);
    const user = userEvent.setup();
    render(<SignIn />);
    expect(await screen.findByText("Sign in to post")).toBeTruthy();
    await typeIn(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/speak?draft=1"));
    expect(stored()?.accessToken).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith("/me"))?.headers.get("authorization")).toMatch(/^Bearer /);
    cleanup(); replace.mockClear(); window.localStorage.clear(); search = "";
    api = (u) => (u.endsWith("/me") ? json(ME_NEW) : null);
    render(<SignIn />);
    await typeIn(userEvent.setup());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/join/topics"));
  });
  it("ignores a next path that leaves the app", async () => {
    seeded();
    search = "next=%2F%2Fevil.com";
    api = (u) => (u.endsWith("/me") ? json(ME_DONE) : null);
    render(<SignIn />);
    await typeIn(userEvent.setup());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
  it("switches between sign in and join, and closing goes back", async () => {
    const user = userEvent.setup();
    render(<SignIn />);
    await user.click(screen.getByRole("button", { name: "Join VOICES" }));
    expect(screen.getByLabelText("Full name")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
    expect(screen.getByLabelText("Email or phone number")).toBeTruthy();
  });
});

describe("Verify (the email code)", () => {
  const draftFor = (over = {}) => saveDraft({ email: "ada@example.com", codeSentAt: Date.now() - 18_000, codeLifeSec: 300, ...over });
  const setup = () => { const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720"); u.verified = false; void idp.startCode("ada@example.com"); };
  const enter = async (code: string) => { for (let i = 0; i < code.length; i++) await userEvent.setup().type(screen.getByLabelText(`Digit ${i + 1}`), code[i]); };
  it("shows the words about email and the resend timer", () => {
    setup(); draftFor();
    render(<Verify />);
    expect(screen.getByText("We sent 6 digits by email to ada@example.com.")).toBeTruthy();
    expect(screen.getByText("Resend code in 0:42")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Verify" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Change email").getAttribute("href")).toBe("/sign-in?mode=join");
  });
  it("sends a visitor with no email back to the sign-up form", () => {
    render(<Verify />);
    expect(replace).toHaveBeenCalledWith("/sign-in?mode=join");
  });
  it("wrong code: says so, clears the boxes, keeps no session", async () => {
    setup(); draftFor();
    render(<Verify />);
    await enter("111111");
    await userEvent.setup().click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("That code is not right. Check it and try again.")).toBeTruthy();
    expect((screen.getByLabelText("Digit 1") as HTMLInputElement).value).toBe("");
    expect(stored()?.accessToken ?? null).toBeNull();
  });
  it("expired code: the page says so before any call", () => {
    setup(); draftFor({ codeSentAt: Date.now() - 301_000 });
    render(<Verify />);
    expect(screen.getByText("This code has expired. Send a new one.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend code" })).toBeTruthy();
  });
  it("resend asks WAWU ID for a new code and restarts the timer", async () => {
    setup(); draftFor({ codeSentAt: Date.now() - 301_000 });
    render(<Verify />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Resend code" }));
    expect(await screen.findByText("A new code is on its way. Check your email.")).toBeTruthy();
    expect(idCalls("/auth/email/verify/start")).toHaveLength(1);
    expect(screen.getByText(/Resend code in 1:00|Resend code in 0:59/)).toBeTruthy();
  });
  it("right code (pasted): stores the session and goes on to topics for a new person", async () => {
    setup(); draftFor();
    api = (u) => (u.endsWith("/me") ? json(ME_NEW) : null);
    render(<Verify />);
    const first = screen.getByLabelText("Digit 1");
    fireEvent.paste(first, { clipboardData: { getData: () => RIGHT_CODE } });
    expect((screen.getByLabelText("Digit 6") as HTMLInputElement).value).toBe("6");
    await userEvent.setup().click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/join/topics"));
    expect(idCalls("/auth/email/verify/confirm")[0].body).toEqual({ email: "ada@example.com", code: RIGHT_CODE });
    expect(stored()?.accessToken).toBeTruthy();
    expect(stored()?.refreshToken).toBeTruthy();
  });
  it("right code with a held post: Verify and post, then back to the held path", async () => {
    setup(); draftFor(); holdReturn("/speak", "post");
    api = (u) => (u.endsWith("/me") ? json(ME_DONE) : null);
    render(<Verify />);
    await enter(RIGHT_CODE);
    await userEvent.setup().click(screen.getByRole("button", { name: "Verify and post" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/speak"));
  });
});

describe("session: refresh rotates and sign out clears", () => {
  it("a 401 refreshes once, retries with the new token and kills the old refresh token", async () => {
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720");
    const first = idp.tokensFor(u);
    window.localStorage.setItem("voices-web-session", JSON.stringify(first));
    const seen: string[] = [];
    api = (url, _m) => {
      if (!url.endsWith("/me")) return null;
      const auth = calls[calls.length - 1].headers.get("authorization") ?? "";
      seen.push(auth);
      return auth === `Bearer ${first.accessToken}` ? err(401, "UNAUTHORIZED", "expired") : json(ME_DONE);
    };
    const me = await apiFetch<{ handle: string }>("/me", { authed: true });
    expect(me.handle).toBe("ada.o");
    expect(seen).toHaveLength(2);
    const now = stored()!;
    expect(now.accessToken).not.toBe(first.accessToken);
    expect(now.refreshToken).not.toBe(first.refreshToken);
    const again = await realFetch(`${idp.url}/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: first.refreshToken }) });
    expect(again.status).toBe(401); // the old one is dead
  });
  it("sign out clears the browser session and tells WAWU ID", async () => {
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720");
    window.localStorage.setItem("voices-web-session", JSON.stringify(idp.tokensFor(u)));
    signOut();
    expect(stored()).toEqual({ accessToken: null, refreshToken: null });
    await waitFor(() => expect(idCalls("/auth/logout")).toHaveLength(1));
  });
});

describe("Topics", () => {
  beforeEach(() => { window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })); });
  it("needs a session", () => {
    window.localStorage.clear();
    render(<Topics />);
    expect(replace).toHaveBeenCalledWith("/sign-in?mode=join");
  });
  it("needs three topics, shows an alerts switch for each and holds the choice for the next step", async () => {
    const user = userEvent.setup();
    render(<Topics />);
    await screen.findByRole("button", { name: "Money" });
    const go = () => screen.getAllByRole("button", { name: /Continue with|Pick/ })[0];
    expect(go().textContent).toBe("Pick 3 more");
    await user.click(screen.getByRole("button", { name: "Money" }));
    await user.click(screen.getByRole("button", { name: "Work" }));
    expect(go().textContent).toBe("Pick 1 more");
    expect(go().hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Power" }));
    await user.click(screen.getByRole("button", { name: "Family" }));
    expect(go().textContent).toBe("Continue with 4 topics");
    const sw = screen.getByRole("switch", { name: "Alerts for Work" }) as HTMLInputElement;
    expect(sw.checked).toBe(true);
    await user.click(sw);
    await user.click(go());
    expect(push).toHaveBeenCalledWith("/join/profile");
    expect(readDraft().topics).toEqual([
      { categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: false }, { categoryId: "c2", alertsOn: true }, { categoryId: "c3", alertsOn: true },
    ]);
  });
});

describe("ProfileSetup", () => {
  beforeEach(() => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    saveDraft({ fullName: "Ada Okafor", email: "ada@example.com", countryCode: "NG", languages: ["en", "pcm"], topics: [{ categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: false }, { categoryId: "c2", alertsOn: true }] });
    api = (u) => (u.includes("/me/handle-check") ? json({ handle: new URL(u, "http://x").searchParams.get("handle"), available: !u.includes("taken.one") }) : null);
  });
  it("without topics goes back to topics", () => {
    window.sessionStorage.clear();
    render(<ProfileSetup />);
    expect(replace).toHaveBeenCalledWith("/join/topics");
  });
  it("suggests a handle, checks it, and creates the profile then saves topics, name and photo; back to the held path", async () => {
    holdReturn("/speak", "post");
    api = (u, m) => {
      if (u.includes("/me/handle-check")) return json({ handle: "ada.okafor", available: true });
      if (m === "POST" && u.endsWith("/me")) return json({ ...ME_DONE, handle: "ada.okafor" }, 201);
      if (m === "PUT" && u.endsWith("/me/categories")) return json({ categories: [] });
      if (m === "POST" && u.endsWith("/uploads")) return json({ fileId: "f1", putUrl: "https://spaces.example/put", putHeaders: { "Content-Type": "image/png" }, expiresAt: new Date().toISOString() }, 201);
      if (m === "POST" && u.endsWith("/uploads/f1/complete")) return json({ fileId: "f1", kind: "AVATAR", confirmedAt: new Date().toISOString() });
      if (m === "PATCH" && u.endsWith("/me/profile")) return json({});
      return null;
    };
    // The photo bytes go to storage by XHR (as the voice card does), then the server is told it landed.
    class FakeXhr {
      status = 0; onload: (() => void) | null = null; onerror: (() => void) | null = null; private url = "";
      open(_m: string, url: string) { this.url = url; }
      setRequestHeader() { /* signed headers */ }
      send() { calls.push({ url: this.url, method: "PUT", headers: new Headers(), body: undefined }); this.status = 200; queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const user = userEvent.setup();
    render(<ProfileSetup />);
    expect((screen.getByLabelText("Handle") as HTMLInputElement).value).toBe("ada.okafor");
    expect(await screen.findByText("@ada.okafor is free. Letters, numbers, dots and underscores.")).toBeTruthy();
    const png = new File([new Uint8Array(1200)], "me.png", { type: "image/png" });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, png);
    expect(await screen.findByRole("button", { name: "Change photo" })).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Finish and post my voice" })[0]);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/speak"));
    const sent = calls.filter((c) => !c.url.includes("handle-check") && !c.url.includes("config/public")).map((c) => `${c.method} ${c.url.replace("/api/v1", "")}`);
    expect(sent).toEqual(["GET /me", "POST /me", "PUT /me/categories", "POST /uploads", "PUT https://spaces.example/put", "POST /uploads/f1/complete", "PATCH /me/profile"]);
    expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/me"))?.body).toEqual({ handle: "ada.okafor", ageConfirmed: true, termsAccepted: true, rulesAccepted: true, countryCode: "NG", languages: ["en", "pcm"], categoryIds: ["c0", "c1", "c2"] });
    expect(calls.find((c) => c.url.endsWith("/me/categories"))?.body).toEqual({ categories: [{ categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: false }, { categoryId: "c2", alertsOn: true }] });
    expect(calls.find((c) => c.url.endsWith("/uploads"))?.body).toEqual({ kind: "AVATAR", mime: "image/png", sizeBytes: 1200 });
    expect(calls.find((c) => c.url.endsWith("/me/profile"))?.body).toEqual({ displayName: "Ada Okafor", avatarFileId: "f1" });
    expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/me"))?.headers.get("idempotency-key")).toBeTruthy();
    expect(readDraft().topics).toBeUndefined();
  });
  it("handle taken: says so and will not finish", async () => {
    api = (u) => (u.includes("/me/handle-check") ? json({ handle: "taken.one", available: false, reason: "TAKEN" }) : null);
    const user = userEvent.setup();
    render(<ProfileSetup />);
    const h = screen.getByLabelText("Handle");
    await user.clear(h);
    await user.type(h, "taken.one");
    expect(await screen.findByText("That handle is taken. Try another.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Finish" })[0].hasAttribute("disabled")).toBe(true);
  });
  it("a handle that is the wrong shape is refused before any call", async () => {
    const user = userEvent.setup();
    render(<ProfileSetup />);
    const h = screen.getByLabelText("Handle");
    await user.clear(h);
    await user.type(h, "ab");
    expect(await screen.findByText("Use at least 3 characters.")).toBeTruthy();
    await user.clear(h);
    await user.type(h, "ada okafor!");
    expect(await screen.findByText("Letters, numbers, dots and underscores only.")).toBeTruthy();
  });
  it("a photo of the wrong kind or over 5 MB is refused with words", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ProfileSetup />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["x"], "a.gif", { type: "image/gif" }));
    expect(await screen.findByText("Choose a JPEG, PNG or WebP photo.")).toBeTruthy();
    const big = new File([new Uint8Array(10)], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    await user.upload(input, big);
    expect(await screen.findByText("That photo is over 5 MB. Choose a smaller one.")).toBeTruthy();
  });
  it("if the handle is taken at the last moment (409), it shows the taken line; a retry does not make the profile twice", async () => {
    let posts = 0;
    api = (u, m) => {
      if (u.includes("/me/handle-check")) return json({ handle: "ada.okafor", available: true });
      if (m === "POST" && u.endsWith("/me")) { posts++; return posts === 1 ? err(409, "HANDLE_TAKEN", "That handle is taken.") : json(ME_DONE, 201); }
      if (m === "PUT") return err(500, "INTERNAL", "boom");
      return null;
    };
    const user = userEvent.setup();
    render(<ProfileSetup />);
    await screen.findByText(/is free/);
    await user.click(screen.getAllByRole("button", { name: "Finish" })[0]);
    expect(await screen.findByText("That handle is taken. Try another.")).toBeTruthy();
    // a different handle, then the topics step fails once: the profile is not posted again on retry
    const h = screen.getByLabelText("Handle");
    await user.clear(h);
    await user.type(h, "ada.o2");
    await screen.findByText(/is free/);
    await user.click(screen.getAllByRole("button", { name: "Finish" })[0]);
    expect(await screen.findByText("This did not work")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    api = (u, m) => (m === "PUT" ? json({ categories: [] }) : m === "PATCH" ? json({}) : u.includes("/me/handle-check") ? json({ handle: "x", available: true }) : null);
    await user.click(screen.getAllByRole("button", { name: "Finish" })[0]);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(posts).toBe(2);
  });
});


describe("round 1: refused sign-ins, redirects, two tabs, reloads", () => {
  it("keeps only pathname, search and hash of a good return", () => {
    expect(safeReturn("/q/abc?x=1#top")).toBe("/q/abc?x=1#top");
    expect(safeReturn("/%2509/x")).toBe("/%2509/x");
  });
  it.each(["suspended", "banned", "pending_deletion"])("a %s account gets no session from sign in and is told so, and never reaches POST /me", async (st) => {
    const u = idp.seed("sus@example.com", "longenough1", "Sus Pended", "+2348032140000");
    idp.statusOf["sus@example.com"] = st;
    const user = userEvent.setup();
    render(<SignIn />);
    await user.type(screen.getByLabelText("Email or phone number"), "sus@example.com");
    await user.type(screen.getByLabelText("Password"), "longenough1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("This account cannot sign in to VOICES right now.")).toBeTruthy();
    expect(stored()?.accessToken ?? null).toBeNull();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
    delete idp.statusOf["sus@example.com"];
    void u;
  });
  it.each(["suspended", "banned", "pending_deletion"])("a %s account confirming its code gets no session", async (st) => {
    const u = idp.seed("sus2@example.com", "longenough1", "Sus Two", "+2348032140001");
    u.verified = false;
    idp.statusOf["sus2@example.com"] = st;
    saveDraft({ email: "sus2@example.com", codeSentAt: Date.now() - 18_000, codeLifeSec: 300 });
    await idp.startCode("sus2@example.com");
    render(<Verify />);
    for (let i = 0; i < 6; i++) await userEvent.setup().type(screen.getByLabelText(`Digit ${i + 1}`), RIGHT_CODE[i]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("This account cannot sign in to VOICES right now.")).toBeTruthy();
    expect(stored()?.accessToken ?? null).toBeNull();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
    delete idp.statusOf["sus2@example.com"];
  });
  it("two tabs refreshing at once: 20 runs, nobody is logged out", async () => {
    const u = idp.seed("two@example.com", "longenough1", "Two Tabs", "+2348032140002");
    idp.ttl = 1;
    for (let run = 0; run < 20; run++) {
      const first = idp.tokensFor(u);
      window.localStorage.setItem("voices-web-session", JSON.stringify(first));
      idp.refreshDelay = run % 3 === 0 ? 0 : 15 + (run % 5) * 10;
      const good = (url: string) => {
        const auth = calls[calls.length - 1].headers.get("authorization") ?? "";
        try { const claims = JSON.parse(atob(auth.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return claims.exp * 1000 > Date.now() + 100 ? json(ME_DONE) : err(401, "UNAUTHORIZED", "expired"); } catch { return err(401, "UNAUTHORIZED", "expired"); }
      };
      api = (url) => (url.endsWith("/me") ? good(url) : null);
      idp.ttl = 900;
      // two separate client instances (two tabs) share one storage
      vi.resetModules();
      const A = await import("@/lib/api/client");
      vi.resetModules();
      const B = await import("@/lib/api/client");
      window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "stale", refreshToken: first.refreshToken }));
      const ra = A.apiFetch("/me", { authed: true });
      const rb = B.apiFetch("/me", { authed: true });
      const [x, y] = await Promise.allSettled([ra, rb]);
      expect(x.status, `run ${run} tab A`).toBe("fulfilled");
      expect(y.status, `run ${run} tab B`).toBe("fulfilled");
      expect(stored()?.accessToken, `run ${run} still signed in`).toBeTruthy();
    }
    idp.refreshDelay = 0;
  });
  it("a refresh refused for real still signs out", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "stale", refreshToken: "never-issued" }));
    api = (u) => (u.endsWith("/me") ? err(401, "UNAUTHORIZED", "no") : null);
    await expect(apiFetch("/me", { authed: true })).rejects.toBeTruthy();
    expect(stored()).toEqual({ accessToken: null, refreshToken: null });
  });
  it("a refresh that cannot be asked (offline) keeps the session", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "stale", refreshToken: "r1" }));
    idp.failNext = { status: 503, body: { statusCode: 503, message: "down" } };
    api = (u) => (u.endsWith("/me") ? err(401, "UNAUTHORIZED", "no") : null);
    await expect(apiFetch("/me", { authed: true })).rejects.toBeTruthy();
    expect(stored()?.refreshToken).toBe("r1");
  });
  it("profile reload: PROFILE_EXISTS carries on (and sets a changed handle); only HANDLE_TAKEN says taken", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    saveDraft({ fullName: "Ada Okafor", countryCode: "NG", languages: ["en"], topics: [{ categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: true }, { categoryId: "c2", alertsOn: true }] });
    const seen: string[] = [];
    api = (u, m, b) => {
      seen.push(`${m} ${u.replace("/api/v1", "")}`);
      if (u.includes("/me/handle-check")) return json({ handle: "ada.okafor", available: true });
      if (m === "POST" && u.endsWith("/me")) return json({ error: { code: "CONFLICT", message: "You already have a profile.", details: { reason: "PROFILE_EXISTS" } } }, 409);
      if (m === "GET" && u.endsWith("/me")) return json({ ...ME_DONE, handle: "ada.old" });
      if (m === "PATCH") return json({});
      if (m === "PUT") return json({ categories: [] });
      void b;
      return null;
    };
    render(<ProfileSetup />);
    await waitFor(() => expect((screen.getByLabelText("Handle") as HTMLInputElement).value).toBe("ada.old"));
    const h = screen.getByLabelText("Handle");
    await userEvent.setup().clear(h);
    await userEvent.setup().type(h, "ada.okafor");
    await screen.findByText(/is free/);
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Finish" })[0]);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(seen).toContain("PATCH /me/profile");
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ handle: "ada.okafor" });
    expect(screen.queryByText("That handle is taken. Try another.")).toBeNull();
  });
  it("a plain 409 CONFLICT that is not a handle does not say taken", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    saveDraft({ fullName: "Ada Okafor", countryCode: "NG", languages: ["en"], topics: [{ categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: true }, { categoryId: "c2", alertsOn: true }] });
    api = (u, m) => (u.includes("handle-check") ? json({ handle: "x", available: true }) : m === "POST" && u.endsWith("/me") ? err(409, "IDEMPOTENCY_KEY_REUSED", "Key reused") : null);
    render(<ProfileSetup />);
    await screen.findByText(/is free/);
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Finish" })[0]);
    expect(await screen.findByText("This did not work")).toBeTruthy();
    expect(screen.queryByText("That handle is taken. Try another.")).toBeNull();
  });
  it("verify: once the code is accepted, a failing next step is retried alone and the used code is never sent again", async () => {
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720");
    u.verified = false;
    saveDraft({ email: "ada@example.com", codeSentAt: Date.now() - 18_000, codeLifeSec: 300 });
    await idp.startCode("ada@example.com");
    let meCalls = 0;
    api = (url) => (url.endsWith("/me") ? (++meCalls === 1 ? err(500, "INTERNAL", "boom") : json(ME_DONE)) : null);
    render(<Verify />);
    for (let i = 0; i < 6; i++) await userEvent.setup().type(screen.getByLabelText(`Digit ${i + 1}`), RIGHT_CODE[i]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("This did not work")).toBeTruthy();
    expect(readDraft().verified).toBe(true);
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(idCalls("/auth/email/verify/confirm")).toHaveLength(1);
    // a reload after acceptance carries on without asking for the code
    cleanup(); replace.mockClear(); meCalls = 5;
    render(<Verify />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(idCalls("/auth/email/verify/confirm")).toHaveLength(1);
  });
  it("verify: too many tries shows the server's words", async () => {
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720");
    u.verified = false;
    saveDraft({ email: "ada@example.com", codeSentAt: Date.now() - 18_000, codeLifeSec: 300 });
    await idp.startCode("ada@example.com");
    render(<Verify />);
    for (let t = 0; t < 6; t++) {
      for (let i = 0; i < 6; i++) await userEvent.setup().type(screen.getByLabelText(`Digit ${i + 1}`), "9");
      await userEvent.setup().click(screen.getByRole("button", { name: "Verify" }));
      await waitFor(() => expect(screen.getByLabelText("Digit 1")).toBeTruthy());
    }
    expect(await screen.findByText("Too many tries. Try again in 60 seconds.")).toBeTruthy();
  });
  it("a code that was accepted is gone: the stand-in answers 401 the second time", async () => {
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720");
    u.verified = false;
    await idp.startCode("ada@example.com");
    const go = () => realFetch(`${idp.url}/auth/email/verify/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "ada@example.com", code: RIGHT_CODE }) });
    expect((await go()).status).toBe(201);
    expect((await go()).status).toBe(401);
  });
  it("sign in by phone for an unverified account asks for the email and sends the code there", async () => {
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720");
    u.verified = false;
    const user = userEvent.setup();
    render(<SignIn />);
    await user.type(screen.getByLabelText("Email or phone number"), "+2348032147720");
    await user.type(screen.getByLabelText("Password"), "longenough1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(/Enter the email on your account/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Email on your account"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/verify"));
    expect(idCalls("/auth/email/verify/start")).toHaveLength(1);
  });
  it("PHONE_NOT_CONFIRMED gets a plain message, and any other 403 the server's words", async () => {
    idp.seed("phone-x@example.com", "longenough1", "Pho Ne", "+2348032149999").verified = false;
    const user = userEvent.setup();
    render(<SignIn />);
    await user.type(screen.getByLabelText("Email or phone number"), "phone-x@example.com");
    await user.type(screen.getByLabelText("Password"), "longenough1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Your phone number is not confirmed yet. Confirm it, then sign in.")).toBeTruthy();
    idp.failNext = { status: 403, body: { statusCode: 403, message: "Your account is on hold.", code: "ON_HOLD" } };
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Your account is on hold.")).toBeTruthy();
  });
  it("sign out also forgets the join draft and the held return", () => {
    saveDraft({ email: "a@b.co" });
    holdReturn("/speak", "post");
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    signOut();
    expect(window.sessionStorage.getItem("voices-join-draft")).toBeNull();
    expect(window.sessionStorage.getItem("voices-return-to")).toBeNull();
  });
  it("the post wording shows only for a held post", async () => {
    search = "next=%2Fq%2Fabc";
    const first = render(<SignIn />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByText(/posts as soon as you are in/)).toBeNull();
    first.unmount();
    window.sessionStorage.clear();
    search = "next=%2Fspeak&held=1";
    render(<SignIn />);
    expect(await screen.findByText("Sign in to post")).toBeTruthy();
    expect(screen.getByText("Your voice is saved. It posts as soon as you are in.")).toBeTruthy();
  });
  it("a signed-in person with no profile on an entry page goes to topics; with one, Home", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    api = (u) => (u.endsWith("/me") ? json(ME_NEW) : null);
    render(<Landing />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/join/topics"));
    cleanup(); replace.mockClear();
    api = (u) => (u.endsWith("/me") ? json(ME_DONE) : null);
    render(<Landing />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
  it("Landing links the rules, puts Add your voice first at 1440 and Onboarding Skip is green", async () => {
    render(<Landing />);
    await screen.findByText("Nigeria is talking. Add your voice.");
    expect(screen.getAllByRole("link", { name: /Rules|Community rules/ }).every((a) => a.getAttribute("href") === "/settings/legal/rules")).toBe(true);
    const row = screen.getAllByRole("link", { name: "Listen as a guest" })[0].parentElement!;
    expect(row.className).not.toMatch(/row-reverse/);
    cleanup();
    render(<Onboarding />);
    await screen.findByText("Nigeria is talking");
    expect(screen.getAllByRole("link", { name: "Skip" })[0].className).toMatch(/link-more/);
  });
  it("the photo cap is the API's 5,000,000 bytes", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    saveDraft({ fullName: "Ada Okafor", countryCode: "NG", languages: ["en"], topics: [{ categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: true }, { categoryId: "c2", alertsOn: true }] });
    render(<ProfileSetup />);
    const big = new File([new Uint8Array(10)], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 5_000_001 });
    await userEvent.setup().upload(document.querySelector('input[type="file"]') as HTMLInputElement, big);
    expect(await screen.findByText("That photo is over 5 MB. Choose a smaller one.")).toBeTruthy();
    const ok = new File([new Uint8Array(10)], "ok.png", { type: "image/png" });
    Object.defineProperty(ok, "size", { value: 5_000_000 });
    await userEvent.setup().upload(document.querySelector('input[type="file"]') as HTMLInputElement, ok);
    expect(await screen.findByRole("button", { name: "Change photo" })).toBeTruthy();
  });
  it("a token refreshed into a suspended state is not kept, POST /me is never made, and the message is plain", async () => {
    const u = idp.seed("slide@example.com", "longenough1", "Sli De", "+2348032140010");
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "stale", refreshToken: idp.tokensFor(u).refreshToken }));
    idp.statusOf["slide@example.com"] = "suspended";
    api = (url) => (url.endsWith("/me") ? err(401, "UNAUTHORIZED", "expired") : null);
    await expect(apiFetch("/me", { authed: true })).rejects.toMatchObject({ message: "This account cannot sign in to VOICES right now." });
    expect(stored()).toEqual({ accessToken: null, refreshToken: null });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
    delete idp.statusOf["slide@example.com"];
  });
  it("a 403 ACCOUNT_SUSPENDED from POST /me says the plain words, never a generic error, and clears the session", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    saveDraft({ fullName: "Ada Okafor", countryCode: "NG", languages: ["en"], topics: [{ categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: true }, { categoryId: "c2", alertsOn: true }] });
    api = (u, m) => (u.includes("handle-check") ? json({ handle: "x", available: true }) : m === "POST" && u.endsWith("/me") ? err(403, "ACCOUNT_SUSPENDED", "Account suspended") : null);
    render(<ProfileSetup />);
    await screen.findByText(/is free/);
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Finish" })[0]);
    expect(await screen.findByText("This account cannot sign in to VOICES right now.")).toBeTruthy();
    expect(screen.queryByText("Something went wrong on our side. Try again in a moment.")).toBeNull();
    expect(stored()).toEqual({ accessToken: null, refreshToken: null });
  });
  it("a 429 from the refresh endpoint keeps the session, waits, and asks once more", async () => {
    const u = idp.seed("busy@example.com", "longenough1", "Bu Sy", "+2348032140011");
    const first = idp.tokensFor(u);
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "stale", refreshToken: first.refreshToken }));
    idp.failNext = { status: 429, body: { statusCode: 429, message: "Too many tries.", retryAfterSeconds: 0.05 } };
    let n = 0;
    api = (url) => (url.endsWith("/me") ? (++n === 1 ? err(401, "UNAUTHORIZED", "expired") : json(ME_DONE)) : null);
    const me = await apiFetch<{ handle: string }>("/me", { authed: true });
    expect(me.handle).toBe("ada.o");
    expect(idCalls("/auth/refresh")).toHaveLength(2);
    expect(stored()?.accessToken).toBeTruthy();
    expect(stored()?.accessToken).not.toBe("stale");
  });
  it("a 429 twice still keeps the session", async () => {
    const u = idp.seed("busy2@example.com", "longenough1", "Bu Sy", "+2348032140012");
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "stale", refreshToken: idp.tokensFor(u).refreshToken }));
    const real = globalThis.fetch;
    let hits = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => (String(input).endsWith("/auth/refresh") ? (hits++, json({ statusCode: 429, message: "Too many tries.", retryAfterSeconds: 0 }, 429)) : real(input, init))));
    api = (url) => (url.endsWith("/me") ? err(401, "UNAUTHORIZED", "expired") : null);
    await expect(apiFetch("/me", { authed: true })).rejects.toBeTruthy();
    expect(hits).toBe(2);
    expect(stored()?.refreshToken).toBeTruthy();
  });
  it("Country sends a signed-in person without a profile straight to topics", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    api = (u) => (u.endsWith("/me") ? json(ME_NEW) : u.endsWith("/countries") ? json({ items: [] }) : null);
    render(<Country />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/join/topics"));
    expect(push).not.toHaveBeenCalled();
  });
  it("Onboarding at 1440 links the Community rules", async () => {
    render(<Onboarding />);
    await screen.findByText("Nigeria is talking");
    expect(screen.getAllByRole("link", { name: "Community rules" })[0].getAttribute("href")).toBe("/settings/legal/rules");
  });
});
