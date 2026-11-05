// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/lib/api/profile";
import { calls, mockApi, signIn } from "./w6-helpers";

beforeEach(() => { window.localStorage.clear(); signIn(); });
afterEach(() => vi.unstubAllGlobals());

describe("profile api module", () => {
  it("uses the contract paths, methods and bodies", async () => {
    mockApi({
      "PUT /me/blocks/u9": null, "DELETE /me/blocks/u9": null, "DELETE /me": null, "PATCH /me/settings": {}, "PATCH /me/profile": {}, "PUT /me/categories": {},
      "POST /uploads": { fileId: "f1" }, "POST /reports": { id: "r", status: "OPEN", blocked: true }, "POST /me/export": { id: "e", status: "PENDING" },
    });
    await api.blockUser("u9"); await api.unblockUser("u9");
    await api.deleteAccount("ada.okafor", true);
    await api.updateSettings({ theme: "dark" });
    await api.updateProfile({ state: "Kano", avatarFileId: "f1" });
    await api.setFollowedCategories([{ categoryId: "c1", alertsOn: true }]);
    await api.createUpload({ kind: "AVATAR", mime: "image/png", sizeBytes: 10 });
    await api.createReport({ targetType: "USER", targetId: "u9", reason: "SCAM_OR_SPAM", alsoBlock: true });
    await api.requestExport();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "PUT /me/blocks/u9", "DELETE /me/blocks/u9", "DELETE /me", "PATCH /me/settings", "PATCH /me/profile", "PUT /me/categories", "POST /uploads", "POST /reports", "POST /me/export",
    ]);
    expect(calls[2].body).toEqual({ confirmHandle: "ada.okafor", understandUnitsForfeited: true });
    expect(calls[7].body).toEqual({ targetType: "USER", targetId: "u9", reason: "SCAM_OR_SPAM", alsoBlock: true });
  });
  it("sends the bearer token on signed-in calls and none for a guest person read", async () => {
    mockApi({ "GET /me": {}, "GET /people/u1": {} });
    const f = () => (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    await api.getMe();
    await api.getPerson("u1", false);
    expect((f()[0][1].headers as Headers).get("Authorization")).toBe("Bearer tok");
    expect((f()[1][1].headers as Headers).get("Authorization")).toBeNull();
  });
});
