"use client";
import { useSearchParams } from "next/navigation";
import { OpenGate } from "@/features/talk/OpenGate";
import { SpeakScreen } from "./SpeakScreen";

/** /speak and /speak?q=<id>: the recorder, once the question has opened. */
export function SpeakGate() {
  const q = useSearchParams().get("q") ?? undefined;
  return <OpenGate questionId={q}><SpeakScreen /></OpenGate>;
}
