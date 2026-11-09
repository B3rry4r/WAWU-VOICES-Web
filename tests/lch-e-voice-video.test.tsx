// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams("a=a1"),
}));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));
import { PostedScreen } from "@/features/talk/PostedScreen";

type Video = { id: string; answerId: string; shape: string; status: string; durationMs: number | null; url: string | null; createdAt: string; readyAt: string | null };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const base = { id: "a1", questionId: "q1", author: { id: "u1", handle: "me", displayName: "Me", state: null, avatarUrl: null }, kind: "VOICE", body: null, clip: { id: "c1", status: "READY", durationMs: 5000, peaks: [], url: null, transcript: null }, createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null };
let videos: Video[] = [];
let calls: string[] = [];
let makeStatus = 202;
const vid = (status: string): Video => ({ id: "v1", answerId: "a1", shape: "9x16", status, durationMs: 9000, url: status === "READY" ? "http://stand-in.test/api/v1/voice-videos/v1/file" : null, createdAt: new Date().toISOString(), readyAt: null });

function stub(answer: unknown = base) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    calls.push(`${init?.method ?? "GET"} ${u}`);
    if (u.endsWith("/answers/a1")) return json(answer);
    if (u.endsWith("/answers/a1/videos") && init?.method === "POST") {
      if (makeStatus === 429) return json({ error: { code: "RATE_LIMITED", message: "You can make 5 videos a day. Try again tomorrow." } }, 429);
      videos = [vid("QUEUED")];
      return json(videos[0], 202);
    }
    if (u.endsWith("/answers/a1/videos")) return json({ items: videos });
    if (u.endsWith("/voice-videos/v1/file")) return new Response(new Blob(["mp4"]), { status: 200 });
    if (u.includes("/me/allowance")) return json({ freePostsRemaining: 5 });
    if (u.endsWith("/share/links")) return json({ code: "c1", url: "x", cardStatus: "PENDING" });
    return new Response("{}", { status: 404 });
  }));
}
beforeEach(() => {
  videos = []; calls = []; makeStatus = 202;
  window.localStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  stub();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("LCH-07: Make a video on the share screen", () => {
  it("asks for nothing until the person taps, then shows Making your video and keeps the audio link", async () => {
    render(<PostedScreen qid="q1" />);
    const b = await screen.findByRole("button", { name: "Make a video" });
    expect(calls.some((c) => c.startsWith("POST") && c.includes("/videos"))).toBe(false);
    await userEvent.setup().click(b);
    await screen.findByText("Making your video");
    expect(calls.filter((c) => c.startsWith("POST") && c.includes("/videos")).length).toBe(1);
    expect(screen.getByText("Share to WhatsApp")).toBeTruthy();
  });

  it("shows Your video is ready with Share and Save, and saves the file with the person's sign-in", async () => {
    videos = [vid("READY")];
    render(<PostedScreen qid="q1" />);
    await screen.findByText("Your video is ready");
    await userEvent.setup().click(screen.getByRole("button", { name: "Save it" }));
    await waitFor(() => expect(calls.some((c) => c.endsWith("/voice-videos/v1/file"))).toBe(true));
  });

  it("a failed video says so and offers Try again", async () => {
    videos = [vid("FAILED")];
    render(<PostedScreen qid="q1" />);
    await screen.findByText("We could not make your video");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Making your video");
  });

  it("the daily limit shows the API's own words", async () => {
    makeStatus = 429;
    render(<PostedScreen qid="q1" />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Make a video" }));
    await screen.findByText("You can make 5 videos a day. Try again tomorrow.");
  });

  it("a text answer has no video panel", async () => {
    stub({ ...base, kind: "TEXT", clip: null, body: "Hello" });
    render(<PostedScreen qid="q1" />);
    await screen.findByText("Your voice is live");
    expect(screen.queryByRole("button", { name: "Make a video" })).toBeNull();
  });
});
