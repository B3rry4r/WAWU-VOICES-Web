/*
 * "Show only what is built" switches. Each flips to true in the task that builds the target (or when the API gap closes).
 * W7 (Voice Units screens) sets WALLET_LIVE. Avatar upload stays off until the API can confirm an uploaded photo
 * (contract request in the W6 hand-back): without it PATCH /me/profile refuses every avatarFileId.
 */
export const WALLET_LIVE = false;
export const AVATAR_UPLOAD_LIVE = false;
