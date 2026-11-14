// @vitest-environment jsdom
// V-SURVEYS round 2, admin side: the three report stages, the review screen, release, the advert's brand page, the consent switch.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminSurveysPage } from "@/features/admin/SurveysPage";
import { AdminSurveyResultsPage } from "@/features/admin/SurveyResultsPage";
import { AdminAdsPage } from "@/features/admin/AdsPage";
import { SettingsPage } from "@/features/profile/SettingsPage";
import { reportToCsv, scrub, showsPeople } from "@/features/admin/survey-csv";
import type { SurveyReport } from "@/lib/api/admin-surveys";
import { apiError, calls, cats, me as memberMe, mockApi, signIn } from "./w6-helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/surveys", useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

beforeEach(() => signIn());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const meAs = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
const table = (extra: Record<string, unknown>) => ({ "GET /me": meAs(["AD_MANAGER"]), "GET /categories": cats, "GET /admin/today": { needsAttention: {} }, "GET /admin/brands": { items: [] }, ...extra });
const head = { id: "s1", brandName: "Zobo Fresh", title: "Power and light", status: "APPROVED" as const, startsOn: "2026-11-20", endsOn: "2026-11-30", responseTarget: 100 };

describe("stage RUNNING and NOT_LIVE", () => {
  it("shows only how many have answered and when the results will be ready", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": { survey: head, stage: "RUNNING", ready: false, released: false, answeredSoFar: 37, note: "Results are fixed when the survey is over." } }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect((await screen.findByTestId("answered-so-far")).textContent).toBe("37 people have answered so far");
    expect(screen.getByText(/ready when the survey ends on .*or when 100 people have answered/)).toBeTruthy();
    for (const w of ["Seen", "Started", "Answered", "By state", "Save as CSV", "Release the results"]) expect(screen.queryByText(w)).toBeNull();
    expect(screen.queryByRole("button", { name: "Save as CSV" })).toBeNull();
    expect(calls.some((c) => c.path.endsWith("/free-answers"))).toBe(false);
  });
  it("says a survey that is not live cannot be answered yet, and one person is singular", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": { survey: { ...head, status: "DRAFT", endsOn: null, responseTarget: null }, stage: "NOT_LIVE", ready: false, released: false, answeredSoFar: 1, note: "" } }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect((await screen.findByTestId("answered-so-far")).textContent).toBe("1 person has answered so far");
    expect(screen.getByText(/not live, so nobody can answer it yet/)).toBeTruthy();
  });
});

