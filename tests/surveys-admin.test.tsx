// @vitest-environment jsdom
// V-SURVEYS web: the admin Sponsored Surveys, Brands and results screens. The API is stubbed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminSurveysPage } from "@/features/admin/SurveysPage";
import { AdminBrandsPage } from "@/features/admin/BrandsPage";
import { AdminSurveyResultsPage } from "@/features/admin/SurveyResultsPage";
import { ADMIN_PAGES, canOpen } from "@/features/admin/roles";
import { apiError, calls, cats, mockApi, signIn } from "./w6-helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/surveys" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const meAs = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
beforeEach(() => signIn());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const survey = (over: Record<string, unknown> = {}) => ({
  id: "s1", brandId: null, brandName: "Zobo Fresh", contactEmail: "hello@zobo.example", title: "Power and light", status: "AWAITING_APPROVAL", label: "Sponsored Survey", live: false,
  checks: [{ text: "Dates are set", ok: true }, { text: "Price is set", ok: false }],
  questions: [{ id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", options: [{ id: "o1", label: "A fan" }, { id: "o2", label: "Cold drinks" }] }],
  categoryIds: [], states: [], startsOn: "2026-11-20", endsOn: "2026-11-30", frequencyCapPerDay: 1, priceKobo: null, responseTarget: 100,
  views: 0, starts: 0, completes: 0, skips: 0, responses: 0, rejectReason: null, changeRequest: null, submittedAt: null, approvedAt: null, ...over,
});
const list = (items: unknown[], awaitingApproval = 1) => ({ items, nextCursor: null, awaitingApproval });
const table = (extra: Record<string, unknown>, roles = ["AD_MANAGER"]) => ({ "GET /me": meAs(roles), "GET /categories": cats, "GET /admin/today": { needsAttention: {} }, "GET /admin/brands": { items: [] }, ...extra });

describe("the admin nav", () => {
  it("has Sponsored Surveys and Brands beside Adverts, for ad managers and admins only", () => {
    const ids = ADMIN_PAGES.map((p) => p.id);
    expect(ids.indexOf("surveys")).toBe(ids.indexOf("ads") + 1);
    expect(ids.indexOf("brands")).toBe(ids.indexOf("ads") + 2);
    for (const page of ["surveys", "brands"] as const) {
      expect(canOpen(["AD_MANAGER"], page)).toBe(true);
      expect(canOpen(["ADMIN"], page)).toBe(true);
      expect(canOpen(["MODERATOR"], page)).toBe(false);
      expect(canOpen(["EDITOR"], page)).toBe(false);
    }
  });
  it("a moderator gets the not found screen and no survey call", async () => {
    mockApi(table({ "GET /admin/surveys": list([]) }, ["MODERATOR"]));
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    expect(await screen.findByText("We could not find that")).toBeTruthy();
    expect(calls.some((c) => c.path === "/admin/surveys")).toBe(false);
  });
});

describe("Sponsored Surveys", () => {
  it("lists with status, and shows the checks and the targeting for the open one", async () => {
    mockApi(table({ "GET /admin/surveys": list([survey(), survey({ id: "s2", brandName: "Kunu Co", status: "APPROVED", live: true, views: 10, starts: 5, responses: 3 })]) }));
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    expect(await screen.findByText("Awaiting approval")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Price is set")).toBeTruthy();
    expect(screen.getByText("hello@zobo.example")).toBeTruthy();
    expect(screen.getByText("From the admin price list")).toBeTruthy();
  });
  it("shows the empty state and the failed state", async () => {
    mockApi(table({ "GET /admin/surveys": list([], 0) }));
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    expect(await screen.findByText("No surveys yet")).toBeTruthy();
    cleanup();
    mockApi(table({ "GET /admin/surveys": () => apiError(500, "X", "no") }));
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    expect(await screen.findByText("This did not load")).toBeTruthy();
  });
  it("approving a survey that fails a check shows the API's words as given", async () => {
    mockApi(table({
      "GET /admin/surveys": list([survey()]),
      "POST /admin/surveys/s1/decision": () => apiError(422, "VALIDATION", "A price is needed before this can run."),
    }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("A price is needed before this can run.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/admin/surveys/s1/decision")?.body).toEqual({ decision: "APPROVE" });
  });
  it("asking for changes and rejecting need a note, and send it", async () => {
    mockApi(table({ "GET /admin/surveys": list([survey()]), "POST /admin/surveys/s1/decision": survey({ status: "DRAFT", changeRequest: "Shorter" }) }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    const ask = (await screen.findByRole("button", { name: "Ask for changes" })) as HTMLButtonElement;
    expect(ask.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(true);
    await u.type(screen.getByLabelText("Note to the brand"), "Shorter");
    await u.click(ask);
    await waitFor(() => expect(calls.find((c) => c.path === "/admin/surveys/s1/decision")?.body).toEqual({ decision: "ASK_FOR_CHANGES", reason: "Shorter" }));
  });
  it("a draft is sent for approval; an approved one is paused; a paused one resumes", async () => {
    mockApi(table({ "GET /admin/surveys": list([survey({ status: "DRAFT" })], 0), "POST /admin/surveys/s1/submit": survey() }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Send for approval" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/admin/surveys/s1/submit")).toBe(true));
    cleanup();
    mockApi(table({ "GET /admin/surveys": list([survey({ status: "APPROVED", live: true })], 0), "POST /admin/surveys/s1/decision": survey({ status: "PAUSED" }) }));
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Pause" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/admin/surveys/s1/decision")?.body).toEqual({ decision: "PAUSE" }));
    cleanup();
    mockApi(table({ "GET /admin/surveys": list([survey({ status: "PAUSED" })], 0), "POST /admin/surveys/s1/decision": survey() }));
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Resume" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/admin/surveys/s1/decision")?.body).toEqual({ decision: "RESUME" }));
  });
  it("creates a survey with 1 to 5 questions and 2 to 6 choices", async () => {
    mockApi(table({ "GET /admin/surveys": list([], 0), "POST /admin/surveys": survey({ status: "DRAFT" }) }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "New survey" }));
    const save = () => screen.getByRole("button", { name: "Save survey" }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    await u.type(screen.getByLabelText("Brand name"), "Zobo Fresh");
    await u.type(screen.getByLabelText("Brand contact email"), "hello@zobo.example");
    await u.type(screen.getByLabelText("Title of the survey"), "Power and light");
    await u.type(screen.getByLabelText("The question"), "How do you keep cool?");
    expect(save().disabled).toBe(true); // a poll needs two choices
    await u.type(screen.getByLabelText("Choice 1"), "A fan");
    await u.type(screen.getByLabelText("Choice 2"), "Cold drinks");
    expect(save().disabled).toBe(false);
    for (let i = 0; i < 4; i++) await u.click(screen.getByRole("button", { name: "Add a choice" }));
    expect(screen.queryByRole("button", { name: "Add a choice" })).toBeNull(); // six is the most
    for (let i = 0; i < 4; i++) await u.click(screen.getByRole("button", { name: "Add a question" }));
    expect(screen.queryByRole("button", { name: "Add a question" })).toBeNull(); // five is the most
    await u.click(screen.getByRole("button", { name: "Remove question 5" }));
    await u.click(screen.getByRole("button", { name: "Remove question 4" }));
    await u.click(screen.getByRole("button", { name: "Remove question 3" }));
    await u.click(screen.getByRole("button", { name: "Remove question 2" }));
    expect(screen.queryByRole("button", { name: /Remove question/ })).toBeNull(); // one is the least
    await u.type(screen.getByLabelText("Choice 3"), "Sleep outside");
    await u.type(screen.getByLabelText("Price in naira (flat fee)"), "50000");
    await u.click(save());
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/admin/surveys")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/admin/surveys")?.body as Record<string, unknown>;
    expect(body.questions).toEqual([{ kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", options: ["A fan", "Cold drinks", "Sleep outside"] }]);
    expect(body.priceKobo).toBe(5000000);
    expect(body.brandName).toBe("Zobo Fresh");
    expect(await screen.findByText(/saved as a draft/)).toBeTruthy();
  });
  it("shows the API's words when a save is refused", async () => {
    mockApi(table({ "GET /admin/surveys": list([survey()]), "PATCH /admin/surveys/s1": () => apiError(409, "CONFLICT", "This survey has answers, so its questions cannot change.") }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveysPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Edit survey" }));
    await u.clear(screen.getByLabelText("The question"));
    await u.type(screen.getByLabelText("The question"), "Another?");
    await u.click(screen.getByRole("button", { name: "Save survey" }));
    expect(await screen.findByText("This survey has answers, so its questions cannot change.")).toBeTruthy();
  });
});

describe("Brands", () => {
  const brand = (over: Record<string, unknown> = {}) => ({ id: "b1", name: "Zobo Fresh", slug: "zobo-fresh", tagline: "Cold zobo.", website: "https://zobo.example", contactEmail: "hello@zobo.example", active: true, logoUrl: null, label: "Brand", ...over });
  it("lists, creates, edits and uploads a logo", async () => {
    let putTo = "";
    class FakeXhr { open(_m: string, u: string) { putTo = u; } setRequestHeader() {} send() { setTimeout(() => this.onload?.(), 0); } status = 200; onload?: () => void; onerror?: () => void; }
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    mockApi({
      ...table({}),
      "GET /admin/brands": { items: [brand()] },
      "POST /uploads": { fileId: "f1", putUrl: "https://files.example/put", putHeaders: {}, expiresAt: "2026-11-20T00:00:00Z" },
      "POST /uploads/f1/complete": { id: "f1" },
      "POST /admin/brands": brand({ id: "b2", name: "Kunu Co", slug: "kunu-co" }),
      "PATCH /admin/brands/b1": brand({ active: false }),
    });
    const u = userEvent.setup();
    render(<AdminFrame><AdminBrandsPage /></AdminFrame>);
    expect(await screen.findByText("/brands/zobo-fresh")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "New brand" }));
    await u.type(screen.getByLabelText("Brand name"), "Kunu Co");
    const file = new File(["x"], "logo.png", { type: "image/png" });
    await u.upload(screen.getByLabelText("Choose a logo"), file);
    await waitFor(() => expect(calls.some((c) => c.path === "/uploads/f1/complete")).toBe(true));
    expect(putTo).toBe("https://files.example/put");
    expect(calls.find((c) => c.path === "/uploads")?.body).toEqual({ kind: "AD_CREATIVE", mime: "image/png", sizeBytes: 1 });
    await u.click(screen.getByRole("button", { name: "Save brand" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/admin/brands")?.body).toEqual({ name: "Kunu Co", active: true, logoFileId: "f1" }));
    expect(await screen.findByText(/Its page is \/brands\/kunu-co/)).toBeTruthy();
  });
  it("a wrong picture type is refused before any call, and the empty state shows", async () => {
    mockApi({ ...table({}), "GET /admin/brands": { items: [] } });
    const u = userEvent.setup({ applyAccept: false });
    render(<AdminFrame><AdminBrandsPage /></AdminFrame>);
    expect(await screen.findByText("No brands yet")).toBeTruthy();
    await u.click(screen.getAllByRole("button", { name: "New brand" })[0]);
    const input = screen.getByLabelText("Choose a logo") as HTMLInputElement;
    await u.upload(input, new File(["x"], "a.gif", { type: "image/gif" }));
    expect(await screen.findByText("Use a JPEG, PNG or WebP picture.")).toBeTruthy();
    expect(calls.some((c) => c.path === "/uploads")).toBe(false);
  });
  it("an edit sends only what changed", async () => {
    mockApi({ ...table({}), "GET /admin/brands": { items: [brand()] }, "PATCH /admin/brands/b1": brand({ tagline: "New" }) });
    const u = userEvent.setup();
    render(<AdminFrame><AdminBrandsPage /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Edit Zobo Fresh" }));
    await u.clear(screen.getByLabelText("One line about the brand"));
    await u.type(screen.getByLabelText("One line about the brand"), "New");
    await u.click(screen.getByRole("button", { name: "Save brand" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ tagline: "New" }));
  });
});

describe("the results page", () => {
  const report = (over: Record<string, unknown> = {}) => ({
    survey: { id: "s1", brandName: "Zobo Fresh", title: "Power and light", status: "APPROVED", startsOn: "2026-11-20", endsOn: "2026-11-30", responseTarget: 100 },
    minGroupSize: 20, belowMinimum: false, totals: { views: 500, starts: 120, skips: 30, responses: 60, completionRate: 50 },
    questions: [{ id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", answered: 60, options: [{ id: "o1", label: "Cold drinks", count: 40, share: 67, hidden: false }, { id: "o2", label: "A fan", count: null, share: null, hidden: true }], texts: [], voices: [] },
      { id: "q2", position: 2, kind: "TEXT", prompt: "Anything else?", answered: 2, options: [], texts: ["Ice please"], voices: [] }],
    byState: [{ state: "Lagos", responses: 30, share: 50 }], byAgeBand: [{ ageBand: "25-34", responses: 25, share: 42 }], note: "Combined and anonymous.", ...over,
  });
  it("shows totals, counts and shares, free answers, state and age band exactly as the API gives them", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": report() }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect(await screen.findByText("Cold drinks")).toBeTruthy();
    expect(screen.getByText("40 · 67%")).toBeTruthy();
    expect(screen.getByText("Fewer than 20 answers, not shown")).toBeTruthy();
    expect(screen.getByText("Ice please")).toBeTruthy();
    expect(screen.getByText("Lagos")).toBeTruthy();
    expect(screen.getByText("25-34")).toBeTruthy();
    expect(screen.getByText("Combined and anonymous.")).toBeTruthy();
    expect(screen.queryByTestId("below-minimum")).toBeNull();
  });
  it("below the minimum shows the state and only views, started and skipped", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": report({ belowMinimum: true, totals: { views: 9, starts: 4, skips: 1, responses: null, completionRate: null }, questions: [], byState: [], byAgeBand: [], note: "Fewer than 20 people have answered." }) }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    const banner = await screen.findByTestId("below-minimum");
    expect(banner.textContent).toContain("Fewer than 20 answers so far");
    expect(screen.queryByText("Answered")).toBeNull();
    expect(screen.queryByText("By state")).toBeNull();
    expect(screen.getByText("Fewer than 20 people have answered.")).toBeTruthy();
  });
  it("Save as CSV saves a file built from the same response", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": report() }));
    let blob: Blob | null = null;
    const url = vi.fn((b: Blob) => { blob = b; return "blob:x"; });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: url, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Save as CSV" }));
    expect(click).toHaveBeenCalled();
    const text = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(blob as unknown as Blob); });
    expect(text).toContain("Choice,How do you keep cool?,Cold drinks,40,67,");
    expect(text).not.toMatch(/s1|[0-9a-f]{8}-/);
    click.mockRestore();
  });
  it("a failed load offers Try again, and an unknown survey says not found", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": () => apiError(500, "X", "no") }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    cleanup();
    mockApi(table({ "GET /admin/surveys/s1/report": () => apiError(404, "NOT_FOUND", "no") }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect(await screen.findByText("We could not find that survey")).toBeTruthy();
  });
});
