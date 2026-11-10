// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }) }));

import { InstallGate, PROMPT_WAIT_MS } from "@/features/install/InstallGate";
import { KEPT_ADDRESS_KEY } from "@/lib/install/address";

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IG = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 Instagram 330.0.0.20.113 (iPhone14,5; iOS 17_4)";
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";

function setup(ua: string, opts: { standalone?: boolean; navStandalone?: boolean; url?: string } = {}) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
  Object.defineProperty(window.navigator, "standalone", { value: opts.navStandalone, configurable: true });
  window.matchMedia = ((q: string) => ({ matches: !!opts.standalone && q.includes("standalone"), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  window.history.replaceState({}, "", opts.url ?? "/");
  const root = document.createElement("div");
  root.id = "app-root";
  document.body.appendChild(root);
}

beforeEach(() => { replace.mockClear(); window.sessionStorage.clear(); window.localStorage.clear(); delete (window as { __voicesInstall?: unknown }).__voicesInstall; });
afterEach(() => { cleanup(); document.body.innerHTML = ""; document.documentElement.removeAttribute("data-install"); vi.useRealTimers(); });

describe("InstallGate", () => {
  it("draws nothing in standalone (display-mode and navigator.standalone)", async () => {
    setup(CHROME, { standalone: true });
    (window as { __voicesInstall?: unknown }).__voicesInstall = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "accepted" }) };
    const { container } = render(<InstallGate />);
    expect(container.innerHTML).toBe("");
    cleanup();
    setup(IOS, { navStandalone: true });
    const r2 = render(<InstallGate />);
    expect(r2.container.innerHTML).toBe("");
  });

  it("renders nothing on the server render (so share cards and crawlers never carry it)", async () => {
    const { renderToString } = await import("react-dom/server");
    expect(renderToString(<InstallGate />)).toBe("");
  });

  it("iPhone Safari: the steps with pictures, and Continue reveals the app and is remembered", async () => {
    setup(IOS, { url: "/c/music?x=1" });
    render(<InstallGate />);
    expect(screen.getByRole("heading", { name: "Add VOICES to your home screen" })).toBeTruthy();
    expect(screen.getByText(/Tap the Share button at the bottom of Safari/)).toBeTruthy();
    expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(3);
    expect(document.documentElement.getAttribute("data-install")).toBe("show");
    expect(document.getElementById("app-root")!.hasAttribute("inert")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Continue in the browser" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.documentElement.getAttribute("data-install")).toBeNull();
    expect(document.getElementById("app-root")!.hasAttribute("inert")).toBe(false);
    expect(window.sessionStorage.getItem("voices-install-continue")).toBe("1");
    // the address was never left
    expect(window.location.pathname + window.location.search).toBe("/c/music?x=1");
  });

  it("does not draw again in a tab that already continued", () => {
    setup(IOS);
    window.sessionStorage.setItem("voices-install-continue", "1");
    const { container } = render(<InstallGate />);
    expect(container.innerHTML).toBe("");
  });

  it("never on the admin pages", () => {
    setup(IOS, { url: "/admin/news" });
    const { container } = render(<InstallGate />);
    expect(container.innerHTML).toBe("");
  });

  it("an in-app browser: open in Safari, with a copy-link button that copies the opened address", async () => {
    setup(IG, { url: "/s/abc1234?src=wa" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<InstallGate />);
    expect(screen.getByRole("heading", { name: "Open VOICES in your browser" })).toBeTruthy();
    expect(screen.getByText(/Instagram opens links in its own small browser/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/s/abc1234?src=wa"));
    expect(await screen.findByText(/Paste it in your browser/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue in the browser" })).toBeTruthy();
  });

  it("beforeinstallprompt: an Install button that calls prompt() and keeps the address", async () => {
    setup(CHROME, { url: "/go" });
    const prompt = vi.fn().mockResolvedValue(undefined);
    (window as { __voicesInstall?: unknown }).__voicesInstall = { prompt, userChoice: Promise.resolve({ outcome: "accepted" }), preventDefault() {} };
    render(<InstallGate />);
    const btn = screen.getByRole("button", { name: /Install VOICES/ });
    await userEvent.click(btn);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Open VOICES from your home screen/)).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(KEPT_ADDRESS_KEY)!).a).toBe("/go");
  });

  it("Chromium waits for a late prompt, then shows the Install button", async () => {
    vi.useFakeTimers();
    setup(CHROME);
    render(<InstallGate />);
    expect(screen.queryByRole("dialog")).toBeNull();
    (window as { __voicesInstall?: unknown }).__voicesInstall = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "dismissed" }) };
    act(() => { window.dispatchEvent(new Event("voices-install-ready")); });
    expect(screen.getByRole("button", { name: /Install VOICES/ })).toBeTruthy();
  });

  it("Chromium with no prompt (already installed, or it will not install) steps aside after a moment", () => {
    vi.useFakeTimers();
    setup(CHROME);
    document.documentElement.setAttribute("data-install", "pending");
    const { container } = render(<InstallGate />);
    act(() => { vi.advanceTimersByTime(PROMPT_WAIT_MS + 50); });
    expect(container.innerHTML).toBe("");
    expect(document.documentElement.getAttribute("data-install")).toBeNull();
  });

  it("the installed app opens the address that was kept, once", () => {
    setup(CHROME, { standalone: true, url: "/" });
    window.localStorage.setItem(KEPT_ADDRESS_KEY, JSON.stringify({ a: "/go", t: Date.now() }));
    render(<InstallGate />);
    expect(replace).toHaveBeenCalledWith("/go");
    expect(window.localStorage.getItem(KEPT_ADDRESS_KEY)).toBeNull();
  });

  it("copy has no em-dashes, no straight quotes in the steps and never says wallet", () => {
    setup(IOS);
    const { container } = render(<InstallGate />);
    const t = container.textContent ?? "";
    expect(t).not.toMatch(/—|–/);
    expect(t).not.toMatch(/wallet/i);
    expect(t).toContain("“Add to Home Screen”");
  });
});
