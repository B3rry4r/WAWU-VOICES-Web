// @vitest-environment jsdom
// V-SHARE-CARD: a guest who came by a share link, picked a word and had to sign in or join comes back to the same screen
// for the same question, word kept, the link's code (from) kept. Real components, the API stubbed, WAWU ID stand-in over HTTP.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.hoisted(() => { process.env.NEXT_PUBLIC_WAWU_ID_BASE = "http://127.0.0.1:14306"; });
const push = vi.fn();
const replace = vi.fn();
let search = "";
let path = "/";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  usePathname: () => path,
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { WawuIdStandIn, RIGHT_CODE } from "./support/wawu-id-standin";
import { MoodPickScreen } from "@/features/mood/MoodPickScreen";
import { WriteScreen } from "@/features/talk/WriteScreen";
import { SpeakScreen } from "@/features/speak/SpeakScreen";
import { Onboarding } from "@/features/entry/Onboarding";
import { SignIn } from "@/features/entry/SignIn";
import { Verify } from "@/features/entry/Verify";
import { Topics } from "@/features/entry/Topics";
import { ProfileSetup } from "@/features/entry/ProfileSetup";
import { readPick } from "@/features/mood/mood";
import { currentOwner, saveDraft as saveSpeakDraft, clearDraft as clearSpeakDraft } from "@/features/speak/draft";

