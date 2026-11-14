// @vitest-environment jsdom
// V-ADMIN-MONEY: the admin money screens read the API's figures, ask on the page before money moves, and show what came back.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminMoneyOverviewPage } from "@/features/admin/money/OverviewPage";
import { AdminPaymentsPage } from "@/features/admin/money/PaymentsPage";
import { AdminWalletsPage } from "@/features/admin/money/WalletsPage";
import { AdminSubscriptionsPage } from "@/features/admin/money/SubscriptionsPage";
import { AdminPricesPage } from "@/features/admin/money/PricesPage";
import { bpsFromPercent, koboFromNaira, milliFromTokens, naira, percent, tokens } from "@/features/admin/money/format";
import { ADMIN_PAGES, canOpen } from "@/features/admin/roles";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/money" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ada.admin", roles, profile: { displayName: "Ada Admin" } });
const NOT_FOUND = { error: { code: "NOT_FOUND", message: "no" } };

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

type Call = { url: string; method: string; headers: Headers; body: unknown };
function stub(routes: (url: string, method: string, call: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string, init?: RequestInit) => {
      const call: Call = { url: u, method: (init?.method ?? "GET").toUpperCase(), headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(call);
      if (u.endsWith("/me")) return json(200, me(["ADMIN"]));
      if (u.includes("/admin/today")) return json(200, null);
      return routes(u, call.method, call) ?? json(404, NOT_FOUND);
    }),
  );
  return calls;
}

const slice = (count: number, price: number, vat: number, charge: number, total: number) => ({ count, priceKobo: price, vatKobo: vat, chargeKobo: charge, totalKobo: total });
const tokensOf = { soldMilli: 970000, fromPlansMilli: 500000, spentMilli: 10000, reversedMilli: 5000, adjustedInMilli: 2000, adjustedOutMilli: 1000, otherMilli: 0, netSpentMilli: 5000, walletChangeMilli: 1466000 };
const windowOf = (label: string, total: number) => ({
  label,
  fromDay: "2026-11-14",
  toDay: "2026-11-14",
  from: "2026-11-13T23:00:00Z",
  to: "2026-11-14T10:00:00Z",
  // Deliberately not adding up: the screen must show what the API says, never its own sum.
  received: { packs: slice(3, 100, 10, 1, 111), subscriptions: slice(1, 200, 20, 2, 222), other: slice(0, 0, 0, 0, 0), total: slice(4, 300, 30, 3, total) },
  overpaidKobo: 10000,
  payments: { paid: 4, failed: 1, pending: 2, expired: 0, refunded: 0 },
  newPayers: 4,
  tokens: tokensOf,
});

describe("formatting", () => {
  it("shows kobo as naira with separators and tokens without the milli", () => {
    expect(naira(1464000)).toBe("₦14,640");
    expect(naira(19953)).toBe("₦199.53");
    expect(naira(null)).toBe("-");
    expect(tokens(16670)).toBe("16.67");
    expect(tokens(183000)).toBe("183");
    expect(percent(750)).toBe("7.5%");
  });
  it("reads what a person types", () => {
    expect(koboFromNaira("1,464")).toBe(146400);
    expect(koboFromNaira("199.53")).toBe(19953);
    expect(koboFromNaira("-5")).toBeNull();
    expect(koboFromNaira("1.234")).toBeNull();
    expect(milliFromTokens("12.5")).toBe(12500);
    expect(milliFromTokens("abc")).toBeNull();
    expect(bpsFromPercent("7.5")).toBe(750);
  });
  it("no word a person reads has an em-dash", () => {
    for (const p of ADMIN_PAGES) expect(p.label).not.toMatch(/—/);
  });
});

