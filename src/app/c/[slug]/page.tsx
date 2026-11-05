import { CategoryScreen } from "@/components/feed/CategoryScreen";

export const metadata = { title: "Category" };

export default function CategoryPage({ params }: { params: { slug: string } }) {
  return <CategoryScreen slug={params.slug} />;
}
