import { describe, expect, it } from "vitest";
import { activeNav, hidesTabBar, isChromeless, onWeekly, showsLogoBar } from "@/components/shell/nav";

describe("chromeless prefixes (no shell at all)", () => {
  it.each(["/welcome", "/sign-in", "/join", "/join/topics", "/join/country", "/admin", "/admin/ads", "/s", "/s/abc123"])("%s has no shell", (p) => {
    expect(isChromeless(p)).toBe(true);
  });
  it.each(["/", "/discover", "/joinx", "/joined", "/adminx", "/sign-inx", "/welcomes", "/search", "/settings", "/speak"])("near miss or app route %s keeps the shell", (p) => {
    expect(isChromeless(p)).toBe(false);
  });
});

describe("full-screen prefixes (no tab bar)", () => {
  it.each([
    "/speak",
    "/speak/anything",
    "/q/abc/write",
    "/q/abc/propose",
    "/report/answer/1",
    "/live/t1/post",
    "/profile/edit",
    "/units/buy",
    "/units/done",
    "/units/out-of-posts",
  ])("%s hides the tab bar", (p) => {
    expect(hidesTabBar(p)).toBe(true);
  });
  it.each(["/", "/discover", "/profile", "/q/abc", "/q/abc/writer", "/q/write", "/live/t1", "/live/post", "/profile/editor", "/units", "/units/buyer", "/speakeasy", "/reports", "/news", "/weekly", "/notifications"])(
    "%s keeps the tab bar",
    (p) => {
      expect(hidesTabBar(p)).toBe(false);
    },
  );
});

describe("the shell logo bar (phone top bar rule)", () => {
  it.each(["/", "/discover", "/profile", "/speak"])("%s shows it", (p) => expect(showsLogoBar(p)).toBe(true));
  it.each(["/notifications", "/weekly", "/weekly/archive", "/q/abc", "/search", "/settings", "/news", "/live/t1", "/profile/edit", "/units", "/c/money", "/p/tunde", "/discover/x", "/profile/edit/", "/q/abc/write"])(
    "%s hides it (the screen draws its own app bar)",
    (p) => expect(showsLogoBar(p)).toBe(false),
  );
  it("ignores a trailing slash", () => {
    expect(showsLogoBar("/discover/")).toBe(true);
  });
});

describe("active tab", () => {
  it.each([
    ["/", "home"],
    ["/discover", "discover"],
    ["/profile", "profile"],
    ["/speak", "speak"],
    ["/q/abc", "home"],
    ["/live/t1", "home"],
    ["/notifications", "home"],
    ["/news", "discover"],
    ["/news/a1", "discover"],
    ["/weekly", "discover"],
    ["/search", "discover"],
    ["/units/buy", "profile"],
    ["/units", "profile"],
    ["/settings", "profile"],
  ])("%s lights %s", (p, id) => expect(activeNav(p)).toBe(id));
  it("lights nothing on an unknown route or a near miss", () => {
    expect(activeNav("/nope")).toBeNull();
    expect(activeNav("/newsroom")).toBeNull();
    expect(activeNav("/unitsx")).toBeNull();
  });
  it("tells the weekly report rows apart", () => {
    expect(onWeekly("/weekly")).toBe(true);
    expect(onWeekly("/weekly/archive")).toBe(true);
    expect(onWeekly("/weeklyx")).toBe(false);
  });
});
