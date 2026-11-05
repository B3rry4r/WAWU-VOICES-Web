// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY, THEME_SCRIPT } from "@/components/shell/theme-script";

function run() {
  new Function(THEME_SCRIPT)();
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("saved theme before paint", () => {
  it("applies dark", () => {
    window.localStorage.setItem(THEME_KEY, "dark");
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
  it("applies light", () => {
    window.localStorage.setItem(THEME_KEY, "light");
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
  it("leaves the device in charge for system, nothing saved or junk", () => {
    for (const v of ["system", "", "purple", null]) {
      document.documentElement.removeAttribute("data-theme");
      if (v === null) window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, v);
      run();
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    }
  });
  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
  it("uses the key the Settings screen saves", () => {
    expect(THEME_KEY).toBe("voices-theme");
  });
});
