import { OpenGate } from "@/features/talk/OpenGate";
import { WhatNextPage } from "@/features/vote/WhatNextPage";

export const metadata = { title: "What Next?" };

export default function Page({ params }: { params: { id: string } }) {
  return <OpenGate questionId={params.id}><WhatNextPage questionId={params.id} /></OpenGate>;
}
