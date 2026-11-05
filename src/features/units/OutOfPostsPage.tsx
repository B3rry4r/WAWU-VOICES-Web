"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { QuestionScreen } from "@/features/talk/QuestionScreen";
import { OutOfPostsSheet } from "./OutOfPostsSheet";
import { isUuid } from "./payment-return";

/** /units/out-of-posts?question=<id>: the same sheet as a page, for any screen that wants to send someone here. */
export function OutOfPostsPage() {
  const router = useRouter();
  const q = useSearchParams().get("question");
  const id = isUuid(q) ? q : null;
  const keep = () => router.push(id ? `/q/${id}` : "/");
  if (!id) return null;
  return (
    <>
      <QuestionScreen id={id} />
      <OutOfPostsSheet questionId={id} onKeep={keep} />
    </>
  );
}
