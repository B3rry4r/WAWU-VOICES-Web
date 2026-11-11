// @vitest-environment jsdom
// Bundle K (V-42): the question pool page, and "Add a question" inside a week of the calendar.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminPoolPage } from "@/features/admin/PoolPage";
import { AdminCalendarPage } from "@/features/admin/CalendarPage";
import { ADMIN_PAGES, canOpen } from "@/features/admin/roles";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/pool" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
const NOT_FOUND = { error: { code: "NOT_FOUND", message: "no" } };

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

type Q = { id: string; kind: string; slotIndex: number | null; day: string | null; text: string; hint: null; status: string; pinned: boolean; isSpare: boolean; categoryId: string | null; voiceCount: number };
const mkQ = (id: string, text: string, kind = "DAILY"): Q => ({ id, kind, slotIndex: null, day: null, text, hint: null, status: "DRAFT", pinned: false, isSpare: false, categoryId: null, voiceCount: 0 });

/** A small stand-in for the pool routes, kept in memory. TAKEN_DAY already has a question. */
function pool(initial: Q[] = [], calls: { url: string; method: string; body: any }[] = []) {
  let rows = [...initial];
  let n = 100;
  const TAKEN_DAY = "2026-11-19";
  const fetcher = vi.fn(async (u: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: u, method, body });
    if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
    if (u.includes("/categories")) return json(200, { items: [{ id: "c1", slug: "money", name: "Money", voicesThisWeek: 0 }] });
    if (u.includes("/admin/today")) return json(404, NOT_FOUND);
    if (u.includes("/admin/questions/bulk")) {
      const items = (body.lines as string[]).map((l, i) => ({ l: l.trim(), line: i + 1 })).filter((x) => x.l).map((x) => {
        if (x.l.length < 3) return { line: x.line, text: x.l, question: null, error: "Too short. Use at least 3 characters." };
        const q = mkQ(`q${n++}`, x.l, body.kind);
        rows = [q, ...rows];
        return { line: x.line, text: x.l, question: q, error: null };
      });
      return json(200, { created: items.filter((i) => !i.error).length, refused: items.filter((i) => i.error).length, items });
    }
    if (u.includes("/schedule")) {
      const id = u.split("/questions/")[1].split("/")[0];
      if (body.day === TAKEN_DAY && !body.replace) return json(409, { error: { code: "DAY_TAKEN", message: "That day already has a question.", details: { question: mkQ("old", "The question already on that day") } } });
      if (body.day === "2030-01-01") return json(422, { error: { code: "VALIDATION_FAILED", message: "Some details need fixing.", details: { fields: [{ path: "day", message: "There is no week on that day. Add the week in the calendar first." }] } } });
      rows = rows.filter((r) => r.id !== id);
      return json(200, { question: { ...mkQ(id, "x"), day: body.day }, swappedWith: body.replace ? mkQ("old", "The question already on that day") : null });
    }
    if (u.includes("/admin/polls")) return json(201, { id: "p1" });
    if (u.match(/\/admin\/questions\/[^/?]+$/) && method === "PATCH") {
      const id = u.split("/").pop()!;
      if (body.status === "CLOSED") rows = rows.filter((r) => r.id !== id);
      else rows = rows.map((r) => (r.id === id ? { ...r, text: body.text, kind: body.kind } : r));
      return json(200, {});
    }
    if (u.includes("/admin/questions?")) return json(200, { items: rows, nextCursor: null, total: rows.length });
    return json(404, NOT_FOUND);
  });
  return fetcher;
}

describe("the nav", () => {
  it("lists Question pool for an editor and an admin, not for a moderator", () => {
    expect(ADMIN_PAGES.some((p) => p.id === "pool" && p.label === "Question pool" && p.href === "/admin/pool")).toBe(true);
    expect(canOpen(["EDITOR"], "pool")).toBe(true);
    expect(canOpen(["ADMIN"], "pool")).toBe(true);
    expect(canOpen(["MODERATOR"], "pool")).toBe(false);
    expect(canOpen(["AD_MANAGER"], "pool")).toBe(false);
  });
});

