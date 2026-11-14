import { notFound } from "next/navigation";
import { DMS_LIVE } from "@/features/dm/live";
import { InboxPage } from "@/features/dm/InboxPage";

export const metadata = DMS_LIVE ? { title: "Messages" } : {};

export default function MessagesPage() {
  if (!DMS_LIVE) notFound();
  return <InboxPage />;
}
