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
const costs = { baseKoboPerUnit: 1380, freeReactionsPerDay: 20, freeVotesPerDay: 3, textPostMilli: 500, voicePostMilli: 1000, reactionAfterFreeMilli: 100, voteAfterFreeMilli: 200, minPackKobo: 13800, extraVoice30Kobo: 15000, extraVoice60Kobo: 20000, textMaxChars: 500, freeVoiceSeconds: 10 };
const tier = (id: string, slug: string, name: string, price: number, u: number, b: number, eff: number) => ({ id, slug, name, priceKobo: price, unitsMilli: u, bonusMilli: b, effectiveKoboPerUnit: eff, baseKoboPerUnit: 1380 });
const TIERS = { tiers: [tier("t-spark", "spark", "Spark", 13800, 10000, 0, 1380), tier("t-buzz", "buzz", "Buzz", 69000, 55000, 5000, 1255)], minPackKobo: 13800, costs, extraVoice: [{ kind: "SECONDS_30", maxSeconds: 30, priceKobo: 15000, label: "Up to 30 sec" }, { kind: "SECONDS_60", maxSeconds: 60, priceKobo: 20000, label: "Up to 1 min" }], walletOffer: null };
const WALLET = { balanceMilli: 12500, freePostsRemaining: 7, freePostsUsed: 3, allowances: {}, costs, tokens: [] };
const payment = (status: string, o: object = {}) => ({ id: PID, kind: "UNITS", status, amountKobo: 69000, txRef: "voices-1", title: "Buzz pack", unitsMilli: 55000, bonusMilli: 5000, method: "card", cardLast4: "4412", receiptNo: status === "SUCCEEDED" ? "VU-261202-48213" : null, failureReason: status === "FAILED" ? "Declined by the bank" : null, balanceMilli: status === "SUCCEEDED" ? 67500 : null, createdAt: "2026-12-02T17:10:00Z", verifiedAt: status === "SUCCEEDED" ? "2026-12-02T17:14:00Z" : null, token: null, ...o });
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
    expect(await screen.findByText("55 units added")).toBeTruthy();
    expect(screen.getByText("Buzz, 55 units (5 bonus)")).toBeTruthy();
    expect(screen.getByText("Card ending 4412")).toBeTruthy();
    expect(screen.getByText("VU-261202-48213")).toBeTruthy();
    expect(screen.getByText("₦690")).toBeTruthy();
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
    expect(screen.queryByText(/units added/)).toBeNull();
  });
  it("another person's payment is not found", async () => {
    search = `paymentId=${PID}`;
    api((m) => (m === `GET /payments/${PID}` ? err(404, "NOT_FOUND", "We could not find that payment.") : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("We could not find that payment")).toBeTruthy();
    expect(screen.queryByText(/units added/)).toBeNull();
  });
  it("failure: says why, adds no units, offers Try again", async () => {
    search = `paymentId=${PID}&status=failed`;
    api((m) => (m === `GET /payments/${PID}` ? json(payment("FAILED")) : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("Payment did not go through")).toBeTruthy();
    expect(screen.getByText(/Declined by the bank\. No units were added\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
    expect(screen.getByText(/Seeing a debit\?/)).toBeTruthy();
  });
  it("Try again starts a fresh payment for the same pack with a new key", async () => {
    search = `paymentId=${PID}&status=failed`;
    const loc = { ...window.location, assign: vi.fn() };
    vi.stubGlobal("location", loc);
    const a = api((m) => {
      if (m === `GET /payments/${PID}`) return json(payment("FAILED"));
      if (m === "POST /payments") return json({ paymentId: "01a1ad10-0000-7000-8000-000000000001", txRef: "voices-2", amountKobo: 69000, currency: "NGN", unitsMilli: 55000, checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/zzz", expiresAt: new Date(Date.now() + 1.8e6).toISOString() }, 201);
      return undefined;
    });
    render(<PaymentDoneScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(loc.assign).toHaveBeenCalledWith("https://checkout.flutterwave.com/v3/hosted/pay/zzz"));
    const post = a.f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toMatchObject({ kind: "UNITS", tierId: "t-buzz" });
  });
  it("a held draft posts after the units arrive and the page says so; a refresh does not post it twice", async () => {
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
    expect(await screen.findByText("55 units added")).toBeTruthy();
    expect(posts).toBe(1);
  });
  it("an old success page refreshed (no attempt) posts no draft, even one written later and waiting", async () => {
    search = `paymentId=${PID}`;
    saveDraft("q-2", "Written after");
    setAwaiting("q-2", true);
    let posts = 0;
    api((m) => (m === `GET /payments/${PID}` ? json(payment("SUCCEEDED")) : m.startsWith("POST /questions/") ? (posts++, json({}, 201)) : undefined));
    render(<PaymentDoneScreen />);
    expect(await screen.findByText("55 units added")).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(posts).toBe(0);
    expect(screen.queryByText("Your answer is posted")).toBeNull();
  });
  it("a token purchase never posts a waiting draft or claims units arrived", async () => {
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
    expect(screen.queryByText(/units arrived/)).toBeNull();
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
    expect(await screen.findByText("55 units added")).toBeTruthy();
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

describe("Voice Units screen", () => {
  it("reads balance, free posts, costs and the smallest pack from the API; never says wallet", async () => {
    api((m) => (m.startsWith("GET /wallet/history") ? json({ items: [{ id: "h1", kind: "PURCHASE", title: "Chat pack", deltaMilli: 26000, balanceAfterMilli: 26000, free: false, freePostsLeft: null, paymentId: PID, hasReceipt: true, amountKobo: 34500, note: null, createdAt: "2026-11-05T10:00:00Z" }], nextCursor: null }) : undefined));
    const { container } = render(<WalletScreen />);
    expect(await screen.findByTestId("balance")).toBeTruthy();
    expect(screen.getByTestId("balance").textContent).toBe("12.5");
    expect(screen.getByText("7 free posts left")).toBeTruthy();
    expect(screen.getByText("From ₦138 for 10 units. Units cannot be cashed out or sent to others.")).toBeTruthy();
    expect(screen.getByText("0.5 units (₦6.90)")).toBeTruthy();
    expect(await screen.findByText("Chat pack")).toBeTruthy();
    expect(screen.getByText("+26")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Receipt" }).getAttribute("href")).toBe(`/units/receipt/${PID}`);
    expect(container.textContent!.toLowerCase()).not.toContain("wallet");
    expect(container.textContent).not.toContain("—");
    expect(container.textContent).not.toContain("AI Credits");
    expect(container.textContent).not.toContain("bank partner");
  });
  it("a second tap on Buy token never makes a second payment", async () => {
    const loc = { ...window.location, assign: vi.fn() };
    vi.stubGlobal("location", loc);
    let release: (r: Response) => void = () => undefined;
    const a = api((m) => (m === "POST /payments" ? (new Promise<Response>((r) => { release = r; }) as unknown as Response) : undefined));
    render(<WalletScreen />);
    const buttons = await screen.findAllByRole("button", { name: "Buy token" });
    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);
    expect(a.calls.filter((c) => c === "POST /payments").length).toBe(1);
    await act(async () => release(json({ paymentId: PID, txRef: "voices-3", amountKobo: 15000, currency: "NGN", unitsMilli: null, checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/t", expiresAt: new Date(Date.now() + 1.8e6).toISOString() }, 201)));
    await waitFor(() => expect(loc.assign).toHaveBeenCalledTimes(1));
  });
  it("a signed-out visitor sees prices from the public config, not a balance", async () => {
    window.localStorage.clear();
    api((m) => (m === "GET /config/public" ? json({ currency: "NGN", freePosts: 10, unitBaseKobo: 1380, costs, tiers: TIERS.tiers, extraVoice: TIERS.extraVoice, voiceFreeSeconds: 10 }) : undefined));
    render(<WalletScreen />);
    expect(await screen.findByText("Sign in to see your Voice Units")).toBeTruthy();
    expect(await screen.findByText("1 unit (₦13.80)")).toBeTruthy();
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

describe("Get Voice Units screen", () => {
  it("lists the packs from the API with price per unit and bonus, and the Pay button names the selected pack", async () => {
    search = "pack=buzz";
    api();
    render(<BuyUnitsScreen />);
    expect(await screen.findByRole("button", { name: /Pay ₦690 for 55 units/ })).toBeTruthy();
    expect(screen.getByText("₦12.55 a unit")).toBeTruthy();
    expect(screen.getByText("+5 bonus")).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: /Spark/ }));
    expect(screen.getByRole("button", { name: /Pay ₦138 for 10 units/ })).toBeTruthy();
    // arrow keys move between the packs
    screen.getByRole("radio", { name: /Spark/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /Buzz/ }).getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: /Spark/ }).getAttribute("aria-checked")).toBe("true");
  });
  it("sends the chosen method with the payment", async () => {
    const loc = { ...window.location, assign: vi.fn() };
    vi.stubGlobal("location", loc);
    const a = api((m) => (m === "POST /payments" ? json({ paymentId: PID, txRef: "voices-4", amountKobo: 13800, currency: "NGN", unitsMilli: 10000, checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/m", expiresAt: new Date(Date.now() + 1.8e6).toISOString() }, 201) : undefined));
    render(<BuyUnitsScreen />);
    await userEvent.click(await screen.findByRole("tab", { name: "Transfer" }));
    await userEvent.click(screen.getByRole("button", { name: /Pay ₦138 for 10 units/ }));
    await waitFor(() => expect(loc.assign).toHaveBeenCalled());
    const post = a.f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ kind: "UNITS", tierId: "t-spark", method: "banktransfer", returnPath: "/units/done" });
  });
  it("shows an offer only when the API sends one", async () => {
    api((m) => (m === "GET /units/tiers" ? json({ ...TIERS, walletOffer: { id: "o", kind: "WALLET_OFFER", brand: "B", label: "Ad", headline: "Top up and get 5 extra units." } }) : undefined));
    render(<BuyUnitsScreen />);
    expect(await screen.findByText("Top up and get 5 extra units.")).toBeTruthy();
  });
});

describe("Out of free posts", () => {
  it("shows the saved draft, the cost and the smallest pack from the API, and marks the draft as waiting", async () => {
    saveDraft("q-9", "Salary lands on the 25th.");
    api((m) => (m === "GET /wallet" ? json({ ...WALLET, balanceMilli: 0, freePostsRemaining: 0, freePostsUsed: 10 }) : undefined));
    const onKeep = vi.fn();
    render(<OutOfPostsSheet questionId="q-9" onKeep={onKeep} />);
    expect(await screen.findByText("You have used your 10 free posts")).toBeTruthy();
    expect(screen.getByText("Balance: 0 units")).toBeTruthy();
    expect(screen.getByText("Salary lands on the 25th.")).toBeTruthy();
    expect(screen.getByText(/A text post uses 0\.5 units \(₦6\.90\)\. The smallest pack is 10 units for ₦138\./)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Get Voice Units from ₦138" });
    expect(link.getAttribute("href")).toBe("/units/buy?from=%2Fq%2Fq-9");
    await userEvent.click(screen.getByRole("button", { name: "Keep my draft for later" }));
    expect(onKeep).toHaveBeenCalled();
  });
});
