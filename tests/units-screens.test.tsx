// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let search = "";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(search) }));

import { PaymentDoneScreen } from "@/features/units/PaymentDoneScreen";
import { WalletScreen } from "@/features/units/WalletScreen";
import { BuyUnitsScreen } from "@/features/units/BuyUnitsScreen";
import { OutOfPostsSheet } from "@/features/units/OutOfPostsSheet";
import { saveDraft, setAwaiting } from "@/features/units/draft";
import { attemptFor, saveAttempt } from "@/features/units/attempt";

const PID = "01a1ad10-f09a-73fc-9902-42da40d26dec";
const costs = { baseKoboPerUnit: 100, freeReactionsPerDay: 20, freeVotesPerDay: 3, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 100, voteAfterFreeMilli: 200, minPackKobo: 18300, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 5000, freeVoiceSeconds: 10, textPriceChars: 150, freePostTextChars: 500, messagesPerDay: 20, textFixMilli: 5000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 };
const tier = (id: string, slug: string, name: string, price: number, u: number, b: number, eff: number) => ({ id, slug, name, priceKobo: price, unitsMilli: u, bonusMilli: b, effectiveKoboPerUnit: eff, baseKoboPerUnit: 100 });
const TIERS = { tiers: [tier("t-entry", "entry", "Entry", 18300, 183000, 0, 100), tier("t-standard", "standard", "Standard", 73200, 732000, 0, 100)], minPackKobo: 18300, costs, extraVoice: [{ kind: "SECONDS_30", maxSeconds: 30, priceKobo: 7800, label: "Up to 30 sec" }, { kind: "SECONDS_60", maxSeconds: 60, priceKobo: 10000, label: "Up to 1 min" }], walletOffer: null };
const WALLET = { balanceMilli: 12500, freePostsRemaining: 7, freePostsUsed: 3, allowances: {}, costs, tokens: [] };
const payment = (status: string, o: object = {}) => ({ id: PID, kind: "UNITS", status, amountKobo: 73200, txRef: "voices-1", title: "Standard pack", unitsMilli: 732000, bonusMilli: 0, method: "card", cardLast4: "4412", receiptNo: status === "SUCCEEDED" ? "VU-261202-48213" : null, failureReason: status === "FAILED" ? "Declined by the bank" : null, balanceMilli: status === "SUCCEEDED" ? 744500 : null, createdAt: "2026-12-02T17:10:00Z", verifiedAt: status === "SUCCEEDED" ? "2026-12-02T17:14:00Z" : null, token: null, ...o });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const err = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

type Handler = (url: string, init: RequestInit) => Response | undefined;
function api(extra: Handler = () => undefined) {
  const calls: string[] = [];
  const f = vi.fn(async (u: unknown, init: RequestInit = {}) => {
    const url = String(u).replace(/^.*\/api\/v1/, "").replace(/^https?:\/\/[^/]+/, "");
    const m = (init.method ?? "GET") + " " + url;
    calls.push(m);
    const e = extra(m, init);
    if (e) return e;
    if (m === "GET /wallet") return json(WALLET);
    if (m === "GET /units/tiers") return json(TIERS);
    if (m.startsWith("GET /wallet/history")) return json({ items: [], nextCursor: null });
    if (m.startsWith("GET /ads/placement")) return json({ ad: null });
    return json({ error: { code: "NOT_FOUND", message: "x" } }, 404);
  });
  vi.stubGlobal("fetch", f);
  return { f, calls };
}

