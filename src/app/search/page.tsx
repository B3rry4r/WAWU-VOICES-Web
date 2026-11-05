import { Suspense } from "react";
import { SearchScreen } from "@/components/feed/SearchScreen";

export const metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchScreen />
    </Suspense>
  );
}
