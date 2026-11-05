import { Suspense } from "react";
import { OutOfPostsPage } from "@/features/units/OutOfPostsPage";

export const metadata = { title: "Voice Units" };

export default function OutOfPostsRoute() {
  return (
    <Suspense>
      <OutOfPostsPage />
    </Suspense>
  );
}
