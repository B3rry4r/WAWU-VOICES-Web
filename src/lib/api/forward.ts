/**
 * The visitor's address for the API (lead ruling RT2, 6 Nov). The share page renders on the web server, which calls the
 * API itself, so without this every visitor would reach the API as the same caller and share one set of limits. nginx
 * puts the visitor's address on X-Forwarded-For; the server-side calls pass that header on unchanged. The API trusts one
 * proxy hop, so it counts the LAST address on the header (the one nginx appended), and a visitor who sends a made-up
 * X-Forwarded-For of their own only adds names in front of it.
 */
export function forwardHeaders(h: { get(name: string): string | null }): Record<string, string> {
  const v = h.get("x-forwarded-for");
  return v ? { "X-Forwarded-For": v } : {};
}
