// @vitest-environment jsdom
// V-SURVEYS round 3, admin side: review handles, a paged list that must be read to the end before release, a question with no figure, a breakdown left out whole.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminSurveyResultsPage } from "@/features/admin/SurveyResultsPage";
import { reportToCsv } from "@/features/admin/survey-csv";
import type { SurveyReport } from "@/lib/api/admin-surveys";
import { apiError, calls, cats, mockApi, signIn } from "./w6-helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/surveys", useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

beforeEach(() => signIn());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const meAs = { id: "u", handle: "ngozi.e", roles: ["AD_MANAGER"], profile: { displayName: "Ngozi Eze" } };
const table = (extra: Record<string, unknown>) => ({ "GET /me": meAs, "GET /categories": cats, "GET /admin/today": { needsAttention: {} }, "GET /admin/brands": { items: [] }, ...extra });
const head = { id: "s1", brandName: "Zobo Fresh", title: "Power and light", status: "APPROVED" as const, startsOn: "2026-11-20", endsOn: "2026-11-30", responseTarget: 100 };
const review = { survey: head, stage: "REVIEW", ready: true, released: false, answeredSoFar: 6, note: "" };
const h = (n: number) => `${String(n).padStart(2, "0")}`.repeat(16);
const item = (n: number) => ({ id: h(n), questionId: "q2", prompt: "Anything else?", kind: "TEXT", text: `Answer number ${n}`, seconds: null, hidden: false });
const pages: Record<string, unknown> = {
  "": { released: false, items: [item(1), item(2)], total: 6, hiddenCount: 0, nextCursor: "c2" },
  c2: { released: false, items: [item(3), item(4)], total: 6, hiddenCount: 0, nextCursor: "c3" },
  c3: { released: false, items: [item(5), item(6)], total: 6, hiddenCount: 0, nextCursor: null },
};
const listHandler = ({ url }: { url: string }) => pages[new URL(url, "http://x").searchParams.get("cursor") ?? ""];
const releaseBtn = () => screen.getByRole("button", { name: "Release the results" }) as HTMLButtonElement;

describe("the review list is paged and release waits for the last page", () => {
  it("keeps Release off with the line until the third page is loaded, then turns it on", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": review, "GET /admin/surveys/s1/free-answers": listHandler }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByText("Answer number 2");
    expect(releaseBtn().disabled).toBe(true);
    expect(screen.getByText("Read the written answers before releasing the results.")).toBeTruthy();
    expect(screen.getByTestId("loaded-count").textContent).toBe("2 of 6 shown");
    await u.click(screen.getByRole("button", { name: "Show more answers" }));
    await screen.findByText("Answer number 4");
    expect(releaseBtn().disabled).toBe(true);
    await u.click(screen.getByRole("button", { name: "Show more answers" }));
    await screen.findByText("Answer number 6");
    expect(releaseBtn().disabled).toBe(false);
    expect(screen.queryByText("Read the written answers before releasing the results.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show more answers" })).toBeNull();
    const gets = calls.filter((c) => c.path.endsWith("/free-answers")).length;
    expect(gets).toBe(3);
  });
  it("hide and show send the handle, never an id, and the count follows across pages", async () => {
    mockApi(table({
      "GET /admin/surveys/s1/report": review,
      "GET /admin/surveys/s1/free-answers": listHandler,
      [`PATCH /admin/surveys/s1/free-answers/${h(1)}`]: ({ body }: { body: { hidden: boolean } }) => ({ id: h(1), hidden: body.hidden }),
    }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: /^Hide: Answer number 1/ }));
    await waitFor(() => expect(screen.getByTestId("hidden-count").textContent).toBe("1 of 6 hidden"));
    expect(calls.filter((c) => c.method === "PATCH").map((c) => c.path)).toEqual([`/admin/surveys/s1/free-answers/${h(1)}`]);
    await u.click(screen.getByRole("button", { name: /^Show: Answer number 1/ }));
    await waitFor(() => expect(screen.getByTestId("hidden-count").textContent).toBe("0 of 6 hidden"));
  });
  it("a 409 from release shows the server's words", async () => {
    mockApi(table({
      "GET /admin/surveys/s1/report": review,
      "GET /admin/surveys/s1/free-answers": { released: false, items: [item(1)], total: 1, hiddenCount: 0, nextCursor: null },
      "POST /admin/surveys/s1/release": () => apiError(409, "CONFLICT", "Read the written answers before releasing the results."),
    }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByText("Answer number 1");
    await u.click(releaseBtn());
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Release the results" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Read the written answers before releasing the results.");
  });
  it("a failed next page says so and can be tried again", async () => {
    let down = true;
    mockApi(table({ "GET /admin/surveys/s1/report": review, "GET /admin/surveys/s1/free-answers": ({ url }: { url: string }) => (url.includes("cursor") && down ? apiError(400, "X", "That page did not load.") : listHandler({ url })) }));
    const u = userEvent.setup();
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await u.click(await screen.findByRole("button", { name: "Show more answers" }));
    await waitFor(() => expect(screen.getByText("That page did not load.")).toBeTruthy());
    down = false;
    await u.click(screen.getByRole("button", { name: "Show more answers" }));
    await screen.findByText("Answer number 4");
  });
});

describe("a released report with parts the server left out", () => {
  const released = (over: Partial<SurveyReport> = {}): SurveyReport => ({
    survey: head, stage: "RELEASED", ready: true, released: true, releasedAt: "2026-12-02T09:00:00Z", minGroupSize: 20, belowMinimum: false,
    totals: { views: 500, starts: 120, skips: 30, responses: 60, completionRate: 50 },
    questions: [
      { id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", answered: null, options: [{ id: "o1", label: "Cold drinks", count: null, share: null, hidden: true }, { id: "o2", label: "A fan", count: null, share: null, hidden: true }], other: null, texts: [], voices: [] },
      { id: "q2", position: 2, kind: "TEXT", prompt: "Anything else?", answered: 25, options: [], other: null, texts: ["Ice please"], voices: [] },
    ],
    byState: [{ state: "Lagos", responses: 30, share: 50 }], byStateOther: null, note: "n", ...over,
  });
  it("a question with answered null shows no figure and no options", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": released() }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    expect((await screen.findByTestId("too-few")).textContent).toBe("Too few answers to show");
    const page = document.body.textContent as string;
    expect(page).not.toMatch(/null|\bNaN\b/);
    expect(page).not.toContain("0 answered this question");
    expect(screen.queryByText("Cold drinks")).toBeNull();
    expect(screen.getByText("25 answered this question")).toBeTruthy();
    expect(reportToCsv(released())).toContain("Too few answers to show");
    expect(reportToCsv(released())).not.toContain("Cold drinks");
  });
  it("a breakdown that is missing is not drawn, not even an empty frame", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": released({ byAgeBand: undefined, byAgeBandOther: undefined }) }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByText("By state");
    expect(screen.queryByText("By age band")).toBeNull();
    expect(screen.queryByText(/No age band is shown/)).toBeNull();
  });
  it("with both breakdowns missing nothing is drawn for either", async () => {
    mockApi(table({ "GET /admin/surveys/s1/report": released({ byState: undefined, byStateOther: undefined, byAgeBand: undefined }) }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByTestId("stage-released");
    expect(screen.queryByText("By state")).toBeNull();
    expect(screen.queryByText("By age band")).toBeNull();
  });
});
