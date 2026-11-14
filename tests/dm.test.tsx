// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace, back: vi.fn() }; // one object, as the real router is: a new one each render would restart the effects
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/messages/c1",
  useSearchParams: () => new URLSearchParams(""),
}));

import { ConversationPage } from "@/features/dm/ConversationPage";
import { InboxPage } from "@/features/dm/InboxPage";
import { DmUnreadProvider, MessagesIcon } from "@/components/shell/Messages";
import { UNREAD_POLL_MS, caption, dmFailure, textPrice, voicePrice, tokensText, when, type DmCosts } from "@/features/dm/dm-logic";
import { ApiError } from "@/lib/api/client";

type Call = { url: string; method: string; headers: Headers; body?: Record<string, unknown> };
let calls: Call[] = [];
function stub(routes: (c: Call) => Response | undefined) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const c: Call = { url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    return routes(c) ?? new Response("{}", { status: 404 });
  }));
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const err = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

const FREE: DmCosts & { maxChars: number; messagesPerDay: number; balanceMilli: number } = { textPriceMilli: 0, textPriceChars: 150, voicePriceMilli: 0, voiceMaxSeconds: 60, messagesLeftToday: 100, maxChars: 5000, messagesPerDay: 100, balanceMilli: 0 };
const PRICED = { ...FREE, textPriceMilli: 5000, voicePriceMilli: 78000 };
const PERSON = { id: "u2", handle: "ada", displayName: "Ada", place: "Abuja", verified: true, deleted: false };
const MSG = (o: object = {}) => ({ id: "m1", conversationId: "c1", senderId: "u2", mine: false, kind: "TEXT", body: "Hello there", clip: null, status: "PUBLISHED", readAt: null, createdAt: new Date().toISOString(), ...o });

