import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { EMPTY_FORM, serverFieldErrors, toRequest, validate } from "@/features/results/form";
import { toComment } from "@/features/results/map";
import type { ResultPost } from "@/lib/api/results";

const OK = { state: "Lagos", lga: "Lagos Mainland", ward: "Ward 6", pollingUnit: "PU 009", accredited: "488", votesCast: "471", rejected: "5" };

describe("result form rules", () => {
  it("accepts the sheet from the board", () => {
    expect(validate(OK)).toEqual({});
    expect(toRequest({ ...OK, state: "  Lagos " })).toMatchObject({ state: "Lagos", accredited: 488, votesCast: 471, rejected: 5 });
  });
  it("asks for every field", () => {
    expect(Object.keys(validate(EMPTY_FORM)).sort()).toEqual(["accredited", "lga", "pollingUnit", "rejected", "state", "votesCast", "ward"]);
  });
  it("refuses more votes than accredited and more rejected than votes", () => {
    expect(validate({ ...OK, votesCast: "500" }).votesCast).toBe("Votes cast cannot be more than the number accredited.");
    expect(validate({ ...OK, rejected: "472" }).rejected).toBe("Rejected votes cannot be more than the votes cast.");
  });
  it("refuses decimals, negatives and huge totals", () => {
    expect(validate({ ...OK, accredited: "4.5" }).accredited).toBe("Use whole numbers only.");
    expect(validate({ ...OK, rejected: "-1" }).rejected).toBe("Use whole numbers only.");
    expect(validate({ ...OK, accredited: "100001" }).accredited).toBe("That number is too large.");
  });
  it("maps the server's field list", () => {
    const err = new ApiError(422, "VALIDATION_FAILED", "Some details need fixing.", true, { fields: [{ path: "votesCast", message: "No." }, { path: "photoFileId", message: "x" }] });
    expect(serverFieldErrors(err)).toEqual({ votesCast: "No." });
  });
});

describe("result post as a design comment", () => {
  it("keeps Lagos time, the place line and the mark", () => {
    const p: ResultPost = {
      id: "1", threadId: "t", author: { id: "u", handle: "kemi.b", displayName: "Kemi Bello", state: null, avatarUrl: null }, state: "Lagos", lga: "Surulere", ward: "Ward 3", pollingUnit: "PU 014",
      accredited: 412, votesCast: 398, rejected: 6, status: "VERIFIED", label: "Verified", checkedAt: "2027-01-16T17:45:00Z", checkedLine: "Checked by the WAWU team, 6:45pm", createdAt: "2027-01-16T17:42:00Z", isMine: false,
    };
    const c = toComment(p);
    expect(c.time).toBe("6:42 pm");
    expect(c.place).toBe("PU 014, Ward 3, Surulere, Lagos");
    expect(c.status).toBe("verified");
    expect(c.figures.map((f) => f.value)).toEqual(["412", "398", "6"]);
  });
});
