"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Banner, Button, Icon } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { listVideos, makeVideo, videoFile, type VideoShape, type VoiceVideo } from "@/lib/api/video";

const SHAPES: { shape: VideoShape; label: string; hint: string }[] = [
  { shape: "9x16", label: "Tall 9:16", hint: "For Status and Stories" },
  { shape: "1x1", label: "Square 1:1", hint: "For feeds" },
];
const POLL_MS = 3000;

/** The words a refused request gives: the API's own sentence when it explained itself. */
function sayWhy(e: unknown): string {
  return e instanceof ApiError && e.explained ? e.message : "That did not go through. Try again.";
}

/**
 * LCH-07: "Make a video" on the share screen of the person's own voice answer. Nothing is made until they ask. While it is
 * made they see "Making your video" and the audio link keeps working for sharing; when it is ready they save or share the
 * file. The file is fetched with their own sign-in (it is never a public link).
 */
export function VoiceVideoPanel({ answerId, onNote }: { answerId: string; onNote: (text: string, tone: "success" | "danger") => void }) {
  const [videos, setVideos] = useState<VoiceVideo[] | null>(null);
  const [shape, setShape] = useState<VideoShape>("9x16");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const told = useRef<Set<string>>(new Set());
  const sessionWasWorking = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const r = await listVideos(answerId);
      setVideos(r.items);
    } catch {
      setVideos((v) => v ?? []);
    }
  }, [answerId]);
  useEffect(() => { void load(); }, [load]);

  const working = (videos ?? []).some((v) => v.status === "QUEUED" || v.status === "MAKING");
  useEffect(() => {
    if (!working) return undefined;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [working, load]);
  // told when it is ready, once per video
  useEffect(() => {
    for (const v of videos ?? []) {
      if (v.status === "READY" && !told.current.has(v.id) && sessionWasWorking.current.has(v.id)) {
        told.current.add(v.id);
        onNote("Your video is ready.", "success");
      }
      if (v.status === "QUEUED" || v.status === "MAKING") sessionWasWorking.current.add(v.id);
    }
  }, [videos, onNote]);

  const mine = (s: VideoShape) => (videos ?? []).find((v) => v.shape === s) ?? null;
  const current = mine(shape);

  async function make() {
    setBusy(true);
    setProblem(null);
    try {
      const v = await makeVideo(answerId, shape);
      sessionWasWorking.current.add(v.id);
      setVideos((all) => [v, ...(all ?? []).filter((o) => o.id !== v.id)]);
    } catch (e) {
      setProblem(sayWhy(e));
    } finally {
      setBusy(false);
    }
  }

  async function save(v: VoiceVideo, share: boolean) {
    setBusy(true);
    try {
      const blob = await videoFile(v.id);
      const file = new File([blob], `voices-video-${v.shape}.mp4`, { type: "video/mp4" });
      if (share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch { /* the person closed the sheet */ }
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        onNote("Your video is saved.", "success");
      }
    } catch (e) {
      onNote(sayWhy(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  if (videos === null) return null;
  const state = current?.status ?? "NONE";
  return (
    <section aria-labelledby="video-h" className="flex flex-col gap-3 rounded-[var(--radius-l)] bg-[var(--surface-2)] px-4 py-4">
      <div className="flex flex-col gap-1">
        <h2 id="video-h" className="m-0 font-display text-[22px] leading-[27px]">Share your voice as a video</h2>
        <p className="m-0 text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">A short video with the question, your voice and its captions. No photos. Only you can see it until you share it.</p>
      </div>
      <div role="group" aria-label="Video shape" className="grid grid-cols-2 gap-2">
        {SHAPES.map((s) => (
          <button
            key={s.shape}
            type="button"
            aria-pressed={shape === s.shape}
            onClick={() => setShape(s.shape)}
            className={`flex min-h-[56px] flex-col items-start justify-center rounded-[var(--radius-m)] border px-3 py-2 text-left ${shape === s.shape ? "border-[var(--green)] bg-[var(--mint)] text-[var(--green-text)]" : "border-[var(--line)] bg-[var(--surface-card)]"}`}
          >
            <span className="text-[15px] font-bold leading-5">{s.label}</span>
            <span className="text-[12px] font-medium leading-4 text-[var(--ink-2)]">{s.hint}</span>
          </button>
        ))}
      </div>
      {state === "QUEUED" || state === "MAKING" ? (
        <Banner tone="info" icon="refresh-cw" title="Making your video">It takes about a minute. You can keep sharing the audio link while it is made, and we will tell you here when it is ready.</Banner>
      ) : null}
      {state === "READY" && current ? (
        <>
          <Banner tone="success" icon="circle-check" title="Your video is ready">Save it to your phone or send it from here.</Banner>
          <div className="grid grid-cols-2 gap-2">
            <Button size="l" icon="share-2" loading={busy} onClick={() => void save(current, true)}>Share the video</Button>
            <Button size="l" variant="secondary" icon="file-down" disabled={busy} onClick={() => void save(current, false)}>Save it</Button>
          </div>
        </>
      ) : null}
      {state === "FAILED" ? (
        <Banner tone="danger" title="We could not make your video" action="Try again" onAction={() => void make()}>Your answer is fine. Try once more, or share the audio link.</Banner>
      ) : null}
      {state === "NONE" ? (
        <Button size="l" block icon="play" loading={busy} onClick={() => void make()}>Make a video</Button>
      ) : null}
      {problem ? <p role="alert" className="m-0 flex gap-2 text-[13px] font-medium leading-[18px] text-[var(--danger)]"><Icon name="triangle-alert" size={16} />{problem}</p> : null}
    </section>
  );
}
