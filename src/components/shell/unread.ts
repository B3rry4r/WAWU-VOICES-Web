/** The bell's unread count. The Notifications page announces the count it knows so the bell follows at once. */
export const UNREAD_EVENT = "voices:unread";

export function announceUnread(unread: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<number>(UNREAD_EVENT, { detail: unread }));
}
