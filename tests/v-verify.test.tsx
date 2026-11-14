// @vitest-environment jsdom
// V-46: verification (the person's screen, the admin queue, the tick, the What Next gate) and the Blob body of the API client.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/verification",
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { VerifyScreen } from "@/features/verify/VerifyScreen";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminVerificationPage } from "@/features/admin/VerificationPage";
import { ADMIN_PAGES, canOpen } from "@/features/admin/roles";
import { WhatNextPage } from "@/features/vote/WhatNextPage";
import { answerCardProps } from "@/lib/feed-format";
import { AnswerCard, ProfileHeader } from "@/components/vx";
import { apiFetch } from "@/lib/api/client";
import { activeNav } from "@/components/shell/nav";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
type Call = { url: string; method: string; headers: Headers; body: unknown };
let calls: Call[] = [];
const signIn = () => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
beforeEach(() => {
  calls = [];
  push.mockReset();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const base = {
  state: "READY",
  verified: false,
  verifiedUntil: null,
  subscription: { planName: "VOICES CONNECT", endDay: "2027-02-14", endLabel: "14 Feb 2027" },
  canUpload: true,
  canSubmit: false,
  documents: { id: false, bill: false },
  request: null,
  lastDecision: null,
};
const withState = (o: Record<string, unknown>) => ({ ...base, ...o });

function stubVerify(get: () => unknown, extra?: (c: Call) => Response | undefined) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const c: Call = { url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body };
      calls.push(c);
      const hit = extra?.(c);
      if (hit) return hit;
      if (c.url.endsWith("/me/verification") && c.method === "GET") return json(200, get());
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }),
  );
}

