import { Suspense } from "react";
import { SpeakGate } from "@/features/speak/SpeakGate";

export const metadata = { title: "Speak" };

export default function SpeakPage() {
  return (
    <Suspense fallback={null}>
      <SpeakGate />
    </Suspense>
  );
}
