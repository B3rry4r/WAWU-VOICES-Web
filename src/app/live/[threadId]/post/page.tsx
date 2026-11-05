import { PostResultPage } from "@/features/results/PostResultPage";

export const metadata = { title: "Post the numbers you see" };

export default function Page({ params }: { params: { threadId: string } }) {
  return <PostResultPage threadId={params.threadId} />;
}
