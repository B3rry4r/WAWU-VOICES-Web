// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadResultPhoto } from "@/lib/api/results";
import { calls, mockApi, signIn } from "./w6-helpers";

const puts: string[] = [];
class FakeXhr {
  status = 0; onload: (() => void) | null = null; onerror: (() => void) | null = null; private url = "";
  open(_m: string, url: string) { this.url = url; }
  setRequestHeader() {}
  send() { puts.push(this.url); this.status = 200; queueMicrotask(() => this.onload?.()); }
}
beforeEach(() => { window.localStorage.clear(); signIn(); puts.length = 0; vi.stubGlobal("XMLHttpRequest", FakeXhr); });
afterEach(() => vi.unstubAllGlobals());

describe("result sheet photo upload", () => {
  it("presigns, PUTs, then calls /uploads/:id/complete so the server confirms it", async () => {
    mockApi({
      "POST /uploads": { fileId: "r1", putUrl: "https://spaces.example/r1", putHeaders: {}, expiresAt: "x" },
      "POST /uploads/r1/complete": { fileId: "r1", kind: "RESULT_PHOTO", confirmedAt: "2026-11-05T10:00:00Z" },
    });
    const id = await uploadResultPhoto(new Blob([new Uint8Array([1, 2, 3])]), "image/jpeg");
    expect(id).toBe("r1");
    expect(calls[0].body).toEqual({ kind: "RESULT_PHOTO", mime: "image/jpeg", sizeBytes: 3 });
    expect(puts).toEqual(["https://spaces.example/r1"]);
    expect(calls[1].path).toBe("/uploads/r1/complete");
  });
});
