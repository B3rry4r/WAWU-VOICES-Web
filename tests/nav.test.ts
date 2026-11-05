import { describe, expect, it } from "vitest";
import { activeNav, hidesTabBar } from "@/components/shell/nav";

describe("shell nav", () => {
  it("marks the right tab", () => {
    expect(activeNav("/")).toBe("home");
    expect(activeNav("/discover")).toBe("discover");
    expect(activeNav("/q/abc")).toBe("home");
    expect(activeNav("/profile")).toBe("profile");
    expect(activeNav("/admin")).toBeNull();
  });
  it("hides the tab bar on full-screen tasks only", () => {
    expect(hidesTabBar("/speak")).toBe(true);
    expect(hidesTabBar("/")).toBe(false);
  });
});
