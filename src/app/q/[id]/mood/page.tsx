import { Suspense } from "react";
import { OpenGate } from "@/features/talk/OpenGate";
import { MoodPickScreen } from "@/features/mood/MoodPickScreen";

export const metadata = { title: "Pick your word" };

export default function MoodPickPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <OpenGate questionId={params.id}><MoodPickScreen qid={params.id} /></OpenGate>
    </Suspense>
  );
}
