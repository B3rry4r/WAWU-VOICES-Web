// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let search = "";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(search) }));

import { BuyUnitsScreen } from "@/features/units/BuyUnitsScreen";
import { WalletScreen } from "@/features/units/WalletScreen";
import { PaymentDoneScreen } from "@/features/units/PaymentDoneScreen";
import { MySubscriptionCard } from "@/features/units/Plans";
import { monthsLabel, packLine, planDay } from "@/features/units/format";
import { startCheckout } from "@/features/units/checkout";

const PID = "01a1ad10-f09a-73fc-9902-42da40d26dec";
const costs = { baseKoboPerUnit: 100, freeReactionsPerDay: 20, freeVotesPerDay: 3, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 100, voteAfterFreeMilli: 200, minPackKobo: 18300, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 5000, freeVoiceSeconds: 10, textPriceChars: 150, freePostTextChars: 500, messagesPerDay: 20, textFixMilli: 5000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 };
const tier = (id: string, slug: string, name: string, price: number, u: number) => ({ id, slug, name, priceKobo: price, unitsMilli: u, bonusMilli: 0, effectiveKoboPerUnit: 100, baseKoboPerUnit: 100 });
const TIERS = { tiers: [tier("t-entry", "entry", "Entry", 18300, 183000), tier("t-standard", "standard", "Standard", 73200, 732000)], minPackKobo: 18300, costs, extraVoice: [], walletOffer: null };
const WALLET = { balanceMilli: 500000, freePostsRemaining: 0, freePostsUsed: 10, allowances: {}, costs, tokens: [] };
const PLANS = {
  plans: [
    { id: "p-connect", slug: "connect", name: "VOICES CONNECT", months: 3, priceKobo: 299900, monthlyMilli: 500000, totalMilli: 1500000 },
    { id: "p-plus", slug: "plus", name: "VOICES PLUS", months: 6, priceKobo: 539900, monthlyMilli: 600000, totalMilli: 3600000 },
    { id: "p-infinity", slug: "infinity", name: "VOICES INFINITY", months: 12, priceKobo: 959900, monthlyMilli: 750000, totalMilli: 9000000 },
  ],
};
const SUB = { id: "s1", planSlug: "connect", planName: "VOICES CONNECT", status: "ACTIVE", months: 3, monthlyMilli: 500000, totalMilli: 1500000, priceKobo: 299900, creditedMonths: 1, startDay: "2026-11-14", endDay: "2027-02-14", nextCreditDay: "2026-12-14", paymentId: PID };
const NONE = { current: null, queued: null, past: [], canBuy: true };
const ACTIVE = { current: SUB, queued: null, past: [], canBuy: false };
const INIT = { paymentId: PID, txRef: "voices-1", amountKobo: 299900, currency: "NGN", unitsMilli: 1500000, checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/abc", expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

type Handler = (m: string, init: RequestInit) => Response | undefined;
function api(mine: unknown, extra: Handler = () => undefined) {
  const calls: Array<{ m: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: unknown, init: RequestInit = {}) => {
      const url = String(u).replace(/^.*\/api\/v1/, "").replace(/^https?:\/\/[^/]+/, "");
      const m = (init.method ?? "GET") + " " + url;
      calls.push({ m, init });
      const e = extra(m, init);
      if (e) return e;
      if (m === "GET /wallet") return json(WALLET);
      if (m === "GET /units/tiers") return json(TIERS);
      if (m === "GET /subscription-plans") return json(PLANS);
      if (m === "GET /subscriptions/me") return json(mine);
      if (m.startsWith("GET /wallet/history")) return json({ items: [], nextCursor: null });
      if (m.startsWith("GET /ads/placement")) return json({ ad: null });
      return json({ error: { code: "NOT_FOUND", message: "x" } }, 404);
    }),
  );
  return calls;
}

