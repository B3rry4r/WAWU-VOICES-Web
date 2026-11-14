/**
 * Owner order, 14 Nov 2026: direct messages are OFF until the owner says.
 * While this is false the site shows no trace of them: no Messages icon, row or button, no unread polling,
 * and /messages, /messages/[id] and /messages/new/[userId] answer with the not-found page.
 * Flipping this to true brings every DM screen and entry point back. The DM code itself is kept.
 */
export const DMS_LIVE = false;
