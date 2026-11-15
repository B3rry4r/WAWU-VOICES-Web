// @vitest-environment jsdom
// V-SURVEYS round 6, H2: a refresh never overwrites another person's sign-in, for every call.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, tokenSubject, WrongPersonError } from "@/lib/api/client";

const KEY = "voices-web-session";
const jwt = (sub: string, n: string) => `h.${btoa(JSON.stringify({ sub, n })).replace(/=+$/, "")}.s`;
const A_OLD = jwt("userA", "old");
const A_NEW = jwt("userA", "new");
const B1 = jwt("userB", "1");
const setSession = (a: string, r: string) => window.localStorage.setItem(KEY, JSON.stringify({ accessToken: a, refreshToken: r }));
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as { accessToken?: string | null; refreshToken?: string | null };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const who = (h: string | null) => (h ? `${tokenSubject(h.replace("Bearer ", ""))}:${JSON.parse(atob(h.replace("Bearer ", "").split(".")[1])).n}` : "none");

let log: string[] = [];
/** Calls other than refresh answer 401 for A_OLD, 200 otherwise. `onRefresh` decides the refresh answer. */
function server(onRefresh: (rt: string) => Promise<Response> | Response) {
  log = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    const h = new Headers(init.headers);
    if (url.endsWith("/auth/refresh")) {
      const rt = (JSON.parse(String(init.body)) as { refreshToken: string }).refreshToken;
      log.push(`refresh ${rt}`);
      return onRefresh(rt);
    }
    const auth = h.get("Authorization");
    log.push(`${who(auth)} ${(init.method ?? "GET")} ${url.replace(/^.*\/api\/v1/, "")}${h.get("Idempotency-Key") ? " key=" + h.get("Idempotency-Key") : ""}`);
    if (auth === `Bearer ${A_OLD}`) return json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401);
    return json({ ok: true });
  }));
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
function gate() { let open!: () => void; const p = new Promise<void>((r) => { open = r; }); return { p, open }; }

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); setSession(A_OLD, "rA-old"); });
afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("H2: compare and set", () => {
  it("A's tab is refreshing, B signs in meanwhile: B's sign-in is intact and nothing of A's is written", async () => {
    const g = gate();
    server(async () => { await g.p; return json({ data: { accessToken: A_NEW, refreshToken: "rA-new" } }); });
    const call = apiFetch("/x", { authed: true, expectSubject: "userA" }).catch((e: unknown) => e);
    await tick(10);
    setSession(B1, "rB-1"); // B signs in in another tab
    g.open();
    expect(await call).toBeInstanceOf(WrongPersonError);
    expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB-1" });
    expect(log.filter((l) => l.startsWith("userB"))).toEqual([]);
  });

  it("the same, for a plain call: it retries once as whoever is signed in now, never with A's token", async () => {
    const g = gate();
    server(async () => { await g.p; return json({ data: { accessToken: A_NEW, refreshToken: "rA-new" } }); });
    const call = apiFetch("/x", { authed: true });
    await tick(10);
    setSession(B1, "rB-1");
    g.open();
    await call;
    expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB-1" });
    expect(log).toEqual(["userA:old GET /x", "refresh rA-old", "userB:1 GET /x"]);
  });

  it("two tabs of the same person: one refresh wins, the other carries on with its tokens", async () => {
    const g = gate();
    server(async () => { await g.p; return json({ data: { accessToken: A_NEW, refreshToken: "rA-new" } }); });
    const one = apiFetch("/x", { authed: true, expectSubject: "userA" });
    await tick(10);
    // the second tab wrote the rotated tokens first
    setSession(A_NEW, "rA-rotated");
    g.open();
    await one;
    expect(stored()).toEqual({ accessToken: A_NEW, refreshToken: "rA-rotated" });
    expect(log).toEqual(["userA:old GET /x", "refresh rA-old", "userA:new GET /x"]);
  });

  it("a refresh refused while B is signed in leaves B alone", async () => {
    const g = gate();
    server(async () => { await g.p; return json({ error: { code: "INVALID", message: "no" } }, 401); });
    const call = apiFetch("/x", { authed: true }).catch((e: unknown) => e);
    await tick(10);
    setSession(B1, "rB-1");
    g.open();
    await call;
    expect(stored()).toEqual({ accessToken: B1, refreshToken: "rB-1" });
  });

  it("a refused refresh alone signs the person out", async () => {
    server(() => json({ error: { code: "INVALID", message: "no" } }, 401));
    await expect(apiFetch("/x", { authed: true })).rejects.toMatchObject({ status: 401 });
    expect(stored().accessToken ?? null).toBeNull();
    expect(stored().refreshToken ?? null).toBeNull();
  });

  it("a plain GET 401: one refresh, one retry with the new token", async () => {
    server(() => json({ data: { accessToken: A_NEW, refreshToken: "rA-new" } }));
    await apiFetch("/me", { authed: true });
    expect(log).toEqual(["userA:old GET /me", "refresh rA-old", "userA:new GET /me"]);
    expect(stored()).toEqual({ accessToken: A_NEW, refreshToken: "rA-new" });
  });

  it("a post with a run-out token: one refresh, one post, the same Idempotency-Key", async () => {
    server(() => json({ data: { accessToken: A_NEW, refreshToken: "rA-new" } }));
    await apiFetch("/questions/q1/answers", { method: "POST", authed: true, body: { a: 1 }, idempotencyKey: "k-1" });
    expect(log).toEqual(["userA:old POST /questions/q1/answers key=k-1", "refresh rA-old", "userA:new POST /questions/q1/answers key=k-1"]);
  });

  it("A signs out while the refresh runs: the answer is dropped, nothing is written", async () => {
    const g = gate();
    server(async () => { await g.p; return json({ data: { accessToken: A_NEW, refreshToken: "rA-new" } }); });
    const call = apiFetch("/x", { authed: true }).catch((e: unknown) => e);
    await tick(10);
    window.localStorage.removeItem(KEY);
    g.open();
    await call;
    expect(stored().accessToken ?? null).toBeNull();
    expect(stored().refreshToken ?? null).toBeNull();
  });
});