beforeEach(() => {
  search = "";
  push.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("PaymentDone (the return page)", () => {
  it("success: shows what the API says, from the payment, and verifies once", async () => {
    search = `paymentId=${PID}&status=successful&transaction_id=285959875&tx_ref=voices-1`;
    // first read: not final yet
    let first = true;
    const a = api((m) => {
      if (m === `GET /payments/${PID}`) { const p = first ? payment("INITIATED") : payment("SUCCEEDED"); first = false; return json(p); }
      if (m === `POST /payments/${PID}/verify`) return json(payment("SUCCEEDED"));
      return undefined;
    });
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("732 tokens added")).toBeTruthy();
    expect(screen.getByText("Standard, 732 tokens")).toBeTruthy();
    expect(screen.getByText("Card ending 4412")).toBeTruthy();
    expect(screen.getByText("VU-261202-48213")).toBeTruthy();
    expect(screen.getByText("₦732")).toBeTruthy();
    expect(a.calls.filter((c) => c.endsWith("/verify")).length).toBe(1);
    const verify = a.f.mock.calls.find((c) => String(c[0]).endsWith("/verify"))!;
    expect(JSON.parse((verify[1] as RequestInit).body as string)).toEqual({ providerTxId: "285959875" });
  });
  it("a forged return (success in the address, nothing paid) never shows success", async () => {
    search = `paymentId=${PID}&status=successful&transaction_id=777&tx_ref=voices-1`;
    api((m) => (m === `GET /payments/${PID}` ? json(payment("INITIATED")) : m === `POST /payments/${PID}/verify` ? err(409, "PAYMENT_NOT_VERIFIED", "We could not confirm this payment yet.") : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Confirming your payment")).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.queryByText(/tokens added/)).toBeNull();
  });
  it("another person's payment is not found", async () => {
    search = `paymentId=${PID}`;
    api((m) => (m === `GET /payments/${PID}` ? err(404, "NOT_FOUND", "We could not find that payment.") : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("We could not find that payment")).toBeTruthy();
    expect(screen.queryByText(/tokens added/)).toBeNull();
  });
  it("failure: says why, adds no units, offers Try again", async () => {
    search = `paymentId=${PID}&status=failed`;
    api((m) => (m === `GET /payments/${PID}` ? json(payment("FAILED")) : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Payment did not go through")).toBeTruthy();
    expect(screen.getByText(/Declined by the bank\. No tokens were added\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
    expect(screen.getByText(/Seeing a debit\?/)).toBeTruthy();
  });
  it("Try again starts a fresh payment for the same pack with a new key", async () => {
    search = `paymentId=${PID}&status=failed`;
    const loc = { ...window.location, assign: vi.fn() };
    vi.stubGlobal("location", loc);
    const a = api((m) => {
      if (m === `GET /payments/${PID}`) return json(payment("FAILED"));
      if (m === "POST /payments") return json({ paymentId: "01a1ad10-0000-7000-8000-000000000001", txRef: "voices-2", amountKobo: 73200, currency: "NGN", unitsMilli: 732000, checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/zzz", expiresAt: new Date(Date.now() + 1.8e6).toISOString() }, 201);
      return undefined;
    });
    render(<PaymentDoneScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(loc.assign).toHaveBeenCalledWith("https://checkout.flutterwave.com/v3/hosted/pay/zzz"));
    const post = a.f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toMatchObject({ kind: "UNITS", tierId: "t-standard" });
  });
  it("a held draft posts after the tokens arrive and the page says so; a refresh does not post it twice", async () => {
    search = `paymentId=${PID}&status=successful&transaction_id=5`;
    saveDraft("q-1", "My take on payday");
    setAwaiting("q-1", true);
    attemptFor("UNITS:t-buzz:card", "/q/q-1", Date.now(), "q-1");
    saveAttempt("UNITS:t-buzz:card", { paymentId: PID });
    let posts = 0;
    const handler: Handler = (m) => {
      if (m === `GET /payments/${PID}`) return json(payment("SUCCEEDED"));
      if (m === "POST /questions/q-1/answers") { posts++; return json({ answer: { id: "a1" } }, 201); }
      return undefined;
    };
    api(handler);
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Your answer is posted")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to the conversation/ }).getAttribute("href")).toBe("/q/q-1");
    cleanup();
    api(handler);
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("732 tokens added")).toBeTruthy();
    expect(posts).toBe(1);
  });
  it("an old success page refreshed (no attempt) posts no draft, even one written later and waiting", async () => {
    search = `paymentId=${PID}`;
    saveDraft("q-2", "Written after");
    setAwaiting("q-2", true);
    let posts = 0;
    api((m) => (m === `GET /payments/${PID}` ? json(payment("SUCCEEDED")) : m.startsWith("POST /questions/") ? (posts++, json({}, 201)) : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("732 tokens added")).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(posts).toBe(0);
    expect(screen.queryByText("Your answer is posted")).toBeNull();
  });
  it("a token purchase never posts a waiting draft or claims tokens arrived", async () => {
    search = `paymentId=${PID}`;
    saveDraft("q-3", "Old abandoned draft");
    setAwaiting("q-3", true);
    attemptFor("EXTRA_VOICE:SECONDS_30", "/q/q-3", Date.now(), undefined);
    saveAttempt("EXTRA_VOICE:SECONDS_30", { paymentId: PID });
    let posts = 0;
    api((m) => (m === `GET /payments/${PID}` ? json(payment("SUCCEEDED", { kind: "EXTRA_VOICE", title: "Extra voice, 30 seconds", unitsMilli: null, bonusMilli: null, token: { id: "t", kind: "SECONDS_30", maxSeconds: 30, status: "AVAILABLE", createdAt: "2026-12-02T17:14:00Z" } })) : m.startsWith("POST /questions/") ? (posts++, json({}, 201)) : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Extra voice token added")).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(posts).toBe(0);
    expect(screen.queryByText(/tokens arrived/)).toBeNull();
  });
  it("the second tab of a race shows the posted banner and does not post again", async () => {
    search = `paymentId=${PID}`;
    saveDraft("q-4", "Raced draft");
    setAwaiting("q-4", true);
    attemptFor("UNITS:t-buzz:card", "/q/q-4", Date.now(), "q-4");
    saveAttempt("UNITS:t-buzz:card", { paymentId: PID });
    let posts = 0;
    const h: Handler = (m) => (m === `GET /payments/${PID}` ? json(payment("SUCCEEDED")) : m === "POST /questions/q-4/answers" ? (posts++, json({}, 201)) : undefined);
    api(h);
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Your answer is posted")).toBeTruthy();
    cleanup();
    window.sessionStorage.clear(); // a new tab: no attempt of its own
    api(h);
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Your answer is posted")).toBeTruthy();
    expect(posts).toBe(1);
  });
  it("lead ruling WF (RW4): a cancelled return whose one verify says not verified shows Cancelled at once, with Try again, never \"do not pay again\"", async () => {
    search = `paymentId=${PID}&status=cancelled`;
    const a = api((m) => (m === `GET /payments/${PID}` ? json(payment("INITIATED")) : m === `POST /payments/${PID}/verify` ? err(409, "PAYMENT_NOT_VERIFIED", "x") : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Payment cancelled")).toBeTruthy();
    expect(screen.getByText("You were not charged.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
    expect(screen.queryByText(/do not pay again/i)).toBeNull();
    expect(a.calls.filter((c) => c.endsWith("/verify")).length).toBe(1);
  });
  it("RW4: a cancelled return where verify says success shows success and credits once (one verify call)", async () => {
    search = `paymentId=${PID}&status=cancelled&transaction_id=285959875`;
    let first = true;
    const a = api((m) => {
      if (m === `GET /payments/${PID}`) { const p = first ? payment("INITIATED") : payment("SUCCEEDED"); first = false; return json(p); }
      if (m === `POST /payments/${PID}/verify`) return json(payment("SUCCEEDED"));
      return undefined;
    });
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("732 tokens added")).toBeTruthy();
    expect(screen.queryByText("Payment cancelled")).toBeNull();
    expect(a.calls.filter((c) => c.endsWith("/verify")).length).toBe(1);
  });
  it("a failed payment with no receipt number labels the reference", async () => {
    search = `paymentId=${PID}`;
    api((m) => (m === `GET /payments/${PID}` ? json(payment("FAILED")) : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Payment reference")).toBeTruthy();
    expect(screen.getByText("voices-1", { selector: "dd span" })).toBeTruthy();
  });
});

describe("Tokens screen", () => {
  it("reads balance, free posts, costs and the smallest pack from the API; never says wallet", async () => {
    api((m) => (m.startsWith("GET /wallet/history") ? json({ items: [{ id: "h1", kind: "PURCHASE", title: "Chat pack", deltaMilli: 26000, balanceAfterMilli: 26000, free: false, freePostsLeft: null, paymentId: PID, hasReceipt: true, amountKobo: 34500, note: null, createdAt: "2026-11-05T10:00:00Z" }], nextCursor: null }) : undefined));
    const { container } = render(<WalletScreen />);
    expect(await screen.findByTestId("balance")).toBeTruthy();
    expect(screen.getByTestId("balance").textContent).toBe("12.5");
    expect(screen.getByText("7 free posts left")).toBeTruthy();
    expect(screen.getByText("From ₦183 for 183 tokens. Tokens cannot be cashed out or sent to others.")).toBeTruthy();
    expect(screen.getByText("5 tokens per 150 characters")).toBeTruthy();
    expect(await screen.findByText("Chat pack")).toBeTruthy();
    expect(screen.getByText("+26")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Receipt" }).getAttribute("href")).toBe(`/units/receipt/${PID}`);
    expect(container.textContent!.toLowerCase()).not.toContain("wallet");
    expect(container.textContent).not.toContain("—");
    expect(container.textContent).not.toContain("AI Credits");
    expect(container.textContent).not.toContain("bank partner");
  });
  it("extra voice is not sold any more: no Buy token button on the screen", async () => {
    api();
    render(<WalletScreen />);
    expect(await screen.findByTestId("balance")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buy token" })).toBeNull();
    expect(screen.queryByText("Extra voice")).toBeNull();
  });
  it("a signed-out visitor sees prices from the public config, not a balance", async () => {
    window.localStorage.clear();
    api((m) => (m === "GET /config/public" ? json({ currency: "NGN", freePosts: 10, unitBaseKobo: 100, costs, tiers: TIERS.tiers, extraVoice: TIERS.extraVoice, voiceFreeSeconds: 10 }) : undefined));
    render(<WalletScreen />);
    expect(await screen.findByText("Sign in to see your tokens")).toBeTruthy();
    expect(await screen.findByText("5 tokens per 150 characters")).toBeTruthy();
    expect(screen.queryByTestId("balance")).toBeNull();
  });
  it("Download statement fetches the CSV with the bearer token and saves it", async () => {
    const urls: string[] = [];
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const a = api((m, init) => {
      if (m === "GET /wallet/history/export") { urls.push(String(new Headers(init.headers).get("authorization"))); return new Response("When,What,Units\n", { status: 200, headers: { "content-type": "text/csv" } }); }
      return undefined;
    });
    render(<WalletScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /Download statement/ }));
    await waitFor(() => expect(clicked).toHaveBeenCalled());
    expect(urls).toEqual(["Bearer tok"]);
    expect(a.calls).toContain("GET /wallet/history/export");
    clicked.mockRestore();
  });
});

describe("Get tokens screen", () => {
  it("lists the packs from the API as the board draws them, and the Pay button names the selected pack", async () => {
    search = "pack=standard";
    api();
    render(<BuyUnitsScreen />);
    expect(await screen.findByRole("button", { name: /Pay ₦732 for 732 tokens/ })).toBeTruthy();
    expect(screen.getByText("1 token is ₦1. You get exactly the tokens you pay for.")).toBeTruthy();
    expect(screen.queryByText(/bonus/)).toBeNull();
    expect(screen.queryByText(/a unit/)).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: /Entry/ }));
    expect(screen.getByRole("button", { name: /Pay ₦183 for 183 tokens/ })).toBeTruthy();
    // arrow keys move between the packs
    screen.getByRole("radio", { name: /Entry/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /Standard/ }).getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: /Entry/ }).getAttribute("aria-checked")).toBe("true");
  });
  it("what things cost: text by length, then the two voice prices, and the day limit", async () => {
    api();
    render(<BuyUnitsScreen />);
    expect(await screen.findByText("What things cost")).toBeTruthy();
    expect(screen.getAllByText("By length. 500 characters is 16.67 tokens.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 per 150 characters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Voice, up to 30 seconds").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Voice, 31 to 60 seconds").length).toBeGreaterThan(0);
    expect(screen.getAllByText("78").length).toBeGreaterThan(0);
    expect(screen.getAllByText("100").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Up to 20 messages a day/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Subscriptions/)).toBeNull(); // not built now (V-38 c)
  });
  it("sends the chosen pack with the payment", async () => {
    const loc = { ...window.location, assign: vi.fn() };
    vi.stubGlobal("location", loc);
    const a = api((m) => (m === "POST /payments" ? json({ paymentId: PID, txRef: "voices-4", amountKobo: 18300, currency: "NGN", unitsMilli: 183000, checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/m", expiresAt: new Date(Date.now() + 1.8e6).toISOString() }, 201) : undefined));
    search = "";
    render(<BuyUnitsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /Pay ₦183 for 183 tokens/ }));
    await waitFor(() => expect(loc.assign).toHaveBeenCalled());
    const post = a.f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ kind: "UNITS", tierId: "t-entry", returnPath: "/units/done" });
  });
  it("shows an offer only when the API sends one", async () => {
    api((m) => (m === "GET /units/tiers" ? json({ ...TIERS, walletOffer: { id: "o", kind: "WALLET_OFFER", brand: "B", label: "Ad", headline: "Top up and get 5 extra tokens." } }) : undefined));
    render(<BuyUnitsScreen />);
    expect(await screen.findByText("Top up and get 5 extra tokens.")).toBeTruthy();
  });
});

describe("Out of free posts", () => {
  it("shows the saved draft, the cost and the smallest pack from the API, and marks the draft as waiting", async () => {
    saveDraft("q-9", "Salary lands on the 25th.");
    api((m) => (m === "GET /wallet" ? json({ ...WALLET, balanceMilli: 0, freePostsRemaining: 0, freePostsUsed: 10 }) : undefined));
    const onKeep = vi.fn();
    render(<OutOfPostsSheet questionId="q-9" onKeep={onKeep} />);
    expect(await screen.findByText("You have used your 10 free posts")).toBeTruthy();
    expect(screen.getByText("Balance: 0 tokens")).toBeTruthy();
    expect(screen.getByText("Salary lands on the 25th.")).toBeTruthy();
    expect(screen.getByText(/Text costs 5 tokens \(₦5\) for every 150 characters\. The smallest pack is 183 tokens for ₦183\./)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Get tokens from ₦183" });
    expect(link.getAttribute("href")).toBe("/units/buy?from=%2Fq%2Fq-9");
    await userEvent.click(screen.getByRole("button", { name: "Keep my draft for later" }));
    expect(onKeep).toHaveBeenCalled();
  });
});
