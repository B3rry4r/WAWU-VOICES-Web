import { ConversationPage } from "@/features/dm/ConversationPage";

export const metadata = { title: "New message" };

export default function NewMessageRoute({ params }: { params: { userId: string } }) {
  return <ConversationPage userId={params.userId} />;
}
