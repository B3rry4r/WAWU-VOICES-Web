// @vitest-environment jsdom
// A written or voice list that came back empty while its count is above 0 says there are too few answers left.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { reportToCsv } from "@/features/admin/survey-csv";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminSurveyResultsPage } from "@/features/admin/SurveyResultsPage";
import type { SurveyReport } from "@/lib/api/admin-surveys";
import { cats, mockApi, signIn } from "./w6-helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/surveys", useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
beforeEach(() => signIn());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const LINE = "Too few answers left to show.";
const meAs = { id: "u", handle: "ngozi.e", roles: ["AD_MANAGER"], profile: { displayName: "Ngozi Eze" } };
const head = { id: "s1", brandName: "Zobo Fresh", title: "Power and light", status: "APPROVED" as const, startsOn: "2026-11-20", endsOn: "2026-11-30", responseTarget: 100 };
const report = (questions: unknown[], over: Partial<SurveyReport> = {}): SurveyReport => ({
  survey: head, stage: "RELEASED", ready: true, released: true, releasedAt: "2026-12-02T09:00:00Z", minGroupSize: 20, belowMinimum: false,
  totals: { views: 500, starts: 120, skips: 30, responses: 60, completionRate: 50 }, questions: questions as never, note: "n", ...over,
});
const base = { position: 1, options: [], other: null, texts: [] as string[], voices: [] as { transcript: string; seconds: number }[] };
const text = (o: object) => ({ ...base, id: "q1", kind: "TEXT", prompt: "Say more", answered: 45, ...o });
const voice = (o: object) => ({ ...base, id: "q2", kind: "VOICE", prompt: "Say it", answered: 45, ...o });
async function show(r: SurveyReport) {
  mockApi({ "GET /me": meAs, "GET /categories": cats, "GET /admin/today": { needsAttention: {} }, "GET /admin/brands": { items: [] }, "GET /admin/surveys/s1/report": r });
  render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
  await screen.findByTestId(r.released ? "stage-released" : "stage-running");
}

describe("a hidden list", () => {
  it("written question: the count stays, the line shows", async () => {
    await show(report([text({})]));
    expect(screen.getByText("45 answered this question")).toBeTruthy();
    expect(screen.getByText(LINE)).toBeTruthy();
    expect(screen.queryByText("No written answers to show.")).toBeNull();
  });
  it("voice question: the count stays, the line shows", async () => {
    await show(report([voice({})]));
    expect(screen.getByText("45 answered this question")).toBeTruthy();
    expect(screen.getByText(LINE)).toBeTruthy();
    expect(screen.queryByText("No voice answers to show.")).toBeNull();
  });
  it("a list with 6 items shows them and no line", async () => {
    await show(report([text({ texts: ["a1", "b2", "c3", "d4", "e5", "f6"] })]));
    expect(screen.getByText("f6")).toBeTruthy();
    expect(screen.queryByText(LINE)).toBeNull();
  });
  it("answered null keeps the old floor handling", async () => {
    await show(report([text({ answered: null })]));
    expect(screen.getByTestId("too-few").textContent).toBe("Too few answers to show");
    expect(screen.queryByText(LINE)).toBeNull();
  });
  it("answered 0 with an empty list is as before", async () => {
    await show(report([text({ answered: 0 })]));
    expect(screen.getByText("No written answers to show.")).toBeTruthy();
    expect(screen.queryByText(LINE)).toBeNull();
  });
  it("a survey that is not released is unchanged", async () => {
    await show(report([text({})], { stage: "RUNNING", released: false, totals: undefined, answeredSoFar: 12 }));
    expect(screen.getByTestId("stage-running")).toBeTruthy();
    expect(screen.queryByText(LINE)).toBeNull();
  });
});

describe("the CSV", () => {
  it("has the sentence for a written and a voice question, and the old line for null", () => {
    const csv = reportToCsv(report([text({}), voice({}), text({ id: "q3", prompt: "Third", answered: null })]));
    expect(csv).toContain(`Note,Say more,${LINE}`);
    expect(csv).toContain(`Note,Say it,${LINE}`);
    expect(csv).toContain("Note,Third,Too few answers to show");
    expect(csv).not.toContain("Free answer,Say more");
  });
  it("matches the page", async () => {
    const r = report([text({}), voice({})]);
    await show(r);
    const onPage = (document.body.textContent ?? "").split(LINE).length - 1;
    expect(onPage).toBe(2);
    expect(reportToCsv(r).split(LINE).length - 1).toBe(onPage);
  });
  it("a list with items is unchanged", () => {
    const csv = reportToCsv(report([text({ texts: ["hello"] })]));
    expect(csv).toContain("Free answer,Say more,hello");
    expect(csv).not.toContain(LINE);
  });
});
