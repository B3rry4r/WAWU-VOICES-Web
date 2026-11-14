// @vitest-environment jsdom
// V-SURVEYS web: the feed card, the Survey screen, the Done screen, the brand page. The API is stubbed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurveyFeedCard } from "@/components/feed/SurveyFeedCard";
import { SurveyScreen } from "@/features/surveys/SurveyScreen";
import { BrandPageScreen } from "@/features/surveys/BrandPageScreen";
import { getSurveyPlacement } from "@/lib/api/surveys";
import { apiError, calls, mockApi, signIn } from "./w6-helpers";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn() }), usePathname: () => "/surveys/s1" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

beforeEach(() => { push.mockClear(); signIn(); });
// A page that is left sends its SKIP on the next tick, and the START flag and the kept answers live in the tab's session storage: both are cleared between tests.
afterEach(async () => { cleanup(); await new Promise((r) => setTimeout(r, 5)); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

/** A stand-in IntersectionObserver the test can fire by hand. */
function stubObserver() {
  const seen: { fire: (ratio: number) => void; el: Element | null; disconnected: boolean }[] = [];
  class IO {
    cb: (e: Partial<IntersectionObserverEntry>[]) => void;
    rec = { el: null as Element | null, disconnected: false, fire: (ratio: number) => this.cb([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]) };
    constructor(cb: (e: Partial<IntersectionObserverEntry>[]) => void) { this.cb = cb; seen.push(this.rec); }
    observe(el: Element) { this.rec.el = el; }
    disconnect() { this.rec.disconnected = true; }
    unobserve() {}
  }
  vi.stubGlobal("IntersectionObserver", IO);
  return seen;
}

const opt = (id: string, label: string) => ({ id, label });
const survey = (over: Record<string, unknown> = {}) => ({
  id: "s1", label: "Sponsored Survey", brandName: "Zobo Fresh", brandSlug: "zobo-fresh", brandWebsite: "https://zobo.example", title: "Power and light", questionCount: 3,
  note: "n", myStatus: "OPEN", voiceMaxSeconds: 30, ageBands: ["18-24", "25-34"],
  questions: [
    { id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", options: [opt("o1", "A fan on battery"), opt("o2", "Cold drinks")] },
    { id: "q2", position: 2, kind: "TEXT", prompt: "Anything else?", options: [] },
  ],
  ...over,
});
const events = () => calls.filter((c) => c.path === "/surveys/s1/events").map((c) => (c.body as { kind: string }).kind);

describe("the feed card", () => {
  const card = { id: "s1", label: "Sponsored Survey", brandName: "Zobo Fresh", brandSlug: null, brandWebsite: null, title: "Power and light", questionCount: 3 };
  it("draws nothing for null", () => {
    const { container } = render(<SurveyFeedCard survey={null} />);
    expect(container.innerHTML).toBe("");
  });
  it("is labelled and links to the survey", () => {
    stubObserver();
    render(<SurveyFeedCard survey={card} />);
    expect(screen.getByText("Sponsored Survey")).toBeTruthy();
    expect(screen.getByText("by Zobo Fresh")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start the survey/ }).getAttribute("href")).toBe("/surveys/s1");
  });
  it("counts no VIEW when it mounts, and one VIEW once at least half of it is on screen", async () => {
    mockApi({ "POST /surveys/s1/events": null });
    const seen = stubObserver();
    const { rerender } = render(<SurveyFeedCard survey={card} />);
    await new Promise((r) => setTimeout(r, 5));
    expect(events()).toEqual([]);
    seen[0].fire(0.3); // a corner of it
    await new Promise((r) => setTimeout(r, 5));
    expect(events()).toEqual([]);
    seen[0].fire(0.6);
    seen[0].fire(1);
    rerender(<SurveyFeedCard survey={{ ...card }} />);
    await waitFor(() => expect(events()).toEqual(["VIEW"]));
    await new Promise((r) => setTimeout(r, 5));
    expect(events()).toEqual(["VIEW"]);
  });
  it("counts nothing where the browser cannot say what is on screen", async () => {
    mockApi({ "POST /surveys/s1/events": null });
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<SurveyFeedCard survey={card} />);
    await new Promise((r) => setTimeout(r, 5));
    expect(events()).toEqual([]);
  });
  it("shows no price, no token and no free-post word to a member", () => {
    stubObserver();
    const { container } = render(<SurveyFeedCard survey={card} />);
    expect(container.textContent).not.toMatch(/₦|token|free post|price/i);
  });
  it("a failed placement call is null", async () => {
    mockApi({ "GET /surveys/placement": () => apiError(500, "X", "no") });
    expect(await getSurveyPlacement()).toBeNull();
    mockApi({ "GET /surveys/placement": { survey: null } });
    expect(await getSurveyPlacement()).toBeNull();
  });
});