describe("/verify, the person's screen", () => {
  it("not subscribed: says verification comes with a subscription, links to the plans, and shows no upload form", async () => {
    signIn();
    stubVerify(() => withState({ state: "NOT_SUBSCRIBED", subscription: null, canUpload: false }));
    render(<VerifyScreen />);
    expect(await screen.findByText("Verification comes with a subscription")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See the plans" }).getAttribute("href")).toBe("/units/buy#plans");
    expect(screen.queryByText("Send your documents")).toBeNull();
  });

  it("ready: two slots, the send button waits for both, the privacy line is there", async () => {
    signIn();
    let st = withState({});
    stubVerify(() => st);
    render(<VerifyScreen />);
    await screen.findByText("Send your documents");
    expect(screen.getByText(/deleted 90 days after the decision/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send for checking" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Your plan: VOICES CONNECT, until 14 Feb 2027.")).toBeTruthy();
    st = withState({ documents: { id: true, bill: true }, canSubmit: true });
  });

  it("uploads the file itself as the body (not JSON), then sends; the screen follows what the API answers", async () => {
    signIn();
    const answers: Record<string, unknown> = {
      "documents/id": withState({ documents: { id: true, bill: false } }),
      "documents/bill": withState({ documents: { id: true, bill: true }, canSubmit: true }),
      submit: withState({ state: "UNDER_REVIEW", canUpload: false, request: { id: "r1", status: "PENDING", submittedAt: "2026-11-14T10:00:00Z", decidedAt: null, reason: null } }),
    };
    stubVerify(() => withState({}), (c) => {
      const k = Object.keys(answers).find((x) => c.url.endsWith("/me/verification/" + x));
      return k ? json(200, answers[k]) : undefined;
    });
    render(<VerifyScreen />);
    await screen.findByText("Send your documents");
    const idFile = new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], "my-id.jpg", { type: "image/jpeg" });
    const billFile = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "bill.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Government ID: choose a file"), idFile);
    await waitFor(() => expect(screen.getByTestId("slot-id").textContent).toContain("Added"));
    await userEvent.upload(screen.getByLabelText("Utility bill: choose a file"), billFile);
    await waitFor(() => expect((screen.getByRole("button", { name: "Send for checking" }) as HTMLButtonElement).disabled).toBe(false));
    const up = calls.filter((c) => c.method === "PUT");
    expect(up.map((c) => c.url.split("/me/verification/")[1])).toEqual(["documents/id", "documents/bill"]);
    expect(up[0].body).toBe(idFile);
    expect(up[0].headers.get("Content-Type")).toBe("image/jpeg");
    expect(up[1].headers.get("Content-Type")).toBe("application/pdf");
    expect(up[0].headers.get("Authorization")).toBe("Bearer t");
    await userEvent.click(screen.getByRole("button", { name: "Send for checking" }));
    expect(await screen.findByText("Under review")).toBeTruthy();
    expect(screen.queryByText("Send your documents")).toBeNull();
  });

  it("a file over 10 MB is refused on the phone, with no call", async () => {
    signIn();
    stubVerify(() => withState({}));
    render(<VerifyScreen />);
    await screen.findByText("Send your documents");
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Government ID: choose a file"), { target: { files: [big] } });
    expect(await screen.findByText(/larger than 10 MB/)).toBeTruthy();
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("shows the API's own words when the upload is refused (no subscription)", async () => {
    signIn();
    stubVerify(() => withState({}), (c) => (c.method === "PUT" ? json(403, { error: { code: "subscription_required", message: "Subscribe to get verified." } }) : undefined));
    render(<VerifyScreen />);
    await screen.findByText("Send your documents");
    await userEvent.upload(screen.getByLabelText("Government ID: choose a file"), new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Subscribe to get verified.")).toBeTruthy();
  });

  it("verified: says until when, from the API's date, and keeps the form away", async () => {
    signIn();
    stubVerify(() => withState({ state: "VERIFIED", verified: true, verifiedUntil: "2027-02-13T23:00:00.000Z", canUpload: false }));
    render(<VerifyScreen />);
    expect(await screen.findByText("You are verified")).toBeTruthy();
    expect(screen.getByText(/until 14 Feb 2027, when your plan ends/)).toBeTruthy();
    expect(screen.queryByText("Send your documents")).toBeNull();
  });

  it("rejected: shows the admin's reason in plain words and the form to upload again", async () => {
    signIn();
    const reason = "Your ID has expired. Upload one that is still valid. It ran out in May.";
    stubVerify(() => withState({ state: "REJECTED", request: { id: "r1", status: "REJECTED", submittedAt: "x", decidedAt: "y", reason } }));
    render(<VerifyScreen />);
    expect(await screen.findByText("We could not approve your documents")).toBeTruthy();
    expect(screen.getByText(reason)).toBeTruthy();
    expect(screen.getByText("Send your documents")).toBeTruthy();
  });

  it("lapsed: explains that it ended with the subscription and lets the person send again", async () => {
    signIn();
    stubVerify(() => withState({ state: "LAPSED" }));
    render(<VerifyScreen />);
    expect(await screen.findByText("Your verification ended")).toBeTruthy();
    expect(screen.getByText("Send your documents")).toBeTruthy();
  });

  it("a guest is asked to sign in, and nothing is requested", async () => {
    stubVerify(() => withState({}));
    render(<VerifyScreen />);
    expect(await screen.findByText("Sign in to get verified")).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("keeps the Profile tab lit on /verify", () => {
    expect(activeNav("/verify")).toBe("profile");
  });
});

describe("the API client sends a file as the body itself", () => {
  it("a Blob keeps its own type and is not turned into JSON", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    stubVerify(() => ({}), () => json(200, { ok: true }));
    const f = new Blob(["abc"], { type: "image/png" });
    await apiFetch("/x", { method: "PUT", body: f, authed: true });
    expect(calls[0].body).toBe(f);
    expect(calls[0].headers.get("Content-Type")).toBe("image/png");
    await apiFetch("/y", { method: "POST", body: { a: 1 }, authed: true });
    expect(calls[1].body).toBe('{"a":1}');
    expect(calls[1].headers.get("Content-Type")).toBe("application/json");
  });
});

describe("admin: the Verification queue", () => {
  const me = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
  const item = (id: string, handle: string, over: Record<string, unknown> = {}) => ({
    id,
    status: "PENDING",
    submittedAt: new Date(Date.now() - 3_600_000).toISOString(),
    decidedAt: null,
    person: { id: "p" + id, handle, displayName: handle + " name" },
    subscription: { planName: "VOICES PLUS", endDay: "2027-05-10", endLabel: "10 May 2027" },
    decidedBy: null,
    reason: null,
    documentsDeleted: false,
    ...over,
  });
  const detail = (it: ReturnType<typeof item>) => ({ ...it, idDocument: { mime: "image/jpeg" }, billDocument: { mime: "application/pdf" } });
  const link = (kind: string) => ({ url: `https://signed.test/verification/${kind === "id" ? "a" : "b"}?exp=1`, mime: kind === "id" ? "image/jpeg" : "application/pdf", expiresAt: new Date(Date.now() + 300_000).toISOString() });
  function stubAdmin(roles: string[], items = [item("r1", "ada"), item("r2", "bola")], decide?: (c: Call) => Response | undefined) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const c: Call = { url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined };
        calls.push(c);
        if (c.url.endsWith("/me")) return json(200, me(roles));
        const d = decide?.(c);
        if (d) return d;
        const dm = c.url.match(/\/admin\/verification\/[^/?]+\/documents\/(id|bill)$/);
        if (dm) return json(200, link(dm[1]));
        const m = c.url.match(/\/admin\/verification\/([^/?]+)$/);
        if (m && c.method === "GET") return json(200, detail(items.find((i) => i.id === m[1]) ?? items[0]));
        if (c.url.includes("/admin/verification") && c.method === "GET") return json(200, { items, nextCursor: null });
        if (c.url.includes("/admin/today")) return json(200, null);
        return json(404, { error: { code: "NOT_FOUND", message: "no" } });
      }),
    );
  }
  const open = () => render(<AdminFrame><AdminVerificationPage /></AdminFrame>);

  it("only ADMIN has the page in the menu and can open it", async () => {
    expect(ADMIN_PAGES.some((p) => p.id === "verification" && p.href === "/admin/verification")).toBe(true);
    expect(canOpen(["ADMIN"], "verification")).toBe(true);
    for (const r of ["EDITOR", "MODERATOR", "AD_MANAGER"] as const) expect(canOpen([r], "verification")).toBe(false);
    signIn();
    stubAdmin(["MODERATOR"]);
    open();
    expect(await screen.findByText("We could not find that")).toBeTruthy();
    expect(calls.some((c) => c.url.includes("/admin/verification"))).toBe(false);
  });

  it("lists the waiting requests in the order given, with name, handle, plan and end date; opens the first with its two documents", async () => {
    signIn();
    stubAdmin(["ADMIN"]);
    open();
    const list = await screen.findByRole("list", { name: "Queue" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining("ada name"), expect.stringContaining("bola name")]);
    expect(rows[0].textContent).toContain("@ada");
    expect(rows[0].textContent).toContain("VOICES PLUS until 10 May 2027");
    expect(calls.find((c) => c.url.includes("/admin/verification?status=pending"))).toBeTruthy();
    const docs = await screen.findAllByTestId("doc");
    expect(docs).toHaveLength(2);
    // opening the page asked for no link: a document is opened on its own, by a tap
    expect(calls.some((c) => c.url.includes("/documents/"))).toBe(false);
    await userEvent.click(within(docs[0]).getByRole("button", { name: "Show the government id" }));
    await userEvent.click(within(docs[1]).getByRole("button", { name: "Show the utility bill" }));
    expect(calls.filter((c) => c.url.includes("/documents/")).map((c) => c.url.split("/documents/")[1])).toEqual(["id", "bill"]);
    expect((await within(docs[0]).findByRole("img", { name: "Government ID" })).getAttribute("src")).toBe("https://signed.test/verification/a?exp=1");
    expect((await within(docs[1]).findByRole("link", { name: "Open the PDF" })).getAttribute("href")).toBe("https://signed.test/verification/b?exp=1");
    expect(screen.getAllByText(/stops working after 5 minutes/).length).toBe(2);
  });

  it("Approve posts to the approve route and takes the row off the list", async () => {
    signIn();
    stubAdmin(["ADMIN"], undefined, (c) => (c.url.endsWith("/admin/verification/r1/approve") ? json(200, { id: "r1", status: "APPROVED", verifiedUntil: "2027-05-10T00:00:00Z" }) : undefined));
    open();
    await screen.findAllByTestId("doc");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText(/Approved\. The person is verified/)).toBeTruthy();
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/admin/verification/r1/approve"))).toBe(true);
    const list = screen.getByRole("list", { name: "Queue" });
    expect(within(list).queryByText(/ada name/)).toBeNull();
  });

  it("Reject needs a reason: nothing is sent until one is picked, and Something else needs words", async () => {
    signIn();
    stubAdmin(["ADMIN"], undefined, (c) => (c.url.endsWith("/admin/verification/r1/reject") ? json(200, { id: "r1", status: "REJECTED" }) : undefined));
    open();
    await screen.findAllByTestId("doc");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const go = () => screen.getByRole("button", { name: "Reject and tell them" }) as HTMLButtonElement;
    expect(go().disabled).toBe(true);
    await userEvent.click(screen.getByLabelText(/Something else/));
    expect(go().disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/Say why \(needed\)/), "The name is smudged.");
    expect(go().disabled).toBe(false);
    await userEvent.click(screen.getByLabelText(/ID expired/));
    expect(go().disabled).toBe(false);
    await userEvent.click(go());
    await screen.findByText(/Rejected\. The person has been emailed/);
    const post = calls.find((c) => c.method === "POST" && c.url.endsWith("/admin/verification/r1/reject"));
    expect(post?.body).toEqual({ reasonCode: "ID_EXPIRED", note: "The name is smudged." });
  });

  it("a second admin got there first: the 409 words show and the row stays", async () => {
    signIn();
    stubAdmin(["ADMIN"], undefined, (c) => (c.url.endsWith("/approve") ? json(409, { error: { code: "CONFLICT", message: "Another admin already decided this request. Reload the list." } }) : undefined));
    open();
    await screen.findAllByTestId("doc");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Another admin already decided this request. Reload the list.")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Queue" })).getByText(/ada name/)).toBeTruthy();
  });

  it("an empty queue says so", async () => {
    signIn();
    stubAdmin(["ADMIN"], []);
    open();
    expect(await screen.findByText("Nothing is waiting")).toBeTruthy();
  });
});