describe("the Money section is for admins only", () => {
  it("the five pages are ADMIN only, and an editor sees no Money group in the nav", async () => {
    for (const p of ADMIN_PAGES.filter((x) => x.group === "Money")) {
      expect(canOpen(["ADMIN"], p.id)).toBe(true);
      for (const r of ["EDITOR", "MODERATOR", "AD_MANAGER"] as const) expect(canOpen([r], p.id)).toBe(false);
    }
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.endsWith("/me") ? json(200, me(["EDITOR"])) : u.includes("/admin/today") ? json(200, null) : json(404, NOT_FOUND))));
    render(<AdminFrame><div>page</div></AdminFrame>);
    await screen.findByText("page");
    expect(screen.queryByText("Money")).toBeNull();
    expect(screen.queryByText("Prices and limits")).toBeNull();
  });

  it("an admin sees the Money group with its five pages", async () => {
    stub(() => undefined);
    render(<AdminFrame><div>page</div></AdminFrame>);
    await screen.findByText("page");
    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    for (const w of ["Money", "Overview", "Payments", "A person's wallet", "Subscriptions", "Prices and limits"]) expect(within(nav).getByText(w)).toBeTruthy();
  });

  it("an editor who opens a money page directly gets the same not-found, and no money call is made", async () => {
    const fetchSpy = vi.fn(async (u: string) => (u.endsWith("/me") ? json(200, me(["EDITOR"])) : u.includes("/admin/today") ? json(200, null) : json(500, {})));
    vi.stubGlobal("fetch", fetchSpy);
    render(<AdminFrame><AdminPaymentsPage /></AdminFrame>);
    expect(await screen.findByText("We could not find that")).toBeTruthy();
    expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes("/admin/payments"))).toBe(false);
  });
});

describe("the overview", () => {
  it("shows the API's figures for each window and adds nothing up in the browser", async () => {
    const calls = stub((u) => (u.includes("/admin/money/overview") ? json(200, { asOf: "2026-11-14T10:00:00Z", lagosDay: "2026-11-14", tokensHeldMilli: 1466000, windows: { today: windowOf("Today", 99999), last7: windowOf("Last 7 days", 88888), last30: windowOf("Last 30 days", 77777) } }) : undefined));
    render(<AdminFrame><AdminMoneyOverviewPage /></AdminFrame>);
    expect(await screen.findByText("WAWU revenue (the price)")).toBeTruthy();
    // 300 + 30 + 3 is 333 kobo, but the API said 99999, 88888 and 77777: those are what is shown
    const received = screen.getByRole("table", { name: "Money received" });
    expect(within(received).getByText("₦999.99")).toBeTruthy();
    expect(within(received).getByText("₦888.88")).toBeTruthy();
    expect(within(received).getByText("₦777.77")).toBeTruthy();
    expect(within(received).queryByText("₦3.33")).toBeNull();
    const made = screen.getByRole("table", { name: "What it is made of" });
    expect(within(made).getAllByText("₦3").length).toBe(3); // price 300 kobo, in each window
    expect(within(made).getByText("Paid over the total, to refund by hand")).toBeTruthy();
    expect(screen.getByText("Tokens held by people")).toBeTruthy();
    expect(calls.filter((c) => c.url.includes("/admin/money/overview"))).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/—/);
  });
  it("says so plainly when the API refuses", async () => {
    stub((u) => (u.includes("/admin/money/overview") ? json(403, { error: { code: "ROLE_REQUIRED", message: "Your role cannot do this.", requestId: "r" } }) : undefined));
    render(<AdminFrame><AdminMoneyOverviewPage /></AdminFrame>);
    expect(await screen.findByText("This did not load")).toBeTruthy();
  });
});

const payment = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  kind: "UNITS",
  status: "PENDING",
  amountKobo: 18300,
  vatKobo: 1373,
  chargeKobo: 280,
  totalKobo: 19953,
  user: { id: "u9", handle: "chika.o" },
  txRef: "voices-abc-123",
  title: "Entry pack",
  unitsMilli: 183000,
  bonusMilli: 0,
  method: null,
  cardLast4: null,
  receiptNo: null,
  failureReason: null,
  balanceMilli: null,
  createdAt: "2026-11-14T09:00:00Z",
  verifiedAt: null,
  token: null,
  overpaidKobo: 0,
  refundNeeded: false,
  ...over,
});