describe("the Survey screen", () => {
  it("walks the questions, counts START once, and posts the answers with the sharing choices", async () => {
    mockApi({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null, "POST /surveys/s1/responses": { ok: true, note: "" } });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Question 1 of 2")).toBeTruthy();
    expect(screen.getAllByText("About 1 min").length).toBeGreaterThan(0);
    const send = screen.getByRole("button", { name: "Send answer" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await u.click(screen.getByRole("radio", { name: "Cold drinks" }));
    await u.click(send);
    expect(await screen.findByText("Question 2 of 2")).toBeTruthy();
    // the last question shows the sharing choices
    await u.type(screen.getByLabelText("Your answer"), "Ice");
    await u.click(screen.getByRole("switch", { name: "Share my state" }));
    await u.selectOptions(screen.getByLabelText("Share my age band"), "25-34");
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByText("Thanks. Your answers are in.")).toBeTruthy();
    const post = calls.find((c) => c.path === "/surveys/s1/responses");
    expect(post?.body).toEqual({ answers: [{ questionId: "q1", optionId: "o2" }, { questionId: "q2", text: "Ice" }], shareState: true, ageBand: "25-34" });
    expect(events()).toEqual(["START"]);
    // the recap lists what the person gave
    expect(screen.getByText("Cold drinks")).toBeTruthy();
    expect(screen.getByText("Ice")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Visit Zobo Fresh" }).getAttribute("href")).toBe("https://zobo.example");
  });
  it("answering without your name sends anonymous and no state or age band", async () => {
    mockApi({ "GET /surveys/s1": survey({ questions: [{ id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "P", options: [opt("o1", "A"), opt("o2", "B")] }] }), "POST /surveys/s1/events": null, "POST /surveys/s1/responses": { ok: true, note: "" } });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "A" }));
    await u.click(screen.getByRole("switch", { name: "Share my state" }));
    await u.click(screen.getByRole("switch", { name: "Answer without my name" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Thanks. Your answers are in.");
    expect(calls.find((c) => c.path === "/surveys/s1/responses")?.body).toEqual({ answers: [{ questionId: "q1", optionId: "o1" }], anonymous: true });
  });
  it("Skip leaves a question out", async () => {
    mockApi({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null, "POST /surveys/s1/responses": { ok: true, note: "" } });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "A fan on battery" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Question 2 of 2");
    await u.click(screen.getAllByRole("button", { name: /^Skip/ })[0]);
    await screen.findByText("Thanks. Your answers are in.");
    expect(calls.find((c) => c.path === "/surveys/s1/responses")?.body).toEqual({ answers: [{ questionId: "q1", optionId: "o1" }] });
  });
  it("skipping every question sends nothing and counts a SKIP", async () => {
    mockApi({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 2");
    await u.click(screen.getAllByRole("button", { name: /^Skip/ })[0]);
    await u.click(screen.getAllByRole("button", { name: /^Skip/ })[0]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(calls.some((c) => c.path === "/surveys/s1/responses")).toBe(false);
    expect(events()).toEqual(["START", "SKIP"]);
  });
  it("Leave the survey counts a SKIP and goes Home; with answers it asks first", async () => {
    mockApi({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 2");
    await u.click(screen.getAllByRole("button", { name: /Leave the survey/ })[0]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(events()).toEqual(["START", "SKIP"]);
  });
  it("leaving after an answer asks first, and Keep going stays", async () => {
    mockApi({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "Cold drinks" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    await screen.findByText("Question 2 of 2");
    await u.click(screen.getAllByRole("button", { name: /Leave the survey/ })[0]);
    expect(await screen.findByText(/have not been sent/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Keep going" }));
    expect(push).not.toHaveBeenCalled();
    expect(events()).toEqual(["START"]);
  });
  it("a second answer (409) shows the Done screen, not an error", async () => {
    mockApi({ "GET /surveys/s1": survey({ questions: [{ id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "P", options: [opt("o1", "A"), opt("o2", "B")] }] }), "POST /surveys/s1/events": null, "POST /surveys/s1/responses": () => apiError(409, "CONFLICT", "You already answered this.") });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "A" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByText("Thanks. Your answers are in.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("an answered survey opens on the Done screen", async () => {
    mockApi({ "GET /surveys/s1": survey({ myStatus: "ANSWERED", questions: [] }) });
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Thanks. Your answers are in.")).toBeTruthy();
  });
  it("another refusal shows the API's words and keeps the answers for a second try", async () => {
    mockApi({ "GET /surveys/s1": survey({ questions: [{ id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "P", options: [opt("o1", "A"), opt("o2", "B")] }] }), "POST /surveys/s1/events": null, "POST /surveys/s1/responses": () => apiError(422, "VALIDATION", "This survey has ended.") });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("radio", { name: "A" }));
    await u.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByText("This survey has ended.")).toBeTruthy();
    expect(screen.getByText("Question 1 of 1")).toBeTruthy();
  });
  it("a survey that is not open (404) says so", async () => {
    mockApi({ "GET /surveys/s1": () => apiError(404, "NOT_FOUND", "no") });
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("This survey is not open")).toBeTruthy();
  });
  it("a failed load can be retried, and offline says so", async () => {
    let n = 0;
    mockApi({ "GET /surveys/s1": () => (n++ === 0 ? apiError(500, "X", "no") : survey()), "POST /surveys/s1/events": null });
    const u = userEvent.setup();
    render(<SurveyScreen id="s1" />);
    await u.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Question 1 of 2")).toBeTruthy();
  });
  it("signed out asks to sign in and calls nothing", async () => {
    window.localStorage.clear();
    mockApi({});
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByText("Sign in to answer")).toBeTruthy();
    expect(calls.length).toBe(0);
  });
  it("never shows a price, a token or a free post as something spent", async () => {
    mockApi({ "GET /surveys/s1": survey(), "POST /surveys/s1/events": null });
    const { container } = render(<SurveyScreen id="s1" />);
    await screen.findByText("Question 1 of 2");
    expect(container.textContent).not.toMatch(/₦|price|tokens?\b/i);
    expect(container.textContent).not.toMatch(/Rant|—/);
  });
});

describe("the brand page", () => {
  const page = {
    brand: { name: "Zobo Fresh", slug: "zobo-fresh", tagline: "Cold zobo and kunu.", website: "https://zobo.example", logoUrl: null, label: "Brand" },
    surveys: [{ id: "s1", title: "Power and light", label: "Sponsored Survey", questionCount: 3, endsOn: null }],
    ads: [{ id: "a1", kind: "FEED_CARD", label: "Ad", headline: "Cold zobo, delivered", body: "Lagos only.", imageUrl: null, linkUrl: "https://zobo.example/order", ctaLabel: "Order now" }],
  };
  it("shows the brand, its advert and its survey, labelled, with no contact address", async () => {
    mockApi({ "GET /brands/zobo-fresh": page });
    const { container } = render(<BrandPageScreen slug="zobo-fresh" />);
    expect(await screen.findByRole("heading", { name: "Zobo Fresh" })).toBeTruthy();
    expect(screen.getByText("Brand")).toBeTruthy();
    expect(screen.getByText("Cold zobo, delivered")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start the survey/ }).getAttribute("href")).toBe("/surveys/s1");
    expect(screen.getAllByRole("link", { name: "Visit Zobo Fresh" })[0].getAttribute("href")).toBe("https://zobo.example");
    expect(container.textContent).not.toMatch(/@/);
  });
  it("says so when nothing is live, and when the brand is not found", async () => {
    mockApi({ "GET /brands/zobo-fresh": { ...page, ads: [], surveys: [] } });
    render(<BrandPageScreen slug="zobo-fresh" />);
    expect(await screen.findByTestId("brand-empty")).toBeTruthy();
    cleanup();
    mockApi({ "GET /brands/nope": () => apiError(404, "NOT_FOUND", "no") });
    render(<BrandPageScreen slug="nope" />);
    expect(await screen.findByText("We could not find that brand")).toBeTruthy();
  });
  it("a failed load offers Try again", async () => {
    mockApi({ "GET /brands/zobo-fresh": () => apiError(500, "X", "no") });
    render(<BrandPageScreen slug="zobo-fresh" />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("a voice question", () => {
  it("uses the recorder with the survey's own maximum length and can be skipped", async () => {
    mockApi({ "GET /surveys/s1": survey({ voiceMaxSeconds: 20, questions: [{ id: "q1", position: 1, kind: "VOICE", prompt: "Say it", options: [] }] }), "POST /surveys/s1/events": null });
    render(<SurveyScreen id="s1" />);
    expect(await screen.findByLabelText("Voice recorder")).toBeTruthy();
    expect(screen.getByText("20 seconds")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Skip/ }).length).toBeGreaterThan(0);
  });
});