beforeEach(() => {
  search = "";
  push.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("plan words and days", () => {
  it("a Lagos day is written without a time zone move, and months read in plain words", () => {
    expect(planDay("2027-02-14")).toBe("14 Feb 2027");
    expect(planDay("2026-12-01")).toBe("1 Dec 2026");
    expect(monthsLabel(1)).toBe("1 month");
    expect(monthsLabel(12)).toBe("12 months");
  });
  it("the payment line names the plan, its months and its monthly tokens", () => {
    const p = { kind: "SUBSCRIPTION", title: "VOICES PLUS", unitsMilli: 3600000, plan: { slug: "plus", name: "VOICES PLUS", months: 6, monthlyMilli: 600000 } } as never;
    expect(packLine(p)).toBe("VOICES PLUS, 6 months, 600 tokens a month");
  });
});

describe("Get tokens: the plans", () => {
  it("shows the three plans from the API with price, each month and in total, no dashes", async () => {
    api(NONE);
    const { container } = render(<BuyUnitsScreen />);
    const connect = await screen.findByTestId("plan-connect");
    expect(within(connect).getByText("VOICES CONNECT")).toBeTruthy();
    expect(within(connect).getByText("3 months")).toBeTruthy();
    expect(within(connect).getByText("₦2,999")).toBeTruthy();
    expect(within(connect).getByText("500 tokens")).toBeTruthy();
    expect(within(connect).getByText("1,500 tokens")).toBeTruthy();
    const plus = screen.getByTestId("plan-plus");
    expect(within(plus).getByText("₦5,399")).toBeTruthy();
    expect(within(plus).getByText("600 tokens")).toBeTruthy();
    expect(within(plus).getByText("3,600 tokens")).toBeTruthy();
    const inf = screen.getByTestId("plan-infinity");
    expect(within(inf).getByText("₦9,599")).toBeTruthy();
    expect(within(inf).getByText("750 tokens")).toBeTruthy();
    expect(within(inf).getByText("9,000 tokens")).toBeTruthy();
    expect(container.textContent).not.toMatch(/[–—]/);
  });

  it("a different price from the API shows as is: nothing is hard coded", async () => {
    vi.stubGlobal("fetch", vi.fn());
    api(NONE, (m) => (m === "GET /subscription-plans" ? json({ plans: [{ ...PLANS.plans[0], priceKobo: 350000 }] }) : undefined));
    render(<BuyUnitsScreen />);
    expect(await within(await screen.findByTestId("plan-connect")).findByText("₦3,500")).toBeTruthy();
  });

  it("the buy button starts the same checkout as a pack: the plan id, the key, no amount, then the hosted page", async () => {
    const calls = api(NONE, (m) => (m === "POST /payments" ? json(INIT, 201) : undefined));
    const go = vi.fn();
    // the screen goes to window.location.assign; assert on the request it sends
    Object.defineProperty(window, "location", { value: { ...window.location, assign: go }, writable: true });
    render(<BuyUnitsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /Get VOICES CONNECT/ }));
    await waitFor(() => expect(calls.some((c) => c.m === "POST /payments")).toBe(true));
    const post = calls.find((c) => c.m === "POST /payments")!;
    expect(JSON.parse(post.init.body as string)).toEqual({ kind: "SUBSCRIPTION", planId: "p-connect", returnPath: "/units/done" });
    expect(new Headers(post.init.headers).get("idempotency-key")).toMatch(/.{8,}/);
    await waitFor(() => expect(go).toHaveBeenCalledWith(INIT.checkoutUrl));
  });

  it("startCheckout for a plan keeps the key across a retry, and sends no amount", async () => {
    let n = 0;
    const keys: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: unknown, init: RequestInit) => {
      n++;
      keys.push(new Headers(init.headers).get("idempotency-key") ?? "");
      if (n === 1) throw new TypeError("offline");
      return json(INIT, 201);
    }));
    const go = vi.fn();
    await expect(startCheckout({ kind: "SUBSCRIPTION", planId: "p-plus" }, undefined, go)).rejects.toBeTruthy();
    await startCheckout({ kind: "SUBSCRIPTION", planId: "p-plus" }, undefined, go);
    expect(keys[0]).toBe(keys[1]);
    expect(go).toHaveBeenCalledWith(INIT.checkoutUrl);
  });

  it("with a plan running the buttons are off and the page says until when; the pack button still works", async () => {
    api(ACTIVE);
    render(<BuyUnitsScreen />);
    const connect = await screen.findByTestId("plan-connect");
    expect((within(connect).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/You already have a plan until 14 Feb 2027/)).toBeTruthy();
    expect(screen.getAllByText("My subscription").length).toBeGreaterThan(0);
    const pay = screen.getByRole("button", { name: /^Pay / }) as HTMLButtonElement;
    expect(pay.disabled).toBe(false);
  });

  it("a refused second plan shows the API's own plain words", async () => {
    api(NONE, (m) => (m === "POST /payments" ? json({ error: { code: "SUBSCRIPTION_ACTIVE", message: "You already have VOICES CONNECT until 14 Feb 2027. You can buy another plan after it ends. You can still buy token packs." } }, 409) : undefined));
    render(<BuyUnitsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: /Get VOICES PLUS/ }));
    expect(await screen.findByText(/You already have VOICES CONNECT until 14 Feb 2027/)).toBeTruthy();
  });

  it("if the plans cannot load, the packs still show", async () => {
    api(NONE, (m) => (m === "GET /subscription-plans" ? json({ error: { code: "INTERNAL", message: "x" } }, 500) : undefined));
    render(<BuyUnitsScreen />);
    expect(await screen.findByRole("button", { name: /^Pay / })).toBeTruthy();
    expect(screen.queryByTestId("plan-connect")).toBeNull();
  });
});