describe("what the person reads", () => {
  it("the reject choices carry the exact words the API sends the person", async () => {
    const { REASONS } = await import("@/features/admin/VerificationPage");
    expect(REASONS.map((r) => r.code)).toEqual(["ID_UNREADABLE", "ID_NOT_VALID", "ID_EXPIRED", "BILL_UNREADABLE", "BILL_TOO_OLD", "DETAILS_DO_NOT_MATCH", "SUBSCRIPTION_ENDED", "OTHER"]);
    for (const r of REASONS) expect(r.person).not.toMatch(/[\u2013\u2014]/);
  });
  it("an expired request tells the person it ran out and shows the form", async () => {
    signIn();
    stubVerify(() => withState({ state: "EXPIRED" }));
    render(<VerifyScreen />);
    expect(await screen.findByText("Your request ran out")).toBeTruthy();
    expect(screen.getByText("Send your documents")).toBeTruthy();
  });
  it("no screen promises DMs", async () => {
    signIn();
    for (const st of [withState({ state: "NOT_SUBSCRIBED", subscription: null }), withState({ state: "VERIFIED", verified: true, verifiedUntil: "2027-02-13T23:00:00.000Z" })]) {
      stubVerify(() => st);
      const { unmount } = render(<VerifyScreen />);
      await screen.findByRole("heading", { level: 2 });
      expect(document.body.textContent).not.toMatch(/\bDMs?\b|chat/i);
      unmount();
    }
  });
});

