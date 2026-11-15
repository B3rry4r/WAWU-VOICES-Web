// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDraft, saveDraft, type Draft } from "@/features/speak/draft";

const tokenFor = (sub: string) => "x." + btoa(JSON.stringify({ sub })).replace(/=+$/, "") + ".y";
const as = (sub: string | null) => { window.localStorage.clear(); if (sub) window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: tokenFor(sub), refreshToken: "r" })); };
const draft = (over: Partial<Draft> = {}): Draft => ({ questionId: "q1", blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", seconds: 8, peaks: [], key: "key-1", savedAt: Date.now(), ...over });

/** A small in-memory IndexedDB whose "list the keys" step can be held shut, so a pass that began for A can be slow while others act. */
function slowStore() {
  const data = new Map<string, unknown>();
  const gate = { open: true, release: () => undefined as void, held: false };
  let waiters: Array<() => void> = [];
  gate.release = () => { gate.open = true; const w = waiters; waiters = []; w.forEach((f) => f()); };
  const store = (tx: { oncomplete?: () => void }) => {
    const op = <T,>(fn: () => T, hold = false) => {
      const req: { result?: T } = {};
      const finish = () => { req.result = fn(); setTimeout(() => tx.oncomplete?.(), 0); };
      if (hold && !gate.open) { gate.held = true; waiters.push(finish); } else setTimeout(finish, 0);
      return req;
    };
    return {
      put: (v: unknown, k: string) => op(() => { data.set(k, v); return k; }),
      get: (k: string) => op(() => data.get(k)),
      delete: (k: string) => op(() => { data.delete(k); return undefined; }),
      getAllKeys: () => op(() => [...data.keys()], true),
    };
  };
  const indexedDB = {
    open: () => {
      const req: { result: unknown; onsuccess?: () => void } = { result: undefined };
      req.result = { createObjectStore: () => undefined, close: () => undefined, transaction: () => { const tx: { oncomplete?: () => void; objectStore?: () => unknown } = {}; tx.objectStore = () => store(tx); return tx; } };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
  };
  return { data, gate, indexedDB };
}

let s: ReturnType<typeof slowStore>;
beforeEach(() => { as(null); s = slowStore(); vi.stubGlobal("indexedDB", s.indexedDB); });
afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("a pass that began for A never removes the recording of B, who signed in during the pass", () => {
  it("A's load is slow; B signs in and keeps a recording meanwhile; when the pass ends B's is still there, untouched", async () => {
    as("A");
    s.gate.open = false; // the store is slow to list its keys
    const pass = loadDraft("A");
    await vi.waitFor(() => expect(s.gate.held).toBe(true)); // A's pass is now waiting for the list
    as("B"); // B signs in, in another tab
    const bs = draft({ key: "b-key", blob: new Blob(["B's voice"], { type: "audio/webm" }) });
    expect(await saveDraft(bs, "B")).toBe(true);
    const kept = s.data.get("rec:B");
    expect(kept).toBeTruthy();
    s.gate.release(); // the slow pass goes on
    await pass;
    expect(s.data.get("rec:B")).toBe(kept); // the very same stored recording, not removed, not changed
    expect((await loadDraft("B"))?.key).toBe("b-key");
  });

  it("the stated rule is unchanged: with A signed in the whole time, another person's old recording is removed on A's load", async () => {
    as("A");
    s.data.set("rec:C", { ...draft({ key: "c-key" }), owner: "C" });
    s.data.set("rec:guest", { ...draft({ key: "g-key" }), owner: null });
    await loadDraft("A");
    expect(s.data.has("rec:C")).toBe(false);
    expect((s.data.get("rec:A") as Draft).key).toBe("g-key"); // a guest's is handed to the person who is signed in, not removed
  });
});
