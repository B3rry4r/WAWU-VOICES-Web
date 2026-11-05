/**
 * Routes this task's screens use. Checked live on 5 Nov 2026 (round 0): every one is served on main, so all are on.
 * A control whose flag is turned off is not drawn, so a withdrawn route can be hidden in one place.
 */
export const SERVED = {
  /** PUT and DELETE /answers/{id}/like */
  likes: true,
  /** PUT and DELETE /answers/{id}/reaction */
  reactions: true,
  /** GET /answers/{id}/replies */
  replies: true,
  /** GET /voice-clips/{id}/play */
  clipPlay: true,
  /** POST /uploads (RESULT_PHOTO) */
  photoUpload: true,
  /** PUT /me/tag-follows */
  tagFollows: true,
  /** GET /me (the poster's own handle for the preview) */
  me: true,
};