describe("stage REVIEW", () => {
  const review = { survey: head, stage: "REVIEW", ready: true, released: false, answeredSoFar: 52, note: "" };
  const items = (hidden = false) => [
    { id: "f1", questionId: "q2", prompt: "Anything else?", kind: "TEXT", text: "Ice please", seconds: null, hidden },
    { id: "f2", questionId: "q2", prompt: "Anything else?", kind: "TEXT", text: "Call Musa at the shop", seconds: null, hidden: false },
    { id: "f3", questionId: "q3", prompt: "Say it", kind: "VOICE", text: "We need light", seconds: 12, hidden: false },
  ];
  it("lists every free answer as the server gives it, with a count of the hidden ones", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": review, "GET /admin/surveys/s1/free-answers": { released: false, items: items(), total: 3, hiddenCount: 0 } }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect(await screen.findByText("Call Musa at the shop")).toBeTruthy();
    expect(screen.getByText("We need light")).toBeTruthy();
    expect(screen.getByTestId("hidden-count").textContent).toBe("0 of 3 hidden");
    expect(screen.queryByText("Seen")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Hide:/ }).length).toBe(3);
  });
  it("Hide and Show are one call each and the count follows", async () => {
    mockApi(table({
      "GET /admin/surveys/s1/report": review,
      "GET /admin/surveys/s1/free-answers": { released: false, items: items(), total: 3, hiddenCount: 0 },
      "PATCH /admin/surveys/s1/free-answers/f2": ({ body }: { body: { hidden: boolean } }) => ({ id: "f2", hidden: body.hidden }),
    }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: /^Hide: Call Musa/ }));
    await waitFor(() => expect(screen.getByTestId("hidden-count").textContent).toBe("1 of 3 hidden"));
    expect(calls.filter((c) => c.method === "PATCH").map((c) => c.body)).toEqual([{ hidden: true }]);
    await u.click(screen.getByRole("button", { name: /^Show: Call Musa/ }));
    await waitFor(() => expect(screen.getByTestId("hidden-count").textContent).toBe("0 of 3 hidden"));
    expect(calls.filter((c) => c.method === "PATCH").map((c) => c.body)).toEqual([{ hidden: true }, { hidden: false }]);
  });
  it("shows the server's own words when a hide is refused", async () => {
    mockApi(table({
      "GET /admin/surveys/s1/report": review,
      "GET /admin/surveys/s1/free-answers": { released: false, items: items(), total: 3, hiddenCount: 0 },
      "PATCH /admin/surveys/s1/free-answers/f1": () => apiError(409, "CONFLICT", "These results were released. Nothing can be hidden now."),
    }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: /^Hide: Ice please/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("These results were released. Nothing can be hidden now.");
  });
  it("Release asks first, says what it does, and sends nothing until confirmed", async () => {
    let released = false;
    mockApi(table({
      "GET /admin/surveys/s1/report": () => (released ? { survey: head, stage: "RELEASED", ready: true, released: true, releasedAt: "2026-12-02T09:00:00Z", minGroupSize: 20, belowMinimum: false, totals: { views: 9, starts: 8, skips: 1, responses: 52, completionRate: 90 }, questions: [], byState: [], byAgeBand: [], note: "" } : review),
      "GET /admin/surveys/s1/free-answers": { released: false, items: items(true), total: 3, hiddenCount: 1 },
      "POST /admin/surveys/s1/release": () => { released = true; return { released: true, releasedAt: "2026-12-02T09:00:00Z", hiddenCount: 1, mailed: true }; },
    }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Release the results" }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByText(/results are fixed from this moment/)).toBeTruthy();
    expect(dlg.getByText(/"results ready" email goes to the brand's contact/)).toBeTruthy();
    expect(dlg.getByText(/1 written or voice answer stays hidden/)).toBeTruthy();
    expect(calls.some((c) => c.path.endsWith("/release"))).toBe(false);
    await u.click(dlg.getByRole("button", { name: "Not yet" }));
    expect(calls.some((c) => c.path.endsWith("/release"))).toBe(false);
    await u.click(screen.getByRole("button", { name: "Release the results" }));
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Release the results" }));
    expect(await screen.findByTestId("stage-released")).toBeTruthy();
    expect(calls.filter((c) => c.path.endsWith("/release")).length).toBe(1);
    expect(screen.getByRole("button", { name: "Save as CSV" })).toBeTruthy();
  });
  it("a refused release shows the server's words and stays on the review", async () => {
    mockApi(table({
      "GET /admin/surveys/s1/report": review,
      "GET /admin/surveys/s1/free-answers": { released: false, items: [], total: 0, hiddenCount: 0 },
      "POST /admin/surveys/s1/release": () => apiError(409, "CONFLICT", "The results were already released."),
    }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect(await screen.findByTestId("review-empty")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Release the results" }));
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Release the results" }));
    expect((await screen.findByRole("alert")).textContent).toContain("The results were already released.");
    expect(screen.getByTestId("stage-review")).toBeTruthy();
  });
  it("a failed list offers Try again", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": review, "GET /admin/surveys/s1/free-answers": () => apiError(500, "X", "no") }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("stage RELEASED", () => {
  const released = (over: Partial<SurveyReport> = {}): SurveyReport => ({
    survey: head, stage: "RELEASED", ready: true, released: true, releasedAt: "2026-12-02T09:00:00Z", minGroupSize: 20, belowMinimum: false,
    totals: { views: 500, starts: 120, skips: 30, responses: 60, completionRate: 50 },
    questions: [{ id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", answered: 60, options: [{ id: "o1", label: "Cold drinks", count: 40, share: 67, hidden: false }, { id: "o2", label: "A fan", count: null, share: null, hidden: true }], other: { label: "Other", count: 20, share: 33 }, texts: [], voices: [] },
      { id: "q2", position: 2, kind: "TEXT", prompt: "Anything else?", answered: 2, options: [], other: null, texts: ["Ice please", "mail me ada@x.com or +234 803 123 4567"], voices: [] }],
    byState: [{ state: "Lagos", responses: 30, share: 50 }], byStateOther: { responses: 20, share: 33 }, byAgeBand: [{ ageBand: "25-34", responses: 25, share: 42 }], byAgeBandOther: null, note: "Combined and anonymous.", ...over,
  });
  it("shows the stored report, the Other lines and the released time", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": released() }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect(await screen.findByText("40 · 67%")).toBeTruthy();
    expect(within(screen.getByTestId("other-line")).getByText("20 · 33%")).toBeTruthy();
    expect(screen.getByTestId("released-at").textContent).toMatch(/^Released on .* These results are fixed\.$/);
    expect(screen.getAllByText("Other").length).toBe(2); // the choice line and the state row
    expect(screen.getByText("Fewer than 20 answers, not shown")).toBeTruthy();
  });
  it("the not enough answers state shows only the counts and the server's note", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": released({ belowMinimum: true, totals: { views: 9, starts: 4, skips: 1, responses: null, completionRate: null }, questions: undefined, byState: undefined, byAgeBand: undefined, byStateOther: undefined, byAgeBandOther: undefined, note: "Fewer than 20 people answered." }) }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect((await screen.findByTestId("below-minimum")).textContent).toContain("Fewer than 20 answers so far");
    expect(screen.getByText("Fewer than 20 people answered.")).toBeTruthy();
    expect(screen.queryByText("By state")).toBeNull();
  });
  it("hides the per-person parts under the floor even when the flag says otherwise, in the page and in the CSV", async () => {
    const r = released({ belowMinimum: false, totals: { views: 50, starts: 30, skips: 5, responses: 15, completionRate: 50 } });
    expect(showsPeople(r)).toBe(false);
    mockApi(table({ "GET /admin/surveys/s1/report": r }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByTestId("below-minimum");
    expect(screen.queryByText("Cold drinks")).toBeNull();
    expect(reportToCsv(r)).not.toContain("Cold drinks");
    expect(reportToCsv(r)).not.toContain("Lagos");
  });
  it("scrubs a number, an email, a link or a handle a second time, in the page and in the CSV", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": released() }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect(await screen.findByText("mail me [removed] or [removed]")).toBeTruthy();
    expect(reportToCsv(released())).not.toMatch(/ada@x|803/);
    expect(scrub("see https://a.co/x and www.b.ng and @ada_o, call 0803-123-4567")).toBe("see [removed] and [removed] and [removed], call [removed]");
    expect(scrub("Plain words stay. 2 or 3 of them.")).toBe("Plain words stay. 2 or 3 of them.");
  });
  it("the CSV writes the Other lines and the word hidden", () => {
    const csv = reportToCsv(released());
    expect(csv).toContain("Choice,How do you keep cool?,Other,20,33,");
    expect(csv).toContain("Choice,How do you keep cool?,A fan,hidden,,");
    expect(csv).toContain("State,,Other,20,33,");
  });
  it("a report that is not released has no CSV rows of choices", () => {
    const csv = reportToCsv({ survey: head, stage: "REVIEW", ready: true, released: false, answeredSoFar: 5, note: "" } as SurveyReport);
    expect(csv).not.toContain("Choice");
  });
});

describe("the advert's brand page", () => {
  const ad = { id: "a1", brand: "Zobo", brandId: null as string | null, kind: "FEED_CARD", status: "AWAITING_APPROVAL", live: false, headline: "Fresh zobo", body: null, linkUrl: "https://zobo.ng", ctaLabel: null, imageUrl: null, audioClipId: null, categoryIds: [], states: [], ageBands: [], startsOn: null, endsOn: null, frequencyCapPerDay: 3, priceKobo: null, views: 0, taps: 0, listens: 0, rejectReason: null, changeRequest: null, checks: [] };
  const brands = { items: [{ id: "b1", name: "Zobo Fresh", slug: "zobo-fresh", tagline: null, website: null, contactEmail: "a@b.co", active: true, logoUrl: null, label: "Brand" }, { id: "b2", name: "Kunu Co", slug: "kunu-co", tagline: null, website: null, contactEmail: "a@b.co", active: false, logoUrl: null, label: "Brand" }] };
  it("lists the brands in an optional select and sends brandId only when it changed", async () => {
    mockApi(table({ "GET /admin/ads": { items: [ad], nextCursor: null, awaitingApproval: 1 }, "GET /admin/brands": brands, "PATCH /admin/ads/a1": ({ body }: { body: unknown }) => ({ ...ad, ...(body as object) }) }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminAdsPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Edit advert" }));
    const sel = (await screen.findByLabelText("Brand page (optional)")) as HTMLSelectElement;
    await waitFor(() => expect(within(sel).getByRole("option", { name: "Zobo Fresh" })).toBeTruthy());
    expect(within(sel).getByRole("option", { name: "Kunu Co (off)" })).toBeTruthy();
    expect(sel.value).toBe("");
    await u.selectOptions(sel, "b1");
    await u.click(screen.getByRole("button", { name: "Save advert" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ brandId: "b1" }));
  });
  it("clears the brand page with null, and a new advert without one sends no brandId", async () => {
    mockApi(table({ "GET /admin/ads": { items: [{ ...ad, brandId: "b1" }], nextCursor: null, awaitingApproval: 1 }, "GET /admin/brands": brands, "PATCH /admin/ads/a1": { ...ad } }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminAdsPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Edit advert" }));
    const sel = (await screen.findByLabelText("Brand page (optional)")) as HTMLSelectElement;
    await waitFor(() => expect(sel.value).toBe("b1"));
    await u.selectOptions(sel, "");
    await u.click(screen.getByRole("button", { name: "Save advert" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ brandId: null }));
  });
});

describe("the consent switch in Settings", () => {
  const withSetting = (on: boolean) => ({ ...memberMe, settings: { ...memberMe.settings, useMyStateForSurveys: on } });
  it("is off by default, says what it does in one line, and saves with a PATCH", async () => {
    mockApi({ "GET /me": withSetting(false), "GET /me/blocks": { items: [], nextCursor: null }, "PATCH /me/settings": ({ body }: { body: unknown }) => ({ ...withSetting(false).settings, ...(body as object) }) });
    const u = userEvent.setup();
    render(<SettingsPage />);
    const sw = (await screen.findByRole("switch", { name: /Use my state to choose surveys for me/ })) as HTMLInputElement;
    expect(sw.checked).toBe(false);
    expect(screen.getByText("Lets a survey aimed at your state reach you. It stays off until you turn it on.")).toBeTruthy();
    await u.click(sw);
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ useMyStateForSurveys: true }));
  });
});

describe("the survey list says where each survey is", () => {
  const row = (over: Record<string, unknown>) => ({
    id: "s1", brandId: null, brandName: "Zobo Fresh", contactEmail: "h@z.co", title: "Power and light", status: "APPROVED", label: "Sponsored Survey", live: false, checks: [], questions: [], categoryIds: [], states: [],
    startsOn: "2099-01-01", endsOn: "2099-02-01", frequencyCapPerDay: 1, priceKobo: null, responseTarget: null, views: 0, starts: 0, completes: 0, skips: 0, responses: 0, rejectReason: null, changeRequest: null, submittedAt: null, approvedAt: null, snapshotAt: null, releasedAt: null, ...over,
  });
  it("an approved survey that has not started says when it starts; a fixed one cannot be edited or paused", async () => {
    mockApi(table({ "GET /admin/surveys": { items: [row({}), row({ id: "s2", brandName: "Kunu Co", snapshotAt: "2026-12-01T10:00:00Z", startsOn: "2026-11-01", endsOn: "2026-11-05", responses: 40 }), row({ id: "s3", brandName: "Soon Co", snapshotAt: "2026-12-01T10:00:00Z", releasedAt: "2026-12-02T10:00:00Z", responses: 40 })], nextCursor: null, awaitingApproval: 0 } }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    expect(await screen.findByText(/^Approved, starts /)).toBeTruthy();
    expect(screen.getByText("Over, results to review")).toBeTruthy();
    expect(screen.getByText("Results released")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /Kunu Co/ }));
    expect(await screen.findByText(/results are fixed. Read the answers/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit survey" })).toBeNull();
    expect(screen.getByRole("link", { name: "Results for the brand" })).toBeTruthy();
  });
});
