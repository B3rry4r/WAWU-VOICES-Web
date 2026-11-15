import { BrandPageScreen } from "@/features/surveys/BrandPageScreen";

export const metadata = { title: "Brand page" };

export default function Page({ params }: { params: { slug: string } }) {
  return <BrandPageScreen slug={params.slug} />;
}
