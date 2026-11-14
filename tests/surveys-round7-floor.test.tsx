// @vitest-environment jsdom
// V-SURVEYS round 7, M1: a choice or an Other under the floor is not drawn and not exported, whatever the server sends.
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

const meAs = { id: "u", handle: "ngozi.e", roles: ["AD_MANAGER"], profile: { displayName: "Ngozi Eze" } };
const head = { id: "s1", brandName: "Zobo Fresh", title: "Power and light", status: "APPROVED" as const, startsOn: "2026-11-20", endsOn: "2026-11-30", responseTarget: 100 };
const report = (over: Partial<SurveyReport>): SurveyReport => ({
  survey: head, stage: "RELEASED", ready: true, released: true, releasedAt: "2026-12-02T09:00:00Z", minGroupSize: 20, belowMinimum: false,
  totals: { views: 500, starts: 120, skips: 30, responses: 60, completionRate: 50 },
  questions: [], note: "n", ...over,
});
const load = (r: SurveyReport) => mockApi({ "GET /me": meAs, "GET /categories": cats, "GET /admin/today": { needsAttention: {} }, "GET /admin/brands": { items: [] }, "GET /admin/surveys/s1/report": r });

const q = {
  id: "q1", position: 1, kind: "SINGLE_CHOICE" as const, prompt: "Do you?", answered: 100, texts: [], voices: [],
  options: [
    { id: "o1", label: "Yes", count: 60, share: 60, hidden: false },
    { id: "o2", label: "No", count: 40, share: 40, hidden: false },
    { id: "o3", label: "Maybe", count: 3, share: 3, hidden: false },
    { id: "o4", label: "Not sure", count: 0, share: 0, hidden: false },
  ],
  other: { label: "Other", count: 5, share: 5 },
};
const withQ = () => report({ questions: [q] as never });

describe("choice rows under the floor", () => {
  it("the page: Maybe 3 and Other 5 are not drawn, Not sure 0 is drawn as 0", async () => {
    load(withQ());
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByText("Do you?");
    const html = document.body.textContent ?? "";
    expect(html).toContain("Yes");
    expect(html).toMatch(/60 · 60%/);
    expect(html).toMatch(/40 · 40%/);
    expect(html).toMatch(/Not sure0 · 0%/);
    expect(html).not.toMatch(/Maybe\s*3/);
    expect(html).not.toMatch(/3 · 3%/);
    expect(screen.queryByTestId("other-line")).toBeNull();
    expect(html).not.toMatch(/Other\s*5/);
  });
  it("the CSV: Maybe has no count, Other 5 is left out, Not sure is 0", () => {
    const csv = reportToCsv(withQ());
    expect(csv).toContain("Choice,Do you?,Yes,60,60");
    expect(csv).toContain("Choice,Do you?,Not sure,0,0");
    expect(csv).toContain("Choice,Do you?,Maybe,hidden,");
    expect(csv).not.toMatch(/Maybe,3/);
    expect(csv).not.toMatch(/Other,5/);
  });
  it("an Other at the floor is drawn", async () => {
    const r = withQ();
    (r.questions as never as { other: unknown }[])[0].other = { label: "Other", count: 20, share: 20 };
    load(r);
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByTestId("other-line");
    expect(reportToCsv(r)).toContain("Other,20,20");
  });
});
