import { Suspense } from "react";
import { PostedScreen } from "@/features/talk/PostedScreen";

export const metadata = { title: "Posted" };

export default function PostedPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <PostedScreen qid={params.id} />
    </Suspense>
  );
}
