/**
 * Routes that other tasks build. A link to one is shown only once the screen exists (show only what is built).
 * Flip a value when its task merges; nothing else in the feed screens changes.
 */
export const BUILT = {
  /** W8a builds /news (the Newsroom). */
  news: false,
} as const;
