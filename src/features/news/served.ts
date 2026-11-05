/**
 * Routes this task's screens use that main does not serve yet (A1 ME, A3 TALK are unmerged on 5 Nov 2026). A control that needs one is
 * not drawn until the API serves it ("show only what is built"). Flip each to true when its route is live; the code and tests are ready.
 */
export const SERVED = {
  /** PUT and DELETE /answers/{id}/like */
  likes: false,
  /** PUT and DELETE /answers/{id}/reaction */
  reactions: false,
  /** GET /answers/{id}/replies */
  replies: false,
  /** GET /voice-clips/{id}/play */
  clipPlay: false,
  /** POST /uploads (RESULT_PHOTO) */
  photoUpload: false,
  /** PUT /me/tag-follows */
  tagFollows: false,
  /** GET /me (the poster's own handle for the preview) */
  me: false,
};
