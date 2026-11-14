// @vitest-environment jsdom
// V-FIX-C: the What Next? summary panel, Group ideas, People and roles, and the weekly emotions form.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminIdeasPage } from "@/features/admin/IdeasPage";
import { AdminPeoplePage } from "@/features/admin/PeoplePage";
import { SummaryPanel } from "@/features/admin/SummaryPanel";
import { AdminWeeklyPage } from "@/features/admin/WeeklyPage";
import { Summary } from "@/features/vote/WhatNextPage";
import { moodRows } from "@/features/reach/weekly-map";
import { ADMIN_PAGES, canOpen } from "@/features/admin/roles";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/ideas" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
const NOT_FOUND = { error: { code: "NOT_FOUND", message: "no" } };
type Call = { url: string; method: string; body: any };

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const DRAFT = {
  topicId: "t1", source: "DATA", aiAvailable: false, aiNote: null,
  draft: { mainView: "", mainViewVoices: 0, opposingView: "", opposingViewVoices: 0, pollLine: "“Publish their assets and plans” leads with 60% of 100 votes. The poll is still open.", nextStepsLine: "Most supported so far: Put the pay date in every offer letter" },
  basedOnVoices: 40, basedOnVotes: 100,
  moods: [{ mood: "ANGRY", count: 2, percent: 67 }, { mood: "HOPEFUL", count: 1, percent: 33 }],
  categories: [{ name: "Money", voices: 40 }],
  quotes: [{ answerId: "a1", kind: "TEXT", reactions: 9, excerpt: "Salary is gone in a day." }],
};

function summaryStub(opts: { aiAvailable: boolean; saved?: unknown }, calls: Call[]) {
  return vi.fn(async (u: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: u, method, body });
    if (u.endsWith("/summary") && method === "GET") return json(200, { aiAvailable: opts.aiAvailable, summary: opts.saved ?? null });
    if (u.endsWith("/summary/draft")) return json(200, { ...DRAFT, aiAvailable: opts.aiAvailable, source: body.ai ? "AI" : "DATA", draft: body.ai ? { ...DRAFT.draft, mainView: "paying on the promised day" } : DRAFT.draft });
    if (u.endsWith("/summary") && method === "PUT") return json(200, { topicId: "t1", ...body, basedOnVoices: 40, basedOnVotes: 100, updatedAt: "2026-11-14T10:00:00Z", reviewedByEditor: body.approve });
    return json(404, NOT_FOUND);
  });
}

describe("the nav", () => {
  it("lists Group ideas for a moderator and an admin, People and roles for an admin only", () => {
    expect(ADMIN_PAGES.some((p) => p.id === "ideas" && p.href === "/admin/ideas")).toBe(true);
    expect(ADMIN_PAGES.some((p) => p.id === "people" && p.href === "/admin/people")).toBe(true);
    expect(canOpen(["MODERATOR"], "ideas")).toBe(true);
    expect(canOpen(["EDITOR"], "ideas")).toBe(false);
    expect(canOpen(["ADMIN"], "people")).toBe(true);
    for (const r of ["EDITOR", "MODERATOR", "AD_MANAGER"] as const) expect(canOpen([r], "people")).toBe(false);
  });
});

