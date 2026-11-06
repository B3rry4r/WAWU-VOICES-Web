import { headers } from "next/headers";
import { forwardHeaders } from "./forward";

/** Server components only: the incoming request's X-Forwarded-For, to pass on to the API (lead ruling RT2). Nothing outside a request. */
export function requestForward(): Record<string, string> {
  try {
    return forwardHeaders(headers());
  } catch {
    return {};
  }
}
