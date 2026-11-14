// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ReplyRow } from "@/features/profile/PostRow";
import type { Reply } from "@/lib/api/profile";

afterEach(cleanup);

const reply = (author: unknown): Reply =>
  ({ id: "r1", kind: "TEXT", stance: "AGREE", body: "Yes", createdAt: "2026-11-14T10:00:00Z", helpfulCount: 0, clip: null, isMine: true, author }) as unknown as Reply;

describe("a reply without a name", () => {
  it("shows no name, handle, picture or Admin pill, even to its writer", () => {
    const c = render(<ReplyRow r={reply(null)} />).container;
    expect(c.querySelector("img")).toBeNull();
    expect(c.textContent).not.toContain("@");
    expect(c.textContent).not.toContain("Admin");
    expect(c.querySelector(".vx-answer__name")?.textContent).toBe("Anonymous");
  });
  it("shows the picture and pill for a named reply", () => {
    const c = render(<ReplyRow r={reply({ handle: "ada", displayName: "Ada", avatarUrl: "https://x.test/a.png", admin: true })} />).container;
    expect(c.querySelector("img")?.getAttribute("src")).toBe("https://x.test/a.png");
    expect(c.querySelector(".vx-answer__name")?.textContent).toBe("@adaAdmin");
  });
});