describe("payments", () => {
  it("lists rows with the person, kind, price, VAT, charge, total, status, reference and time; filters go to the API; cursor pages append", async () => {
    const calls = stub((u) => {
      if (!u.includes("/admin/payments")) return undefined;
      if (u.includes("cursor=c2")) return json(200, { items: [payment({ id: "p2", user: { id: "u8", handle: "tunde.a" }, txRef: "voices-def-456" })], nextCursor: null });
      return json(200, { items: [payment()], nextCursor: "c2" });
    });
    render(<AdminFrame><AdminPaymentsPage /></AdminFrame>);
    const row = (await screen.findByText("chika.o")).closest("tr")!;
    for (const t of ["Token pack", "₦183", "₦13.73", "₦2.80", "₦199.53", "Pending", "voices-abc-123"]) expect(within(row).getByText(t)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("tunde.a")).toBeTruthy();
    expect(screen.getByText("chika.o")).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText("Kind"), "SUBSCRIPTION");
    await waitFor(() => expect(calls.some((c) => c.url.includes("kind=SUBSCRIPTION"))).toBe(true));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "FAILED");
    await waitFor(() => expect(calls.some((c) => c.url.includes("status=FAILED") && c.url.includes("kind=SUBSCRIPTION"))).toBe(true));
  });

  it("re-verify asks on the page first, then posts once with an Idempotency-Key and shows the result", async () => {
    const calls = stub((u, m) => {
      if (u.includes("/admin/payments/p1/reverify") && m === "POST") return json(200, payment({ status: "SUCCEEDED", balanceMilli: 183000 }));
      if (u.includes("/admin/payments")) return json(200, { items: [payment()], nextCursor: null });
      return undefined;
    });
    render(<AdminFrame><AdminPaymentsPage /></AdminFrame>);
    await screen.findByText("chika.o");
    await userEvent.click(screen.getByRole("button", { name: "Re-verify" }));
    expect(screen.getByText("Ask the provider about this payment again?")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Check it now" }));
    expect(await screen.findByText(/Checked with the provider: paid\. The person now has 183 tokens\./)).toBeTruthy();
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].headers.get("Idempotency-Key")).toBeTruthy();
    expect(screen.queryByText("Ask the provider about this payment again?")).toBeNull();
    expect(within(screen.getByText("chika.o").closest("tr")!).getByText("Paid")).toBeTruthy(); // the row now says Paid
  });

  it("cancel does not call the API; a refusal is shown in plain words", async () => {
    const calls = stub((u, m) => {
      if (u.includes("/reverify") && m === "POST") return json(404, { error: { code: "NOT_FOUND", message: "We could not find that payment.", requestId: "r" } });
      if (u.includes("/admin/payments")) return json(200, { items: [payment()], nextCursor: null });
      return undefined;
    });
    render(<AdminFrame><AdminPaymentsPage /></AdminFrame>);
    await screen.findByText("chika.o");
    await userEvent.click(screen.getByRole("button", { name: "Re-verify" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Re-verify" }));
    await userEvent.click(screen.getByRole("button", { name: "Check it now" }));
    expect(await screen.findByText("We could not find that payment.")).toBeTruthy();
  });
});

const wallet = (balanceMilli: number, extra: Record<string, unknown> = {}) => ({
  user: { id: "u9", handle: "chika.o", displayName: "Chika" },
  balanceMilli,
  freePostsRemaining: 4,
  ledger: [{ id: "l1", kind: "PURCHASE", title: "Entry pack", deltaMilli: 183000, balanceAfterMilli: 183000, free: false, paymentId: null, hasReceipt: false, createdAt: "2026-11-14T09:00:00Z", note: null, amountKobo: null, freePostsLeft: null }],
  payments: [],
  nextCursor: null,
  ...extra,
});

describe("a person's wallet", () => {
  async function openWallet(balance = 50000) {
    const calls = stub((u, m) => {
      if (u.includes("/admin/users")) return json(200, { items: [{ profile: { id: "u9", handle: "chika.o", displayName: "Chika" }, status: "ACTIVE", roles: [], strikes: 0, createdAt: "2026-11-01T00:00:00Z" }], nextCursor: null });
      if (u.includes("/admin/wallets/u9/adjust") && m === "POST") return json(201, wallet(balance + 20000, { adjustment: { auditId: "aud-123", txnId: "txn-456", deltaMilli: 20000, balanceMilli: balance + 20000 } }));
      if (u.includes("/admin/wallets/u9")) return json(200, wallet(balance));
      return undefined;
    });
    render(<AdminFrame><AdminWalletsPage /></AdminFrame>);
    await userEvent.type(await screen.findByLabelText("Handle"), "chika.o");
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    await screen.findByText("50 tokens");
    return calls;
  }

  it("shows the person's account status beside the adjust form, in words, and keeps the form usable", async () => {
    stub((u) => {
      if (u.includes("/admin/users")) return json(200, { items: [{ profile: { id: "u9", handle: "chika.o", displayName: "Chika" }, status: "SUSPENDED", roles: [], strikes: 0, createdAt: "2026-11-01T00:00:00Z" }], nextCursor: null });
      if (u.includes("/admin/wallets/u9")) return json(200, wallet(50000, { status: "SUSPENDED" }));
      return undefined;
    });
    render(<AdminFrame><AdminWalletsPage /></AdminFrame>);
    await userEvent.type(await screen.findByLabelText("Handle"), "chika.o");
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    await screen.findByText("50 tokens");
    const box = screen.getByTestId("wallet-account-status");
    expect(within(box).getByText("Suspended")).toBeTruthy();
    expect(screen.getByText("This account is suspended. You can still change their balance.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Tokens"), "5");
    await userEvent.type(screen.getByLabelText("Reason"), "Goodwill");
    expect((screen.getByRole("button", { name: "Review the change" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("finds a person by handle and shows the balance and ledger", async () => {
    const calls = await openWallet();
    expect(calls.some((c) => c.url.includes("/admin/users?q=chika.o"))).toBe(true);
    expect(screen.getByText("Entry pack")).toBeTruthy();
    expect(screen.getByText("+183")).toBeTruthy();
  });

  it("an adjustment needs an amount and a reason, asks on the page, then shows the audit id and the ledger transaction", async () => {
    const calls = await openWallet();
    const review = screen.getByRole("button", { name: "Review the change" }) as HTMLButtonElement;
    expect(review.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText("Tokens"), "20");
    expect(review.disabled).toBe(true); // no reason yet
    await userEvent.type(screen.getByLabelText("Reason"), "Goodwill after the outage");
    expect(review.disabled).toBe(false);
    await userEvent.click(review);
    expect(screen.getByText("Add 20 tokens to chika.o?")).toBeTruthy();
    expect(screen.getByText(/goes from 50 to 70 tokens/)).toBeTruthy();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Add the tokens" }));
    expect(await screen.findByText(/Audit id aud-123\. Ledger transaction txn-456\./)).toBeTruthy();
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toEqual({ deltaMilli: 20000, reason: "Goodwill after the outage" });
    expect(post.headers.get("Idempotency-Key")).toBeTruthy();
    expect(screen.getByText("70 tokens")).toBeTruthy();
  });

  it("taking away more than the balance, zero, a negative or more than 1,000 tokens is stopped before any call", async () => {
    const calls = await openWallet(50000);
    await userEvent.click(screen.getByRole("tab", { name: "Take tokens away" }));
    const amount = screen.getByLabelText("Tokens");
    await userEvent.type(amount, "51");
    expect(screen.getByText(/A balance cannot go below zero/)).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Reason"), "Mistake");
    expect((screen.getByRole("button", { name: "Review the change" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.clear(amount);
    await userEvent.type(amount, "-3");
    expect(screen.getByText(/Use a number above 0/)).toBeTruthy();
    await userEvent.clear(amount);
    await userEvent.type(amount, "0");
    expect(screen.getByText(/Use a number above 0/)).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Add tokens" }));
    await userEvent.clear(amount);
    await userEvent.type(amount, "1001");
    expect(screen.getByText("At most 1,000 tokens at a time.")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});

describe("subscriptions", () => {
  it("lists plans with start, end, months credited and the next credit day; the filter goes to the API", async () => {
    const sub = (over: Record<string, unknown>) => ({ id: "s1", user: { id: "u9", handle: "chika.o", displayName: null }, plan: { slug: "connect", name: "VOICES CONNECT" }, status: "ACTIVE", startDay: "2026-11-14", endDay: "2027-02-14", months: 3, creditedMonths: 1, monthlyMilli: 500000, priceKobo: 299900, nextCreditDay: "2026-12-14", paymentId: "p1", createdAt: "2026-11-14T09:00:00Z", ...over });
    const calls = stub((u) => (u.includes("/admin/subscriptions") ? json(200, { items: [sub({}), sub({ id: "s2", status: "ENDED", creditedMonths: 3, nextCreditDay: null, user: { id: "u8", handle: "tunde.a", displayName: null } })], counts: { ACTIVE: 1, ENDED: 1 }, nextCursor: null }) : undefined));
    render(<AdminFrame><AdminSubscriptionsPage /></AdminFrame>);
    const row = (await screen.findByText("chika.o")).closest("tr")!;
    for (const t of ["VOICES CONNECT", "Active", "1 of 3", "Sat 14 Nov 2026", "Mon 14 Dec 2026", "500", "₦2,999"]) expect(within(row).getByText(t)).toBeTruthy();
    const ended = screen.getByText("tunde.a").closest("tr")!;
    expect(within(ended).getByText("3 of 3")).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText("Show"), "ENDED");
    await waitFor(() => expect(calls.some((c) => c.url.includes("status=ENDED"))).toBe(true));
    expect(calls.every((c) => c.method === "GET" || c.url.includes("/me"))).toBe(true);
  });
});

describe("prices and limits", () => {
  const entry = (key: string, value: unknown, over: Record<string, unknown> = {}) => ({ key, value, description: null, placeholder: false, version: 1, updatedAt: "2026-11-14T09:00:00Z", updatedBy: null, ...over });
  const config = () => ({
    items: [
      entry("cost.text_post_milli", 5000),
      entry("text.price_chars", 150),
      entry("voice.extra30.price_kobo", 7800),
      entry("voice.extra60.price_kobo", 10000),
      entry("textfix.cost_milli", 5000),
      entry("allowance.free_posts", 10),
      entry("allowance.free_post_text_chars", 500),
      entry("allowance.messages_per_day", 20),
      entry("units.min_purchase_kobo", 18300),
      entry("cost.reaction_milli", 100),
      entry("cost.vote_milli", 200),
      entry("cost.proposal_milli", 0),
      entry("cost.explain_milli", 0),
      entry("charges.vat_rate_bps", 750, { placeholder: true }),
      entry("charges.fee_rate_bps", 140, { placeholder: true }),
      entry("charges.fee_flat_kobo", 0, { placeholder: true }),
      entry("charges.fee_cap_kobo", 200000, { placeholder: true }),
      entry("units.tiers", [{ slug: "entry", name: "Entry", priceKobo: 18300, unitsMilli: 183000, bonusMilli: 0 }]),
      entry("units.plans", [{ slug: "connect", name: "VOICES CONNECT", months: 3, priceKobo: 299900, monthlyMilli: 500000, active: true }]),
    ],
  });
  const change = (over: Record<string, unknown> = {}) => ({ id: "c1", key: "allowance.messages_per_day", oldValue: 20, newValue: 30, reason: "Launch week", by: "bola.admin", createdAt: "2026-11-14T08:00:00Z", rollbackOfId: null, ...over });

  it("shows the four action costs in their own group, editable, with Put back on a changed one", async () => {
    stub((u) =>
      u.includes("/admin/config/changes") ? json(200, { items: [change({ id: "c9", key: "cost.vote_milli", oldValue: 100, newValue: 200 })], nextCursor: null }) : u.includes("/admin/config") ? json(200, config()) : undefined,
    );
    render(<AdminFrame><AdminPricesPage /></AdminFrame>);
    await screen.findByText("What an action costs");
    for (const t of ["A reaction", "A vote", "A What Next? proposal", "Explaining a vote"]) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    const row = screen.getAllByText("A vote").map((e) => e.closest("li")).find(Boolean) as HTMLElement;
    expect(within(row).getByText("0.2 tokens")).toBeTruthy();
    expect(within(row).getByRole("button", { name: /Change/ })).toBeTruthy();
    expect(within(row).getByRole("button", { name: /Put back/ })).toBeTruthy();
  });

  it("shows every setting in plain units, the placeholders flagged, and the change log", async () => {
    stub((u) => (u.includes("/admin/config/changes") ? json(200, { items: [change()], nextCursor: null }) : u.includes("/admin/config") ? json(200, config()) : undefined));
    render(<AdminFrame><AdminPricesPage /></AdminFrame>);
    await screen.findByText("VAT rate");
    for (const t of ["7.5%", "1.4%", "₦78", "₦100", "5 tokens", "150 characters", "₦2,000", "20"]) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Owner to confirm").length).toBe(4);
    const log = screen.getByRole("table", { name: "Change log" });
    expect(within(log).getByText("bola.admin")).toBeTruthy();
    expect(within(log).getByText("Launch week")).toBeTruthy();
    expect(within(log).getByText("20")).toBeTruthy();
    expect(within(log).getByText("30")).toBeTruthy();
  });

  it("a change needs a reason, is reviewed on the page, then sent as one PUT with the value in kobo", async () => {
    const calls = stub((u, m) => {
      if (u.includes("/admin/config/voice.extra30.price_kobo") && m === "PUT") return json(200, entry("voice.extra30.price_kobo", 9000));
      if (u.includes("/admin/config/changes")) return json(200, { items: [], nextCursor: null });
      if (u.includes("/admin/config")) return json(200, config());
      return undefined;
    });
    render(<AdminFrame><AdminPricesPage /></AdminFrame>);
    const row = (await screen.findByText("Voice message, up to 30 seconds")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Change" }));
    const input = within(row).getByLabelText("Voice message, up to 30 seconds");
    await userEvent.clear(input);
    await userEvent.type(input, "90");
    const review = within(row).getByRole("button", { name: "Review the change" }) as HTMLButtonElement;
    expect(review.disabled).toBe(true); // no reason
    await userEvent.type(within(row).getByLabelText("Reason"), "Cheaper voice for launch");
    await userEvent.click(review);
    expect(within(row).getByText(/From ₦78 to ₦90\./)).toBeTruthy();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    await userEvent.click(within(row).getByRole("button", { name: "Change it" }));
    await screen.findByText(/changed\. It applies to the next checkout/);
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.body).toEqual({ value: 9000, reason: "Cheaper voice for launch" });
  });

  it("a negative or fractional number is stopped on the page; the same value is not a change", async () => {
    const calls = stub((u) => (u.includes("/admin/config/changes") ? json(200, { items: [], nextCursor: null }) : u.includes("/admin/config") ? json(200, config()) : undefined));
    render(<AdminFrame><AdminPricesPage /></AdminFrame>);
    const row = (await screen.findByText("Free posts for each person")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Change" }));
    const input = within(row).getByLabelText("Free posts for each person");
    await userEvent.type(within(row).getByLabelText("Reason"), "A reason");
    const review = within(row).getByRole("button", { name: "Review the change" }) as HTMLButtonElement;
    expect(review.disabled).toBe(true); // 10 is already 10
    await userEvent.clear(input);
    await userEvent.type(input, "-1");
    expect(review.disabled).toBe(true);
    expect(within(row).getByText("A whole number")).toBeTruthy();
    await userEvent.clear(input);
    await userEvent.type(input, "2.5");
    expect(review.disabled).toBe(true);
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("the API's refusal is shown in its own words", async () => {
    stub((u, m) => {
      if (u.includes("/admin/config/charges.vat_rate_bps") && m === "PUT") return json(422, { error: { code: "VALIDATION_FAILED", message: "Some details need fixing.", requestId: "r", details: { fields: [{ path: "value", message: "Use a whole number from 0 to 2500." }] } } });
      if (u.includes("/admin/config/changes")) return json(200, { items: [], nextCursor: null });
      if (u.includes("/admin/config")) return json(200, config());
      return undefined;
    });
    render(<AdminFrame><AdminPricesPage /></AdminFrame>);
    const row = (await screen.findByText("VAT rate")).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Change" }));
    const input = within(row).getByLabelText("VAT rate");
    await userEvent.clear(input);
    await userEvent.type(input, "40");
    await userEvent.type(within(row).getByLabelText("Reason"), "Try it");
    await userEvent.click(within(row).getByRole("button", { name: "Review the change" }));
    await userEvent.click(within(row).getByRole("button", { name: "Change it" }));
    expect(await within(row).findByText("Use a whole number from 0 to 2500.")).toBeTruthy();
  });

  it("Put back restores the previous value: it asks for a reason, then posts the rollback for the newest change", async () => {
    const calls = stub((u, m) => {
      if (u.includes("/admin/config/changes/c1/rollback") && m === "POST") return json(200, entry("allowance.messages_per_day", 20));
      if (u.includes("/admin/config/changes")) return json(200, { items: [change()], nextCursor: null });
      if (u.includes("/admin/config")) return json(200, config());
      return undefined;
    });
    render(<AdminFrame><AdminPricesPage /></AdminFrame>);
    const row = (await screen.findAllByText("Messages a person can send in a day"))[0].closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Put back" }));
    expect(screen.getByText('Put "Messages a person can send in a day" back?')).toBeTruthy();
    expect(screen.getByText(/From 30 back to 20\./)).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Reason"), "Too many for now");
    await userEvent.click(screen.getByRole("button", { name: "Put it back" }));
    await screen.findByText(/put back to 20\./);
    const post = calls.find((c) => c.method === "POST" && c.url.includes("rollback"))!;
    expect(post.body).toEqual({ reason: "Too many for now" });
  });

  it("packs and plans can be edited; a plan keeps its months and tokens a month", async () => {
    const calls = stub((u, m) => {
      if (u.includes("/admin/config/units.plans") && m === "PUT") return json(200, entry("units.plans", []));
      if (u.includes("/admin/config/changes")) return json(200, { items: [], nextCursor: null });
      if (u.includes("/admin/config")) return json(200, config());
      return undefined;
    });
    render(<AdminFrame><AdminPricesPage /></AdminFrame>);
    const card = (await screen.findByRole("table", { name: "Subscription plans" })).closest("section")!;
    await userEvent.click(within(card).getByRole("button", { name: "Change" }));
    expect(within(card).getByText(/3 months, 500 tokens a month/)).toBeTruthy();
    expect(within(card).queryByLabelText("connect months")).toBeNull();
    const price = within(card).getByLabelText("connect price");
    await userEvent.clear(price);
    await userEvent.type(price, "2499");
    await userEvent.type(within(card).getByLabelText("Reason"), "Launch price");
    await userEvent.click(within(card).getByRole("button", { name: "Review the change" }));
    expect(within(card).getByText(/VOICES CONNECT: ₦2,999, to ₦2,499/)).toBeTruthy();
    await userEvent.click(within(card).getByRole("button", { name: "Change them" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.body).toEqual({ value: [{ slug: "connect", name: "VOICES CONNECT", months: 3, priceKobo: 249900, monthlyMilli: 500000, active: true }], reason: "Launch price" });
  });
});
