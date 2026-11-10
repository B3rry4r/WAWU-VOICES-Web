// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }) }));

import { InstallGate } from "@/features/install/InstallGate";
import { KEPT_ADDRESS_KEY } from "@/lib/install/address";

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IG = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 Instagram 330.0.0.20.113 (iPhone14,5; iOS 17_4)";
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36";

const DESKTOP_CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0";

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

  it("Chromium with no offer: nothing covers the app, nothing is hidden, no timer is waiting (M1)", () => {
    vi.useFakeTimers();
    setup(CHROME);
    const { container } = render(<InstallGate />);
    expect(container.innerHTML).toBe("");
    expect(document.documentElement.getAttribute("data-install")).toBeNull();
    expect(document.getElementById("app-root")!.hasAttribute("inert")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    // and a late offer still draws the screen over the app
    (window as { __voicesInstall?: unknown }).__voicesInstall = { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "dismissed" }) };
    act(() => { window.dispatchEvent(new Event("voices-install-ready")); });
    expect(screen.getByRole("button", { name: /Install VOICES/ })).toBeTruthy();
  });

  it("the boot script hides nothing and has no failsafe timer (M1)", async () => {
    const { INSTALL_SCRIPT } = await import("@/lib/install/boot-script");
    const css = (await import("node:fs")).readFileSync("src/features/install/install.css", "utf8");
    expect(INSTALL_SCRIPT).not.toMatch(/data-install|pending/);
    expect(css).not.toMatch(/pending|ig-reveal/);
  });

  it("a cancelled install keeps no address; an accepted one does (L1)", async () => {
    setup(CHROME, { url: "/s/abc1234?x=1" });
    (window as { __voicesInstall?: unknown }).__voicesInstall = { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: "dismissed" }) };
    render(<InstallGate />);
    await userEvent.click(screen.getByRole("button", { name: /Install VOICES/ }));
    expect(window.localStorage.getItem(KEPT_ADDRESS_KEY)).toBeNull();
    cleanup();
    setup(CHROME, { url: "/s/abc1234?x=1" });
    (window as { __voicesInstall?: unknown }).__voicesInstall = { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: "accepted" }) };
    render(<InstallGate />);
    await userEvent.click(screen.getByRole("button", { name: /Install VOICES/ }));
    expect(JSON.parse(window.localStorage.getItem(KEPT_ADDRESS_KEY)!).a).toBe("/s/abc1234?x=1");
  });

  it("sign-out clears the kept address (L1)", async () => {
    window.localStorage.setItem(KEPT_ADDRESS_KEY, JSON.stringify({ a: "/go", t: Date.now() }));
    const { signOut } = await import("@/lib/api/auth");
    signOut();
    expect(window.localStorage.getItem(KEPT_ADDRESS_KEY)).toBeNull();
  });

  it("appinstalled keeps the address (L1)", () => {
    setup(CHROME, { url: "/go" });
    render(<InstallGate />);
    act(() => { window.dispatchEvent(new Event("appinstalled")); });
    expect(JSON.parse(window.localStorage.getItem(KEPT_ADDRESS_KEY)!).a).toBe("/go");
  });

  it("a computer never reads 'home screen' or 'one tap' (L4)", async () => {
    setup(DESKTOP_CHROME);
    (window as { __voicesInstall?: unknown }).__voicesInstall = { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: "accepted" }) };
    const { container } = render(<InstallGate />);
    expect(screen.getByRole("heading", { name: "Install VOICES" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/home screen|one tap/i);
    await userEvent.click(screen.getByRole("button", { name: /Install VOICES/ }));
    expect(container.textContent).not.toMatch(/home screen|one tap/i);
  });

  it("Safari 17 on a Mac: the Add to Dock steps (feature probe), no 'home screen'", () => {
    setup(MAC_SAFARI);
    (HTMLElement.prototype as { togglePopover?: unknown }).togglePopover = () => {};
    try {
      const { container } = render(<InstallGate />);
      expect(container.querySelector("[data-install-mode]")!.getAttribute("data-install-mode")).toBe("dock-safari");
      expect(screen.getByText(/Open the “File” menu/)).toBeTruthy();
      expect(screen.getByText(/Choose “Add to Dock”/)).toBeTruthy();
      expect(container.textContent).not.toMatch(/home screen|one tap/i);
      expect(screen.getByRole("button", { name: "Continue in the browser" })).toBeTruthy();
    } finally {
      delete (HTMLElement.prototype as { togglePopover?: unknown }).togglePopover;
    }
  });

  it("Safari on a Mac without the Safari 17 probe, and Firefox: no screen", () => {
    setup(MAC_SAFARI);
    expect(render(<InstallGate />).container.innerHTML).toBe("");
    cleanup();
    setup(FIREFOX);
    (HTMLElement.prototype as { togglePopover?: unknown }).togglePopover = () => {};
    try {
      expect(render(<InstallGate />).container.innerHTML).toBe("");
    } finally {
      delete (HTMLElement.prototype as { togglePopover?: unknown }).togglePopover;
    }
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
