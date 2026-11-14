import { Suspense } from "react";
import { OpenGate } from "@/features/talk/OpenGate";
import { PostedScreen } from "@/features/talk/PostedScreen";

export const metadata = { title: "Posted" };

export default function PostedPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <OpenGate questionId={params.id}><PostedScreen qid={params.id} /></OpenGate>
    </Suspense>
  );
}
