import { ConversationPage } from "@/features/dm/ConversationPage";

export const metadata = { title: "Messages" };

export default function ConversationRoute({ params }: { params: { id: string } }) {
  return <ConversationPage conversationId={params.id} />;
}
