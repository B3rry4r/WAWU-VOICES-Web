import { Suspense } from "react";
import { WriteScreen } from "@/features/talk/WriteScreen";

export const metadata = { title: "Your answer" };

export default function WritePage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <WriteScreen qid={params.id} />
    </Suspense>
  );
}
