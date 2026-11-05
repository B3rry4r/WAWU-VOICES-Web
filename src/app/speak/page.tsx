import { Suspense } from "react";
import { SpeakScreen } from "@/features/speak/SpeakScreen";

export const metadata = { title: "Speak" };

export default function SpeakPage() {
  return (
    <Suspense fallback={null}>
      <SpeakScreen />
    </Suspense>
  );
}
