/**
 * Runtime config. The API is at /api/v1 on the web app's own address (V-26); set NEXT_PUBLIC_API_BASE_URL to
 * point elsewhere (local development). No mock mode exists: the web app always calls the real API.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
export const WAWU_ID_BASE = process.env.NEXT_PUBLIC_WAWU_ID_BASE ?? "https://id.wawuafrica.com";
export const REQUEST_TIMEOUT_MS = 10000;