beforeEach(() => {
  calls = []; push.mockReset(); replace.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("direct message prices and caption (the server's numbers, from GET /dm/limits)", () => {
  it("free by default: the caption is the design's line with the configured seconds", () => {
    expect(caption(FREE)).toBe("Messages are free. Voice messages are up to 60 seconds.");
    expect(caption({ ...FREE, voiceMaxSeconds: 10 })).toBe("Messages are free. Voice messages are up to 10 seconds.");
    expect(textPrice("a".repeat(500), FREE).milli).toBe(0);
    expect(voicePrice(30, FREE)).toBe(0);
  });
  it("priced: text is proportional per 150 characters, voice is one price, and the caption says both", () => {
    expect(textPrice("a".repeat(150), PRICED)).toEqual({ chars: 150, milli: 5000 });
    expect(textPrice("a".repeat(500), PRICED).milli).toBe(16670);
    expect(textPrice("😀".repeat(150), PRICED).chars).toBe(150);
    expect(voicePrice(59, PRICED)).toBe(78000);
    expect(tokensText(16670)).toBe("16.67 tokens");
    expect(caption(PRICED)).toBe("Text costs 5 tokens for every 150 characters. A voice message costs 78 tokens and can be up to 60 seconds.");
  });
  it("the inbox time label: minutes, hours, Yesterday, weekday", () => {
    const now = new Date("2026-11-14T12:00:00");
    expect(when("2026-11-14T11:58:00", now)).toBe("2m");
    expect(when("2026-11-14T09:00:00", now)).toBe("3h");
    expect(when("2026-11-13T09:00:00", now)).toBe("Yesterday");
    expect(when("2026-11-09T09:00:00", now)).toBe("Mon");
  });
});

describe("the words for each refusal", () => {
  const e = (status: number, code: string) => new ApiError(status, code, "x", true);
  it("verification_required asks for a subscription and points at the plans", () => {
    expect(dmFailure(e(403, "verification_required"))).toMatchObject({ text: "Subscribe and get verified to send messages.", plans: true });
  });
  it("blocked and unavailable say the same neutral thing", () => {
    expect(dmFailure(e(403, "blocked")).text).toBe("You can't message this person.");
    expect(dmFailure(e(403, "recipient_unavailable")).text).toBe("You can't message this person.");
    expect(dmFailure(e(403, "dm_closed")).text).toBe("This person is not taking messages.");
  });
  it("402, the daily limit, and offline", () => {
    expect(dmFailure(e(402, "INSUFFICIENT_UNITS"))).toMatchObject({ buy: true });
    expect(dmFailure(e(429, "DAILY_LIMIT_REACHED")).text).toContain("Come back after midnight");
    expect(dmFailure(new ApiError(0, "OFFLINE", "x", false)).text).toContain("offline");
  });
  it("no refusal text has an em-dash", () => {
    for (const code of ["verification_required", "blocked", "dm_closed", "ACCOUNT_SUSPENDED", "DAILY_LIMIT_REACHED", "INSUFFICIENT_UNITS", "VOICE_TOO_LONG", "x"])
      expect(dmFailure(e(403, code)).text).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("the messages icon", () => {
  it("shows the unread number, asks for it again every 30 seconds, and is not drawn for a guest", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let n = 3;
    stub((c) => (c.url.endsWith("/dm/unread") ? json({ unread: n }) : undefined));
    render(<DmUnreadProvider><MessagesIcon /></DmUnreadProvider>);
    await waitFor(() => expect(screen.getByTestId("messages-dot")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Messages, 3 unread" }).getAttribute("href")).toBe("/messages");
    const before = calls.filter((c) => c.url.endsWith("/dm/unread")).length;
    n = 5;
    await act(async () => { await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS + 50); });
    await waitFor(() => expect(screen.getByRole("link", { name: "Messages, 5 unread" })).toBeTruthy());
    expect(calls.filter((c) => c.url.endsWith("/dm/unread")).length).toBe(before + 1);
  });
  it("a guest makes no call and sees no icon", async () => {
    window.localStorage.clear();
    stub(() => json({ unread: 1 }));
    render(<DmUnreadProvider><MessagesIcon /></DmUnreadProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByRole("link", { name: /Messages/ })).toBeNull();
    expect(calls.length).toBe(0);
  });
});

const convs = () => ({
  items: [
    { id: "c1", person: PERSON, lastMessage: { id: "m1", kind: "TEXT", preview: "Perfect. Send me the link when you post.", mine: false, createdAt: new Date().toISOString() }, unread: 2, muted: false, updatedAt: new Date().toISOString() },
    { id: "c2", person: { ...PERSON, id: "u3", handle: "tunde.a", displayName: "Tunde Adewale" }, lastMessage: { id: "m2", kind: "VOICE", preview: "Voice message · 0:09", mine: false, createdAt: new Date().toISOString() }, unread: 0, muted: false, updatedAt: new Date().toISOString() },
    { id: "c3", person: { ...PERSON, id: "u4", handle: "chidi.o", displayName: "Chidi Okeke" }, lastMessage: { id: "m3", kind: "TEXT", preview: "Pay yourself first.", mine: true, createdAt: new Date().toISOString() }, unread: 0, muted: false, updatedAt: new Date().toISOString() },
  ],
  nextCursor: null,
});

describe("inbox", () => {
  it("draws the board: tabs, name + handle + time, previews (voice with its length, yours with You:), unread count, and the privacy line", async () => {
    stub((c) => (c.url.includes("/dm/conversations") ? json(convs()) : c.url.endsWith("/dm/unread") ? json({ unread: 2 }) : undefined));
    render(<InboxPage />);
    expect(await screen.findByText("Perfect. Send me the link when you post.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Unread/ })).toBeTruthy();
    expect(screen.getByText("@ada")).toBeTruthy();
    expect(screen.getByText("Voice message · 0:09")).toBeTruthy();
    expect(screen.getByText("You: Pay yourself first.")).toBeTruthy();
    expect(screen.getByTestId("row-unread").textContent).toBe("2");
    expect(screen.getByRole("link", { name: "Ada, 2 unread" }).getAttribute("href")).toBe("/messages/c1");
    expect(screen.getByText("Messages are private between you and the other person. You can report or block from any chat.")).toBeTruthy();
  });
  it("the Unread tab keeps only the unread chats", async () => {
    stub((c) => (c.url.includes("/dm/conversations") ? json(convs()) : json({ unread: 2 })));
    render(<InboxPage />);
    await screen.findByText("Voice message · 0:09");
    await userEvent.click(screen.getByRole("tab", { name: /Unread/ }));
    expect(screen.queryByText("Voice message · 0:09")).toBeNull();
    expect(screen.getByText("Perfect. Send me the link when you post.")).toBeTruthy();
  });
  it("the verified tick shows beside the name in the rows and in the chat header", async () => {
    stub((c) => (c.url.includes("/dm/conversations") && !c.url.includes("/messages") ? json(convs()) : c.url.endsWith("/dm/unread") ? json({ unread: 2 }) : undefined));
    const { unmount } = render(<InboxPage />);
    await screen.findByText("Voice message · 0:09");
    expect(screen.getAllByLabelText("Verified")).toHaveLength(3);
    unmount();
    stub((c) => (c.url.includes("/dm/conversations/c1/messages") ? json({ person: PERSON, muted: false, items: [MSG()], nextCursor: null }) : c.url.endsWith("/dm/limits") ? json(FREE) : json({ unread: 0 })));
    render(<ConversationPage conversationId="c1" />);
    await screen.findByText("Hello there");
    expect(screen.getAllByLabelText("Verified").length).toBeGreaterThan(0);
  });
  it("an empty inbox says how to start", async () => {
    stub((c) => (c.url.includes("/dm/conversations") ? json({ items: [], nextCursor: null }) : json({ unread: 0 })));
    render(<InboxPage />);
    expect(await screen.findByText("No messages yet")).toBeTruthy();
  });
  it("New message searches people by handle and opens the chat with the one you pick", async () => {
    stub((c) => {
      if (c.url.includes("/dm/conversations")) return json({ items: [], nextCursor: null });
      if (c.url.includes("/search?")) return json({ people: [{ id: "u9", handle: "kemi.b", displayName: "Kemi Bello", state: "Abuja" }], questions: [], answers: [], topics: [], totals: {}, nextCursor: null });
      return json({ unread: 0 });
    });
    render(<InboxPage />);
    await screen.findByText("No messages yet");
    await userEvent.click(screen.getAllByRole("button", { name: /New message/ })[0]);
    await userEvent.type(await screen.findByPlaceholderText("Search by handle or name"), "kemi");
    await userEvent.click(await screen.findByText("Kemi Bello"));
    expect(push).toHaveBeenCalledWith("/messages/new/u9");
  });
});

describe("conversation", () => {
  const routes = (send?: (c: Call) => Response, limits = FREE) => (c: Call) => {
    if (c.url.endsWith("/dm/limits")) return json(limits);
    if (c.url.includes("/dm/conversations/c1/messages")) return json({ person: PERSON, muted: false, items: [MSG()], nextCursor: null });
    if (c.url.includes("/dm/conversations/c1/read")) return new Response(null, { status: 204 });
    if (c.url.includes("/dm/conversations/c1/mute")) return new Response(null, { status: 204 });
    if (c.url.endsWith("/dm/unread")) return json({ unread: 0 });
    if (c.url.endsWith("/dm/messages") && send) return send(c);
    return undefined;
  };
  const sent = (c: Call) => json({ message: MSG({ id: "m2", mine: true, senderId: "me", body: c.body?.body, costMilli: 0 }), charge: { costMilli: 0, balanceMilli: 0 } }, 201);

  it("draws the header, the day divider, the bubble with its time, the composer and the free caption", async () => {
    stub(routes());
    render(<ConversationPage conversationId="c1" />);
    expect(await screen.findByText("Hello there")).toBeTruthy();
    expect(screen.getByText("@ada · Abuja")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByPlaceholderText("Write a message")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record a voice message" })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("dm-caption").textContent).toBe("Messages are free. Voice messages are up to 60 seconds."));
    await waitFor(() => expect(calls.some((c) => c.url.includes("/dm/conversations/c1/read") && c.method === "POST")).toBe(true));
  });

  it("a voice message shows its transcript when there is one, and nothing when there is not", async () => {
    stub((c) => (c.url.includes("/dm/conversations/c1/messages") ? json({ person: PERSON, muted: false, nextCursor: null, items: [
      MSG({ id: "v1", kind: "VOICE", body: null, clip: { id: "k1", durationMs: 9000, peaks: null, transcript: "The generator man is too real." } }),
      MSG({ id: "v2", kind: "VOICE", body: null, createdAt: new Date(Date.now() - 60000).toISOString(), clip: { id: "k2", durationMs: 9000, peaks: null, transcript: null } }),
    ] }) : routes()(c)));
    render(<ConversationPage conversationId="c1" />);
    expect(await screen.findByText("The generator man is too real.")).toBeTruthy();
    expect(screen.getAllByText(/Transcript/)).toHaveLength(1);
  });

  it("the More menu has exactly Mute this chat, Report @ada and Block @ada; mute and unmute call the API", async () => {
    stub(routes());
    render(<ConversationPage conversationId="c1" />);
    await screen.findByText("Hello there");
    await userEvent.click(screen.getByRole("button", { name: "More: mute, report or block" }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Mute this chat", "Report @ada", "Block @ada"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Mute this chat" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/dm/conversations/c1/mute") && c.method === "PUT")).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "More: mute, report or block" }));
    expect(screen.getByRole("menuitem", { name: "Unmute this chat" })).toBeTruthy();
  });

  it("Block @ada blocks and goes back to the inbox", async () => {
    stub((c) => (c.url.endsWith("/me/blocks/u2") ? new Response(null, { status: 204 }) : routes()(c)));
    render(<ConversationPage conversationId="c1" />);
    await screen.findByText("Hello there");
    await userEvent.click(screen.getByRole("button", { name: "More: mute, report or block" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Block @ada" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/messages"));
  });

  it("Report @ada reports the message they sent, with the reason, and can block with it", async () => {
    stub((c) => (c.url.endsWith("/reports") ? json({ id: "r1", status: "OPEN", blocked: false }, 201) : routes()(c)));
    render(<ConversationPage conversationId="c1" />);
    await screen.findByText("Hello there");
    await userEvent.click(screen.getByRole("button", { name: "More: mute, report or block" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Report @ada" }));
    await userEvent.click(screen.getByLabelText("Scam or spam"));
    await userEvent.click(screen.getByLabelText("Also block @ada"));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByText("Thanks. We got your report.")).toBeTruthy();
    expect(calls.find((c) => c.url.endsWith("/reports"))!.body).toMatchObject({ targetType: "DM_MESSAGE", targetId: "m1", reason: "SCAM_OR_SPAM", alsoBlock: true });
  });

  it("typing turns the mic into Send; sending uses an Idempotency-Key and shows the new bubble", async () => {
    stub(routes(sent));
    render(<ConversationPage conversationId="c1" />);
    await screen.findByText("Hello there");
    await userEvent.type(screen.getByLabelText("Your message"), "Hi Ada");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Hi Ada")).toBeTruthy();
    const post = calls.find((c) => c.url.endsWith("/dm/messages"))!;
    expect(post.headers.get("Idempotency-Key")).toBeTruthy();
    expect(post.body).toEqual({ toUserId: "u2", kind: "TEXT", body: "Hi Ada" });
  });

  it("with a price set, the cost is shown before sending", async () => {
    stub(routes(sent, PRICED));
    render(<ConversationPage conversationId="c1" />);
    await screen.findByText("Hello there");
    await waitFor(() => expect(screen.getByTestId("dm-caption").textContent).toContain("Text costs 5 tokens for every 150 characters."));
    await userEvent.type(screen.getByLabelText("Your message"), "a".repeat(150));
    expect(screen.getByTestId("dm-caption").textContent).toBe("150 of 5,000 characters. Costs 5 tokens.");
  });

  it("a 403 verification_required becomes a prompt that links to /verify, and keeps the words", async () => {
    stub(routes(() => err(403, "verification_required", "Subscribe and get verified to send messages.")));
    render(<ConversationPage conversationId="c1" />);
    await screen.findByText("Hello there");
    await userEvent.type(screen.getByLabelText("Your message"), "Hi Ada");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Subscribe and get verified to send messages.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See how to get verified" }).getAttribute("href")).toBe("/verify");
    expect((screen.getByLabelText("Your message") as HTMLInputElement).value).toBe("Hi Ada");
  });

  it("a lost connection keeps the key so the retry is the same send; a refusal makes the next try a new key", async () => {
    let n = 0;
    stub(routes(() => {
      n++;
      if (n === 1) throw new TypeError("network");
      return err(403, "blocked", "You can't message this person.");
    }));
    render(<ConversationPage conversationId="c1" />);
    await screen.findByText("Hello there");
    await userEvent.type(screen.getByLabelText("Your message"), "Hi Ada");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText(/offline/i);
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("You can't message this person.");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/dm/messages")).length).toBe(3));
    const keys = calls.filter((c) => c.url.endsWith("/dm/messages")).map((c) => c.headers.get("Idempotency-Key"));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("a person who is not taking messages cannot be written to", async () => {
    stub((c) => (c.url.includes("/dm/with/u2") ? json({ person: PERSON, conversationId: null, acceptsMessages: false }) : routes()(c)));
    render(<ConversationPage userId="u2" />);
    expect(await screen.findByText("You can't message this person.")).toBeTruthy();
    expect(screen.queryByLabelText("Your message")).toBeNull();
  });

  it("opening by person goes to the conversation when there already is one", async () => {
    stub((c) => (c.url.includes("/dm/with/u2") ? json({ person: PERSON, conversationId: "c9", acceptsMessages: true }) : routes()(c)));
    render(<ConversationPage userId="u2" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/messages/c9"));
  });

  it("a conversation that is not yours is a plain not-found", async () => {
    stub((c) => (c.url.includes("/dm/conversations/c1/messages") ? err(404, "NOT_FOUND", "We could not find that.") : routes()(c)));
    render(<ConversationPage conversationId="c1" />);
    expect(await screen.findByText(/could not find/i)).toBeTruthy();
  });
});
