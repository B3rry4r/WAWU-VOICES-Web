import { describe, expect, it } from "vitest";
import { costRows, dayLabel, extraVoiceTitle, failureText, ledgerFigure, ledgerNote, methodLabel, naira, nairaExact, nairaOfUnits, packLine, signedUnits, units, unitsLabel, whenShort } from "@/features/units/format";
import type { LedgerItem, Payment } from "@/lib/api/units";

const item = (o: Partial<LedgerItem>): LedgerItem => ({ amountKobo: null, freePostsLeft: null, id: "i", kind: "SPEND_POST", title: "t", deltaMilli: 0, balanceAfterMilli: null, free: false, paymentId: null, hasReceipt: false, createdAt: "2026-11-05T08:14:00Z", note: null, ...o });

describe("money and units", () => {
  it("shows kobo as naira the way the boards do", () => {
    expect(naira(13800)).toBe("₦138");
    expect(naira(138000)).toBe("₦1,380");
    expect(naira(690)).toBe("₦6.90");
    expect(nairaExact(1200)).toBe("₦12.00");
    expect(nairaExact(1327)).toBe("₦13.27");
  });
  it("shows milli-units as a count", () => {
    expect(units(12500)).toBe("12.5");
    expect(units(55000)).toBe("55");
    expect(units(500)).toBe("0.5");
    expect(unitsLabel(500)).toBe("0.5 units");
    expect(unitsLabel(1000)).toBe("1 unit");
    expect(unitsLabel(0)).toBe("0 units");
    expect(unitsLabel(12500)).toBe("12.5 units");
    expect(signedUnits(-200)).toBe("−0.2");
    expect(signedUnits(26000)).toBe("+26");
  });
  it("derives a unit cost in naira from the API's base rate, never a constant", () => {
    expect(nairaOfUnits(500, 1380)).toBe("₦6.90");
    expect(nairaOfUnits(1000, 1380)).toBe("₦13.80");
    expect(nairaOfUnits(500, 2000)).toBe("₦10");
  });
  it("builds the cost rows from the numbers it is given", () => {
    const rows = costRows({ baseKoboPerUnit: 1000, freeReactionsPerDay: 5, freeVotesPerDay: 2, textPostMilli: 500, voicePostMilli: 2000, reactionAfterFreeMilli: 100, voteAfterFreeMilli: 200, minPackKobo: 0, extraVoice30Kobo: 0, extraVoice60Kobo: 0, textMaxChars: 500, freeVoiceSeconds: 15 });
    expect(rows).toEqual([
      { label: "Text answer or reply", value: "0.5 units (₦5)" },
      { label: "Voice, up to 15 seconds", value: "2 units (₦20)" },
      { label: "Reaction after 5 free a day", value: "0.1 units" },
      { label: "Vote after 2 free a day", value: "0.2 units" },
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
    expect(whenShort("2026-11-05T08:14:00Z", now)).toBe("Today, 9:14 am");
    // 11:30pm UTC on the 5th is already the 6th in Lagos
    expect(dayLabel("2026-11-05T23:30:00Z", new Date("2026-11-06T09:00:00Z"))).toBe("Today");
  });
});

const pay = (o: Partial<Payment>): Payment => ({ id: "p", kind: "UNITS", status: "SUCCEEDED", amountKobo: 69000, txRef: "voices-x", title: "Buzz pack", unitsMilli: 55000, bonusMilli: 5000, method: "card", cardLast4: "4412", receiptNo: "VU-1", failureReason: null, balanceMilli: 67500, createdAt: "2026-11-05T10:00:00Z", verifiedAt: "2026-11-05T10:01:00Z", token: null, ...o });

describe("payment lines", () => {
  it("writes the pack and the method", () => {
    expect(packLine(pay({}))).toBe("Buzz, 55 units (5 bonus)");
    expect(packLine(pay({ bonusMilli: 0, title: "Spark pack", unitsMilli: 10000 }))).toBe("Spark, 10 units");
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
