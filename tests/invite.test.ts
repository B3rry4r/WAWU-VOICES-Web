import { describe, expect, it } from "vitest";
import { GET } from "@/app/go/[code]/route";
import { INVITE_COOKIE, INVITE_MAX_AGE, cleanInviteCode, inviteCookieValue, readInviteCode } from "@/lib/invite";
import { qrMatrix, qrSvgPath } from "@/lib/qr";
import { answeredAgo, friendsLine, inviteMessage, smsHref, smsKindFor, whatsappHref } from "@/features/share/invite-share";

const visit = (code: string, cookie?: string) =>
  GET(new Request(`https://x.test/go/${code}`, { headers: cookie ? { cookie } : {} }), { params: { code } });

describe("the invite cookie (LCH-06)", () => {
  it("keeps only the code, for 30 days, on the first link", () => {
    const r = visit("ab12cd7");
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("/go");
    const c = r.headers.get("set-cookie") ?? "";
    expect(c).toContain(`${INVITE_COOKIE}=ab12cd7`);
    expect(c).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    expect(INVITE_MAX_AGE).toBe(2592000);
    expect(c).toContain("SameSite=Lax");
  });
  it("first link wins: a code already kept is not replaced", () => {
    const r = visit("zzzzzzz", `${INVITE_COOKIE}=ab12cd7; other=1`);
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(r.headers.get("location")).toBe("/go");
  });
  it("does not keep a code with the wrong shape", () => {
    for (const bad of ["x", "AB-12CD7", "a".repeat(40)]) expect(visit(bad).headers.get("set-cookie")).toBeNull();
    expect(cleanInviteCode("AB12CD7")).toBe("ab12cd7");
  });
  it("reads it back and marks it Secure on https", () => {
    expect(readInviteCode(`a=1; ${INVITE_COOKIE}=ab12cd7`)).toBe("ab12cd7");
    expect(readInviteCode("a=1")).toBeNull();
    expect(inviteCookieValue("ab12cd7", true)).toContain("; Secure");
  });
});

describe("the share words (LCH-05)", () => {
  const link = "https://usevoices.com/go/ab12cd7";
  it("the message is exactly the spec", () => {
    expect(inviteMessage("HOPEFUL", link)).toBe(
      "I just shared how I feel about Nigeria on VOICES.\n\nI feel HOPEFUL about Nigeria. What about you?\n\nAdd your voice in 10 seconds: https://usevoices.com/go/ab12cd7",
    );
  });
  it("sms: carries the encoded body, in the Android and iPhone forms", () => {
    const t = inviteMessage("PROUD", link);
    const body = encodeURIComponent(t);
    expect(smsHref(t, "android")).toBe(`sms:?body=${body}`);
    expect(smsHref(t, "ios")).toBe(`sms:&body=${body}`);
    expect(smsHref(t, "android")).toContain("%0A%0A");
    expect(decodeURIComponent(smsHref(t, "ios").split("body=")[1])).toBe(t);
  });
  it("picks the iPhone form for iPhone and iPad, else Android", () => {
    expect(smsKindFor({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe("ios");
    expect(smsKindFor({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios");
    expect(smsKindFor({ userAgent: "Mozilla/5.0 (Linux; Android 14)" })).toBe("android");
  });
  it("WhatsApp opens with the text", () => {
    const t = inviteMessage("TIRED", link);
    expect(whatsappHref(t)).toBe(`https://wa.me/?text=${encodeURIComponent(t)}`);
  });
  it("the friends lines", () => {
    expect(friendsLine(2)).toBe("2 of your friends have answered");
    expect(friendsLine(1)).toBe("1 of your friends has answered");
    expect(friendsLine(0)).toBe("No friends have answered yet");
    const now = Date.parse("2026-11-09T12:00:00Z");
    expect(answeredAgo("2026-11-09T10:00:00Z", now)).toBe("Answered 2h ago");
    expect(answeredAgo("2026-11-09T11:20:00Z", now)).toBe("Answered 40 min ago");
  });
});

describe("the QR code (LCH-05)", () => {
  const link = "http://stand-in.test/go/ab12cd7";
  const m = qrMatrix(link);
  it("is a square with the three finder patterns", () => {
    expect(m.length).toBe(m[0].length);
    expect((m.length - 17) % 4).toBe(0);
    const finder = (x: number, y: number) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const edge = i === 0 || j === 0 || i === 6 || j === 6; const core = i >= 2 && i <= 4 && j >= 2 && j <= 4; expect(m[y + i][x + j]).toBe(edge || core); } };
    finder(0, 0); finder(m.length - 7, 0); finder(0, m.length - 7);
  });
  it("is the same every time, differs per link, and is drawn from the link alone", () => {
    expect(qrSvgPath(qrMatrix(link))).toBe(qrSvgPath(m));
    expect(qrSvgPath(qrMatrix(link + "x"))).not.toBe(qrSvgPath(m));
  });
  it("refuses text that cannot fit", () => { expect(() => qrMatrix("x".repeat(300))).toThrow(); });
  it("matches the matrix a separate QR reader decoded back to this link (jsQR, 9 Nov)", () => {
    const flat = m.map((r) => r.map((v) => (v ? "1" : "0")).join("")).join("");
    let h = 0; for (const ch of flat) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    expect(`${m.length}:${h}`).toBe("29:27153316");
  });
});
