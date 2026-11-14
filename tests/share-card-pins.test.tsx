// @vitest-environment jsdom
// V-SHARE-CARD: pins the Speak screen (the pick-one-word screen) as it is today. None of this may change.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/q/q1/mood",
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { MoodPickScreen } from "@/features/mood/MoodPickScreen";
import { readPick } from "@/features/mood/mood";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const QUESTION = { id: "q1", kind: "DAILY", status: "LIVE", text: "How do you feel about Nigeria right now?", hint: "With everything going on, say it in your voice. 60 seconds.", moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"], category: null, recentVoices: [], voiceCount: 0, answerCount: 0, iSaved: false };

beforeEach(() => {
  push.mockReset(); replace.mockReset(); search = "";
  window.localStorage.clear(); window.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).endsWith("/questions/q1")) return json(QUESTION);
    if (String(url).endsWith("/config/public")) return json({ voiceFreeSeconds: 60 });
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("the Speak screen with word options, as a person meets it today", () => {
  it("draws the heading, the line, the question, its small line and the pick prompt", async () => {
    render(<MoodPickScreen qid="q1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "How do you feel about Nigeria right now?" })).toBeTruthy();
    expect(screen.getByText("Speak")).toBeTruthy();
    expect(screen.getByText("Today’s question")).toBeTruthy();
    expect(screen.getByText("Nigeria’s national conversation")).toBeTruthy();
    expect(screen.getByText("With everything going on, say it in your voice. 60 seconds.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Pick one word" })).toBeTruthy();
    expect(screen.getByText("Your word shows beside your answer. You can change it until you post.")).toBeTruthy();
  });
  it("shows the four words in order, none pressed", async () => {
    render(<MoodPickScreen qid="q1" />);
    await screen.findByTestId("mood-ANGRY");
    const group = screen.getByRole("group", { name: "Pick one word" });
    const words = within(group).getAllByRole("button").map((b) => b.textContent);
    expect(words).toEqual(["ANGRY", "TIRED", "PROUD", "HOPEFUL"]);
    for (const b of within(group).getAllByRole("button")) expect(b.getAttribute("aria-pressed")).toBe("false");
  });
  it("has both buttons with their labels", async () => {
    render(<MoodPickScreen qid="q1" />);
    expect(await screen.findByRole("button", { name: "Say it in 60 seconds" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Type it instead" })).toBeTruthy();
  });
  it("has the Share my word switch, on, with its line", async () => {
    render(<MoodPickScreen qid="q1" />);
    await screen.findByTestId("mood-ANGRY");
    expect(screen.getByText("Share my word")).toBeTruthy();
    expect(screen.getByText("The friend whose link brought you here sees your word. Nobody else does.")).toBeTruthy();
    expect((screen.getByRole("switch", { name: "Share my word with the friend who invited me" }) as HTMLInputElement | HTMLElement).getAttribute("aria-checked") ?? (screen.getByRole("switch") as HTMLInputElement).checked).toBeTruthy();
  });
  it("picks a word, changes it, and goes on with the last one (no from, nothing extra in the address)", async () => {
    render(<MoodPickScreen qid="q1" />);
    await screen.findByTestId("mood-ANGRY");
    await userEvent.click(screen.getByTestId("mood-PROUD"));
    expect(screen.getByTestId("mood-PROUD").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByTestId("mood-TIRED"));
    expect(screen.getByTestId("mood-TIRED").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("mood-PROUD").getAttribute("aria-pressed")).toBe("false");
    expect(readPick("q1")).toBe("TIRED");
    await userEvent.click(screen.getByRole("button", { name: "Say it in 60 seconds" }));
    expect(push).toHaveBeenLastCalledWith("/q/q1/speak?mood=TIRED");
    await userEvent.click(screen.getByRole("button", { name: "Type it instead" }));
    expect(push).toHaveBeenLastCalledWith("/q/q1/write?mood=TIRED");
  });
  it("asks for a word first when none is picked, and goes nowhere", async () => {
    render(<MoodPickScreen qid="q1" />);
    await screen.findByTestId("mood-ANGRY");
    await userEvent.click(screen.getByRole("button", { name: "Say it in 60 seconds" }));
    expect(screen.getByRole("alert").textContent).toBe("Pick one word first.");
    expect(push).not.toHaveBeenCalled();
  });
  it("a closed question says so instead", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => String(url).endsWith("/questions/q1") ? json({ ...QUESTION, status: "CLOSED" }) : json({ voiceFreeSeconds: 60 })));
    render(<MoodPickScreen qid="q1" />);
    expect(await screen.findByText("This question has closed.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("mood-ANGRY")).toBeNull());
  });
});
