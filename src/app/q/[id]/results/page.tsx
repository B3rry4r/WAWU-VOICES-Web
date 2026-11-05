import { ResultsPage } from "@/features/vote/ResultsPage";

export const metadata = { title: "Results" };

export default function Page({ params }: { params: { id: string } }) {
  return <ResultsPage questionId={params.id} />;
}
