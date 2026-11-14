// @vitest-environment jsdom
// V-SURVEYS round 2, public side: one START, answers kept across a reload, Back asks first, an exit sends one SKIP, the choice group is one tab stop.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyScreen } from "@/features/surveys/SurveyScreen";
import { BrandPageScreen } from "@/features/surveys/BrandPageScreen";
import { loadDraft } from "@/features/surveys/logic";
import { calls, mockApi, signIn } from "./w6-helpers";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn() }), usePathname: () => "/surveys/s1" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

beforeEach(() => { push.mockClear(); signIn(); });
afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 5)); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

const opt = (id: string, label: string) => ({ id, label });
const survey = (over: Record<string, unknown> = {}) => ({
  id: "s1", label: "Sponsored Survey", brandName: "Zobo Fresh", brandSlug: "zobo-fresh", brandWebsite: null, title: "Power and light", questionCount: 3,
  note: "n", myStatus: "OPEN", voiceMaxSeconds: 30, ageBands: ["18-24", "25-34"],
  questions: [
    { id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", options: [opt("o1", "A fan on battery"), opt("o2", "Cold drinks"), opt("o3", "Nothing")] },
    { id: "q2", position: 2, kind: "TEXT", prompt: "Anything else?", options: [] },
    { id: "q3", position: 3, kind: "VOICE", prompt: "Say it", options: [] },
  ],
  ...over,
});
const events = () => calls.filter((c) => c.path === "/surveys/s1/events").map((c) => (c.body as { kind: string }).kind);
const table = () => ({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null, "POST /surveys/s1/responses": { ok: true, note: "" } });
const tick = () => new Promise((r) => setTimeout(r, 5));

async function answerFirst(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
  await u.click(screen.getByRole("button", { name: "Send answer" }));
  await screen.findByText("Question 2 of 3");
}

describe("START once per person per survey", () => {
  it("a second open of the same survey in this tab sends no second START", async () => {
    mockApi(table());
    const first = render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    await waitFor(() => expect(events()).toContain("START"));
    first.unmount();
    await tick();
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    await tick();
    expect(events().filter((k) => k === "START")).toEqual(["START"]);
  });
  it("keeps the flag per survey id, and works when the store is blocked", async () => {
    mockApi(table());
    const real = Object.getOwnPropertyDescriptor(window, "sessionStorage") as PropertyDescriptor;
    // The token lives in localStorage; only the tab's session store is blocked.
    Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new Error("blocked"); } });
    try {
      render(<SurveyScreen id="s1" />);
      await screen.findByText("Question 1 of 3");
      await waitFor(() => expect(events()).toContain("START"));
    } finally {
      Object.defineProperty(window, "sessionStorage", real);
    }
  });
});

describe("answers survive a reload", () => {
  it("brings back the position, the choice and a voice clip id, then clears them once sent", async () => {
    mockApi(table());
    const u = userEvent.setup();
    const first = render(<SurveyScreen id="s1" />);
    await answerFirst(u);
    await u.type(screen.getByLabelText("Your answer"), "Ice");
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Question 3 of 3");
    // a voice answer is kept by its clip id: put one in the saved draft the way the page writes it
    const raw = JSON.parse(window.sessionStorage.getItem("wawu.survey.s1.draft") as string);
    expect(raw.idx).toBe(2);
    expect(raw.given.q1).toEqual({ kind: "choice", optionId: "o2", label: "Cold drinks" });
    raw.given.q3 = { kind: "voice", clipId: "clip-9", seconds: 7 };
    window.sessionStorage.setItem("wawu.survey.s1.draft", JSON.stringify(raw));
    first.unmount();
    await tick();
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Question 3 of 3")).toBeTruthy();
    // go back to question 1: the choice is still there
    await u.click(screen.getAllByRole("button", { name: "Back" })[0]);
    await u.click(screen.getAllByRole("button", { name: "Back" })[0]);
    expect((await screen.findByRole("radio", { name: "Cold drinks" })).getAttribute("aria-checked")).toBe("true");
    expect(events().filter((k) => k === "START")).toEqual(["START"]);
  });
  it("drops what no longer fits the survey, and clears the draft after a send", async () => {
    expect(loadDraft("s1", survey().questions as never, [])).toBeNull();
    window.sessionStorage.setItem("wawu.survey.s1.draft", JSON.stringify({ idx: 9, given: { q1: { kind: "choice", optionId: "gone", label: "x" }, q9: { kind: "text", text: "y" } }, anonymous: true, shareState: false, ageBand: "99" }));
    const d = loadDraft("s1", survey().questions as never, ["18-24"]);
    expect(d).toEqual({ idx: 2, given: {}, anonymous: true, shareState: false, ageBand: "" });
    window.sessionStorage.clear();
    mockApi({ ...table(), "GET /surveys/s1": survey({ questions: [survey().questions[0]] }) });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    expect(window.sessionStorage.getItem("wawu.survey.s1.draft")).toBeNull();
  });
});

