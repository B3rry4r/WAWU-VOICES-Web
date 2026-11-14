import { Suspense } from "react";
import { OpenGate } from "@/features/talk/OpenGate";
import { SpeakScreen } from "@/features/speak/SpeakScreen";

export const metadata = { title: "Speak" };

export default function QuestionSpeakPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <OpenGate questionId={params.id}><SpeakScreen questionId={params.id} /></OpenGate>
    </Suspense>
  );
}
