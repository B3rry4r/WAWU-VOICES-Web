// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { WriteScreen } from "@/features/talk/WriteScreen";
import { saveTyped, typedDraft } from "@/features/talk/lib";
import { getDraft, markPosted, saveDraft, setAwaiting } from "@/features/units/draft";
import { postDraftForPurchase } from "@/features/units/post-draft";
import { ApiError, NetworkError } from "@/lib/api/client";

const tokenFor = (sub: string) => "x." + btoa(JSON.stringify({ sub })).replace(/=+$/, "") + ".y";
const as = (sub: string) => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: tokenFor(sub), refreshToken: "r" }));
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const question = { id: "q1", status: "LIVE", kind: "DAILY", text: "How do you feel?", hint: null, category: null, recentVoices: [], voiceCount: 1, answerCount: 1, proposalCount: 0, hasOpenPoll: false, iSaved: false };
const allowance = { freePostsRemaining: 0, balanceMilli: 100000, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, extraVoiceTokens: [],
  costs: { textPostMilli: 5000, voicePostMilli: 78000, baseKoboPerUnit: 100, textMaxChars: 5000, textPriceChars: 150, freePostTextChars: 500, messagesPerDay: 20, textFixMilli: 5000, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60, freeVoiceSeconds: 10 } };

const WORDS = "My honest answer";
/** A person (A) who typed words, ran out of posts, and tapped Get tokens: the draft is held and waiting. */
function hold(person = "A", qid = "q1", words = WORDS) {
  saveTyped(`q:${qid}`, words, person);
  saveDraft(qid, words, Date.now(), person);
  setAwaiting(qid, true, person);
}
const ok = () => vi.fn(async (): Promise<{ answer?: { id: string } }> => ({}));
async function writeBox(qid = "q1") {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).endsWith(`/questions/${qid}`) ? json({ ...question, id: qid }) : String(url).endsWith("/me/allowance") ? json(allowance) : new Response("{}", { status: 404 }))));
  render(<WriteScreen qid={qid} />);
  return (await screen.findByRole("textbox")) as HTMLTextAreaElement;
}

beforeEach(() => { window.localStorage.clear(); as("A"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("a held post that posted leaves nothing in the write box", () => {
  it("1. posted on payment done: the typed words are gone and the write screen opens empty", async () => {
    hold();
    expect(await postDraftForPurchase("q1", "pay-1", { post: ok() })).toEqual({ status: "posted", questionId: "q1" });
    expect(typedDraft("q:q1", "A")).toBe("");
    expect((await writeBox()).value).toBe("");
  });

  it("2. a refusal keeps the draft and the typed words", async () => {
    hold();
    const post = vi.fn(async (): Promise<{ answer?: { id: string } }> => { throw new ApiError(422, "VALIDATION", "Too long", true); });
    expect(await postDraftForPurchase("q1", "pay-1", { post })).toMatchObject({ status: "kept" });
    expect(typedDraft("q:q1", "A")).toBe(WORDS);
    expect(getDraft("q1", "A")?.body).toBe(WORDS);
    expect((await writeBox()).value).toBe(WORDS);
  });

  it("3. a lost connection keeps the words, then the retry posts and the words go", async () => {
    hold();
    const lost = vi.fn(async (): Promise<{ answer?: { id: string } }> => { throw new NetworkError("offline"); });
    expect(await postDraftForPurchase("q1", "pay-1", { post: lost })).toEqual({ status: "retry", questionId: "q1" });
    expect(typedDraft("q:q1", "A")).toBe(WORDS);
    const post = ok();
    expect(await postDraftForPurchase("q1", "pay-1", { post })).toEqual({ status: "posted", questionId: "q1" });
    expect(post).toHaveBeenCalledTimes(1);
    expect(typedDraft("q:q1", "A")).toBe("");
  });

  it("4. another question's words and another person's words are untouched", async () => {
    hold();
    saveTyped("q:q2", "Other question", "A");
    const v2 = JSON.parse(window.localStorage.getItem("voices-typing-v2") ?? "{}");
    v2.B = { "q:q1": { t: "B's words", at: Date.now() } }; // B's table, written while B was signed in
    window.localStorage.setItem("voices-typing-v2", JSON.stringify(v2));
    window.localStorage.setItem("voices-typing-drafts", JSON.stringify({ "q:q1": "Guest words" }));
    await postDraftForPurchase("q1", "pay-1", { post: ok() });
    const after = JSON.parse(window.localStorage.getItem("voices-typing-v2") ?? "{}") as Record<string, Record<string, { t: string }>>;
    expect(after.A["q:q1"]).toBeUndefined();
    expect(after.A["q:q2"].t).toBe("Other question");
    expect(after.B["q:q1"].t).toBe("B's words");
    expect(window.localStorage.getItem("voices-typing-drafts")).toContain("Guest words");
  });

  it("5. the other tab posted first: this tab clears its words too", async () => {
    hold();
    // The other tab recorded the post. Its record is shared; this tab still has the words in its own view of the box.
    markPosted("q1", "pay-1", "A");
    saveTyped("q:q1", WORDS, "A"); // words written back by this tab before it learned of the post
    const post = ok();
    expect(await postDraftForPurchase("q1", "pay-1", { post })).toEqual({ status: "posted", questionId: "q1" });
    expect(post).not.toHaveBeenCalled();
    expect(typedDraft("q:q1", "A")).toBe("");
    expect((await writeBox()).value).toBe("");
  });

  it("5b. a full page load with no draft id still clears, through the payment's record", async () => {
    hold();
    markPosted("q1", "pay-1", "A");
    saveTyped("q:q1", WORDS, "A");
    expect(await postDraftForPurchase(undefined, "pay-1", { post: ok() })).toEqual({ status: "posted", questionId: "q1" });
    expect(typedDraft("q:q1", "A")).toBe("");
  });

  it("newer words typed after the post are kept", async () => {
    hold();
    markPosted("q1", "pay-1", "A");
    saveTyped("q:q1", "Something new", "A");
    await postDraftForPurchase("q1", "pay-1", { post: ok() });
    expect(typedDraft("q:q1", "A")).toBe("Something new");
  });
});
