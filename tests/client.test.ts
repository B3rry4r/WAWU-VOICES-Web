import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError, apiFetch } from "@/lib/api/client";

afterEach(() => vi.unstubAllGlobals());

function stub(res: Response | Error) {
  vi.stubGlobal("fetch", vi.fn(async () => { if (res instanceof Error) throw res; return res; }));
}

describe("apiFetch empty bodies", () => {
  it("a real empty 202 (DELETE /me) returns undefined", async () => {
    stub(new Response(null, { status: 202 }));
    expect(await apiFetch("/api/x", { method: "DELETE" })).toBeUndefined();
  });
  it("a 200 with a zero-length body returns undefined", async () => {
    stub(new Response("", { status: 200 }));
    expect(await apiFetch("/api/x")).toBeUndefined();
  });
});

describe("apiFetch", () => {
  it("returns the JSON body", async () => {
    stub(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    expect(await apiFetch<{ ok: number }>("/api/x")).toEqual({ ok: 1 });
  });
  it("reads the API error shape", async () => {
    stub(new Response(JSON.stringify({ error: { code: "NO_UNITS", message: "Not enough units" } }), { status: 402 }));
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ status: 402, code: "NO_UNITS", explained: true });
  });
  it("marks an unexplained failure", async () => {
    stub(new Response("<html>", { status: 502 }));
    const e = (await apiFetch("/api/x").catch((x: unknown) => x)) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.explained).toBe(false);
  });
  it("turns a transport failure into NetworkError", async () => {
    stub(new TypeError("fail"));
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(NetworkError);
  });
  it("sends Idempotency-Key and bearer", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    await apiFetch("/api/x", { method: "POST", body: {}, token: "t", idempotencyKey: "k1" });
    const h = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(h.get("Idempotency-Key")).toBe("k1");
    expect(h.get("Authorization")).toBe("Bearer t");
  });
});