describe("the verified tick", () => {
  it("VerifiedTick draws only for a verified person", async () => {
    const { VerifiedTick } = await import("@/features/verify/VerifiedTick");
    const { unmount } = render(<VerifiedTick verified />);
    expect(screen.getByRole("img", { name: "Verified" })).toBeTruthy();
    unmount();
    render(<VerifiedTick verified={false} />);
    expect(screen.queryByRole("img", { name: "Verified" })).toBeNull();
  });
  it("shows beside the name on an answer, only for a verified author", () => {
    const a = (v: boolean) => ({ id: "a1", author: { id: "u", handle: "ada", displayName: "Ada", state: null, avatarUrl: null, verified: v }, createdAt: new Date().toISOString(), kind: "TEXT", body: "hi", clip: null, labels: [], likeCount: 0, replyCount: 0, reactionCount: 0, reactionBreakdown: [], iLiked: false, news: null }) as never;
    const props = (v: boolean) => answerCardProps(a(v));
    expect(props(true).author).toMatchObject({ handle: "@ada", verified: true });
    expect(props(false).author).toMatchObject({ verified: false });
    const { unmount } = render(<AnswerCard {...props(true)} />);
    expect(screen.getByRole("img", { name: "Verified" })).toBeTruthy();
    unmount();
    render(<AnswerCard {...props(false)} />);
    expect(screen.queryByRole("img", { name: "Verified" })).toBeNull();
  });

  it("shows beside the name on a profile", () => {
    render(<ProfileHeader name="Ada" handle="@ada" verified />);
    expect(screen.getByRole("img", { name: "Verified" })).toBeTruthy();
    cleanup();
    render(<ProfileHeader name="Ada" handle="@ada" />);
    expect(screen.queryByRole("img", { name: "Verified" })).toBeNull();
  });
});

