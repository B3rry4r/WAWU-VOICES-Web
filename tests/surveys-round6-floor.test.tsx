// @vitest-environment jsdom
// V-SURVEYS round 6, L1: the results page never draws a row under the floor, even if the server sends one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

describe("rows under the floor are not drawn", () => {
  it("a state and an age row under 20 are left out when the server sent no Other", async () => {
    load(report({
      byState: [{ state: "Lagos", responses: 30, share: 50 }, { state: "Kano", responses: 3, share: 4 }], byStateOther: null,
      byAgeBand: [{ ageBand: "18-24", responses: 25, share: 40 }, { ageBand: "25-34", responses: 4, share: 7 }], byAgeBandOther: null,
    }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByText("By state");
    expect(screen.getByText("Lagos")).toBeTruthy();
    expect(screen.getByText("18-24")).toBeTruthy();
    expect(screen.queryByText("Kano")).toBeNull();
    expect(screen.queryByText("25-34")).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/Kano|25-34/);
  });
  it("with an Other from the server, the small rows are folded into it", async () => {
    load(report({
      byState: [{ state: "Lagos", responses: 30, share: 50 }, { state: "Kano", responses: 3, share: 4 }], byStateOther: { responses: 18, share: 30 },
    }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByText("By state");
    expect(screen.queryByText("Kano")).toBeNull();
    const other = screen.getByText("Other").closest("tr") as HTMLElement;
    expect(other.textContent).toContain("21");
    expect(other.textContent).toContain("34%");
  });
  it("a breakdown with nothing at or over the floor is not drawn at all", async () => {
    load(report({ byState: [{ state: "Kano", responses: 3, share: 4 }], byStateOther: null }));
    render(<AdminFrame><AdminSurveyResultsPage id="s1" /></AdminFrame>);
    await screen.findByTestId("stage-released");
    expect(screen.queryByText("By state")).toBeNull();
    expect(document.body.innerHTML).not.toContain("Kano");
  });
});
