// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { afterSignOut, clearDraft, leaveTab, loadDraft, openedFor, saveDraft, type Draft } from "@/features/speak/draft";
import { sessionStorage as session } from "@/lib/auth/session-storage";
import * as held from "@/features/units/draft";
import { saveTyped, typedDraft } from "@/features/talk/lib";

const tokenFor = (sub: string) => "x." + btoa(JSON.stringify({ sub })).replace(/=+$/, "") + ".y";
const KEY = "voices-web-session";
const raw = (sub: string | null) => (sub ? JSON.stringify({ accessToken: tokenFor(sub), refreshToken: "r" }) : null);
/** Another tab writes the session: storage changes and the browser tells THIS tab (it never does for this tab's own writes). */
const otherTab = (from: string | null, to: string | null) => {
  if (to) window.localStorage.setItem(KEY, raw(to)!); else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new StorageEvent("storage", { key: KEY, oldValue: raw(from), newValue: raw(to) }));
};
const d = (over: Partial<Draft> = {}): Draft => ({ questionId: "q", blob: new Blob(["a"]), mime: "audio/webm", seconds: 3, peaks: [1], key: "k", savedAt: 1, ...over });

beforeEach(async () => { window.localStorage.clear(); leaveTab(); await clearDraft(null); });
afterEach(() => { window.localStorage.clear(); leaveTab(); });

describe("the tab keeps its person", () => {
  it("1. signed out in ANOTHER tab is not a guest: the take is kept under A, and B never gets it", async () => {
    window.localStorage.setItem(KEY, raw("A")!);
    expect(openedFor()).toBe("A");
    otherTab("A", null); // A signs out in tab 2
    expect(openedFor()).toBe("A");
    await saveDraft(d(), openedFor()); // tab 1 records: kept with owner A
    otherTab(null, "B");
    expect(await loadDraft("B")).toBeNull(); // B's own screen never sees it (and it is removed)
    expect(openedFor()).toBe("A");
    expect(await saveDraft(d({ key: "again" }), openedFor())).toBe(false); // tab 1 is refused while B is signed in
    expect(await loadDraft(openedFor())).toBeNull();
  });
  it("1b. a recording kept for A while nobody is signed in comes back to A when A signs in again", async () => {
    window.localStorage.setItem(KEY, raw("A")!);
    expect(openedFor()).toBe("A");
    otherTab("A", null);
    await saveDraft(d({ key: "mine" }), openedFor());
    otherTab(null, "A");
    expect((await loadDraft("A"))?.key).toBe("mine");
  });
  it("1c. a session that runs out in a lone person's one tab: kept for A, A gets it back after signing in again here", async () => {
    window.localStorage.setItem(KEY, raw("A")!);
    expect(openedFor()).toBe("A");
    session.clear(); // this tab's own expiry: no storage event
    expect(openedFor()).toBe("A");
    await saveDraft(d({ key: "kept" }), openedFor());
    expect((await loadDraft(openedFor()))?.owner).toBe("A");
    session.setTokens(tokenFor("A"), "r2"); // A signs in again in this tab
    expect(openedFor()).toBe("A");
    expect((await loadDraft(openedFor()))?.key).toBe("kept");
  });
  it("1d. only a sign-in or sign-out done in THIS tab changes whose tab it is", () => {
    window.localStorage.setItem(KEY, raw("A")!);
    expect(openedFor()).toBe("A");
    session.clear();
    session.setTokens(tokenFor("C"), "r"); // after the session ran out, C signs in here
    expect(openedFor()).toBe("C");
    session.clear(); leaveTab(); // sign-out here
    expect(openedFor()).toBeNull();
  });
  it("2. B signing in elsewhere never changes the tab: a remount, or going Home and back, still gets A", async () => {
    window.localStorage.setItem(KEY, raw("A")!);
    expect(openedFor()).toBe("A");
    otherTab("A", "B");
    for (let i = 0; i < 5; i++) expect(openedFor()).toBe("A"); // each screen mounted again
    expect(await saveDraft(d(), openedFor())).toBe(false);
  });
  it("2d. a tab that missed the event: the comparison with who is signed in right now still refuses", async () => {
    window.localStorage.setItem(KEY, raw("A")!);
    expect(openedFor()).toBe("A"); // seen while A was signed in
    window.localStorage.setItem(KEY, raw("B")!); // B signs in, no event reaches this tab
    expect(await saveDraft(d(), "A")).toBe(false); // refused anyway: the person of the screen is compared with the session before every write
    expect(await loadDraft("A")).toBeNull();
  });
  it("2e. a refresh in this tab of someone else's session does not change whose tab it is", () => {
    window.localStorage.setItem(KEY, raw("A")!);
    expect(openedFor()).toBe("A");
    otherTab("A", "B");
    session.setTokens(tokenFor("B"), "r9"); // this tab refreshed the stored (B's) refresh token
    expect(openedFor()).toBe("A");
  });
  it("a guest tab follows the person who signs in, here or elsewhere: what the guest kept is that person's now, nothing refuses", async () => {
    expect(openedFor()).toBeNull();
    await saveDraft(d({ key: "guest" }), openedFor()); // the guest has a take
    otherTab(null, "B"); // the same person signs in in tab 2
    expect(openedFor()).toBe("B");
    expect(await saveDraft(d({ key: "guest2" }), openedFor())).not.toBe(undefined); // not refused
    expect((await loadDraft(openedFor()))?.key).toBe("guest2");
    expect((await loadDraft("B"))?.owner).toBe("B");
  });
  it("a guest take made before the sign-in elsewhere is the person's: loaded by them, once", async () => {
    await saveDraft(d({ key: "g" }), null);
    otherTab(null, "U");
    expect((await loadDraft(openedFor()))?.key).toBe("g");
    otherTab("U", "V"); // someone else later: the first person's recording is not theirs
    expect(await loadDraft("V")).toBeNull();
  });
  it("sign-out in this tab removes that person's recording only", async () => {
    window.localStorage.setItem(KEY, raw("A")!);
    await saveDraft(d({ key: "a" }), "A");
    const before = window.localStorage.getItem(KEY);
    session.clear();
    await afterSignOut(before ? (JSON.parse(before) as { accessToken: string }).accessToken : null);
    window.localStorage.setItem(KEY, raw("A")!);
    expect(await loadDraft("A")).toBeNull();
    expect(openedFor()).toBe("A"); // follows the session again (a fresh sign-in here)
  });
});