const idp = new WawuIdStandIn(14306);
beforeAll(async () => { await idp.start(); });
afterAll(async () => { await idp.stop(); });
const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const QUESTION = { id: "q1", kind: "DAILY", status: "LIVE", text: "How do you feel about Nigeria right now?", hint: null, moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"], category: null, recentVoices: [], voiceCount: 3, answerCount: 0, iSaved: false, endsAt: null };
const CONFIG = { currency: "NGN", freePosts: 10, unitBaseKobo: 1380, voiceFreeSeconds: 60, costs: { freeVoiceSeconds: 60, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 0, extraVoice60Kobo: 0, voiceTier1Seconds: 30, voiceMaxSeconds: 60, textPostMilli: 1000 }, tiers: [], extraVoice: [] };
const ALLOW = { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, extraVoiceTokens: [], costs: { ...CONFIG.costs, textMaxChars: 500 }, freeReactionsLeftToday: 20 };
const CATS = ["Money", "Work", "Power", "Family"].map((name, i) => ({ id: `c${i}`, slug: name.toLowerCase(), name, blurb: null, voicesThisWeek: 0, questionCount: 0 }));
const ME_NEW = { id: "u1", wawuId: "w1", handle: null, profileComplete: false };
const ME_DONE = { ...ME_NEW, handle: "ada.okafor", profileComplete: true };
let me: unknown = ME_DONE;

const FROM = "AbC1234";
const BACK_WRITE = `/q/q1/write?mood=PROUD&from=${FROM}`;
const stored = () => JSON.parse(window.localStorage.getItem("voices-web-session") ?? "null") as { accessToken: string | null } | null;

beforeEach(() => {
  search = ""; path = "/"; me = ME_DONE;
  push.mockReset(); replace.mockReset();
  window.sessionStorage.clear(); window.localStorage.clear(); window.history.replaceState({}, "", "/");
  URL.createObjectURL = () => "blob:preview"; URL.revokeObjectURL = () => undefined;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const u = String(input);
    const m = init.method ?? "GET";
    if (u.startsWith(idp.url)) return realFetch(input, init);
    if (u.endsWith("/questions/q1")) return json(QUESTION);
    if (u.endsWith("/config/public")) return json(CONFIG);
    if (u.endsWith("/me/allowance")) return json(ALLOW);
    if (u.endsWith("/me/settings")) return json({ shareMyWord: true });
    if (u.endsWith("/categories")) return json({ items: CATS });
    if (u.includes("/me/handle-check")) return json({ handle: "ada.okafor", available: true });
    if (m === "POST" && u.endsWith("/me")) return json({ ...ME_DONE }, 201);
    if (m === "PUT" && u.endsWith("/me/categories")) return json({ categories: [] });
    if (m === "PATCH" && u.endsWith("/me/profile")) return json({});
    if (u.endsWith("/me")) return json(me);
    if (u.endsWith("/questions/today")) return json(QUESTION);
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
});
afterEach(async () => { cleanup(); vi.unstubAllGlobals(); idp.users.clear(); idp.calls.length = 0; await clearSpeakDraft(currentOwner()); });

const nextOf = (href: string) => new URL(href, "http://x").search.slice(1);
async function pickAndTap(label: "Say it in 60 seconds" | "Type it instead") {
  search = `from=${FROM}`; path = "/q/q1/mood";
  render(<MoodPickScreen qid="q1" />);
  await screen.findByTestId("mood-PROUD");
  await userEvent.click(screen.getByTestId("mood-PROUD"));
  await userEvent.click(screen.getByRole("button", { name: label }));
  cleanup();
}

describe("a guest who came by a share link", () => {
  it("keeps the link's code from the pick screen to the buttons", async () => {
    await pickAndTap("Say it in 60 seconds");
    expect(push).toHaveBeenLastCalledWith(`/q/q1/speak?mood=PROUD&from=${FROM}`);
    push.mockReset();
    await pickAndTap("Type it instead");
    expect(push).toHaveBeenLastCalledWith(`/q/q1/write?mood=PROUD&from=${FROM}`);
  });

  it("a person who arrives with no word is sent to the pick screen with from kept", async () => {
    search = `from=${FROM}`; path = "/q/q1/write";
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    render(<WriteScreen qid="q1" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/q/q1/mood?from=${FROM}`));
    cleanup(); replace.mockReset(); search = ""; render(<WriteScreen qid="q1" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/q/q1/mood"));
  });

  it("signs in from Type it and is back on the same screen with the word and from, able to type at once", async () => {
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720"); u.verified = true;
    await pickAndTap("Type it instead");
    search = `mood=PROUD&from=${FROM}`; path = "/q/q1/write";
    render(<WriteScreen qid="q1" />);
    const link = await screen.findByRole("link", { name: "Sign in" });
    search = nextOf(link.getAttribute("href")!); path = "/sign-in";
    cleanup();
    render(<SignIn />);
    await userEvent.type(screen.getByLabelText("Email or phone number"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(BACK_WRITE));
    expect(readPick("q1")).toBe("PROUD");
    cleanup();
    search = BACK_WRITE.split("?")[1]; path = "/q/q1/write";
    render(<WriteScreen qid="q1" />);
    expect(await screen.findByRole("textbox")).toBeTruthy();
  });

  it("signs in from the pick screen's own Sign in link and is back on the pick screen with from and the word", async () => {
    const { GuestEntry } = await import("@/components/shell/GuestEntry");
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720"); u.verified = true;
    search = `from=${FROM}`; path = "/q/q1/mood";
    window.history.replaceState({}, "", `/q/q1/mood?from=${FROM}`);
    render(<><GuestEntry /><MoodPickScreen qid="q1" /></>);
    await userEvent.click(await screen.findByTestId("mood-PROUD"));
    const link = await screen.findByRole("link", { name: "Sign in" });
    search = nextOf(link.getAttribute("href")!); path = "/sign-in";
    cleanup();
    render(<SignIn />);
    await userEvent.type(screen.getByLabelText("Email or phone number"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/q/q1/mood?from=${FROM}`));
    cleanup();
    search = `from=${FROM}`; path = "/q/q1/mood";
    render(<MoodPickScreen qid="q1" />);
    await waitFor(() => expect(screen.getByTestId("mood-PROUD").getAttribute("aria-pressed")).toBe("true"));
  });

  it("an email that is not verified yet goes through the code step and still comes back with the word and from", async () => {
    const u = idp.seed("ada@example.com", "longenough1", "Ada Okafor", "+2348032147720"); u.verified = false;
    await pickAndTap("Type it instead");
    search = `next=${encodeURIComponent(BACK_WRITE)}`; path = "/sign-in";
    render(<SignIn />);
    await userEvent.type(screen.getByLabelText("Email or phone number"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/verify"));
    cleanup();
    path = "/join/verify"; search = "";
    render(<Verify />);
    for (let i = 0; i < RIGHT_CODE.length; i++) await userEvent.type(screen.getByLabelText(`Digit ${i + 1}`), RIGHT_CODE[i]);
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(BACK_WRITE));
    expect(readPick("q1")).toBe("PROUD");
  });

  it("joins from Say it (a held recording): every step, then back on the recorder with the word and from, and the voice posts by itself", async () => {
    const blob = new Blob(["abc"], { type: "audio/webm" });
    await pickAndTap("Say it in 60 seconds");
    await saveSpeakDraft(currentOwner(), { questionId: "q1", blob, mime: "audio/webm", seconds: 5, peaks: [1, 2, 3], key: "k1", savedAt: Date.now() });
    // The recorder as a guest: send leaves for /join with the way back.
    const assign = vi.fn();
    const realLocation = window.location;
    vi.stubGlobal("location", { ...window.location, assign, origin: window.location.origin, search: "", pathname: "/q/q1/speak" });
    search = `mood=PROUD&from=${FROM}`; path = "/q/q1/speak";
    render(<SpeakScreen questionId="q1" />);
    const send = await screen.findByRole("button", { name: /^(Send|Post|Sign in to post)/ });
    await userEvent.click(send);
    await waitFor(() => expect(assign).toHaveBeenCalled());
    const joinUrl = assign.mock.calls[0][0] as string;
    vi.stubGlobal("location", realLocation);
    cleanup();
    const q = new URL(joinUrl, "http://x").searchParams;
    expect(joinUrl.startsWith("/join?next=")).toBe(true);
    expect(q.get("held")).toBe("1");
    const back = q.get("next")!;
    expect(new URL(back, "http://x").pathname).toBe("/q/q1/speak");
    expect(new URL(back, "http://x").searchParams.get("from")).toBe(FROM);
    expect(new URL(back, "http://x").searchParams.get("mood")).toBe("PROUD");
    // Landing on /join keeps the way back through the steps.
    window.history.replaceState({}, "", joinUrl);
    render(<Onboarding />);
    cleanup();
    // The sign-up form, the code, the topics, the profile.
    window.history.replaceState({}, "", "/sign-in?mode=join");
    search = "mode=join"; path = "/sign-in";
    render(<SignIn />);
    await userEvent.type(screen.getByLabelText("Full name"), "Ada Okafor");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Phone number"), "0803 214 7720");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.click(screen.getByLabelText(/I am 18 or older/));
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/join/verify"));
    cleanup();
    me = ME_NEW;
    render(<Verify />);
    for (let i = 0; i < RIGHT_CODE.length; i++) await userEvent.type(screen.getByLabelText(`Digit ${i + 1}`), RIGHT_CODE[i]);
    await userEvent.click(screen.getByRole("button", { name: /^Verify/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/join/topics"), );
    expect(stored()?.accessToken).toBeTruthy();
    cleanup();
    render(<Topics />);
    for (const t of ["Money", "Work", "Power"]) await userEvent.click(await screen.findByRole("button", { name: t }));
    await userEvent.click(screen.getAllByRole("button", { name: /Continue with/ })[0]);
    expect(push).toHaveBeenLastCalledWith("/join/profile");
    cleanup();
    render(<ProfileSetup />);
    await screen.findByLabelText("Handle");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Finish and post my voice" })[0].hasAttribute("disabled")).toBe(false));
    await userEvent.click(screen.getAllByRole("button", { name: "Finish and post my voice" })[0]);
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith(`/q/q1/speak?from=${FROM}&mood=PROUD&autopost=1`));
    expect(readPick("q1")).toBe("PROUD");
  }, 30000);
});