describe("What Next? summary panel", () => {
  it("with no key: the first open drafts from the data (no views, no counts), AI is off in plain words, Approve needs counted voices", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", summaryStub({ aiAvailable: false }, calls));
    render(<SummaryPanel topicId="t1" />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Write the summary" }));
    // the poll line comes from the data, in votes; the views and counts are empty
    expect(await screen.findByDisplayValue(/leads with 60% of 100 votes/)).toBeTruthy();
    expect((screen.getByLabelText("Main view") as HTMLInputElement).value).toBe("");
    const main = screen.getByLabelText("Voices behind the main view: count them from the voices") as HTMLInputElement;
    const opp = screen.getByLabelText("Voices behind the opposing view: count them from the voices") as HTMLInputElement;
    expect(main.value).toBe("");
    expect(opp.value).toBe("");
    expect(screen.getByText(/AI drafting is off here/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Draft with AI" }) as HTMLButtonElement).disabled).toBe(true);
    // the material it was built from is shown
    expect(screen.getByText(/Angry 2 \(67%\)/)).toBeTruthy();
    expect(screen.getByText("Salary is gone in a day.")).toBeTruthy();
    // Approve is off, with a line saying why, until both counts are filled
    const approve = screen.getByRole("button", { name: "Save and show on What Next" }) as HTMLButtonElement;
    await u.type(screen.getByLabelText("Main view"), "publishing pay bands");
    await u.type(screen.getByLabelText("Main opposing view"), "keeping pay private");
    expect(approve.disabled).toBe(true);
    expect(screen.getByText(/count the voices behind each view and enter at least 1/)).toBeTruthy();
    await u.type(main, "30");
    expect(approve.disabled).toBe(true);
    await u.type(opp, "10");
    expect(approve.disabled).toBe(false);
    await u.click(approve);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")!.body).toMatchObject({ mainView: "publishing pay bands", mainViewVoices: 30, opposingViewVoices: 10, approve: true, aiDrafted: false });
    expect(await screen.findByText(/It is now shown on What Next/)).toBeTruthy();
  });

  it("with a key: Draft with AI asks for ai true, counts stay empty, a draft can be saved without them", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", summaryStub({ aiAvailable: true }, calls));
    render(<SummaryPanel topicId="t1" />);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Write the summary" }));
    await screen.findByDisplayValue(/leads with 60% of 100 votes/);
    await u.click(screen.getByRole("button", { name: "Draft with AI" }));
    expect(await screen.findByDisplayValue("paying on the promised day")).toBeTruthy();
    expect((screen.getByLabelText("Voices behind the main view: count them from the voices") as HTMLInputElement).value).toBe("");
    expect(calls.filter((c) => c.url.endsWith("/summary/draft")).map((c) => c.body.ai)).toEqual([false, true]);
    await u.type(screen.getByLabelText("Main opposing view"), "saving first");
    await u.click(screen.getByRole("button", { name: "Save as a draft" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ approve: false, aiDrafted: true, mainViewVoices: 0 }));
    expect(await screen.findByText(/It is not shown to anyone yet/)).toBeTruthy();
  });

  it("when the summary fails to load: it says so and offers Try again, never says AI is off, and Write is off until it loads", async () => {
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.endsWith("/summary") ? (fail ? json(500, { error: { code: "INTERNAL", message: "x" } }) : json(200, { aiAvailable: true, summary: null })) : json(404, NOT_FOUND))));
    render(<SummaryPanel topicId="t1" />);
    expect(await screen.findByText("The summary did not load.")).toBeTruthy();
    expect(screen.queryByText(/AI drafting is off/)).toBeNull();
    expect((screen.getByRole("button", { name: "Write the summary" }) as HTMLButtonElement).disabled).toBe(true);
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Write the summary" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText("The summary did not load.")).toBeNull();
  });

  it("shows a saved summary with its state, and the API's words when it refuses", async () => {
    const calls: Call[] = [];
    const saved = { topicId: "t1", mainView: "paying on time", mainViewVoices: 20, opposingView: "saving first", opposingViewVoices: 10, pollLine: "split", nextStepsLine: "one", basedOnVoices: 40, basedOnVotes: 100, updatedAt: "2026-11-14T10:00:00Z", reviewedByEditor: true, aiDrafted: false };
    const f = summaryStub({ aiAvailable: false, saved }, calls);
    vi.stubGlobal("fetch", f);
    render(<SummaryPanel topicId="t1" />);
    expect(await screen.findByText("Shown on What Next")).toBeTruthy();
    expect(screen.getByText(/Based on 40 voices and 100 votes/)).toBeTruthy();
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => (init?.method === "PUT" ? json(422, { error: { code: "VALIDATION_FAILED", message: "Some details need fixing.", details: { fields: [{ path: "mainView", message: "Say “lean towards” or “split”, never that everyone agrees." }] } } }) : f(u, init))));
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Edit the summary" }));
    // a saved summary opens with its own counts, so Approve is on
    await u.click(screen.getByRole("button", { name: "Save and show on What Next" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/never that everyone agrees/);
  });
});

