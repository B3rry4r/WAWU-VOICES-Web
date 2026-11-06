import { useEffect, useState } from "react";
import { getTopic } from "@/lib/api/vote";

/** lead ruling WF, 6 Nov (A-M1): the What Next? headline is the week's What Next prompt (topic.whatNextPrompt), not the day's question.
 *  Undefined while it is being read (the headline waits, so the wrong words never flash); null when the week has no prompt or it cannot be read, and the caller then uses the question text. */
export function useWhatNextPrompt(topicId: string | null | undefined): string | null | undefined {
  const [prompt, setPrompt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setPrompt(topicId ? undefined : null);
    if (!topicId) return undefined;
    getTopic(topicId).then(
      (t) => { if (live) setPrompt(t.whatNextPrompt?.trim() || null); },
      () => { if (live) setPrompt(null); },
    );
    return () => { live = false; };
  }, [topicId]);
  return prompt;
}
