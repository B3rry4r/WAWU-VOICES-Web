import { INVITE_COOKIE, cleanInviteCode, inviteCookieValue } from "@/lib/invite";

export const dynamic = "force-dynamic";

/**
 * /go/<code> (LCH-06): keep the code for 30 days, then go to /go (the campaign page, built by LCH-08). The first link a visitor opens wins: a
 * code already kept is never replaced. A code with the wrong shape is simply not kept. Only the code is stored.
 */
export function GET(req: Request, { params }: { params: { code: string } }): Response {
  const code = cleanInviteCode(params.code);
  const have = cleanInviteCode(
    (req.headers.get("cookie") ?? "").split(";").map((p) => p.trim()).find((p) => p.startsWith(`${INVITE_COOKIE}=`))?.slice(INVITE_COOKIE.length + 1),
  );
  const headers = new Headers({ Location: "/go", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  if (code && !have) headers.append("Set-Cookie", inviteCookieValue(code, req.headers.get("x-forwarded-proto") === "https"));
  return new Response(null, { status: 307, headers });
}
