// @vitest-environment jsdom
// V-ADMIN-PHONE: the admin works on a phone. The old "Open the admin on a computer." line is gone; a top bar and a menu take its place.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { TableFrame, Td, Th } from "@/features/admin/money/parts";
import { ADMIN_PAGES, canOpen } from "@/features/admin/roles";

let path = "/admin/money/payments";
vi.mock("next/navigation", () => ({ usePathname: () => path, useRouter: () => ({ replace: () => undefined, push: () => undefined }), useSearchParams: () => new URLSearchParams("") }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ada.admin", roles, profile: { displayName: "Ada Admin" } });
const today = { needsAttention: { newsTags: 3, resultPosts: 0, ads: 0, weeklyReports: 0, moderationOpen: 7 } };

function stub(roles: string[]) {
  vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.endsWith("/me") ? json(200, me(roles)) : u.includes("/admin/today") ? json(200, today) : json(404, { error: { code: "NOT_FOUND", message: "no" } }))));
}
const setWidth = (w: number) => Object.defineProperty(window, "innerWidth", { value: w, configurable: true, writable: true });

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  path = "/admin/money/payments";
  setWidth(1024);
});

describe("the admin frame on a phone", () => {
  for (const w of [390, 768]) {
    it(`at ${w} px wide it shows the page, not the line about a computer`, async () => {
      setWidth(w);
      stub(["ADMIN"]);
      render(<AdminFrame><p>the page</p></AdminFrame>);
      expect(await screen.findByText("the page")).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/Open the admin on a computer/);
    });
  }

  it("has a top bar with the mark, the name of the page and a menu button", async () => {
    setWidth(390);
    stub(["ADMIN"]);
    render(<AdminFrame><p>the page</p></AdminFrame>);
    await screen.findByText("the page");
    expect(screen.getByAltText("VOICES admin")).toBeTruthy();
    expect(screen.getByTestId("phone-page-name").textContent).toBe("Payments");
    expect(screen.getByRole("button", { name: "Menu" })).toBeTruthy();
  });

  it("the menu lists every page an admin may open, with the same counts, and Sign out at the bottom", async () => {
    setWidth(390);
    stub(["ADMIN"]);
    render(<AdminFrame><p>the page</p></AdminFrame>);
    await screen.findByText("the page");
    await screen.findByText("7");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const sheet = screen.getByRole("dialog");
    const links = within(sheet).getAllByRole("link");
    expect(links.map((l) => l.textContent?.replace(/\d+$/, ""))).toEqual(ADMIN_PAGES.map((p) => p.label));
    expect(links.map((l) => l.getAttribute("href"))).toEqual(ADMIN_PAGES.map((p) => p.href));
    expect(within(sheet).getByText("Money")).toBeTruthy();
    expect(within(links.find((l) => l.textContent?.startsWith("Moderation"))!).getByText("7")).toBeTruthy();
    expect(within(links.find((l) => l.textContent?.startsWith("News tags"))!).getByText("3")).toBeTruthy();
    expect(within(sheet).getByRole("link", { name: "Payments" }).getAttribute("aria-current")).toBe("page");
    const buttons = within(sheet).getAllByRole("button");
    expect(buttons[buttons.length - 1].textContent).toBe("Sign out");
  });

  it("an editor's menu lists only the editor's pages: no Money, no Verification, no Moderation", async () => {
    setWidth(390);
    stub(["EDITOR"]);
    path = "/admin/news";
    render(<AdminFrame><p>the page</p></AdminFrame>);
    await screen.findByText("the page");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const sheet = screen.getByRole("dialog");
    const names = within(sheet).getAllByRole("link").map((l) => l.textContent?.replace(/\d+$/, ""));
    expect(names).toEqual(ADMIN_PAGES.filter((p) => canOpen(["EDITOR"], p.id)).map((p) => p.label));
    for (const w of ["Money", "Verification", "Moderation", "Payments"]) expect(within(sheet).queryByText(w)).toBeNull();
  });

  it("tapping a page in the menu goes to it (a real link) and the menu closes when the page changes", async () => {
    setWidth(390);
    stub(["ADMIN"]);
    const { rerender } = render(<AdminFrame><p>the page</p></AdminFrame>);
    await screen.findByText("the page");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Verification" }).getAttribute("href")).toBe("/admin/verification");
    path = "/admin/verification";
    rerender(<AdminFrame><p>the page</p></AdminFrame>);
    await screen.findByText("the page");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("phone-page-name").textContent).toBe("Verification");
  });

  it("the menu closes with its Close button", async () => {
    setWidth(390);
    stub(["ADMIN"]);
    render(<AdminFrame><p>the page</p></AdminFrame>);
    await screen.findByText("the page");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Sign out in the menu ends the session and shows the sign-in page", async () => {
    setWidth(390);
    stub(["ADMIN"]);
    render(<AdminFrame><p>the page</p></AdminFrame>);
    await screen.findByText("the page");
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "VOICES admin" })).toBeTruthy();
    expect(window.localStorage.getItem("voices-web-session")).not.toMatch(/"accessToken":"t"/);
  });
});

describe("the shared table on a phone", () => {
  it("gives each cell its column name from the header, so rows can stack", async () => {
    render(
      <TableFrame label="Things">
        <thead>
          <tr>
            <Th>Person</Th>
            <Th right>Total</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>chika.o</Td>
            <Td right>₦5</Td>
          </tr>
        </tbody>
      </TableFrame>,
    );
    const row = screen.getByText("chika.o").closest("tr")!;
    await vi.waitFor(() => expect(row.children[1].getAttribute("data-label")).toBe("Total"));
    expect(row.children[0].getAttribute("data-label")).toBe("Person");
  });
});
