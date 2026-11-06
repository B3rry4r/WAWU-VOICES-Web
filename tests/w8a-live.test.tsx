// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveResultsPage, POLL_MS } from "@/features/results/LiveResultsPage";

const author = { id: "u", handle: "kemi.b", displayName: "Kemi Bello", state: null, avatarUrl: null };
const post = (id: string, status: "VERIFIED" | "NOT_VERIFIED") => ({
  id, threadId: "t1", author, state: "Lagos", lga: "Surulere", ward: "Ward 3", pollingUnit: "PU " + id, accredited: 10, votesCast: 9, rejected: 1, status,
  label: status === "VERIFIED" ? "Verified" : "Not verified", checkedAt: null, checkedLine: null, createdAt: "2027-01-16T17:42:00Z", isMine: false,
});
let urls: string[];
let newCount = 0;

function json(body: unknown) { return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }); }

beforeEach(() => {
  urls = [];
  newCount = 0;
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(url);
    if (url.endsWith("/result-threads/t1")) return json({ id: "t1", title: "Election Week: Your Vote, Your Voice", subtitle: "Presidential and National Assembly elections", heldOn: "2027-01-16", status: "OPEN", postCount: 3, verifiedCount: 1, toCheck: 2 });
    if (url.includes("status=VERIFIED")) return json({ items: [post("1", "VERIFIED")], nextCursor: null, newCount: 0, newestCursor: "v" });
    if (url.includes("after=")) return json({ items: [], nextCursor: null, newCount, newestCursor: "z" });
    return json({ items: [post("1", "VERIFIED"), post("2", "NOT_VERIFIED"), post("3", "NOT_VERIFIED")], nextCursor: null, newCount: 0, newestCursor: "c" });
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("LiveResultsPage", () => {
  it("draws the thread, the counts and the signed-in post button", async () => {
    render(<LiveResultsPage threadId="t1" />);
    expect(await screen.findByText("Presidential and National Assembly elections")).toBeTruthy();
    expect(screen.getByText("Polling unit results")).toBeTruthy();
    // WF-6 C-N7: posts nobody has checked (checkedAt null) carry no "Not verified" pill; the verified one keeps its mark
    expect(screen.queryAllByText("Not verified").length).toBe(0);
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Post the numbers you see" })[0].getAttribute("href")).toBe("/live/t1/post");
  });

  it("Verified only asks the server for VERIFIED", async () => {
    const user = userEvent.setup();
    render(<LiveResultsPage threadId="t1" />);
    await screen.findByText("Polling unit results");
    await user.click(screen.getByRole("tab", { name: /Verified only/ }));
    await waitFor(() => expect(urls.some((u) => u.includes("/posts?status=VERIFIED"))).toBe(true));
  });

  it("shows no post button to a guest", async () => {
    window.localStorage.clear();
    render(<LiveResultsPage threadId="t1" />);
    await screen.findByText("Polling unit results");
    expect(screen.queryByRole("link", { name: "Post the numbers you see" })).toBeNull();
  });

  it("polls with after and shows the new results pill, then reloads on tap", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<LiveResultsPage threadId="t1" />);
    await screen.findByText("Polling unit results");
    expect(screen.queryByText(/new result/)).toBeNull();
    newCount = 2;
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS + 50); });
    const pill = await screen.findByText("2 new results");
    expect(urls.some((u) => u.includes("after=c"))).toBe(true);
    newCount = 0;
    await user.click(pill);
    await waitFor(() => expect(screen.queryByText("2 new results")).toBeNull());
  });
});
