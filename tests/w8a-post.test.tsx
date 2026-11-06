// @vitest-environment jsdom
vi.mock("@/features/news/served", () => ({ SERVED: { likes: true, reactions: true, replies: true, clipPlay: true, photoUpload: true, tagFollows: true, me: true } }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { PostResultPage } from "@/features/results/PostResultPage";
import { hidesTabBar } from "@/components/shell/nav";

type Call = { url: string; method: string; headers: Headers; body: unknown };
let calls: Call[];
let puts: { url: string; type: string | undefined; size: number }[];
let postStatus = 201;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  calls = [];
  puts = [];
  postStatus = 201;
  push.mockReset();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    calls.push({ url, method: init.method ?? "GET", headers, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith("/me")) return json(200, { handle: "ada.okafor" });
    if (url.includes("/result-threads/t1") && !url.includes("/posts")) return json(200, { id: "t1", title: "T", subtitle: null, heldOn: "2027-01-16", status: "OPEN", postCount: 0, verifiedCount: 0, toCheck: 0 });
    if (url.endsWith("/uploads")) return json(201, { fileId: "11111111-1111-4111-8111-111111111111", putUrl: "https://spaces.test/put", putHeaders: { "x-amz-acl": "private" }, expiresAt: "2027-01-01T00:00:00Z" });
    if (url.endsWith("/complete")) return json(200, { fileId: "11111111-1111-4111-8111-111111111111", kind: "RESULT_PHOTO", confirmedAt: "2027-01-01T00:00:00Z" });
    if (url.endsWith("/posts")) return postStatus === 201 ? json(201, { id: "p" }) : json(409, { error: { code: "CONFLICT", message: "This results thread is closed. You can no longer post numbers.", details: { reason: "THREAD_CLOSED" } } });
    return json(404, {});
  }));
  class FakeXHR {
    status = 200; onload: (() => void) | null = null; onerror: (() => void) | null = null; url = ""; type: string | undefined;
    open(_m: string, url: string) { this.url = url; }
    setRequestHeader(k: string, v: string) { if (k.toLowerCase() === "content-type") this.type = v; }
    send(b: Blob) { puts.push({ url: this.url, type: this.type, size: b.size }); queueMicrotask(() => this.onload?.()); }
  }
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

async function fillAll(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("State"), "Lagos");
  await user.type(screen.getByLabelText("Local government"), "Lagos Mainland");
  await user.type(screen.getByLabelText("Ward"), "Ward 6");
  await user.type(screen.getByLabelText("Polling unit"), "PU 009");
  await user.type(screen.getByLabelText("Accredited"), "488");
  await user.type(screen.getByLabelText("Votes cast"), "471");
  await user.type(screen.getByLabelText("Rejected"), "5");
}

describe("PostResultPage", () => {
  it("shows a message under each empty field and posts nothing", async () => {
    const user = userEvent.setup();
    render(<PostResultPage threadId="t1" />);
    await user.click(await screen.findByRole("button", { name: "Post these numbers" }));
    expect(await screen.findByText("Add the state.")).toBeTruthy();
    expect(screen.getAllByText("Add the number.")).toHaveLength(3);
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/posts"))).toBe(false);
  });

  it("posts the totals with an Idempotency-Key and no photo, then goes back to the thread", async () => {
    const user = userEvent.setup();
    render(<PostResultPage threadId="t1" />);
    await fillAll(user);
    await user.click(screen.getByRole("button", { name: "Post these numbers" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/live/t1?posted=1"));
    const post = calls.find((c) => c.method === "POST" && c.url.endsWith("/posts"));
    expect(post?.body).toEqual({ state: "Lagos", lga: "Lagos Mainland", ward: "Ward 6", pollingUnit: "PU 009", accredited: 488, votesCast: 471, rejected: 5 });
    expect(post?.headers.get("Idempotency-Key")).toBeTruthy();
    expect(post?.headers.get("Authorization")).toBe("Bearer tok");
    expect(calls.some((c) => c.url.endsWith("/uploads"))).toBe(false);
  });

  it("refuses a PDF and an oversize photo, accepts a JPEG and uploads it before posting", async () => {
    const user = userEvent.setup();
    render(<PostResultPage threadId="t1" />);
    const input = screen.getByTestId("photo-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "sheet.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("Use a JPEG, PNG or WebP photo.")).toBeTruthy();
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText("That photo is too large. Use one under 10 MB.")).toBeTruthy();
    fireEvent.change(input, { target: { files: [new File(["abc"], "sheet.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByText("sheet.jpg")).toBeTruthy();
    await fillAll(user);
    await user.click(screen.getByRole("button", { name: "Post these numbers" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const upload = calls.find((c) => c.url.endsWith("/uploads"));
    expect(upload?.body).toEqual({ kind: "RESULT_PHOTO", mime: "image/jpeg", sizeBytes: 3 });
    expect(puts).toEqual([{ url: "https://spaces.test/put", type: "image/jpeg", size: 3 }]);
    expect(calls.some((c) => c.url.endsWith("/uploads/11111111-1111-4111-8111-111111111111/complete"))).toBe(true);
    const post = calls.find((c) => c.method === "POST" && c.url.endsWith("/posts"));
    expect((post?.body as { photoFileId?: string }).photoFileId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("shows the closed state when the thread closes while the form is open", async () => {
    postStatus = 409;
    const user = userEvent.setup();
    render(<PostResultPage threadId="t1" />);
    await fillAll(user);
    await user.click(screen.getByRole("button", { name: "Post these numbers" }));
    expect(await screen.findByText("This results thread is closed")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves the phone tab bar to the shell: the page injects no style, and the shell lists the route as full-screen", async () => {
    render(<PostResultPage threadId="t1" />);
    await screen.findByRole("button", { name: "Post these numbers" });
    expect(document.querySelector("style")).toBeNull();
    expect(hidesTabBar("/live/t1/post")).toBe(true);
    expect(hidesTabBar("/live/t1")).toBe(false);
  });

  it("asks a guest to sign in and shows no form", async () => {
    window.localStorage.clear();
    render(<PostResultPage threadId="t1" />);
    expect(await screen.findByText("Sign in to post the numbers you see")).toBeTruthy();
    expect(screen.queryByLabelText("State")).toBeNull();
  });
});
