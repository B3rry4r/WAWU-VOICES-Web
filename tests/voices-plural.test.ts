import { describe, expect, it } from "vitest";
import { voicesText } from "@/components/vx/helpers";

describe("voicesText", () => {
  it("is plural for every count except exactly 1", () => {
    expect(voicesText(0)).toBe("0 voices");
    expect(voicesText(1)).toBe("1 voice");
    expect(voicesText(2)).toBe("2 voices");
    expect(voicesText(12500)).toBe("12.5K voices");
  });
});
