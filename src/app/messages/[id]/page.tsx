import { notFound } from "next/navigation";
import { DMS_LIVE } from "@/features/dm/live";
import { ConversationPage } from "@/features/dm/ConversationPage";

export const metadata = DMS_LIVE ? { title: "Messages" } : {};

export default function ConversationRoute({ params }: { params: { id: string } }) {
  if (!DMS_LIVE) notFound();
  return <ConversationPage conversationId={params.id} />;
}
