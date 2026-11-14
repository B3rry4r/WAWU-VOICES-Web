import type { components } from "./types";
import { apiFetch } from "./client";
import { guestId } from "./feed";

type S = components["schemas"];
export type SupportTopic = S["SupportMessageRequest"]["topic"];

/** POST /support/messages: guest or signed in. The server mails the receipt. */
export const sendSupportMessage = (b: { topic: SupportTopic; message: string; contactEmail?: string; paymentId?: string }) => {
  const g = guestId();
  return apiFetch<S["SupportReceipt"]>("/support/messages", { method: "POST", authed: true, headers: g ? { "X-Guest-Id": g } : undefined, body: b });
};
