// @vitest-environment jsdom
// V-SHARE-CARD: /s/<code> for an open QUESTION link moves a person to its Speak screen (with from); every other link is as it was.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import type { SharePage } from "@/lib/api/reach";

const getSharePage = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); }, useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/api/forward-server", () => ({ requestForward: () => ({}) }));
vi.mock("@/lib/api/reach", async (orig) => ({ ...(await orig<object>()), getSharePage: (...a: unknown[]) => getSharePage(...a), getPollTitle: vi.fn().mockResolvedValue(null), getProfileVoices: vi.fn(), recordShareEvent: vi.fn().mockResolvedValue(undefined) }));

const WORDS_LINE = "Pick one word: Angry, Tired, Proud, Hopeful. Say it in your voice.";
const share = (over: Partial<SharePage> = {}, q: Record<string, unknown> | null = {}): SharePage => ({
  code: "AbC1234", objectType: "QUESTION", topicLine: "How do you feel about Nigeria right now?", countryAndTheme: "NIGERIA", arguments: [], leanLine: null, poll: null,
  proposalCount: null, topProposal: null, news: null, basedOnVoices: 4, summaryUpdatedAt: "2026-11-14T10:00:00Z", summaryLabel: "x", featuredVoice: null, transcript: null,
  question: q === null ? null : ({ id: "q9", status: "LIVE", text: "How do you feel about Nigeria right now?", moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"], voicesCount: 4, ...q } as never),
  report: null, cardFallback: false, ctaLabel: "Add your voice",
  openGraph: { title: "How do you feel about Nigeria right now?", description: WORDS_LINE, imageUrl: "https://api.example/share/AbC1234/card", url: "https://voices.example/s/AbC1234" },
  ...over,
}) as SharePage;

beforeEach(() => { replace.mockReset(); getSharePage.mockReset(); });
afterEach(cleanup);

describe("the share page for a QUESTION link", () => {
  it("an open question with word options moves the person to the pick screen with from, once, by replace", async () => {
    const { default: Page } = await import("@/app/s/[code]/page");
    getSharePage.mockResolvedValueOnce(share());
    render(await Page({ params: { code: "AbC1234" } }));
    expect(screen.getByTestId("share-move-on")).toBeTruthy();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/q/q9/mood?from=AbC1234"));
    expect(replace).toHaveBeenCalledTimes(1);
    // nothing of the share page itself is drawn while it moves: no flash of another screen
    expect(screen.queryByTestId("share-page")).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
  it("an open question without word options moves to its recorder with from", async () => {
    const { default: Page } = await import("@/app/s/[code]/page");
    getSharePage.mockResolvedValueOnce(share({}, { moodOptions: undefined }));
    render(await Page({ params: { code: "AbC1234" } }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/q/q9/speak?from=AbC1234"));
  });
  it.each([["closed", { status: "CLOSED" }], ["not yet open", { status: "SCHEDULED" }], ["a draft", { status: "DRAFT" }]])("a %s question keeps the share page and does not move", async (_n, q) => {
    const { default: Page } = await import("@/app/s/[code]/page");
    getSharePage.mockResolvedValueOnce(share({}, q));
    render(await Page({ params: { code: "AbC1234" } }));
    expect(screen.getByTestId("share-page")).toBeTruthy();
    expect(screen.queryByTestId("share-move-on")).toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(replace).not.toHaveBeenCalled();
  });
  it("a QUESTION link with no question inside keeps the share page", async () => {
    const { default: Page } = await import("@/app/s/[code]/page");
    getSharePage.mockResolvedValueOnce(share({}, null));
    render(await Page({ params: { code: "AbC1234" } }));
    expect(screen.getByTestId("share-page")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
  it.each(["ANSWER", "POLL_RESULT", "WEEKLY_REPORT", "PROFILE", "CATEGORY", "RESULT_THREAD", "WHAT_NEXT_SUMMARY"] as const)("a %s link keeps the share page", async (kind) => {
    const { default: Page } = await import("@/app/s/[code]/page");
    getSharePage.mockResolvedValueOnce(share({ objectType: kind, ...(kind === "PROFILE" ? { topicLine: "@ada on VOICES" } : {}) }));
    render(await Page({ params: { code: "AbC1234" } }));
    expect(screen.getByTestId("share-page")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    expect(replace).not.toHaveBeenCalled();
  });
  it("a missing link still asks for Next's 404", async () => {
    const { default: Page } = await import("@/app/s/[code]/page");
    getSharePage.mockRejectedValueOnce(new ApiError(404, "NOT_FOUND", "x", true));
    await expect(Page({ params: { code: "zzzzzzz" } })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(replace).not.toHaveBeenCalled();
  });
  it("a code that is not plain letters and digits is never put in an address", async () => {
    const { speakTarget } = await import("@/features/share/speak-target");
    expect(speakTarget(share({ code: "a/../b?x=1" }))).toBeNull();
    expect(speakTarget(share())).toBe("/q/q9/mood?from=AbC1234");
  });
});

describe("the metadata of a QUESTION link (server drawn on /s/<code>, whatever the person is moved to)", () => {
  it("title is the question, description is the API's own line, the card is 1200 x 630, large summary card", async () => {
    const { generateMetadata } = await import("@/app/s/[code]/page");
    getSharePage.mockResolvedValueOnce(share({ openGraph: { title: "A shorter title", description: WORDS_LINE, imageUrl: "https://api.example/share/AbC1234/card", url: "https://voices.example/s/AbC1234" } }));
    const m = await generateMetadata({ params: { code: "AbC1234" } });
    const q = "How do you feel about Nigeria right now?";
    expect(m.title).toBe(q);
    expect(m.description).toBe(WORDS_LINE);
    expect(m.openGraph).toMatchObject({ title: q, description: WORDS_LINE, url: "https://voices.example/s/AbC1234", images: [{ url: "https://api.example/share/AbC1234/card", width: 1200, height: 630 }] });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: q, description: WORDS_LINE, images: ["https://api.example/share/AbC1234/card"] });
  });
  it("a changed description from the API is passed on as it is (never typed here)", async () => {
    const { generateMetadata } = await import("@/app/s/[code]/page");
    getSharePage.mockResolvedValueOnce(share({ openGraph: { title: "t", description: "Some other words", imageUrl: "https://api.example/c", url: "https://voices.example/s/AbC1234" } }));
    const m = await generateMetadata({ params: { code: "AbC1234" } });
    expect(m.description).toBe("Some other words");
    expect(m.openGraph?.description).toBe("Some other words");
  });
  it("an ANSWER link keeps the API's own title", async () => {
    const { generateMetadata } = await import("@/app/s/[code]/page");
    getSharePage.mockResolvedValueOnce(share({ objectType: "ANSWER", openGraph: { title: "A voice on VOICES", description: "d", imageUrl: "https://api.example/c", url: "https://voices.example/s/AbC1234" } }));
    const m = await generateMetadata({ params: { code: "AbC1234" } });
    expect(m.title).toBe("A voice on VOICES");
  });
});
