import { WhatNextPage } from "@/features/vote/WhatNextPage";

export const metadata = { title: "What Next?" };

export default function Page({ params }: { params: { id: string } }) {
  return <WhatNextPage questionId={params.id} />;
}
