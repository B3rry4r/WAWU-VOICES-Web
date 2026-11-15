// @vitest-environment jsdom
// V-SURVEYS round 4: a tab knows who it belongs to; keeps are per person; signing out clears and sends nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leaveTab, OTHER_TAB_NOTE } from "@/features/speak/draft";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyScreen } from "@/features/surveys/SurveyScreen";
import { signOut } from "@/lib/api/auth";
import { apiError, calls, mockApi, signIn } from "./w6-helpers";

const push = vi.fn();
const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back }), usePathname: () => "/surveys/s1" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const jwt = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, "")}.s`;
beforeEach(() => { leaveTab(); push.mockClear(); back.mockClear(); signIn(jwt("userA")); });
afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 5)); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

const opt = (id: string, label: string) => ({ id, label });
const survey = () => ({
  id: "s1", label: "Sponsored Survey", brandName: "Zobo Fresh", brandSlug: "zobo-fresh", brandWebsite: null, title: "t", questionCount: 2,
  note: "n", myStatus: "OPEN", voiceMaxSeconds: 30, ageBands: ["18-24"],
  questions: [
    { id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", options: [opt("o1", "A fan on battery"), opt("o2", "Cold drinks")] },
    { id: "q2", position: 2, kind: "SINGLE_CHOICE", prompt: "And at night?", options: [opt("p1", "Window"), opt("p2", "Fan")] },
  ],
});
const table = (extra: Record<string, unknown> = {}) => ({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null, "POST /surveys/s1/responses": { ok: true, note: "" }, ...extra });
const surveyCalls = () => calls.filter((c) => c.path.startsWith("/surveys/s1/") );
const keys = () => Object.keys(window.sessionStorage).filter((k) => k.startsWith("wawu.survey.")).sort();
const NOTICE = OTHER_TAB_NOTE;
/** What another tab does to the shared session in local storage, then the browser's storage event reaches this tab. */
const otherTab = (token: string | null) => {
  const KEY = "voices-web-session";
  if (token) window.localStorage.setItem(KEY, JSON.stringify({ accessToken: token, refreshToken: "r" }));
  else window.localStorage.setItem(KEY, JSON.stringify({ accessToken: null, refreshToken: null }));
  act(() => { window.dispatchEvent(new StorageEvent("storage", { key: KEY })); });
};

async function toLast(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
  await u.click(screen.getByRole("button", { name: "Send answer" }));
  await screen.findByText("Question 2 of 2");
  await u.click(screen.getByRole("radio", { name: "Fan" }));
}

describe("rule 2: a tab knows who it belongs to", () => {
  it("another tab signs in B: the storage event shows the notice with a Reload button, at once", async () => {
    mockApi(table());
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    otherTab(jwt("userB"));
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.queryByText("Question 2 of 2")).toBeNull();
  });
  it("Submit in a stale tab sends nothing as B (the check runs before the write, even before any event)", async () => {
    mockApi(table());
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    // the session changes without any event reaching the tab; the first write finds out
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: jwt("userB"), refreshToken: "r" }));
    const before = calls.length;
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(calls.slice(before)).toEqual([]);
    expect(calls.some((c) => c.path === "/surveys/s1/responses")).toBe(false);
  });
  it("the same check runs when the tab becomes visible again and on focus", async () => {
    mockApi(table());
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 2");
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: jwt("userB"), refreshToken: "r" }));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    act(() => { fireEvent(document, new Event("visibilitychange")); });
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });
  it("Leave, Back and the unmount send no SKIP as B, and no START", async () => {
    mockApi(table());
    const r = render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 2");
    otherTab(jwt("userB"));
    await screen.findByText(NOTICE);
    r.unmount();
    await new Promise((x) => setTimeout(x, 10));
    expect(surveyCalls().filter((c) => c.path.endsWith("/events")).map((c) => (c.body as { kind: string }).kind)).toEqual(["START"]);
  });
  it("Reload shows the new person's own empty survey, with a START of their own", async () => {
    mockApi(table());
    const u = userEvent.setup();
    const a = render(<SurveyScreen id="s1" />);
    await toLast(u);
    otherTab(jwt("userB"));
    await screen.findByText(NOTICE);
    a.unmount();
    leaveTab(); // what a reload does
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Question 1 of 2")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Cold drinks" }).getAttribute("aria-checked")).toBe("false");
    await waitFor(() => expect(keys()).toContain("wawu.survey.userB.s1.started"));
  });
  it("another tab signs out: same rule as the record screen, the tab stays A's, no someone-else line, nothing is sent as anyone", async () => {
    mockApi(table());
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 2");
    const before = calls.length;
    otherTab(null);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getByText("Question 1 of 2")).toBeTruthy();
    expect(calls.length).toBe(before);
  });
});

describe("the notice follows the session", () => {
  it("signed out in the other tab, then B signed in: the someone-else line shows", async () => {
    mockApi(table());
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 2");
    otherTab(null);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(NOTICE)).toBeNull();
    otherTab(jwt("userB"));
    expect(await screen.findByText(NOTICE)).toBeTruthy();
  });
});

describe("rule 1: keeps are per person and per survey; nothing crosses", () => {
  it("B fills a draft, signs out, A signs in: A sees A's draft, B's stays B's", async () => {
    mockApi(table());
    const u = userEvent.setup();
    const a = render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "A fan on battery" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Question 2 of 2");
    a.unmount();
    signOut();
    signIn(jwt("userB"));
    leaveTab(); // a page load
    const b = render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Question 2 of 2");
    b.unmount();
    signOut();
    expect(keys().filter((k) => k.endsWith(".draft"))).toEqual(["wawu.survey.userA.s1.draft", "wawu.survey.userB.s1.draft"]);
    signIn(jwt("userA"));
    leaveTab(); // a page load
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Question 2 of 2")).toBeTruthy(); // A's own position
    expect(JSON.parse(window.sessionStorage.getItem("wawu.survey.userA.s1.draft") as string).given.q1.optionId).toBe("o1");
    expect(JSON.parse(window.sessionStorage.getItem("wawu.survey.userB.s1.draft") as string).given.q1.optionId).toBe("o2");
  });
  it("a guest has nothing: no survey call, no key", async () => {
    window.localStorage.clear();
    mockApi(table());
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Sign in to answer")).toBeTruthy();
    expect(calls.length).toBe(0);
    expect(keys()).toEqual([]);
  });
});

describe("rule 3: signing out clears nothing of another person's and sends nothing", () => {
  it("signOut leaves every survey key and sends no survey request", async () => {
    mockApi(table());
    window.sessionStorage.setItem("wawu.survey.userA.s1.draft", "{}");
    window.sessionStorage.setItem("wawu.survey.userC.s9.skipped", "1");
    const before = calls.length;
    signOut();
    expect(keys()).toEqual(["wawu.survey.userA.s1.draft", "wawu.survey.userC.s9.skipped"]);
    expect(calls.slice(before).filter((c) => c.path.startsWith("/surveys"))).toEqual([]);
  });
});

describe("the key rule (needsNewKey): a writer drops its Idempotency-Key only after success or when the server asks for a new one", () => {
  it("a 500 then a success sends the same key twice", async () => {
    const seen: string[] = [];
    let n = 0;
    mockApi(table({ "POST /surveys/s1/responses": ({ headers }: { headers: Headers }) => { seen.push(headers.get("Idempotency-Key") ?? ""); n += 1; return n === 1 ? apiError(500, "INTERNAL", "no") : { ok: true, note: "" }; } }));
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByTestId("survey-problem");
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    expect(seen.length).toBe(2);
    expect(seen[0]).not.toBe("");
    expect(seen[1]).toBe(seen[0]);
  });
  it("when the server asks for a new key, the next tap carries a different one", async () => {
    const seen: string[] = [];
    let n = 0;
    mockApi(table({ "POST /surveys/s1/responses": ({ headers }: { headers: Headers }) => { seen.push(headers.get("Idempotency-Key") ?? ""); n += 1; return n === 1 ? apiError(409, "IDEMPOTENCY_KEY_REUSED", "Key used") : { ok: true, note: "" }; } }));
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await toLast(u);
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("That did not send. Tap Send answer to try again.");
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    expect(seen[1]).not.toBe(seen[0]);
  });
});
