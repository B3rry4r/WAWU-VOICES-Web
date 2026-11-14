"use client";
import { useParams } from "next/navigation";
import { ShareGate } from "@/features/share/ShareGate";

/** Anything that throws while the server draws a share page: the person sees the waiting state, which asks again from the browser on the usual steps. Never an error page. */
export default function ShareError() {
  const params = useParams<{ code: string }>();
  return <ShareGate code={String(params?.code ?? "")} />;
}
