// @vitest-environment jsdom
// V-SURVEYS round 3, public side: SKIP only for a real choice to leave and once; everything kept is the person's own; a ready voice answer is kept; the closed survey.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leaveTab } from "@/features/speak/draft";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  id: "s1", label: "Sponsored Survey", brandName: "Zobo Fresh", brandSlug: "zobo-fresh", brandWebsite: null, title: "Power and light", questionCount: 3,
  note: "n", myStatus: "OPEN", voiceMaxSeconds: 30, ageBands: ["18-24"],
  questions: [
    { id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", options: [opt("o1", "A fan on battery"), opt("o2", "Cold drinks")] },
    { id: "q2", position: 2, kind: "TEXT", prompt: "Anything else?", options: [] },
    { id: "q3", position: 3, kind: "VOICE", prompt: "Say it", options: [] },
  ],
});
const events = () => calls.filter((c) => c.path === "/surveys/s1/events").map((c) => (c.body as { kind: string }).kind);
const table = (extra: Record<string, unknown> = {}) => ({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null, "POST /surveys/s1/responses": { ok: true, note: "" }, "DELETE /voice-clips/c9": null, ...extra });
const tick = () => new Promise((r) => setTimeout(r, 5));
const keys = () => Object.keys(window.sessionStorage).filter((k) => k.startsWith("wawu.survey."));
const draftOf = (who: string) => JSON.parse(window.sessionStorage.getItem(`wawu.survey.${who}.s1.draft`) as string);

async function toQuestion3(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
  await u.click(screen.getByRole("button", { name: "Send answer" }));
  await u.type(await screen.findByLabelText("Your answer"), "Ice");
  await u.click(screen.getByRole("button", { name: "Send answer" }));
  await screen.findByText("Question 3 of 3");
}

describe("N1: SKIP only for a real choice to leave, and once", () => {
  it("a reload, a hidden tab, switching app and closing the tab send nothing", async () => {
    mockApi(table());
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    for (let i = 0; i < 5; i++) fireEvent(window, new Event("pagehide"));
    fireEvent(window, new PageTransitionEvent("pagehide", { persisted: false }));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    await tick();
    expect(events()).toEqual(["START"]);
  });
  it("the Skip link on every question sends one SKIP when every question is skipped, and a second visit sends none", async () => {
    mockApi(table());
    const u = userEvent.setup();
    const first = render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    await u.click(screen.getAllByRole("button", { name: "Leave the survey" })[0]);
    await waitFor(() => expect(events()).toEqual(["START", "SKIP"]));
    first.unmount();
    await tick();
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    await u.click(screen.getAllByRole("button", { name: "Leave the survey" })[0]);
    await tick();
    expect(events()).toEqual(["START", "SKIP"]);
  });
  it("one SKIP is kept per person: another person on the same tab can send theirs", async () => {
    mockApi(table());
    const first = render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    first.unmount();
    await waitFor(() => expect(events()).toEqual(["START", "SKIP"]));
    signOut();
    signIn(jwt("userB"));
    leaveTab(); // a page load
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    await waitFor(() => expect(events()).toEqual(["START", "SKIP", "START"]));
  });
});

describe("N2: what is kept belongs to the person (and signing out clears nothing)", () => {
  it("person B on the same tab finds question 1, nothing of A's, and sends their own START", async () => {
    mockApi(table());
    const u = userEvent.setup();
    const a = render(<SurveyScreen id="s1" />);
    await toQuestion3(u);
    expect(draftOf("userA").given.q1.optionId).toBe("o2");
    expect(keys().every((k) => k.startsWith("wawu.survey.userA."))).toBe(true);
    a.unmount();
    signOut();
    // round 4, ruling 3: signing out clears nothing; A's keys stay, under A
    expect(keys().sort()).toEqual(["wawu.survey.userA.s1.draft", "wawu.survey.userA.s1.started"]);
    signIn(jwt("userB"));
    leaveTab(); // a page load
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Question 1 of 3")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Cold drinks" }).getAttribute("aria-checked")).toBe("false");
    await waitFor(() => expect(events().filter((k) => k === "START").length).toBe(2));
  });
  it("without a sign-out, another person's draft is still not read", async () => {
    mockApi(table());
    window.sessionStorage.setItem("wawu.survey.userA.s1.draft", JSON.stringify({ idx: 2, given: {}, anonymous: false, shareState: false, ageBand: "" }));
    signIn(jwt("userB"));
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Question 1 of 3")).toBeTruthy();
  });
});

