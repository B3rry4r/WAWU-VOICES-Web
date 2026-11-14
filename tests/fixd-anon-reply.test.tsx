// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const talk = vi.hoisted(() => ({ createReply: vi.fn(), createVoiceReply: vi.fn() }));
vi.mock("@/lib/api/talk", async (orig) => ({ ...(await orig<typeof import("@/lib/api/talk")>()), createReply: (...a: unknown[]) => talk.createReply(...a), createVoiceReply: (...a: unknown[]) => talk.createVoiceReply(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/" }));

const speak = vi.hoisted(() => ({ createVoiceClip: vi.fn(), completeVoiceClip: vi.fn(), getVoiceClip: vi.fn(), deleteVoiceClip: vi.fn() }));
vi.mock("@/lib/api/speak", async (orig) => ({ ...(await orig<typeof import("@/lib/api/speak")>()), ...Object.fromEntries(Object.entries(speak).map(([k, f]) => [k, (...a: unknown[]) => (f as (...x: unknown[]) => unknown)(...a)])) }));
vi.mock("@/lib/audio-ref/upload", () => ({ putWithRetry: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/audio-ref/recorder", () => {
  class VoiceRecorder {
    private done?: (r: unknown) => void;
    private p = new Promise((res) => { this.done = res; });
    start() { return Promise.resolve(null); }
    result() { return this.p; }
    stop() { this.done?.({ blob: new Blob(["v"], { type: "audio/webm" }), mime: "audio/webm", seconds: 5, realSeconds: 5, stoppedBy: "user", overLimit: false }); }
    cancel() { /* nothing held */ }
  }
  return { VoiceRecorder };
});

import { ReplyComposer } from "@/features/talk/ReplyComposer";
import { VoiceBox } from "@/features/speak/VoiceBox";
import { readAnonPref } from "@/lib/anon-pref";
import { ReplyRow } from "@/features/profile/PostRow";
import type { Reply } from "@/lib/api/talk";

const allow = {
  freePostsRemaining: 5, messagesLeftToday: 20, balanceMilli: 0, extraVoiceTokens: [],
  costs: { textMaxChars: 1000, textPostMilli: 5000, textPriceChars: 150, freePostTextChars: 500, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, freeVoiceSeconds: 10 },
} as never;

beforeEach(() => {
  window.HTMLMediaElement.prototype.pause = () => undefined;
  window.sessionStorage.clear();
  window.localStorage.clear();
  talk.createReply.mockReset().mockResolvedValue({});
  talk.createVoiceReply.mockReset();
});
afterEach(cleanup);

async function typeAndPick(text: string) {
  await userEvent.click(screen.getByRole("button", { name: /I agree/ }));
  await userEvent.type(screen.getByRole("textbox"), text);
}
const post = () => screen.getByRole("button", { name: /^(Post|Reply|Send)/ });

describe("V-FIX-D: Post without my name on a text reply", () => {
  it("is off by default, and a named reply sends no anonymous flag", async () => {
    render(<ReplyComposer aid="a1" qid="q1" who="@tunde.a" allow={allow} onPosted={() => {}} onBuy={() => {}} />);
    expect(screen.getByRole("switch", { name: "Post without my name" }) as HTMLInputElement).toHaveProperty("checked", false);
    await typeAndPick("Agreed, every month");
    await userEvent.click(post());
    await waitFor(() => expect(talk.createReply).toHaveBeenCalledTimes(1));
    expect(talk.createReply.mock.calls[0].slice(0, 3)).toEqual(["a1", "AGREE", "Agreed, every month"]);
    expect(talk.createReply.mock.calls[0][4]).toBe(false);
  });

  it("switched on, the reply goes out with anonymous true, and the choice is forgotten after it posts", async () => {
    render(<ReplyComposer aid="a1" qid="q1" who="@tunde.a" allow={allow} onPosted={() => {}} onBuy={() => {}} />);
    await typeAndPick("Quietly agreed");
    await userEvent.click(screen.getByRole("switch", { name: "Post without my name" }));
    expect(readAnonPref("reply:a1")).toBe(true);
    await userEvent.click(post());
    await waitFor(() => expect(talk.createReply).toHaveBeenCalledTimes(1));
    expect(talk.createReply.mock.calls[0][4]).toBe(true);
    await waitFor(() => expect(readAnonPref("reply:a1")).toBe(false));
  });

  it("a try again after a failure uses the switch as it is NOW (turned off after a failed anonymous try, then on after a failed named one)", async () => {
    talk.createReply.mockRejectedValueOnce(new Error("boom")).mockRejectedValueOnce(new Error("boom")).mockResolvedValue({});
    render(<ReplyComposer aid="a1" qid="q1" who="@tunde.a" allow={allow} onPosted={() => {}} onBuy={() => {}} />);
    await typeAndPick("Same words");
    const sw = () => screen.getByRole("switch", { name: "Post without my name" });
    await userEvent.click(sw()); // on
    await userEvent.click(post());
    await waitFor(() => expect(talk.createReply).toHaveBeenCalledTimes(1));
    await screen.findByText("This did not post");
    await userEvent.click(sw()); // off, after the failure
    await userEvent.click(post());
    await waitFor(() => expect(talk.createReply).toHaveBeenCalledTimes(2));
    await screen.findByText("This did not post");
    await userEvent.click(sw()); // on again
    await userEvent.click(post());
    await waitFor(() => expect(talk.createReply).toHaveBeenCalledTimes(3));
    expect(talk.createReply.mock.calls.map((c) => c[4])).toEqual([true, false, true]);
    // the retry keeps its Idempotency-Key (same words), so the server cannot post it twice
    expect(new Set(talk.createReply.mock.calls.map((c) => c[3])).size).toBe(1);
  });
});

describe("V-FIX-D: the text box and the voice sheet of one reply share one switch position", () => {
  it("turning it on in one is seen in the other", async () => {
    const onSend = vi.fn();
    render(<><ReplyComposer aid="a9" qid="q1" who="@tunde.a" allow={allow} onPosted={() => {}} onBuy={() => {}} /><VoiceBox purpose="REPLY" maxSeconds={60} freeSeconds={10} anonSlot="reply:a9" sendLabel={() => "Send"} onSend={onSend} /></>);
    const text = screen.getByRole("switch", { name: "Post without my name" }) as HTMLInputElement;
    expect(text.checked).toBe(false);
    await userEvent.click(text);
    expect(readAnonPref("reply:a9")).toBe(true);
    // the voice box shows its own switch only under a take, so check the stored slot it reads and the event it follows
    window.dispatchEvent(new CustomEvent("voices-anon-pref", { detail: { slot: "reply:a9", on: false } }));
    await waitFor(() => expect((screen.getByRole("switch", { name: "Post without my name" }) as HTMLInputElement).checked).toBe(false));
  });
});

describe("V-FIX-D: Post without my name on a voice reply (VoiceBox)", () => {
  async function record() {
    const t0 = Date.now();
    const now = vi.spyOn(Date, "now");
    let n = 0;
    now.mockImplementation(() => t0 + (n++) * 400);
    await userEvent.click(screen.getByRole("button", { name: "Start recording" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    await userEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await screen.findByRole("button", { name: /^Send/ });
    now.mockRestore();
  }
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    speak.createVoiceClip.mockReset().mockResolvedValue({ clip: { id: "c1" }, putUrl: "https://put.test" });
    speak.completeVoiceClip.mockReset().mockResolvedValue({});
    speak.getVoiceClip.mockReset().mockResolvedValue({ status: "READY" });
  });

  it("the switch shows under the take, and Send carries its position at that moment, also on a try again", async () => {
    const onSend = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    render(<VoiceBox purpose="REPLY" maxSeconds={60} freeSeconds={10} anonSlot="reply:a1" sendLabel={() => "Send"} onSend={onSend} />);
    await record();
    const sw = screen.getByRole("switch", { name: "Post without my name" });
    expect((sw as HTMLInputElement).checked).toBe(false);
    await userEvent.click(sw);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].anonymous).toBe(true);
    await screen.findByText(/Something went wrong/);
    await userEvent.click(screen.getByRole("switch", { name: "Post without my name" })); // off after the failure
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
    expect(onSend.mock.calls[1][0].anonymous).toBe(false);
    // both tries are the same recording and the same key
    expect(onSend.mock.calls[1][0].key).toBe(onSend.mock.calls[0][0].key);
  });

  it("a box with no switch (an explain-my-vote voice) always sends anonymous false", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<VoiceBox purpose="VOTE_EXPLANATION" maxSeconds={60} freeSeconds={10} sendLabel={() => "Send"} onSend={onSend} />);
    await record();
    expect(screen.queryByRole("switch", { name: "Post without my name" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend.mock.calls[0][0].anonymous).toBe(false);
  });
});

const reply = (over: Partial<Reply> = {}): Reply => ({
  id: "r1", answerId: "a1", author: { id: "u1", handle: "kemi.a", displayName: "Kemi", state: null, avatarUrl: null }, stance: "AGREE", kind: "TEXT", body: "Yes.",
  clip: null, createdAt: new Date().toISOString(), status: "PUBLISHED", helpfulCount: 0, isMine: false, ...over,
}) as Reply;

describe("V-FIX-D: a reply with no author is shown as Anonymous", () => {
  it("someone else's unnamed reply shows no name, no handle and no tag", () => {
    render(<ReplyRow r={reply({ author: null, isMine: false })} />);
    expect(screen.getByText("Anonymous")).toBeTruthy();
    expect(screen.queryByTestId("anon-tag")).toBeNull();
    expect(document.body.textContent).not.toContain("kemi");
  });
  it("my own unnamed reply on my page carries the Posted without your name tag", () => {
    render(<ReplyRow r={reply({ author: null, isMine: true })} />);
    expect(screen.getByTestId("anon-tag").textContent).toBe("Posted without your name");
  });
  it("a named reply is unchanged", () => {
    render(<ReplyRow r={reply()} />);
    expect(screen.getByText("@kemi.a")).toBeTruthy();
    expect(screen.queryByTestId("anon-tag")).toBeNull();
  });
});