describe("My subscription", () => {
  it("shows the plan, months credited so far, next credit day and end day", () => {
    const { container } = render(<MySubscriptionCard mine={ACTIVE as never} />);
    expect(screen.getByText("VOICES CONNECT")).toBeTruthy();
    expect(screen.getByText("500 tokens a month for 3 months")).toBeTruthy();
    expect(screen.getByText("1 of 3")).toBeTruthy();
    expect(screen.getByText("14 Dec 2026")).toBeTruthy();
    expect(screen.getByText("14 Feb 2027")).toBeTruthy();
    expect(container.textContent).not.toMatch(/[–—]/);
  });
  it("after the last credit it says all months are credited, with the end day still shown", () => {
    render(<MySubscriptionCard mine={{ ...ACTIVE, current: { ...SUB, creditedMonths: 3, nextCreditDay: null } } as never} />);
    expect(screen.getByText("3 of 3")).toBeTruthy();
    expect(screen.getByText("All months credited")).toBeTruthy();
  });
  it("a plan waiting to start is named with its start day", () => {
    render(<MySubscriptionCard mine={{ current: SUB, queued: { ...SUB, id: "s2", planName: "VOICES PLUS", status: "QUEUED", startDay: "2027-02-14", months: 6, monthlyMilli: 600000 }, past: [], canBuy: false } as never} />);
    expect(screen.getByText("VOICES PLUS is next")).toBeTruthy();
    expect(screen.getByText(/starts on 14 Feb 2027/)).toBeTruthy();
  });
  it("with no plan it says so and points to the plans", () => {
    render(<MySubscriptionCard mine={NONE as never} />);
    expect(screen.getByText("You have no plan")).toBeTruthy();
    expect((screen.getByRole("link", { name: "See the plans" }) as HTMLAnchorElement).getAttribute("href")).toBe("/units/buy#plans");
  });
  it("the Tokens page loads it for the signed-in person", async () => {
    const calls = api(ACTIVE);
    render(<WalletScreen />);
    expect(await screen.findByText("1 of 3")).toBeTruthy();
    expect(calls.some((c) => c.m === "GET /subscriptions/me")).toBe(true);
  });
});

describe("the return page for a plan", () => {
  it("says the plan has started, with the plan line, and verifies once", async () => {
    search = `paymentId=${PID}&status=successful&transaction_id=285959875&tx_ref=voices-1`;
    const paid = { id: PID, kind: "SUBSCRIPTION", status: "SUCCEEDED", amountKobo: 299900, txRef: "voices-1", title: "VOICES CONNECT", unitsMilli: 1500000, bonusMilli: 0, method: "card", cardLast4: "4412", receiptNo: "VT-261114-ABCD1234", failureReason: null, balanceMilli: 500000, createdAt: "2026-11-14T10:00:00Z", verifiedAt: "2026-11-14T10:02:00Z", token: null, plan: { slug: "connect", name: "VOICES CONNECT", months: 3, monthlyMilli: 500000 } };
    const calls = api(NONE, (m) => (m === `GET /payments/${PID}` || m === `POST /payments/${PID}/verify` ? json(paid) : undefined));
    const { container } = render(<PaymentDoneScreen />);
    expect(await screen.findByText("VOICES CONNECT has started")).toBeTruthy();
    expect(screen.getByText("VOICES CONNECT, 3 months, 500 tokens a month")).toBeTruthy();
    expect(screen.getByText("₦2,999")).toBeTruthy();
    expect(container.textContent).not.toMatch(/[–—]/);
    expect(calls.filter((c) => c.m.endsWith("/verify")).length).toBeLessThanOrEqual(1);
  });
});