describe("leaving", () => {
  it("Back with answers asks first, on the page, and sends no SKIP until the person leaves", async () => {
    mockApi(table());
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await answerFirst(u);
    fireEvent.popState(window);
    expect(await screen.findByText(/have not been sent/)).toBeTruthy();
    await tick();
    expect(events()).toEqual(["START"]);
    await u.click(screen.getByRole("button", { name: "Keep going" }));
    expect(events()).toEqual(["START"]);
    fireEvent.popState(window);
    await screen.findByText(/have not been sent/);
    await u.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(events()).toEqual(["START", "SKIP"]));
    expect(push).toHaveBeenCalledWith("/");
    expect(window.sessionStorage.getItem("wawu.survey.s1.draft")).toBeNull();
  });
  it("Back with no answers sends one SKIP and goes back", async () => {
    mockApi(table());
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    fireEvent.popState(window);
    await waitFor(() => expect(events()).toEqual(["START", "SKIP"]));
    expect(back).toHaveBeenCalled();
    expect(screen.queryByText(/have not been sent/)).toBeNull();
    back.mockRestore();
  });
  it("a closed tab or a hidden page sends one SKIP with keepalive, whichever comes first, and not after the answers are sent", async () => {
    mockApi(table());
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    fireEvent(window, new Event("pagehide"));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(events()).toEqual(["START", "SKIP"]));
    await tick();
    expect(events()).toEqual(["START", "SKIP"]);
    const skip = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find((c) => c[0].endsWith("/surveys/s1/events") && String(c[1].body).includes("SKIP"));
    expect(skip?.[1].keepalive).toBe(true);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
  it("a person who finished sends no SKIP when the page goes", async () => {
    mockApi({ ...table(), "GET /surveys/s1": survey({ questions: [survey().questions[0]] }) });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    fireEvent(window, new Event("pagehide"));
    await tick();
    expect(events()).toEqual(["START"]);
  });
  it("leaving the page by a link counts one SKIP", async () => {
    mockApi(table());
    const r = render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    r.unmount();
    await waitFor(() => expect(events()).toEqual(["START", "SKIP"]));
  });
});

describe("the choices are one radio group", () => {
  it("is one tab stop and the arrow keys move the choice", async () => {
    mockApi(table());
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    const radios = await screen.findAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    radios[0].focus();
    await u.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(document.activeElement).toBe(screen.getAllByRole("radio")[1]);
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    await u.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getAllByRole("radio")[2].getAttribute("aria-checked")).toBe("true");
  });
});

describe("Why am I seeing this", () => {
  it("is a link in the grey box that opens the words, with no price or token", async () => {
    mockApi(table());
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    const links = screen.getAllByRole("button", { name: "Why am I seeing this?" });
    await u.click(links[0]);
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).toMatch(/Use my state to choose surveys for me/);
    expect(dlg.textContent).not.toMatch(/₦|token|price|—/i);
  });
});

describe("the brand page ad", () => {
  it("has Why this ad? that opens the words", async () => {
    mockApi({ "GET /brands/zobo-fresh": { brand: { name: "Zobo Fresh", slug: "zobo-fresh", tagline: null, website: null, logoUrl: null, label: "Sponsored" }, surveys: [], ads: [{ id: "a1", kind: "FEED_CARD", label: "Ad", headline: "Cold zobo", body: null, imageUrl: null, linkUrl: "https://zobo.example", ctaLabel: "Order now" }] } });
    const u = userEvent.setup();
    render(<BrandPageScreen slug="zobo-fresh" />);
    await u.click(await screen.findByRole("button", { name: "Why this ad?" }));
    expect((await screen.findByRole("dialog")).textContent).toMatch(/WAWU approved it before it ran/);
  });
});
