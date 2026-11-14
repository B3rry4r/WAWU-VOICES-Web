import { OpenGate } from "@/features/talk/OpenGate";
import { ResultsPage } from "@/features/vote/ResultsPage";

export const metadata = { title: "Results" };

export default function Page({ params }: { params: { id: string } }) {
  return <OpenGate questionId={params.id}><ResultsPage questionId={params.id} /></OpenGate>;
}
