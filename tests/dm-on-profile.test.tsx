// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { calls, me, mockApi, profile, signIn } from "./w6-helpers";

vi.mock("@/features/dm/live", () => ({ DMS_LIVE: true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), usePathname: () => "/" }));

import { MePage } from "@/features/profile/MePage";
import { PersonPage } from "@/features/profile/PersonPage";
import { SettingsPage } from "@/features/profile/SettingsPage";

beforeEach(() => { window.localStorage.clear(); calls.length = 0; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const answers = { items: [], nextCursor: null };
const tunde = { ...profile, id: "u2", handle: "tunde.a", displayName: "Tunde" };
const ID = "00000000-0000-4000-8000-000000000002";

describe("DMs on (switch mocked): profile and settings", () => {
  it("a person's menu shows the Message button, and keeps Report and Block", async () => {
    signIn(); mockApi({ ["GET /people/" + ID]: { profile: tunde, isBlockedByMe: false, recentAnswers: [], nextCursor: null }, "GET /me": me });
    render(<PersonPage segment={ID} />);
    await userEvent.click(await screen.findByRole("button", { name: "More: report or block @tunde.a" }));
    expect(screen.getByRole("button", { name: "Report @tunde.a" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Block @tunde.a" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Message @tunde.a" })).not.toBeNull();
  });
  it("my profile shows the Messages row", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/answers": answers, "GET /me/saved": answers });
    render(<MePage />);
    await screen.findByText("Settings");
    expect(document.querySelector('a[href="/messages"]')).not.toBeNull();
  });
  it("settings shows the Let people message me switch", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/blocks": { items: [], nextCursor: null } });
    render(<SettingsPage />);
    await screen.findByText("Share my word");
    expect(screen.queryByText("Let people message me")).not.toBeNull();
  });
});
