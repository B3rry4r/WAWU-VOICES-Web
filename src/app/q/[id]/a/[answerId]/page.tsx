import { ThreadScreen } from "@/features/talk/ThreadScreen";

export const metadata = { title: "Replies" };

export default function ThreadPage({ params }: { params: { id: string; answerId: string } }) {
  return <ThreadScreen qid={params.id} aid={params.answerId} />;
}
