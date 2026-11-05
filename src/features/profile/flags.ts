/*
 * "Show only what is built" switch. Avatar upload stays off: the server now has POST /uploads/{fileId}/complete, but
 * uploadAvatar() does not call it yet, so PATCH /me/profile would refuse the avatarFileId. Flip it with that call.
 */
export const AVATAR_UPLOAD_LIVE = false;
