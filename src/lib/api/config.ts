/**
 * Runtime config. An empty API base means same origin (production: the VOICES API is under /api on the
 * same host as the web app). No mock mode exists: the web app always calls the real API.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export const WAWU_ID_BASE = process.env.NEXT_PUBLIC_WAWU_ID_BASE ?? "https://id.wawuafrica.com";
export const REQUEST_TIMEOUT_MS = 10000;
