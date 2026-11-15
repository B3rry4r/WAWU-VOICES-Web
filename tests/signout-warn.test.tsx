// @vitest-environment jsdom
// Sign out warns first when the person has a recording kept on this device that was not sent (owner order, 15 Nov 2026).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { me, mockApi, calls } from "./w6-helpers";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, back: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/features/dm/live", () => ({ DMS_LIVE: false }));

import { DeletionPending } from "@/features/profile/DeletionPending";
import { SettingsPage } from "@/features/profile/SettingsPage";
import { DRAFT_MAX_AGE_MS, hasKeptRecording, loadDraft, type Draft } from "@/features/speak/draft";

const SENTENCE = "You have a recording you have not sent. Sign out anyway?";
const tokenFor = (sub: string) => "x." + btoa(JSON.stringify({ sub })).replace(/=+$/, "") + ".y";
const signInAs = (sub: string) => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: tokenFor(sub), refreshToken: "r" }));
const tokenNow = () => JSON.parse(window.localStorage.getItem("voices-web-session") ?? "{}").accessToken ?? null;
const draft = (over: Partial<Draft> = {}): Draft => ({ questionId: "q1", blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", seconds: 40, peaks: [], key: "key-1", savedAt: Date.now(), ...over });

/** A small IndexedDB stand in that records every read, write and removal, and can be made to throw. */
function fakeStore() {
  const data = new Map<string, unknown>();
  const log = { gets: [] as string[], puts: [] as string[], dels: [] as string[], keys: 0 };
  const st = { broken: false };
  const store = (tx: { oncomplete?: () => void }) => {
    const op = <T,>(fn: () => T) => { const req: { result?: T } = {}; setTimeout(() => { req.result = fn(); setTimeout(() => tx.oncomplete?.(), 0); }, 0); return req; };
    return {
      put: (v: unknown, k: string) => op(() => { log.puts.push(k); data.set(k, v); return k; }),
      get: (k: string) => op(() => { log.gets.push(k); return data.get(k); }),
      delete: (k: string) => op(() => { log.dels.push(k); data.delete(k); return undefined; }),
      getAllKeys: () => op(() => { log.keys++; return [...data.keys()]; }),
    };
  };
  const indexedDB = {
    open: () => {
      if (st.broken) throw new Error("storage blocked");
      const req: { result: unknown; onsuccess?: () => void } = { result: undefined };
      req.result = { createObjectStore: () => undefined, close: () => undefined, transaction: () => { const tx: { oncomplete?: () => void; objectStore?: () => unknown } = {}; tx.objectStore = () => store(tx); return tx; } };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
  };
  return { data, log, st, indexedDB };
}
let s: ReturnType<typeof fakeStore>;
const snapshot = () => JSON.stringify([...s.data.entries()].map(([k, v]) => [k, { ...(v as Draft), blob: (v as Draft).blob.size }]));

beforeEach(() => {
  window.localStorage.clear(); push.mockReset(); replace.mockReset();
  s = fakeStore();
  vi.stubGlobal("indexedDB", s.indexedDB);
  mockApi({ "GET /me": me, "GET /me/blocks": { items: [], nextCursor: null }, "POST /auth/logout": null });
  signInAs("tunde");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const signOutButton = () => screen.getAllByRole("button", { name: "Sign out" })[0];
const openSettings = async () => { render(<SettingsPage />); await screen.findByText("Share my word"); };
const loggedOut = () => calls.some((c) => c.path.endsWith("/auth/logout"));

describe("Settings: Sign out with a kept recording", () => {
  it("1. shows the sentence; Go back keeps the person signed in and the recording stored, and signs nobody out", async () => {
    s.data.set("rec:tunde", draft({ owner: "tunde" }));
    await openSettings();
    await userEvent.click(signOutButton());
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).toContain(SENTENCE);
    expect(screen.getByRole("button", { name: "Sign out anyway" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tokenNow()).toBe(tokenFor("tunde"));
    expect(s.data.has("rec:tunde")).toBe(true);
    expect(s.log.dels).toEqual([]);
    expect(loggedOut()).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("1b. Escape is Go back, and focus goes into the dialog", async () => {
    s.data.set("rec:tunde", draft({ owner: "tunde" }));
    await openSettings();
    await userEvent.click(signOutButton());
    const dlg = await screen.findByRole("dialog");
    await waitFor(() => expect(dlg.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tokenNow()).toBe(tokenFor("tunde"));
    expect(s.data.has("rec:tunde")).toBe(true);
  });

  it("2. Sign out anyway signs out, removes the recording as before, and lands where sign-out lands", async () => {
    s.data.set("rec:tunde", draft({ owner: "tunde" }));
    await openSettings();
    await userEvent.click(signOutButton());
    await userEvent.click(await screen.findByRole("button", { name: "Sign out anyway" }));
    expect(tokenNow()).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
    await waitFor(() => expect(s.data.has("rec:tunde")).toBe(false));
    await waitFor(() => expect(loggedOut()).toBe(true));
  });

  it("2b. a kept offline recording waiting to be sent and a kept voice reply are warned about too", async () => {
    for (const extra of [{ queued: true }, { reply: { answerId: "a1", stance: "AGREE" as const } }]) {
      s.data.clear();
      s.data.set("rec:tunde", draft({ owner: "tunde", ...extra }));
      await openSettings();
      await userEvent.click(signOutButton());
      expect((await screen.findByRole("dialog")).textContent).toContain(SENTENCE);
      cleanup();
    }
  });

  it("3. no kept recording: signs out at once, no dialog", async () => {
    await openSettings();
    await userEvent.click(signOutButton());
    await waitFor(() => expect(tokenNow()).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("4. a recording older than 7 days does not count: no dialog", async () => {
    const old = Date.now() - DRAFT_MAX_AGE_MS - 60_000;
    s.data.set("rec:tunde", draft({ owner: "tunde", savedAt: old, recordedAt: old }));
    await openSettings();
    await userEvent.click(signOutButton());
    await waitFor(() => expect(tokenNow()).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("5. storage that throws: no dialog, sign-out works", async () => {
    s.data.set("rec:tunde", draft({ owner: "tunde" }));
    s.st.broken = true;
    await openSettings();
    await userEvent.click(signOutButton());
    await waitFor(() => expect(tokenNow()).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("6. another person's kept recording: no dialog, and the check does not read, change or remove it", async () => {
    s.data.set("rec:someone-else", draft({ owner: "someone-else" }));
    const before = snapshot();
    await openSettings();
    const getsBefore = s.log.gets.length;
    expect(await hasKeptRecording("tunde")).toBe(false);
    expect(s.log.gets.slice(getsBefore)).toEqual(["rec:tunde"]);
    await userEvent.click(signOutButton());
    await waitFor(() => expect(tokenNow()).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(s.log.gets.every((k) => k === "rec:tunde")).toBe(true);
    expect(s.data.has("rec:someone-else")).toBe(true);
    expect(snapshot()).toBe(before);
  });
});

describe("The account deletion screen's Sign out", () => {
  it("7. a kept recording: the sentence; Go back changes nothing; Sign out anyway signs out to /welcome; none: at once", async () => {
    s.data.set("rec:tunde", draft({ owner: "tunde" }));
    render(<DeletionPending scheduledFor="2026-11-30" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect((await screen.findByRole("dialog")).textContent).toContain(SENTENCE);
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tokenNow()).toBe(tokenFor("tunde"));
    expect(s.data.has("rec:tunde")).toBe(true);
    expect(replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign out anyway" }));
    expect(replace).toHaveBeenCalledWith("/welcome");
    expect(tokenNow()).toBeNull();
    await waitFor(() => expect(s.data.has("rec:tunde")).toBe(false));
    cleanup(); replace.mockReset();
    signInAs("tunde");
    render(<DeletionPending scheduledFor="2026-11-30" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/welcome"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tokenNow()).toBeNull();
  });
});

describe("hasKeptRecording", () => {
  it("8. writes nothing: the store is the same before and after, and a guest's recording is not claimed", async () => {
    s.data.set("rec:guest", draft({ owner: null, key: "g" }));
    s.data.set("rec:tunde", draft({ owner: "tunde" }));
    s.data.set("rec:other", draft({ owner: "other", key: "o" }));
    const before = snapshot();
    expect(await hasKeptRecording("tunde")).toBe(true);
    expect(await hasKeptRecording("nobody")).toBe(false);
    expect(await hasKeptRecording(null)).toBe(false);
    expect(snapshot()).toBe(before);
    expect(s.log.puts).toEqual([]);
    expect(s.log.dels).toEqual([]);
    expect(s.log.keys).toBe(0);
    expect((s.data.get("rec:guest") as Draft).owner).toBeNull();
    s.data.delete("rec:tunde");
    expect(await hasKeptRecording("tunde")).toBe(false);
    expect(s.data.has("rec:guest")).toBe(true);
    expect(await loadDraft(null)).not.toBeNull(); // sanity: the guest's recording is still there to be claimed by the screen that owns that
  });
});
