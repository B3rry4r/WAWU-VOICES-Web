import { describe, expect, it } from "vitest";
import { aboutMinutes, clock, recapLine, toInputs } from "@/features/surveys/logic";
import { cell, csvFileName, reportToCsv } from "@/features/admin/survey-csv";
import { changedFields, formReady, toQuestionInputs } from "@/features/admin/SurveysPage";
import type { SurveyReport } from "@/lib/api/admin-surveys";

const q = (id: string, kind: "SINGLE_CHOICE" | "TEXT" | "VOICE", position: number) => ({ id, position, kind, prompt: "P" + position, options: [] });

describe("survey logic", () => {
  it("about a minute for three questions, never less than one", () => {
    expect([1, 3, 4, 5].map(aboutMinutes)).toEqual([1, 1, 2, 2]);
    expect(clock(12)).toBe("0:12");
  });
  it("builds the answer list in question order and leaves a skipped question out", () => {
    const qs = [q("a", "SINGLE_CHOICE", 1), q("b", "TEXT", 2), q("c", "VOICE", 3)];
    expect(toInputs(qs, { c: { kind: "voice", clipId: "clip", seconds: 12 }, a: { kind: "choice", optionId: "o1", label: "Cold drinks" } })).toEqual([
      { questionId: "a", optionId: "o1" },
      { questionId: "c", clipId: "clip" },
    ]);
    expect(recapLine({ kind: "voice", clipId: "x", seconds: 12 })).toBe("Voice answer, 0:12");
  });
});

const report = (over: Partial<SurveyReport> = {}): SurveyReport => ({
  survey: { id: "11111111-1111-4111-8111-111111111111", brandName: "Zobo Fresh", title: "Power and light", status: "APPROVED", startsOn: "2026-11-20", endsOn: "2026-11-30", responseTarget: 100 },
  minGroupSize: 20,
  belowMinimum: false,
  totals: { views: 500, starts: 120, skips: 30, responses: 60, completionRate: 50 },
  questions: [
    { id: "q1", position: 1, kind: "SINGLE_CHOICE", prompt: "How do you keep cool?", answered: 60, options: [{ id: "o1", label: "Cold drinks", count: 40, share: 67, hidden: false }, { id: "o2", label: "A fan, \"battery\"", count: null, share: null, hidden: true }], texts: [], voices: [] },
    { id: "q2", position: 2, kind: "TEXT", prompt: "Anything else?", answered: 3, options: [], texts: ["=SUM(1)", "Fine, thanks"], voices: [] },
    { id: "q3", position: 3, kind: "VOICE", prompt: "Say it", answered: 2, options: [], texts: [], voices: [{ transcript: "We need light", seconds: 12 }] },
  ],
  byState: [{ state: "Lagos", responses: 30, share: 50 }],
  byAgeBand: [{ ageBand: "25-34", responses: 25, share: 42 }],
  note: "Results are combined and anonymous.",
  ...over,
});

describe("the results CSV", () => {
  it("is built from the report body: counts, shares, free answers, transcripts, state and age band", () => {
    const csv = reportToCsv(report());
    const lines = csv.replace("\uFEFF", "").trim().split("\r\n");
    expect(lines[0]).toBe("Section,Question,Answer,Count,Share (%),Seconds");
    expect(lines).toContain("Choice,How do you keep cool?,Cold drinks,40,67,");
    expect(lines).toContain('Choice,How do you keep cool?,"A fan, ""battery""",,,');
    expect(lines).toContain("Free answer,Anything else?,'=SUM(1),,,");
    expect(lines).toContain("Voice answer,Say it,We need light,,,12");
    expect(lines).toContain("State,,Lagos,30,50,");
    expect(lines).toContain("Age band,,25-34,25,42,");
  });
  it("carries no id and no time", () => {
    const csv = reportToCsv(report());
    expect(csv).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(csv).not.toMatch(/2026-11|T\d\d:\d\d/);
  });
  it("below the minimum writes only views, started and skipped, and the note", () => {
    const csv = reportToCsv(report({ belowMinimum: true, note: "Fewer than 20 answers so far." }));
    expect(csv).toContain("Totals,,Views,500");
    expect(csv).not.toContain("Cold drinks");
    expect(csv).not.toContain("Lagos");
    expect(csv).not.toContain("Answers");
    expect(csv).toContain("Fewer than 20 answers so far.");
  });
  it("escapes and names the file", () => {
    expect(cell('a"b')).toBe('"a""b"');
    expect(cell(null)).toBe("");
    expect(csvFileName(report())).toBe("survey-results-zobo-fresh-power-and-light.csv");
  });
});

describe("the survey form rules", () => {
  const base = { brandName: "Zobo Fresh", contactEmail: "a@b.co", title: "T" };
  it("needs 1 to 5 questions and 2 to 6 choices on a single-choice question", () => {
    const poll = (n: number) => ({ kind: "SINGLE_CHOICE" as const, prompt: "P", options: Array.from({ length: n }, (_, i) => "c" + i) });
    expect(formReady(base, [poll(2)])).toBe(true);
    expect(formReady(base, [poll(1)])).toBe(false);
    expect(formReady(base, [poll(7)])).toBe(false);
    expect(formReady(base, [])).toBe(false);
    expect(formReady(base, Array.from({ length: 6 }, () => ({ kind: "TEXT" as const, prompt: "P", options: [] })))).toBe(false);
    expect(formReady({ ...base, contactEmail: "" }, [poll(2)])).toBe(false);
  });
  it("sends choices only for a single-choice question", () => {
    expect(toQuestionInputs([{ kind: "TEXT", prompt: " P ", options: ["x"] }, { kind: "SINGLE_CHOICE", prompt: "Q", options: [" a ", "", "b"] }])).toEqual([{ kind: "TEXT", prompt: "P" }, { kind: "SINGLE_CHOICE", prompt: "Q", options: ["a", "b"] }]);
  });
  it("an edit sends only what changed (dates alone never send the questions)", () => {
    const s = { brandId: null, brandName: "Z", contactEmail: "a@b.co", title: "T", questions: [{ id: "1", position: 1, kind: "TEXT", prompt: "P", options: [] }], categoryIds: [], states: [], startsOn: null, endsOn: null, frequencyCapPerDay: 1, priceKobo: null, responseTarget: null } as never;
    expect(changedFields(s, { brandName: "Z", contactEmail: "a@b.co", title: "T", questions: [{ kind: "TEXT", prompt: "P" }], startsOn: "2026-12-01" })).toEqual({ startsOn: "2026-12-01" });
  });
});
