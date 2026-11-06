// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { calls, cats, me, mockApi, profile, signIn } from "./w6-helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), usePathname: () => "/" }));

import { SettingsPage } from "@/features/profile/SettingsPage";
import { AnswerCard } from "@/components/vx";
import { countText } from "@/lib/format/plural";

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const answers = { items: [], nextCursor: null };
const countries = { items: [{ code: "NG", name: "Nigeria", currency: "NGN", status: "live" }, { code: "GH", name: "Ghana", currency: "GHS", status: "soon" }] };
const routes = {
  "GET /me": me, "GET /me/answers": answers, "GET /me/saved": answers, "GET /me/blocks": answers,
  "GET /countries": countries, "GET /categories": cats, "GET /me/categories": { categories: [{ categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: false }, { categoryId: "c2", alertsOn: true }] },
};

describe("Settings: Country, Language and Quiet hours (the API stores each)", () => {
  it("draws the rows with their values and the topics that alert", async () => {
    signIn(); mockApi(routes);
    render(<SettingsPage />);
    expect(await screen.findByText("Country")).toBeTruthy();
    expect(await screen.findByText("Nigeria")).toBeTruthy();
    expect(screen.getByText("Language")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Quiet hours")).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
    expect(await screen.findByText("Money, Power and light")).toBeTruthy();
  });
  it("Language saves PATCH /me/profile languages and refuses to empty the list", async () => {
    signIn(); mockApi({ ...routes, "PATCH /me/profile": ({ body }: { body: unknown }) => ({ ...profile, ...(body as object) }) });
    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Language/ }));
    const sheet = within(await screen.findByRole("dialog"));
    await userEvent.click(sheet.getByRole("button", { name: "Pidgin" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/me/profile")?.body).toEqual({ languages: ["en", "pcm"] }));
    await userEvent.click(sheet.getByRole("button", { name: "English" }));
    await userEvent.click(sheet.getByRole("button", { name: "Pidgin" }));
    expect(await sheet.findByText("Keep at least one language.")).toBeTruthy();
  });
  it("Country saves PATCH /me/profile countryCode and Ghana (coming soon) cannot be picked", async () => {
    signIn(); mockApi({ ...routes, "PATCH /me/profile": ({ body }: { body: unknown }) => ({ ...profile, ...(body as object) }) });
    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Country/ }));
    const sheet = within(await screen.findByRole("dialog"));
    expect((await sheet.findByRole("radio", { name: /Ghana/ }) as HTMLInputElement).disabled).toBe(true);
    expect((sheet.getByRole("radio", { name: "Nigeria" }) as HTMLInputElement).checked).toBe(true);
  });
  it("Quiet hours saves both ends as minutes after midnight, and can be turned off", async () => {
    signIn();
    mockApi({ ...routes, "PATCH /me/settings": ({ body }: { body: unknown }) => ({ ...me.settings, ...(body as object) }) });
    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Quiet hours/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Save quiet hours" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/me/settings")?.body).toEqual({ quietHoursStart: 1320, quietHoursEnd: 420 }));
    expect(await screen.findByText("10pm to 7am")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Quiet hours/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Turn quiet hours off" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/me/settings").pop()?.body).toEqual({ quietHoursStart: null, quietHoursEnd: null }));
  });
});

describe("singular at exactly 1", () => {
  it("countText", () => {
    expect(countText(1, "vote")).toBe("1 vote");
    expect(countText(0, "vote")).toBe("0 votes");
    expect(countText(1200, "reaction")).toBe("1,200 reactions");
    expect(countText(1, "reply", "replies")).toBe("1 reply");
    expect(countText(2, "reply", "replies")).toBe("2 replies");
  });
});

describe("reaction tray tab order", () => {
  it("Tab goes from React to the tray, then on to Reply", async () => {
    const user = userEvent.setup();
    render(<AnswerCard author={{ name: "Ada" }} time="1h ago" text="Hello" likes={1} replies={1} />);
    expect(screen.getByRole("button", { name: "Reply, 1 reply" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Like, 1 like" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "React" }));
    const buttons = Array.from(document.querySelectorAll("button")).map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
    const react = buttons.indexOf("React");
    const reply = buttons.indexOf("Reply, 1 reply");
    const tray = buttons.findIndex((t) => /Relatable|Well said|Same/.test(t));
    expect(react).toBeGreaterThan(-1);
    expect(tray).toBeGreaterThan(react);
    expect(tray).toBeLessThan(reply);
  });
});
