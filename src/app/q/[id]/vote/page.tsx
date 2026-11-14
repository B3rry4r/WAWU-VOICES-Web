import { OpenGate } from "@/features/talk/OpenGate";
import { VotePage } from "@/features/vote/VotePage";

export const metadata = { title: "Vote" };

export default function Page({ params }: { params: { id: string } }) {
  return <OpenGate questionId={params.id}><VotePage questionId={params.id} /></OpenGate>;
}