describe("K4: the Question pool page", () => {
  it("an editor adds 10 questions in one box and puts 2 on days (one free, one taken after a confirm)", async () => {
    const calls: { url: string; method: string; body: any }[] = [];
    vi.stubGlobal("fetch", pool([], calls));
    render(<AdminFrame><AdminPoolPage /></AdminFrame>);
    const u = userEvent.setup();
    expect(await screen.findByText("The pool is empty")).toBeTruthy();
    const ten = Array.from({ length: 10 }, (_, i) => `Pool question number ${i + 1}?`).join("\n");
    fireEvent.change(screen.getByLabelText("Questions"), { target: { value: ten } });
    expect(screen.getByText("10 questions ready to add")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Add to the pool" }));
    expect(await screen.findByText("10 questions added to the pool.")).toBeTruthy();
    const bulk = calls.find((c) => c.url.includes("/questions/bulk"))!;
    expect(bulk.body.kind).toBe("DAILY");
    expect(bulk.body.lines).toHaveLength(10);
    const list = await screen.findByRole("list", { name: "Questions in the pool" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);

    // a free day: at once
    const first = within(list).getAllByRole("listitem")[0];
    await u.click(within(first).getByRole("button", { name: "Put on a day" }));
    fireEvent.change(within(first).getByLabelText("Day"), { target: { value: "2026-11-20" } });
    await u.click(within(first).getByRole("button", { name: "Put on this day" }));
    expect(await screen.findByText("Question put on Fri 20.")).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Questions in the pool" })).getAllByRole("listitem")).toHaveLength(9));

    // a taken day: asks first, swaps only after the confirm
    const second = within(screen.getByRole("list", { name: "Questions in the pool" })).getAllByRole("listitem")[0];
    await u.click(within(second).getByRole("button", { name: "Put on a day" }));
    fireEvent.change(within(second).getByLabelText("Day"), { target: { value: "2026-11-19" } });
    await u.click(within(second).getByRole("button", { name: "Put on this day" }));
    expect(await within(second).findByText('That day already has "The question already on that day".')).toBeTruthy();
    expect(calls.filter((c) => c.url.includes("/schedule")).map((c) => c.body.replace)).toEqual([undefined, undefined]);
    await u.click(within(second).getByRole("button", { name: "Swap" }));
    expect(await screen.findByText(/Question put on Thu 19\. The question that was there is back in the pool\./)).toBeTruthy();
    expect(calls.filter((c) => c.url.includes("/schedule")).pop()!.body).toEqual({ day: "2026-11-19", replace: true });
  });

  it("names a refused line, keeps it in the box, and says no-week in the API's own words", async () => {
    vi.stubGlobal("fetch", pool([mkQ("a", "Waiting question")]));
    render(<AdminFrame><AdminPoolPage /></AdminFrame>);
    const u = userEvent.setup();
    await screen.findByText("Waiting question");
    fireEvent.change(screen.getByLabelText("Questions"), { target: { value: "A good question here?\nab\nAnother good one?" } });
    await u.click(screen.getByRole("button", { name: "Add to the pool" }));
    expect(await screen.findByText("Line 2: Too short. Use at least 3 characters.")).toBeTruthy();
    expect(screen.getByText("2 questions added to the pool.")).toBeTruthy();
    expect((screen.getByLabelText("Questions") as HTMLTextAreaElement).value).toBe("ab");
    const row = screen.getAllByRole("listitem").find((li) => within(li).queryByText("Waiting question"))!;
    await u.click(within(row).getByRole("button", { name: "Put on a day" }));
    fireEvent.change(within(row).getByLabelText("Day"), { target: { value: "2030-01-01" } });
    await u.click(within(row).getByRole("button", { name: "Put on this day" }));
    expect(await within(row).findByText("There is no week on that day. Add the week in the calendar first.")).toBeTruthy();
  });

  it("refuses more than 50 lines before sending anything", async () => {
    const f = pool([]);
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><AdminPoolPage /></AdminFrame>);
    await screen.findByText("The pool is empty");
    fireEvent.change(screen.getByLabelText("Questions"), { target: { value: Array.from({ length: 51 }, (_, i) => `Question ${i + 1} here`).join("\n") } });
    expect(screen.getByText("That is 51 lines. Add 50 or fewer.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add to the pool" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("edit changes the text; remove asks first and closes the question; a Flash one starts now with no week", async () => {
    const calls: { url: string; method: string; body: any }[] = [];
    vi.stubGlobal("fetch", pool([mkQ("d", "A daily one"), mkQ("f", "A flash one", "FLASH")], calls));
    render(<AdminFrame><AdminPoolPage /></AdminFrame>);
    const u = userEvent.setup();
    const daily = (await screen.findByText("A daily one")).closest("li")!;
    const flash = screen.getByText("A flash one").closest("li")!;
    // the right button for each kind
    expect(within(daily).queryByRole("button", { name: "Start now" })).toBeNull();
    expect(within(flash).queryByRole("button", { name: "Put on a day" })).toBeNull();

    await u.click(within(daily).getByRole("button", { name: /Edit question/ }));
    const box = within(daily).getByLabelText("Question");
    fireEvent.change(box, { target: { value: "A daily one, reworded" } });
    await u.click(within(daily).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Question saved.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ kind: "DAILY", text: "A daily one, reworded" });

    await u.click(within(flash).getByRole("button", { name: "Start now" }));
    await u.click(within(flash).getByRole("group", { name: "Start flash poll" }).querySelector("button")!);
    expect(await screen.findByText("Flash poll started.")).toBeTruthy();
    const poll = calls.find((c) => c.url.includes("/admin/polls"))!;
    expect(poll.body).toMatchObject({ kind: "FLASH", questionId: "f", choiceMode: "SINGLE" });
    expect(poll.body.topicId).toBeUndefined();

    const again = (await screen.findByText("A daily one, reworded")).closest("li")!;
    await u.click(within(again).getByRole("button", { name: /Remove question/ }));
    expect(within(again).getByText("Remove this question from the pool? It will not be asked.")).toBeTruthy();
    await u.click(within(again).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Question removed from the pool.")).toBeTruthy();
    expect(calls.filter((c) => c.method === "PATCH").pop()!.body).toMatchObject({ status: "CLOSED" });
  });

  it("a moderator does not get the page", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.endsWith("/me") ? json(200, me(["MODERATOR"])) : json(404, NOT_FOUND))));
    render(<AdminFrame><AdminPoolPage /></AdminFrame>);
    expect(await screen.findByText("We could not find that")).toBeTruthy();
    expect(screen.queryByText("Add questions")).toBeNull();
  });
});

describe("K5: Add a question in a week of the calendar", () => {
  it("adds a spare to that week and the week shows one more", async () => {
    const calls: { url: string; method: string; body: any }[] = [];
    let spares: Q[] = [{ ...mkQ("s1", "First spare"), isSpare: true }];
    const week = () => ({
      topic: { id: "t1", weekNumber: 5, title: "Money talk", blurb: null, countryCode: "NG", startsOn: "2026-11-12", endsOn: "2026-11-18", status: "SCHEDULED", sensitive: false, whatNextPrompt: null, questionCount: 8, voiceCount: 0, id2: 1 },
      questions: [{ ...mkQ("d1", "Day one question"), day: "2026-11-12", slotIndex: 1, status: "SCHEDULED" }],
      spare: spares,
      poll: null,
    });
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: u, method, body });
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/today")) return json(404, NOT_FOUND);
      if (u.endsWith("/admin/questions") && method === "POST") {
        spares = [...spares, { ...mkQ("s2", body.text), isSpare: true }];
        return json(201, spares[spares.length - 1]);
      }
      if (u.includes("/admin/topics/t1")) return json(200, week());
      if (u.includes("/admin/topics")) return json(200, { items: [{ weekNumber: 5, topicId: "t1", title: "Money talk", startsOn: "2026-11-12", status: "SCHEDULED" }], nextCursor: null, counts: { live: 0, scheduled: 1, inReview: 0, draft: 0, sensitive: 0 }, totals: { weeks: 1, questions: 8 } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminCalendarPage /></AdminFrame>);
    const u = userEvent.setup();
    expect(await screen.findByText("1 more question held for follow-ups and flash polls")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Add a question" }));
    fireEvent.change(screen.getByLabelText("New spare question"), { target: { value: "A brand new spare question?" } });
    await u.click(screen.getByRole("button", { name: "Add question" }));
    expect(await screen.findByText("2 more questions held for follow-ups and flash polls")).toBeTruthy();
    expect(screen.getByText("Question added to the week as a spare.")).toBeTruthy();
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toEqual({ topicId: "t1", kind: "DAILY", isSpare: true, text: "A brand new spare question?" });
  });
});
