// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

const push = vi.fn();
let search = "mode=join";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/sign-in",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/features/entry/AuthSheet", () => ({ AuthSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
const register = vi.fn(async (_: unknown) => ({}));
const signInCall = vi.fn(async (..._: unknown[]) => ({}));
vi.mock("@/lib/api/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/auth")>()),
  register: (i: unknown) => register(i),
  signIn: (...a: unknown[]) => signInCall(...a),
  startEmailVerification: vi.fn(async () => ({ expiresIn: 300 })),
}));
vi.mock("@/lib/api/me", () => ({ getMe: vi.fn(async () => ({ profileComplete: true })) }));

import { PhoneField } from "@/components/vx";
import { idAsSent, SignIn } from "@/features/entry/SignIn";
import { DIAL_COUNTRIES, searchCountries } from "@/lib/phone/countries";
import { countryForNumber, looksLikePhone, readPhone } from "@/lib/phone/phone";

afterEach(cleanup);
beforeEach(() => {
  register.mockClear();
  signInCall.mockClear();
  push.mockClear();
  search = "mode=join";
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("the number formed", () => {
  it("Nigeria is the default and a leading 0 is dropped", () => {
    expect(readPhone("0803 214 7720")).toMatchObject({ ok: true, e164: "+2348032147720", national: "8032147720" });
    expect(readPhone("803-214-7720", "NG")).toMatchObject({ ok: true, e164: "+2348032147720" });
    expect(readPhone("+234 803 214 7720", "NG")).toMatchObject({ ok: true, e164: "+2348032147720" });
    expect(readPhone("2348032147720", "NG")).toMatchObject({ ok: true, e164: "+2348032147720" });
    expect(readPhone("+234 (0) 803 214 7720", "NG")).toMatchObject({ ok: true, e164: "+2348032147720" });
  });
  it("another country uses its own code and drops its trunk 0", () => {
    expect(readPhone("07400 123456", "GB")).toMatchObject({ ok: true, e164: "+447400123456", national: "7400123456" });
    expect(readPhone("(201) 555-0123", "US")).toMatchObject({ ok: true, e164: "+12015550123" });
    expect(readPhone("024 123 4567", "GH")).toMatchObject({ ok: true, e164: "+233241234567" });
  });
  it("a number typed with + or 00 is read on its own, whatever country is chosen", () => {
    expect(readPhone("+44 7400 123456", "NG")).toMatchObject({ ok: true, e164: "+447400123456" });
    expect(readPhone("0044 7400 123456", "NG")).toMatchObject({ ok: true, e164: "+447400123456" });
    expect(countryForNumber("+447400123456", "NG").code).toBe("GB");
    expect(countryForNumber("+2348032147720", "GH").code).toBe("NG");
  });
  it("refuses what cannot be a number", () => {
    expect(readPhone("   ")).toEqual({ ok: false, reason: "empty" });
    expect(readPhone("12ab")).toEqual({ ok: false, reason: "invalid" });
    expect(readPhone("123", "GB")).toEqual({ ok: false, reason: "invalid" });
    expect(readPhone("0803 214 77", "NG")).toEqual({ ok: false, reason: "invalid" });
    expect(readPhone("+1234567890123456", "US")).toEqual({ ok: false, reason: "invalid" });
  });
  it("removes an explicit (0) trunk, keeps a bare 0 after the code outside Nigeria, and refuses +0", () => {
    expect(readPhone("+44 (0) 7400 123456", "NG")).toMatchObject({ ok: true, e164: "+447400123456" });
    expect(readPhone("+44(0)7400123456", "GB")).toMatchObject({ ok: true, e164: "+447400123456" });
    expect(readPhone("+39 02 1234 5678", "IT")).toMatchObject({ ok: true, e164: "+390212345678" });
    expect(readPhone("+234 0803 214 7720", "NG")).toMatchObject({ ok: true, e164: "+2348032147720" });
    expect(readPhone("+0 7400 123456", "NG")).toEqual({ ok: false, reason: "invalid" });
    expect(readPhone("0044 7400 123456", "NG")).toMatchObject({ ok: true });
  });
  it("tells a phone from an email", () => {
    expect(looksLikePhone("0803 214 7720")).toBe(true);
    expect(looksLikePhone("+44 7400 123456")).toBe(true);
    expect(looksLikePhone("ada@example.com")).toBe(false);
    expect(looksLikePhone("")).toBe(false);
  });
});

describe("the list of countries", () => {
  it("has Nigeria first, the world after, every dial code once per country", () => {
    expect(DIAL_COUNTRIES[0]).toMatchObject({ code: "NG", dial: "234" });
    expect(DIAL_COUNTRIES.length).toBeGreaterThan(200);
    expect(new Set(DIAL_COUNTRIES.map((c) => c.code)).size).toBe(DIAL_COUNTRIES.length);
    expect(DIAL_COUNTRIES[0].flag).toBe("\u{1F1F3}\u{1F1EC}");
    expect(DIAL_COUNTRIES.slice(1).map((c) => c.name)).toEqual([...DIAL_COUNTRIES.slice(1).map((c) => c.name)].sort((a, b) => a.localeCompare(b, "en")));
  });
  it("searches by name, code, dial code and nickname", () => {
    expect(searchCountries("gha")[0].code).toBe("GH");
    expect(searchCountries("united").map((c) => c.code)).toEqual(expect.arrayContaining(["GB", "US", "AE"]));
    expect(searchCountries("+44").map((c) => c.code)).toContain("GB");
    expect(searchCountries("uk")[0].code).toBe("GB");
    expect(searchCountries("zzzz")).toEqual([]);
    expect(searchCountries("+1").slice(0, 2).map((c) => c.code)).toEqual(["US", "CA"]);
    expect(searchCountries("+44")[0].code).toBe("GB");
  });
});

function Harness({ onNumber }: { onNumber?: (v: string, c: string) => void }) {
  const [v, setV] = useState("");
  const [c, setC] = useState("NG");
  onNumber?.(v, c);
  return <PhoneField label="Phone number" value={v} onChange={setV} country={c} onCountry={setC} />;
}

describe("the picker on the field", () => {
  it("shows Nigeria and +234 as the prefix at first, then the list opens with a search", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const btn = screen.getByRole("button", { name: /Country code, Nigeria \+234/ });
    expect(btn.textContent).toContain("+234");
    await user.click(btn);
    const list = screen.getByRole("list", { name: "Countries" });
    expect(within(list).getAllByRole("button")[0].textContent).toContain("Nigeria");
    await user.type(screen.getByRole("searchbox"), "ghana");
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    await user.click(within(list).getByRole("button", { name: /Ghana/ }));
    expect(screen.queryByRole("list", { name: "Countries" })).toBeNull();
    expect(screen.getByRole("button", { name: /Country code, Ghana \+233/ }).textContent).toContain("+233");
  });
  it("says so when nothing matches, and Escape closes the list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Country code/ }));
    await user.type(screen.getByRole("searchbox"), "qqqq");
    expect(screen.getByText("Nothing matches. Check the spelling, or search by code.")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});

describe("keyboard and focus", () => {
  it("arrows move through the list, Enter picks, Home and End jump, and focus goes back to the button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const btn = screen.getByRole("button", { name: /Country code/ });
    await user.click(btn);
    await user.keyboard("{ArrowDown}");
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe("Nigeria +234");
    await user.keyboard("{ArrowDown}");
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe("Afghanistan +93");
    await user.keyboard("{End}");
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe("Zimbabwe +263");
    await user.keyboard("{Home}");
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe("Nigeria +234");
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    await user.keyboard("ghana{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /Country code, Ghana/ })));
  });
  it("Escape closes the list and gives focus back to the button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Country code/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("searchbox")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /Country code/ })));
  });
});

describe("what sign in sends", () => {
  it("sends a number exactly as typed with Nigeria chosen, and an email always", () => {
    for (const t of ["0803 214 7720", "2348032147720", "+234 803 214 7720", "803-214-7720"]) expect(idAsSent(t, "NG")).toBe(t);
    expect(idAsSent("ada@example.com", "NG")).toBe("ada@example.com");
    expect(idAsSent("ada@example.com", "GB")).toBe("ada@example.com");
  });
  it("sends the full international form for another country", () => {
    expect(idAsSent("07400 123456", "GB")).toBe("+447400123456");
    expect(idAsSent("+44 7400 123456", "GB")).toBe("+447400123456");
    expect(idAsSent("12", "GB")).toBe("12");
  });
  it("the sign in screen passes it on", async () => {
    const user = userEvent.setup();
    search = "";
    render(<SignIn />);
    await user.type(screen.getByLabelText("Email or phone number"), "0803 214 7720");
    await user.type(screen.getByLabelText("Password"), "longenough1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(signInCall).toHaveBeenCalled());
    expect(signInCall.mock.calls[0][0]).toBe("0803 214 7720");
  });
});

describe("sign up", () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, phone: string) => {
    await user.type(screen.getByLabelText("Full name"), "Ada Okafor");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Phone number"), phone);
    await user.type(screen.getByLabelText("Password"), "longenough1");
    await user.click(screen.getByLabelText(/I am 18 or older/));
  };
  it("sends a Nigerian number as +234 and the national digits", async () => {
    const user = userEvent.setup();
    render(<SignIn />);
    await fill(user, "0803 214 7720");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][0]).toMatchObject({ phoneNational: "8032147720", dialCode: "+234", country: "Nigeria" });
  });
  it("sends a United Kingdom number with its own code after the country is chosen", async () => {
    const user = userEvent.setup();
    render(<SignIn />);
    await user.click(screen.getByRole("button", { name: /Country code/ }));
    await user.type(screen.getByRole("searchbox"), "united king");
    await user.click(screen.getByRole("button", { name: /United Kingdom/ }));
    await fill(user, "07400 123456");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][0]).toMatchObject({ phoneNational: "7400123456", dialCode: "+44", country: "United Kingdom" });
  });
  it("asks again when the number does not fit the country", async () => {
    const user = userEvent.setup();
    render(<SignIn />);
    await fill(user, "12345");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByText("Enter a valid number for Nigeria, or start with + and the country code.")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });
});
