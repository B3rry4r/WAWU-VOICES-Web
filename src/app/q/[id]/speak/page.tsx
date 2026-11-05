import { Suspense } from "react";
import { SpeakScreen } from "@/features/speak/SpeakScreen";

export const metadata = { title: "Speak" };

export default function QuestionSpeakPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <SpeakScreen questionId={params.id} />
    </Suspense>
  );
}
