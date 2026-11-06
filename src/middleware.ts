import { NextResponse, type NextRequest } from "next/server";
import { forwardHeaders } from "@/lib/api/forward";

/**
 * /s/<code> for a code the API does not know: Next's own notFound() answers 404 but sends an empty error shell (no layout, no theme)
 * until JavaScript runs. So the check happens here: an unknown code is rewritten to /link-not-found, a normal page rendered through
 * the root layout (saved theme included), with status 404 and noindex. A known code, or any trouble reaching the API, falls through.
 */
export const config = { matcher: ["/s/:code*"] };

function apiOrigin(): string {
  const set = process.env.VOICES_API_BASE;
  if (set) return set;
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL;
  return pub && /^https?:\/\//.test(pub) ? pub : "http://127.0.0.1:4000/api/v1";
}

export async function middleware(req: NextRequest) {
  const code = req.nextUrl.pathname.split("/")[2] ?? "";
  try {
    const res = await fetch(`${apiOrigin()}/share/${encodeURIComponent(code)}`, { headers: { Accept: "application/json", ...forwardHeaders(req.headers) }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (res.status === 404 || res.status === 400) {
      const url = req.nextUrl.clone();
      url.pathname = "/link-not-found";
      return NextResponse.rewrite(url, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
    }
  } catch {
    /* the page itself will say what went wrong */
  }
  return NextResponse.next();
}
