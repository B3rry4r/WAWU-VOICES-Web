import { Suspense } from "react";
import { MoodPickScreen } from "@/features/mood/MoodPickScreen";

export const metadata = { title: "Pick your word" };

export default function MoodPickPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <MoodPickScreen qid={params.id} />
    </Suspense>
  );
}