describe("Group ideas", () => {
  it("lists questions, shows a suggested group, and confirming sends the title and proposals", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: u, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/admin/today")) return json(404, NOT_FOUND);
      if (u.includes("/admin/proposal-questions")) return json(200, { items: [{ questionId: "q1", text: "What would make pay fairer?", weekNumber: 4, proposalCount: 3, groupCount: 0, ungroupedCount: 3 }] });
      if (u.includes("/admin/proposals?")) return json(200, { question: { id: "q1", text: "What would make pay fairer?" }, items: [
        { id: "p1", kind: "TEXT", text: "Put the pay date in every offer letter", supportCount: 9, challengeCount: 0, groupId: null, groupTitle: null, createdAt: "2026-11-14T10:00:00Z" },
        { id: "p2", kind: "TEXT", text: "Pay date in the offer letter with a penalty", supportCount: 4, challengeCount: 1, groupId: null, groupTitle: null, createdAt: "2026-11-14T10:00:00Z" },
        { id: "p3", kind: "TEXT", text: "Build libraries", supportCount: 1, challengeCount: 0, groupId: null, groupTitle: null, createdAt: "2026-11-14T10:00:00Z" },
      ], groups: [], suggestions: [{ title: "Put the pay date in every offer letter", proposalIds: ["p1", "p2"] }] });
      if (u.endsWith("/admin/proposal-groups")) return json(201, { id: "g1", title: "Pay date in the offer letter", confirmed: true, proposalCount: 2, supportCount: 13, challengeCount: 1, topProposal: null });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminIdeasPage /></AdminFrame>);
    const u = userEvent.setup();
    const sug = await screen.findByRole("region", { name: "Suggested group 1" });
    const name = within(sug).getByLabelText("Group name");
    await u.clear(name);
    await u.type(name, "Pay date in the offer letter");
    await u.click(within(sug).getByRole("button", { name: "Confirm this group" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/admin/proposal-groups"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/admin/proposal-groups"))!.body).toEqual({ title: "Pay date in the offer letter", proposalIds: ["p1", "p2"] });
    expect(await screen.findByText(/Group confirmed/)).toBeTruthy();
  });

  it("Split this group asks on the page first, then calls DELETE and says what happened", async () => {
    const calls: Call[] = [];
    let grouped = true;
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: u, method, body: undefined });
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/admin/today")) return json(404, NOT_FOUND);
      if (u.includes("/admin/proposal-questions")) return json(200, { items: [{ questionId: "q1", text: "Pay?", weekNumber: 4, proposalCount: 2, groupCount: grouped ? 1 : 0, ungroupedCount: grouped ? 0 : 2 }] });
      if (u.includes("/admin/proposals?")) return json(200, { question: { id: "q1", text: "Pay?" }, items: [], groups: grouped ? [{ id: "g1", title: "Pay date", confirmed: true, proposalCount: 2 }] : [], suggestions: [] });
      if (u.endsWith("/admin/proposal-groups/g1") && method === "DELETE") { grouped = false; return json(200, { id: "g1", released: 2 }); }
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminIdeasPage /></AdminFrame>);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Split this group" }));
    expect(screen.getByText(/Split “Pay date”\? Its 2 proposals go back to not grouped/)).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await u.click(screen.getByRole("button", { name: "Keep it" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await u.click(screen.getByRole("button", { name: "Split this group" }));
    await u.click(screen.getByRole("button", { name: "Split the group" }));
    expect(await screen.findByText(/Group split: “Pay date”\. Its 2 proposals went back to not grouped/)).toBeTruthy();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
  });

  it("an editor does not get the page", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.endsWith("/me") ? json(200, me(["EDITOR"])) : json(404, NOT_FOUND))));
    render(<AdminFrame><AdminIdeasPage /></AdminFrame>);
    expect(await screen.findByText("We could not find that")).toBeTruthy();
  });
});

