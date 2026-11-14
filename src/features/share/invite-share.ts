/** LCH-05: the words and links of the "You’re live" share, in one place so the screen and the tests read the same text. */

/** The pre-filled message, word for word as the launch spec gives it. `word` is the mood word in capitals. */
export function inviteMessage(word: string, link: string): string {
  return `I just shared how I feel about Nigeria on VOICES.\n\nI feel ${word} about Nigeria. What about you?\n\nAdd your voice in a minute or less: ${link}`;
}

/** WhatsApp opens with the text filled in; the person still taps Send. */
export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export type SmsKind = "ios" | "android";

/** The sms: link with the body: iPhone wants `sms:&body=`, Android `sms:?body=`. It opens the person's own messages app. */
export function smsHref(text: string, kind: SmsKind): string {
  return `sms:${kind === "ios" ? "&" : "?"}body=${encodeURIComponent(text)}`;
}

/** iPhone and iPad (including an iPad that says it is a Mac) take the iPhone form; everything else the Android form. */
export function smsKindFor(nav: { userAgent?: string; platform?: string; maxTouchPoints?: number }): SmsKind {
  const ua = nav.userAgent ?? "";
  if (/iP(hone|ad|od)/.test(ua)) return "ios";
  if (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1) return "ios";
  return "android";
}

/** "2 of your friends have answered", "1 of your friends has answered", or the empty line. */
export function friendsLine(n: number): string {
  if (n <= 0) return "No friends have answered yet";
  return n === 1 ? "1 of your friends has answered" : `${n} of your friends have answered`;
}

/** "Answered 2h ago": the Friends board's second line. */
export function answeredAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (min < 1) return "Answered just now";
  if (min < 60) return `Answered ${min} min ago`;
  if (min < 1440) return `Answered ${Math.floor(min / 60)}h ago`;
  return `Answered ${Math.floor(min / 1440)}d ago`;
}