describe("typed words and held posts: each person's own", () => {
  it("held posts: B has B's own beside A's; A's are still A's; a guest's go to the first person who opens that question, once", () => {
    window.localStorage.setItem(KEY, raw("A")!);
    held.saveDraft("q1", "A's words", 1, "A");
    window.localStorage.setItem(KEY, raw("B")!);
    expect(held.getDraft("q1", "B")).toBeUndefined();
    expect(held.saveDraft("q1", "B's words", 2, "B")?.body).toBe("B's words");
    held.setAwaiting("q1", true, "B");
    expect(held.awaitingDrafts("B").map((x) => x.body)).toEqual(["B's words"]);
    window.localStorage.setItem(KEY, raw("A")!);
    expect(held.getDraft("q1", "A")?.body).toBe("A's words");
    expect(held.awaitingDrafts("A")).toEqual([]);
    // A's open tab while B is signed in: nothing shown, nothing written
    window.localStorage.setItem(KEY, raw("B")!);
    expect(held.getDraft("q1", "A")).toBeUndefined();
    expect(held.saveDraft("q1", "A again", 3, "A")).toBeUndefined();
    expect(held.getDraft("q1", "B")?.body).toBe("B's words");
    // words with no person (main's table, or a guest's) are taken once, by whoever opens that question first
    held.saveDraft("q2", "old words");
    expect(held.getDraft("q2", "B")?.body).toBe("old words");
    window.localStorage.setItem(KEY, raw("A")!);
    expect(held.getDraft("q2", "A")).toBeUndefined();
    expect(held.getDraft("q2")).toBeUndefined();
  });
  it("typed words: each person's own; sign-out leaves them; a guest's words are taken once; none shown to others", () => {
    window.localStorage.setItem(KEY, raw("A")!);
    saveTyped("q:q1", "A words", "A");
    window.localStorage.setItem(KEY, raw("B")!);
    expect(typedDraft("q:q1", "B")).toBe("");
    saveTyped("q:q1", "B words", "B");
    expect(typedDraft("q:q1", "B")).toBe("B words");
    expect(typedDraft("q:q1", "A")).toBe(""); // A's open tab while B is signed in sees none
    saveTyped("q:q1", "A more", "A"); // and cannot write
    window.localStorage.setItem(KEY, raw("A")!);
    expect(typedDraft("q:q1", "A")).toBe("A words");
    window.localStorage.removeItem(KEY);
    saveTyped("q:g", "guest words", null);
    expect(typedDraft("q:g", null)).toBe("guest words");
    window.localStorage.setItem(KEY, raw("A")!);
    expect(typedDraft("q:g", "A")).toBe("guest words");
    window.localStorage.setItem(KEY, raw("B")!);
    expect(typedDraft("q:g", "B")).toBe("");
  });
});