describe("People and roles", () => {
  const person = { profile: { id: "u9", handle: "ada.okafor", displayName: "Ada Okafor" }, status: "ACTIVE", roles: ["EDITOR"], strikes: 0, createdAt: "2026-11-01T00:00:00Z" };
  it("finds a person by handle, changes the roles with a reason, and sends the whole set", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: u, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (u.endsWith("/me")) return json(200, me(["ADMIN"]));
      if (u.includes("/admin/today")) return json(404, NOT_FOUND);
      if (u.includes("/admin/roles")) return json(200, { items: [{ user: { id: "u1", handle: "ngozi.e", displayName: "Ngozi Eze" }, roles: ["ADMIN"] }], nextCursor: null });
      if (u.includes("/admin/users?")) return json(200, { items: [person], nextCursor: null });
      if (u.includes("/admin/users/u9/roles")) return json(200, { user: person.profile, roles: init?.body ? JSON.parse(String(init.body)).roles : [] });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminPeoplePage /></AdminFrame>);
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText("Handle"), "@ada.okafor");
    await u.click(screen.getByRole("button", { name: "Find" }));
    const list = await screen.findByRole("list", { name: "People found" });
    await u.click(within(list).getByRole("listitem"));
    expect((screen.getByRole("checkbox", { name: /^Editor/ }) as HTMLInputElement).checked).toBe(true);
    // save is off until something changes and a reason is given
    const save = screen.getByRole("button", { name: "Save roles" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await u.click(screen.getByRole("checkbox", { name: /^Moderator/ }));
    await u.click(screen.getByRole("checkbox", { name: /^Editor/ }));
    expect(screen.getByText("Give a reason of at least 3 characters.")).toBeTruthy();
    await u.type(screen.getByLabelText("Why"), "Moves to the moderation desk");
    expect(screen.getByText(/Gives moderator\. Takes away editor\./)).toBeTruthy();
    await u.click(save);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ roles: ["MODERATOR"], reason: "Moves to the moderation desk" });
    // Round 1 (was: toContain("q=%40ada.okafor")): the leading @ is stripped before the call.
    expect(calls.find((c) => c.url.includes("/admin/users?"))!.url).toContain("q=ada.okafor");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Why").value).toBe("");
    expect(screen.getByText("Change a role to save.")).toBeTruthy();
    expect(await screen.findByText(/@ada\.okafor is now moderator/)).toBeTruthy();
  });

  it("the API's refusal is shown in its own words", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (u.endsWith("/me")) return json(200, me(["ADMIN"]));
      if (u.includes("/admin/today")) return json(404, NOT_FOUND);
      if (u.includes("/admin/roles")) return json(200, { items: [{ user: { id: "u1", handle: "ngozi.e", displayName: "Ngozi Eze" }, roles: ["ADMIN"] }], nextCursor: null });
      if (init?.method === "PUT") return json(422, { error: { code: "VALIDATION_FAILED", message: "You cannot remove your own admin role.", details: { fields: [{ path: "roles", message: "You cannot remove your own admin role." }] } } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminPeoplePage /></AdminFrame>);
    const u = userEvent.setup();
    const staff = await screen.findByRole("list", { name: "People with a role" });
    await u.click(within(staff).getByRole("listitem"));
    await u.click(screen.getByRole("checkbox", { name: /^Admin/ }));
    await u.type(screen.getByLabelText("Why"), "test");
    await u.click(screen.getByRole("button", { name: "Save roles" }));
    expect(await screen.findByText("You cannot remove your own admin role.")).toBeTruthy();
  });
});