describe("the customer pays VAT and the payment charge: the breakdown", () => {
  const STD = { priceKobo: 73200, vatKobo: 5490, chargeKobo: 1131, totalKobo: 79821 };
  const CON = { priceKobo: 299900, vatKobo: 22493, chargeKobo: 4578, totalKobo: 326971 };
  const withQuotes = (m: string) => {
    if (m === "GET /units/tiers") return json({ ...TIERS, vatRateBps: 750, tiers: TIERS.tiers.map((t) => ({ ...t, quote: t.slug === "standard" ? STD : { priceKobo: t.priceKobo, vatKobo: 1373, chargeKobo: 280, totalKobo: t.priceKobo + 1653 } })) });
    if (m === "GET /subscription-plans") return json({ vatRateBps: 750, plans: PLANS.plans.map((p) => ({ ...p, quote: p.slug === "connect" ? CON : { priceKobo: p.priceKobo, vatKobo: 1, chargeKobo: 1, totalKobo: p.priceKobo + 2 } })) });
    return undefined;
  };

  it("a pack shows Price, VAT (7.5%), Payment charge and Total, and the button shows the total", async () => {
    api(NONE, withQuotes);
    const { container } = render(<BuyUnitsScreen />);
    const packBreakdown = (await screen.findAllByTestId("breakdown"))[0];
    expect(within(packBreakdown).getByText("Price")).toBeTruthy();
    expect(within(packBreakdown).getByText("₦732")).toBeTruthy();
    expect(within(packBreakdown).getByText("VAT (7.5%)")).toBeTruthy();
    expect(within(packBreakdown).getByText("₦54.90")).toBeTruthy();
    expect(within(packBreakdown).getByText("Payment charge")).toBeTruthy();
    expect(within(packBreakdown).getByText("₦11.31")).toBeTruthy();
    expect(within(packBreakdown).getByText("Total")).toBeTruthy();
    expect(within(packBreakdown).getByText("₦798.21")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pay ₦798.21 for 732 tokens" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/[–—]/);
  });

  it("a plan shows its own breakdown and its button shows the total, tokens unchanged", async () => {
    api(NONE, withQuotes);
    render(<BuyUnitsScreen />);
    const connect = await screen.findByTestId("plan-connect");
    expect(within(connect).getByText("₦3,269.71", { selector: "dd" })).toBeTruthy();
    expect(within(connect).getByText("₦224.93")).toBeTruthy();
    expect(within(connect).getByText("₦45.78")).toBeTruthy();
    expect(within(connect).getByText("500 tokens")).toBeTruthy();
    expect(within(connect).getByRole("button", { name: "Get VOICES CONNECT" }).textContent).toBe("Pay ₦3,269.71");
  });

  it("the receipt lists price, VAT and charge before the total paid", async () => {
    const { ReceiptScreen } = await import("@/features/units/ReceiptScreen");
    api(NONE, (m) => (m.startsWith("GET /payments/") && m.endsWith("/receipt") ? json({ receiptNo: "VT-1", txRef: "voices-1", title: "Standard pack", amountKobo: 73200, vatKobo: 5490, chargeKobo: 1131, totalKobo: 79821, unitsMilli: 732000, method: "card", cardLast4: null, paidAt: "2026-11-14T10:00:00Z", buyerHandle: "ada" }) : undefined));
    render(<ReceiptScreen paymentId={PID} />);
    expect(await screen.findByText("₦798.21")).toBeTruthy();
    expect(screen.getByText("VAT")).toBeTruthy();
    expect(screen.getByText("₦54.90")).toBeTruthy();
  });
});