describe("N3: a recorded voice answer is kept", () => {
  const withVoice = () => window.sessionStorage.setItem("wawu.survey.userA.s1.draft", JSON.stringify({ idx: 2, given: { q1: { kind: "choice", optionId: "o2", label: "Cold drinks" }, q3: { kind: "voice", clipId: "c9", seconds: 12 } }, anonymous: false, shareState: false, ageBand: "" }));
  it("after a reload the last question shows the clip ready, and Send answer sends its id", async () => {
    mockApi(table());
    withVoice();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    expect((await screen.findByTestId("voice-ready")).textContent).toMatch(/ready, 0:12/);
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    const body = calls.find((c) => c.path === "/surveys/s1/responses")?.body as { answers: unknown[] };
    expect(body.answers).toEqual([{ questionId: "q1", optionId: "o2" }, { questionId: "q3", clipId: "c9" }]);
    expect(keys().filter((k) => k.endsWith(".draft"))).toEqual([]);
  });
  it("a send that fails leaves the clip in the draft", async () => {
    mockApi(table({ "POST /surveys/s1/responses": () => apiError(500, "X", "no") }));
    withVoice();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("button", { name: "Send answer" }));
    await screen.findByTestId("survey-problem");
    expect(draftOf("userA").given.q3).toEqual({ kind: "voice", clipId: "c9", seconds: 12 });
  });
  it("Record again drops the clip from the draft and shows the recorder", async () => {
    mockApi(table());
    withVoice();
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("button", { name: "Record again" }));
    expect(await screen.findByTestId("voice-box")).toBeTruthy();
    await waitFor(() => expect(draftOf("userA").given.q3).toBeUndefined());
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/voice-clips/c9")).toBe(true);
  });
});

describe("N4: leaving by a route that sends SKIP removes the draft", () => {
  it("a link away", async () => {
    mockApi(table());
    const u = userEvent.setup();
    const r = render(<SurveyScreen id="s1" />);
    await toQuestion3(u);
    expect(window.sessionStorage.getItem("wawu.survey.userA.s1.draft")).not.toBeNull();
    r.unmount();
    await waitFor(() => expect(events()).toEqual(["START", "SKIP"]));
    expect(window.sessionStorage.getItem("wawu.survey.userA.s1.draft")).toBeNull();
  });
  it("Back with no answers", async () => {
    mockApi(table());
    const spy = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 3");
    fireEvent.popState(window);
    await waitFor(() => expect(events()).toEqual(["START", "SKIP"]));
    expect(window.sessionStorage.getItem("wawu.survey.userA.s1.draft")).toBeNull();
    spy.mockRestore();
  });
});

describe("a survey that closed before the answer arrived", () => {
  it("shows the server's words, sends no SKIP, removes the draft and goes back to the feed place", async () => {
    mockApi(table({ "POST /surveys/s1/responses": () => apiError(409, "CONFLICT", "This survey has closed.") }));
    const u = userEvent.setup();
    // the last question is a voice question with a kept clip
    window.sessionStorage.setItem("wawu.survey.userA.s1.draft", JSON.stringify({ idx: 2, given: { q3: { kind: "voice", clipId: "c9", seconds: 5 } }, anonymous: false, shareState: false, ageBand: "" }));
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("button", { name: "Send answer" }));
    expect(await screen.findByText("This survey has closed.")).toBeTruthy();
    expect(screen.queryByText("Thanks. Your answers are in.")).toBeNull();
    expect(window.sessionStorage.getItem("wawu.survey.userA.s1.draft")).toBeNull();
    await u.click(screen.getByRole("button", { name: "Back to where you were" }));
    expect(back).toHaveBeenCalledTimes(1);
    await tick();
    expect(events().filter((k) => k === "SKIP")).toEqual([]);
  });
});