describe("Weekly report: emotions and the poll by state", () => {
  const report = {
    id: "r1", topicId: "t1", weekNumber: 2, status: "DRAFT", draftedAt: "2026-11-05T17:00:00Z", pollClosedAt: null, publishAt: null, headline: "H", mood: "M", summary: "S", themes: [], sentiment: {}, pollSummary: {},
    quotes: [], basedOnVoices: 10, basedOnVotes: 5, languagesRead: ["English"], checks: [], cardTitle: null, editorNote: null,
    emotions: [{ name: "Angry", share: 50, change: 0 }, { name: "Tired", share: 33, change: 33 }],
    regions: [{ state: "Lagos", votes: 40, leading: "A stable naira", percent: 55 }],
  };
  it("draws the drafted emotions and states, and the edit form sends emotions with the edit", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: u, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/today")) return json(404, NOT_FOUND);
      if (method === "PATCH") return json(200, { ...report, emotions: JSON.parse(String(init?.body)).emotions });
      if (u.includes("/admin/weekly-reports")) return json(200, { items: [report], nextCursor: null });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminWeeklyPage /></AdminFrame>);
    const u = userEvent.setup();
    expect(await screen.findByText("Angry")).toBeTruthy();
    expect(screen.getByText("Lagos")).toBeTruthy();
    expect(screen.getByText(/55% A stable naira \(40 votes\)/)).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Edit draft" }));
    const share = screen.getAllByLabelText("Share (%)")[0];
    await u.clear(share);
    await u.type(share, "52");
    await u.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    await u.click(screen.getByRole("button", { name: "Add an emotion" }));
    await u.type(screen.getByLabelText("Emotion 2"), "Hopeful");
    await u.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    expect(calls.find((c) => c.method === "PATCH")!.body.emotions).toEqual([{ name: "Angry", share: 52, change: 0 }, { name: "Hopeful", share: 0, change: 0 }]);
  });
});

describe("Weekly report without emotions or regions, and with no change figure", () => {
  it("moodRows copes with a report that has no emotions, and a null change draws no figure", () => {
    expect(moodRows({} as never)).toEqual([]);
    expect(moodRows({ emotions: [{ name: "Angry", share: 50, change: null }, { name: "Tired", share: 30, change: -3 }] })).toEqual([
      { label: "Angry", pct: 50, delta: undefined },
      { label: "Tired", pct: 30, delta: -3 },
    ]);
  });
});

describe("What Next summary on the public page", () => {
  // the next-steps line exactly as the API's data draft writes it
  const base = { topicId: "t1", mainView: "paying on time", mainViewVoices: 20, opposingView: "saving first", opposingViewVoices: 10, pollLine: "“Pay on time” leads with 60% of 100 votes. The poll is still open.", nextStepsLine: "Most supported so far: Put the pay date in every offer letter", basedOnVoices: 40, basedOnVotes: 100, updatedAt: new Date().toISOString(), reviewedByEditor: true };
  it("prints the proposals count once, voices only from the counted fields, and the plain label", () => {
    const { container } = render(<Summary s={{ ...base, aiDrafted: false }} proposals={214} groups={38} />);
    const text = container.textContent ?? "";
    expect(text.match(/214 proposals/g)).toHaveLength(1);
    expect(text).toContain("20 voices");
    expect(text).toContain("10 voices");
    expect(text).toContain("Reviewed by an editor");
    expect(text).not.toContain("AI-assisted");
    expect(text).toContain("60% of 100 votes");
  });
  it("says AI-assisted when the summary was AI drafted", () => {
    const { container } = render(<Summary s={{ ...base, aiDrafted: true }} proposals={1} groups={0} />);
    expect(container.textContent).toContain("AI-assisted, reviewed by an editor");
  });
});
