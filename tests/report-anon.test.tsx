// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn() }), useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/features/talk/QuestionScreen", () => ({ QuestionScreen: () => null }));
vi.mock("@/features/talk/lib", async (orig) => ({ ...(await orig<object>()), useSignedIn: () => true }));

const reports: Record<string, unknown>[] = [];
let ans: unknown;
vi.mock("@/lib/api/talk", () => ({
  getAnswer: () => Promise.resolve(ans),
  createReport: (b: Record<string, unknown>) => { reports.push(b); return Promise.resolve({ id: "r1", status: "OPEN", blocked: false }); },
  unblockUser: vi.fn(),
}));

import { ReportScreen } from "@/features/talk/ReportScreen";

const base = { id: "a1", questionId: "q1", kind: "TEXT", body: "x" };
const named = { ...base, author: { id: "u1", handle: "tunde.a", displayName: "Tunde", state: null, avatarUrl: null } };

beforeEach(() => { reports.length = 0; });
afterEach(cleanup);

async function sendReport() {
  await userEvent.click(await screen.findByRole("radio", { name: "Scam or spam" }));
  await userEvent.click(screen.getByRole("button", { name: /Send report/ }));
  await waitFor(() => expect(reports).toHaveLength(1));
}

describe("ReportScreen and a post without a name", () => {
  it("an answer with no author offers no block option and sends no alsoBlock", async () => {
    ans = { ...base, author: null };
    render(<ReportScreen type="ANSWER" id="a1" />);
    await screen.findByRole("radio", { name: "Scam or spam" });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/block/i)).toBeNull();
    await sendReport();
    expect("alsoBlock" in reports[0]).toBe(false);
    expect((await screen.findByText("Thanks. We got your report.")).textContent).toBeTruthy();
    expect(screen.queryByText(/block/i)).toBeNull();
    expect(document.querySelector("a[href*='block']")).toBeNull();
  });

  it("an answer flagged anonymous is treated the same, even if an author came through", async () => {
    ans = { ...named, anonymous: true };
    render(<ReportScreen type="ANSWER" id="a1" />);
    await screen.findByRole("radio", { name: "Scam or spam" });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/tunde/i)).toBeNull();
    await sendReport();
    expect("alsoBlock" in reports[0]).toBe(false);
  });

  it("a named answer still offers the block option and sends it", async () => {
    ans = named;
    render(<ReportScreen type="ANSWER" id="a1" />);
    await userEvent.click(await screen.findByLabelText(/Also block @tunde.a/));
    await sendReport();
    expect(reports[0].alsoBlock).toBe(true);
  });
});