describe("What Next: the suggest button", () => {
  const question = { id: "q1", status: "LIVE", text: "What should happen next?", topicTitle: "Prices", weekNumber: 2, proposalCount: 1, voiceCount: 1, voicesCount: 1, answerCount: 1, topicId: null };
  const wn = { question, summary: null, groups: [], proposals: [], proposalTotal: 0, groupTotal: 0, nextCursor: null };
  function stubWhatNext(verified: boolean) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/me/verification")) return json(200, withState({ state: verified ? "VERIFIED" : "NOT_SUBSCRIBED", verified, subscription: null }));
        if (u.includes("/what-next")) return json(200, wn);
        return json(404, { error: { code: "NOT_FOUND", message: "no" } });
      }),
    );
  }
  it("an unverified person who taps it sees the verification words and a link, and is not sent to a form that would fail", async () => {
    signIn();
    stubWhatNext(false);
    render(<WhatNextPage questionId="q1" />);
    const btns = await screen.findAllByRole("button", { name: "Propose a next step" });
    await userEvent.click(btns[0]);
    expect(await screen.findByText("Subscribe and get verified to suggest ideas.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Get verified" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Get verified" }));
    expect(push).toHaveBeenCalledWith("/verify");
    expect(push).not.toHaveBeenCalledWith("/q/q1/propose");
  });
  it("a verified person gets the link to the form", async () => {
    signIn();
    stubWhatNext(true);
    render(<WhatNextPage questionId="q1" />);
    const links = await screen.findAllByRole("link", { name: "Propose a next step" });
    expect(links[0].getAttribute("href")).toBe("/q/q1/propose");
  });
  it("a guest still gets the link (the form asks them to sign in)", async () => {
    stubWhatNext(false);
    render(<WhatNextPage questionId="q1" />);
    const links = await screen.findAllByRole("link", { name: "Propose a next step" });
    expect(links[0].getAttribute("href")).toBe("/q/q1/propose");
  });
});
