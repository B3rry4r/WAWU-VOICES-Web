import { LiveResultsPage } from "@/features/results/LiveResultsPage";

export const metadata = { title: "Live results" };

export default function Page({ params }: { params: { threadId: string } }) {
  return <LiveResultsPage threadId={params.threadId} />;
}
