import { NewsPostPage } from "@/features/news/NewsPostPage";

export const metadata = { title: "News post" };

export default function Page({ params }: { params: { answerId: string } }) {
  return <NewsPostPage answerId={params.answerId} />;
}
