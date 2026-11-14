import { describe, expect, it } from "vitest";
import { tokenFor } from "@/features/speak/logic";

const tok = (maxSeconds: number, id = "t" + maxSeconds) => ({ id, status: "AVAILABLE", maxSeconds, kind: "SECONDS_30" }) as never;

describe("tokenFor (a legacy extra voice token, V-46)", () => {
  it("with a free post left and a take inside the free minute, no token is used", () => {
    expect(tokenFor([tok(30)], 45, 60, 2)).toBeUndefined();
    expect(tokenFor([tok(30)], 20, 60)).toBeUndefined();
  });
  it("with no free post left, a token that covers the take is used, the smallest one", () => {
    expect(tokenFor([tok(60), tok(30)], 25, 60, 0)?.id).toBe("t30");
    expect(tokenFor([tok(60), tok(30)], 45, 60, 0)?.id).toBe("t60");
  });
  it("a token too short for the take is not used, and an empty hand gives none", () => {
    expect(tokenFor([tok(30)], 45, 60, 0)).toBeUndefined();
    expect(tokenFor([], 20, 60, 0)).toBeUndefined();
  });
});
