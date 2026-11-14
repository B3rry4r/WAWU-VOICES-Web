"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/vx";
import { ErrorLine } from "./ui";
import {
  AUDIO_MIMES,
  PICTURE_MIMES,
  audioProblem,
  audioSeconds,
  pictureProblem,
  uploadPicture,
  uploadRecording,
  type TeamClipPurpose,
  type TeamFileKind,
} from "@/lib/api/admin-media";

export interface Picked {
  id: string;
  name: string;
}

type Props =
  | { kind: "picture"; label: string; hint?: string; fileKind: TeamFileKind; value: Picked | null; onChange: (v: Picked | null) => void; required?: boolean }
  | { kind: "audio"; label: string; hint?: string; purpose: TeamClipPurpose; maxSeconds: number; value: Picked | null; onChange: (v: Picked | null) => void; required?: boolean };

/** A file chosen from the computer, checked here for type, size and length, then sent through the same media routes the app uses. */
export function MediaPick(p: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = (p.kind === "picture" ? PICTURE_MIMES : AUDIO_MIMES).join(",");

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (p.kind === "picture") {
        const bad = pictureProblem(file);
        if (bad) throw new Error(bad);
        p.onChange({ id: await uploadPicture(file, p.fileKind), name: file.name });
      } else {
        const secs = await audioSeconds(file);
        const bad = audioProblem(file, secs, p.maxSeconds);
        if (bad) throw new Error(bad);
        p.onChange({ id: await uploadRecording(file, secs, p.purpose), name: file.name });
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not upload. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="vx-field">
      <label className="vx-field__label" htmlFor={id}>{p.label + (p.required ? "" : " (optional)")}</label>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} id={id} type="file" accept={accept} className="sr-only" disabled={busy} onChange={(e) => void choose(e.target.files?.[0])} data-testid={`pick-${p.kind}`} />
        <Button variant="secondary" size="s" icon={p.kind === "picture" ? "plus" : "mic"} loading={busy} onClick={() => input.current?.click()}>
          {p.value ? "Choose another" : p.kind === "picture" ? "Choose a picture" : "Choose a recording"}
        </Button>
        {p.value ? (
          <>
            <span className="text-caption" data-testid={`picked-${p.kind}`}>{p.value.name}</span>
            <Button variant="ghost" size="s" onClick={() => p.onChange(null)}>Remove</Button>
          </>
        ) : null}
      </div>
      {p.hint ? <p className="vx-field__hint m-0 mt-1 text-caption text-ink-2">{p.hint}</p> : null}
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
