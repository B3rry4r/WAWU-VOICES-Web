// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { targetHref } from "@/features/notifications/NotificationsPage";
import { AudioAdCard } from "@/components/feed/AudioAdCard";
import { OverrideMessage } from "@/components/feed/OverrideMessage";

vi.mock("@/lib/api/polls", () => ({ recordAdEvent: () => Promise.resolve() }));
vi.mock("@/lib/api/profile", () => ({ getPlayUrl: () => Promise.resolve({ url: "https://x.test/a", expiresAt: "x", mime: "audio/mp4" }) }));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => false }));
afterEach(() => cleanup());

const Q = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const A = "33333333-3333-4333-8333-333333333333";

describe("V-FIX-B round 2: every new notice opens something (the API's real payloads)", () => {
  it("POLL_CLOSED: targetType poll, the poll's id, the question in questionId: opens that question's results", () => {
    expect(targetHref({ type: "POLL_CLOSED", targetType: "poll", targetId: P, questionId: Q })).toBe(`/q/${Q}/results`);
  });
  it("POLL_CLOSED with no question opens the weekly page instead of nothing", () => {
    expect(targetHref({ type: "POLL_CLOSED", targetType: "poll", targetId: P, questionId: null })).toBe("/weekly");
  });
  it("a tag notice (TAG_CHANGED) on an answer with no questionId opens the Newsroom post; with one it opens the thread as before; other types stay as they are", () => {
    expect(targetHref({ type: "TAG_CHANGED", targetType: "answer", targetId: A, questionId: null })).toBe(`/news/${A}`);
    expect(targetHref({ type: "TAG_CHANGED", targetType: "answer", targetId: A, questionId: Q })).toBe(`/q/${Q}/a/${A}`);
    expect(targetHref({ type: "REPLY", targetType: "answer", targetId: A, questionId: null })).toBeNull();
  });
  it("CATEGORY_ALERT: targetType question opens the question", () => {
    expect(targetHref({ type: "CATEGORY_ALERT", targetType: "question", targetId: Q, questionId: Q })).toBe(`/q/${Q}`);
  });
  it("TAG_FOLLOW: targetType answer opens the post in the Newsroom", () => {
    expect(targetHref({ type: "TAG_FOLLOW", targetType: "answer", targetId: A, questionId: Q })).toBe(`/news/${A}`);
  });
  it("the older types still open as they did", () => {
    expect(targetHref({ type: "REPLY", targetType: "answer", targetId: A, questionId: Q })).toBe(`/q/${Q}/a/${A}`);
    expect(targetHref({ type: "FLASH_POLL", targetType: "poll", targetId: P })).toBe("/");
  });
});

describe("V-FIX-B round 2: the advert's link and long words", () => {
  const ad = { id: "a1", kind: "AUDIO_SLOT" as const, brand: "Soup", label: "Ad" as const, headline: "x".repeat(100), body: null, imageUrl: null, audioClipId: Q, audioDurationMs: 9000, ctaLabel: "L".repeat(60) };
  it("draws a button only for an http or https address, in a new tab that cannot reach back", () => {
    render(<AudioAdCard ad={{ ...ad, linkUrl: "https://example.com/a" }} />);
    const a = screen.getByRole("link", { name: /L{60}/ });
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    cleanup();
    render(<AudioAdCard ad={{ ...ad, linkUrl: "javascript:alert(1)" }} />);
    expect(screen.queryByRole("link")).toBeNull();
    cleanup();
    render(<AudioAdCard ad={{ ...ad, linkUrl: "data:text/html,hi" }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("an override's long unbroken string is allowed to break", () => {
    render(<OverrideMessage o={{ contentKind: "TEXT", body: "y".repeat(200), audioUrl: null, imageUrl: null, linkUrl: null, endsAt: "2999-01-01T00:00:00Z" }} />);
    expect(screen.getByTestId("override-message").className).toContain("overflow-wrap:anywhere");
  });
});
