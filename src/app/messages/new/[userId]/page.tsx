import { notFound } from "next/navigation";
import { DMS_LIVE } from "@/features/dm/live";
import { ConversationPage } from "@/features/dm/ConversationPage";

export const metadata = DMS_LIVE ? { title: "New message" } : {};

export default function NewMessageRoute({ params }: { params: { userId: string } }) {
  if (!DMS_LIVE) notFound();
  return <ConversationPage userId={params.userId} />;
}
