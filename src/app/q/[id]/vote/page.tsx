import { VotePage } from "@/features/vote/VotePage";

export const metadata = { title: "Vote" };

export default function Page({ params }: { params: { id: string } }) {
  return <VotePage questionId={params.id} />;
}
