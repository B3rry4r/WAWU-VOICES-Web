// @vitest-environment jsdom
// WF-6b (A-L6): Close on the recorder, even while recording, replaces its history entry so Back never returns to the recorder.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpeakScreen } from "@/features/speak/SpeakScreen";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }), usePathname: () => "/q/q1/speak", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/audio-ref/recorder", () => ({
  VoiceRecorder: class {
    start() { return Promise.resolve(null); }
    result() { return new Promise(() => undefined); }
    stop() { /* a recording that never finishes in this test */ }
    cancel() { /* nothing to release */ }
  },
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const question = { id: "q1", text: "Q?", hint: null, status: "LIVE", category: null, topicTitle: null, voiceCount: 0, answerCount: 0, proposalCount: 0, recentVoices: [], iSaved: false, kind: "DAILY", scheduledFor: null, startsAt: null, endsAt: null, pinned: false, sensitive: false, hasOpenPoll: false, topicId: null, weekNumber: null };
const config = { currency: "NGN", freePosts: 10, unitBaseKobo: 1380, voiceFreeSeconds: 10, costs: { freeVoiceSeconds: 10, voicePostMilli: 1000, baseKoboPerUnit: 1380 }, tiers: [], extraVoice: [] };

beforeEach(() => {
  replace.mockClear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith("/questions/q1") ? json(question) : url.endsWith("/config/public") ? json(config) : json({ error: { code: "NOT_FOUND", message: "no" } }, 404))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("Close the recorder", () => {
  it("while idle it replaces the recorder in history with the question", async () => {
    render(<SpeakScreen questionId="q1" />);
    await screen.findByRole("button", { name: "Start recording" });
    await userEvent.click(screen.getByRole("button", { name: "Close the recorder" }));
    expect(replace).toHaveBeenCalledWith("/q/q1");
  });
  it("while recording it first steps back over the recorder's own history entry, then replaces", async () => {
    const before = window.history.length;
    render(<SpeakScreen questionId="q1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Start recording" }));
    await waitFor(() => expect(window.history.length).toBe(before + 1));
    await userEvent.click(screen.getByRole("button", { name: "Close the recorder" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/q/q1"));
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
