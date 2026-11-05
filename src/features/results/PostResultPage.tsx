"use client";

import { useEffect, useRef, useState } from "react";
import { Rail } from "@/components/shell/ShellSlots";
import { useRouter } from "next/navigation";
import { Banner, Button, EmptyState, Icon, ResultComment, TextField } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { createResultPost, getMyHandle, getResultThread, isResultPhotoMime, uploadResultPhoto } from "@/lib/api/results";
import { EMPTY_FORM, MAX_PHOTO_BYTES, postErrorMessage, serverFieldErrors, toRequest, validate } from "./form";
import type { FieldErrors, PostForm } from "./form";
import { SERVED } from "@/features/news/served";
import { AppBar, DesktopBack, LabelsPanel, useSignedIn } from "./shared";

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

export function PostResultPage({ threadId }: { threadId: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const back = `/live/${threadId}`;
  const [handle, setHandle] = useState<string | null>(null);
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const key = useRef<{ sig: string; id: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getResultThread(threadId).then((t) => setClosed(t.status !== "OPEN")).catch(() => undefined);
  }, [threadId]);
  useEffect(() => {
    if (signedIn && SERVED.me) getMyHandle().then((m) => m.handle && setHandle(m.handle)).catch(() => undefined);
  }, [signedIn]);

  const set = (k: keyof PostForm) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFormError(null);
  };

  function pick(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    if (!isResultPhotoMime(file.type)) return setPhotoError("Use a JPEG, PNG or WebP photo.");
    if (file.size > MAX_PHOTO_BYTES) return setPhotoError("That photo is too large. Use one under 10 MB.");
    setPhoto(file);
  }

  async function submit() {
    if (busy) return;
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFormError(null);
    try {
      const body = toRequest(form);
      let photoFileId: string | undefined;
      if (SERVED.photoUpload && photo && isResultPhotoMime(photo.type)) photoFileId = await uploadResultPhoto(photo, photo.type);
      // One key per distinct form: a retry after a dropped connection replays the same post, never makes a second.
      const sig = JSON.stringify([body, photoFileId ?? null]);
      if (!key.current || key.current.sig !== sig) key.current = { sig, id: newKey() };
      await createResultPost(threadId, photoFileId ? { ...body, photoFileId } : body, key.current.id);
      router.push(`${back}?posted=1`);
    } catch (err) {
      const fields = serverFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      if (err instanceof ApiError && err.code === "CONFLICT" && (err.details as { reason?: string } | undefined)?.reason === "THREAD_CLOSED") setClosed(true);
      else setFormError(Object.keys(fields).length ? "Some details need fixing." : postErrorMessage(err));
      setBusy(false);
    }
  }

  const preview = (
    <ResultComment
      author={{ handle: handle ? "@" + handle : "You", name: handle ?? "You" }}
      time="Just now"
      place={[form.pollingUnit, form.ward, form.lga, form.state].filter((s) => s.trim()).join(", ") || "Your polling unit"}
      figures={[
        { label: "Accredited", value: form.accredited.trim() || "0" },
        { label: "Votes cast", value: form.votesCast.trim() || "0" },
        { label: "Rejected", value: form.rejected.trim() || "0" },
      ]}
      status="unverified"
      checked="Not checked yet. The WAWU team is on it."
      hideActions
    />
  );

  if (signedIn === false) {
    return (
      <>
        <AppBar href={back} back="close" backLabel="Close" title="Post the numbers you see" subtitle="Polling unit results" />
        <DesktopBack href={back} label="Back to live results" />
        <EmptyState icon="lock" title="Sign in to post the numbers you see" />
      </>
    );
  }
  if (closed) {
    return (
      <>
        <AppBar href={back} back="close" backLabel="Close" title="Post the numbers you see" subtitle="Polling unit results" />
        <DesktopBack href={back} label="Back to live results" />
        <EmptyState icon="radio" title="This results thread is closed" body="You can no longer post numbers." />
      </>
    );
  }

  return (
    <>
      <AppBar href={back} back="close" backLabel="Close" title="Post the numbers you see" subtitle="Polling unit results" />
      <DesktopBack href={back} label="Back to live results" />
      <form
        className="flex flex-col gap-5 pb-40 pt-2 dt:pb-8"
        noValidate
        onSubmit={(ev) => { ev.preventDefault(); void submit(); }}
        aria-label="Post the numbers you see"
      >
        <h1 className="m-0 hidden font-display text-[32px] font-normal leading-9 dt:block">Post the numbers you see</h1>
        <p className="m-0 text-[16px] leading-6 text-ink-2">Copy exactly what is written on the result sheet at your polling unit.</p>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 p-0 font-display text-[18px] font-normal leading-6">Where</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <TextField label="State" value={form.state} onChange={set("state")} error={errors.state} autoComplete="off" />
            <TextField label="Local government" value={form.lga} onChange={set("lga")} error={errors.lga} autoComplete="off" />
            <TextField label="Ward" value={form.ward} onChange={set("ward")} error={errors.ward} autoComplete="off" />
            <TextField label="Polling unit" value={form.pollingUnit} onChange={set("pollingUnit")} error={errors.pollingUnit} autoComplete="off" />
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 p-0 font-display text-[18px] font-normal leading-6">The numbers on the sheet</legend>
          <div className="grid grid-cols-3 gap-x-3">
            <TextField label="Accredited" value={form.accredited} onChange={set("accredited")} error={errors.accredited} inputMode="numeric" autoComplete="off" />
            <TextField label="Votes cast" value={form.votesCast} onChange={set("votesCast")} error={errors.votesCast} inputMode="numeric" autoComplete="off" />
            <TextField label="Rejected" value={form.rejected} onChange={set("rejected")} error={errors.rejected} inputMode="numeric" autoComplete="off" />
          </div>
        </fieldset>

        {SERVED.photoUpload ? <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold leading-5" id="photo-label">Photo of the result sheet (optional)</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-labelledby="photo-label"
            tabIndex={-1}
            data-testid="photo-input"
            onChange={(ev) => { pick(ev.target.files?.[0]); ev.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex min-h-[72px] items-center gap-3 rounded-l border-[1.5px] border-dashed border-line-strong bg-transparent p-3 text-left text-ink"
          >
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-pill bg-mint text-green-text"><Icon name={photo ? "check" : "plus"} size={24} /></span>
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-[16px] leading-5">{photo ? photo.name : "Add a photo"}</b>
              <span className="text-[13px] leading-4 text-ink-2">It helps the WAWU team check faster. Only the team sees it.</span>
            </span>
          </button>
          {photo ? <button type="button" className="vx-link self-start" onClick={() => setPhoto(null)}>Remove the photo</button> : null}
          {photoError ? <p className="m-0 text-[13px] leading-4 text-danger" role="alert">{photoError}</p> : null}
        </div> : null}

        <Banner title="The WAWU team checks every post">Until it is checked, your post shows Not verified. Post only what is written on the sheet.</Banner>

        <section className="flex flex-col gap-2" aria-label="How it will look">
          <h2 className="m-0 font-display text-[18px] font-normal leading-6">How it will look</h2>
          {preview}
        </section>

        <div className="fixed inset-x-0 bottom-0 z-sticky flex flex-col gap-2 bg-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-1px_0_var(--line)] dt:static dt:bg-transparent dt:p-0 dt:shadow-none">
          {formError ? <p className="m-0 text-center text-[14px] leading-5 text-danger" role="alert">{formError}</p> : null}
          <Button type="submit" size="l" block icon="send" loading={busy}>Post these numbers</Button>
          <p className="m-0 text-center text-[13px] leading-4 text-ink-2">Posting results is free. It does not use your free posts or units.</p>
        </div>
      </form>
      <Rail>
        <LabelsPanel />
      </Rail>
    </>
  );
}
