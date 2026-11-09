import { describe, expect, it } from "vitest";
import { costRows, dayLabel, extraVoiceTitle, failureText, ledgerFigure, ledgerNote, methodLabel, naira, nairaExact, nairaOfUnits, packLine, signedUnits, units, unitsLabel, whenShort } from "@/features/units/format";
import type { LedgerItem, Payment } from "@/lib/api/units";

const item = (o: Partial<LedgerItem>): LedgerItem => ({ amountKobo: null, freePostsLeft: null, id: "i", kind: "SPEND_POST", title: "t", deltaMilli: 0, balanceAfterMilli: null, free: false, paymentId: null, hasReceipt: false, createdAt: "2026-11-05T08:14:00Z", note: null, ...o });

describe("money and tokens", () => {
  it("shows kobo as naira the way the boards do", () => {
    expect(naira(13800)).toBe("₦138");
    expect(naira(138000)).toBe("₦1,380");
    expect(naira(690)).toBe("₦6.90");
    expect(nairaExact(1200)).toBe("₦12.00");
    expect(nairaExact(1327)).toBe("₦13.27");
  });
  it("shows milli-tokens as a count", () => {
    expect(units(12500)).toBe("12.5");
    expect(units(55000)).toBe("55");
    expect(units(500)).toBe("0.5");
    expect(units(16670)).toBe("16.67");
    expect(units(1464000)).toBe("1,464");
    expect(unitsLabel(500)).toBe("0.5 tokens");
    expect(unitsLabel(1000)).toBe("1 token");
    expect(unitsLabel(0)).toBe("0 tokens");
    expect(unitsLabel(12500)).toBe("12.5 tokens");
    expect(signedUnits(-200)).toBe("−0.2");
    expect(signedUnits(26000)).toBe("+26");
  });
  it("derives a unit cost in naira from the API's base rate, never a constant", () => {
    expect(nairaOfUnits(500, 1380)).toBe("₦6.90");
    expect(nairaOfUnits(1000, 1380)).toBe("₦13.80");
    expect(nairaOfUnits(500, 2000)).toBe("₦10");
  });
  it("builds the cost rows from the numbers it is given", () => {
    const rows = costRows({ baseKoboPerUnit: 100, freeReactionsPerDay: 5, freeVotesPerDay: 2, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 100, voteAfterFreeMilli: 200, minPackKobo: 0, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 5000, freeVoiceSeconds: 15, textPriceChars: 150, voiceTier1Seconds: 30, voiceMaxSeconds: 60 });
    expect(rows).toEqual([
      { label: "Text", value: "5 tokens per 150 characters" },
      { label: "Voice, up to 30 seconds", value: "78 tokens" },
      { label: "Voice, 31 to 60 seconds", value: "100 tokens" },
      { label: "Reaction after 5 free a day", value: "0.1 tokens" },
      { label: "Vote after 2 free a day", value: "0.2 tokens" },
    ]);
  });
  it("names extra voice tokens", () => {
    expect(extraVoiceTitle(30)).toBe("Extra voice, 30 seconds");
    expect(extraVoiceTitle(60)).toBe("Extra voice, 1 minute");
  });
});

describe("history rows", () => {
  it("picks the right-hand figure", () => {
    expect(ledgerFigure(item({ free: true }))).toEqual({ text: "Free", tone: "free" });
    expect(ledgerFigure(item({ deltaMilli: 0, amountKobo: 20000, kind: "PURCHASE" }))).toEqual({ text: "₦200", tone: "plain" });
    expect(ledgerFigure(item({ deltaMilli: -200 }))).toEqual({ text: "−0.2", tone: "plain" });
    expect(ledgerFigure(item({ deltaMilli: 26000, kind: "PURCHASE" }))).toEqual({ text: "+26", tone: "plus" });
  });
  it("notes the free posts left and the server's own note", () => {
    expect(ledgerNote(item({ free: true, freePostsLeft: 7 }))).toEqual(["free post, 7 left"]);
    expect(ledgerNote(item({ note: "used on one message" }))).toEqual(["used on one message"]);
  });
  it("writes days in Lagos time", () => {
    const now = new Date("2026-11-05T22:30:00Z"); // 11:30pm Lagos, still the 5th
    expect(dayLabel("2026-11-05T08:14:00Z", now)).toBe("Today");
    expect(dayLabel("2026-11-04T17:40:00Z", now)).toBe("Yesterday");
    expect(dayLabel("2026-10-28T18:05:00Z", now)).toBe("28 Oct");
    expect(whenShort("2026-11-05T08:14:00Z", now)).toBe("Today, 9:14am");
    // 11:30pm UTC on the 5th is already the 6th in Lagos
    expect(dayLabel("2026-11-05T23:30:00Z", new Date("2026-11-06T09:00:00Z"))).toBe("Today");
  });
});

const pay = (o: Partial<Payment>): Payment => ({ id: "p", kind: "UNITS", status: "SUCCEEDED", amountKobo: 69000, txRef: "voices-x", title: "Buzz pack", unitsMilli: 55000, bonusMilli: 5000, method: "card", cardLast4: "4412", receiptNo: "VU-1", failureReason: null, balanceMilli: 67500, createdAt: "2026-11-05T10:00:00Z", verifiedAt: "2026-11-05T10:01:00Z", token: null, ...o });

describe("payment lines", () => {
  it("writes the pack and the method", () => {
    expect(packLine(pay({}))).toBe("Buzz, 55 tokens (5 bonus)"); // a pack with a bonus still reads right
    expect(packLine(pay({ bonusMilli: 0, title: "Spark pack", unitsMilli: 10000 }))).toBe("Spark, 10 tokens");
    expect(packLine(pay({ kind: "EXTRA_VOICE", title: "Extra voice, 1 minute", unitsMilli: null }))).toBe("Extra voice, 1 minute");
    expect(methodLabel(pay({}))).toBe("Card ending 4412");
    expect(methodLabel(pay({ method: "bank_transfer", cardLast4: null }))).toBe("Bank transfer");
    expect(methodLabel(pay({ method: "ussd", cardLast4: null }))).toBe("USSD");
    expect(methodLabel(pay({ method: null, cardLast4: null }))).toBeNull();
  });
  it("never shows an internal code as a reason", () => {
    expect(failureText("Declined by the bank")).toBe("Declined by the bank.");
    expect(failureText("checkout_unavailable")).toBe("The payment did not go through.");
    expect(failureText(null)).toBe("The payment did not go through.");
    expect(failureText("amount_or_currency_mismatch")).toMatch(/does not match/);
  });
});
