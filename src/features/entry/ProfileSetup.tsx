"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Icon, TextField } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { getPublicConfig } from "@/lib/api/feed";
import { checkHandle, createMe, PHOTO_MAX_BYTES, PHOTO_MIMES, setCategories, updateProfile, uploadAvatar } from "@/lib/api/me";
import { handleFromName, tokenName } from "@/lib/auth/claims";
import { clearDraft, peekReturn, readDraft, takeReturn, type JoinDraft } from "@/lib/auth/entry-draft";
import { BottomBar, EntryFrame, EntryScroll, ErrorBanner, StepHeader, refusalWords, useNeedSession } from "./ui";

const HANDLE_RE = /^[a-z0-9._]{3,20}$/;
type Check = { state: "idle" } | { state: "checking" } | { state: "free" } | { state: "taken" } | { state: "bad"; why: string };

/** /join/profile (step 2 of 2): handle, name, photo; then the profile is made, topics saved and the person is sent back where they were. */
export function ProfileSetup() {
  const router = useRouter();
  const ok = useNeedSession();
  const [draft, setDraft] = useState<JoinDraft | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [free, setFree] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const made = useRef(false);

  useEffect(() => {
    const d = readDraft();
    setDraft(d);
    const t = tokenName();
    const n = d.fullName || [t?.first, t?.last].filter(Boolean).join(" ");
    setName(n);
    setHandle(handleFromName(n));
    setPosting(peekReturn() !== null);
    getPublicConfig().then((c) => setFree(c.freePosts)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (draft && !(draft.topics && draft.topics.length >= 3)) router.replace("/join/topics");
  }, [draft, router]);
  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  // Is the handle free? Ask 400 ms after the last key.
  useEffect(() => {
    const h = handle.trim().toLowerCase().replace(/^@/, "");
    if (!h) return setCheck({ state: "idle" });
    if (!HANDLE_RE.test(h)) return setCheck({ state: "bad", why: h.length < 3 ? "Use at least 3 characters." : h.length > 20 ? "Use 20 characters or fewer." : "Letters, numbers, dots and underscores only." });
    setCheck({ state: "checking" });
    let live = true;
    const t = setTimeout(() => {
      checkHandle(h)
        .then((r) => live && setCheck(r.available ? { state: "free" } : { state: "taken" }))
        .catch(() => live && setCheck({ state: "idle" }));
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [handle]);
  if (!ok || !draft) return null;

  const pick = (f: File | undefined) => {
    setPhotoErr(null);
    if (!f) return;
    if (!(PHOTO_MIMES as readonly string[]).includes(f.type)) return setPhotoErr("Choose a JPEG, PNG or WebP photo.");
    if (f.size > PHOTO_MAX_BYTES) return setPhotoErr("That photo is over 5 MB. Choose a smaller one.");
    setPhoto(f);
  };

  const finish = async () => {
    if (busy || check.state === "taken" || check.state === "bad") return;
    setBusy(true);
    setFailure(null);
    const h = handle.trim().toLowerCase().replace(/^@/, "");
    const topics = draft.topics ?? [];
    try {
      if (!made.current) {
        await createMe({ handle: h, ageConfirmed: true, termsAccepted: true, rulesAccepted: true, countryCode: draft.countryCode, languages: draft.languages, categoryIds: topics.map((t) => t.categoryId) });
        made.current = true;
      }
      await setCategories(topics.map((t) => ({ categoryId: t.categoryId, alertsOn: t.alertsOn })));
      const patch: { displayName?: string; avatarFileId?: string } = {};
      if (name.trim()) patch.displayName = name.trim();
      if (photo) patch.avatarFileId = await uploadAvatar(photo);
      if (patch.displayName || patch.avatarFileId) await updateProfile(patch);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setCheck({ state: "taken" });
      else setFailure(err);
      setBusy(false);
      return;
    }
    clearDraft();
    router.replace(takeReturn() ?? "/");
  };

  const hint =
    check.state === "free" ? `@${handle.trim().toLowerCase().replace(/^@/, "")} is free. Letters, numbers, dots and underscores.`
    : check.state === "checking" ? "Checking the handle."
    : check.state === "idle" ? "Letters, numbers, dots and underscores."
    : undefined;
  const error = check.state === "taken" ? "That handle is taken. Try another." : check.state === "bad" ? check.why : undefined;
  const cta = posting ? "Finish and post my voice" : "Finish";
  const submit = (
    <Button size="l" block icon="send" loading={busy} disabled={check.state !== "free" || !name.trim()} onClick={finish}>{cta}</Button>
  );
  const note = posting && free ? <p className="m-0 text-center text-[13px] font-medium leading-[18px] text-ink-2">{`This is your 1st of ${free} free posts.`}</p> : null;
  return (
    <EntryFrame>
      <StepHeader step={2} back="/join/topics" />
      <EntryScroll>
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-4 pb-6 pt-1">
          <h1 className="m-0 font-display text-[28px] font-normal leading-8">How should people know you?</h1>
          {failure ? <ErrorBanner error={failure} onRetry={() => setFailure(null)} fallback={refusalWords(failure, "We could not save your profile. Try again.")} /> : null}
          <div className="flex items-center gap-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your photo" className="h-[88px] w-[88px] flex-none rounded-full object-cover" />
            ) : (
              <Avatar name={name || "V"} size="xl" />
            )}
            <div className="flex flex-col items-start gap-2">
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="vx-sr" tabIndex={-1} aria-hidden="true" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
              <Button variant="secondary" icon="plus" onClick={() => file.current?.click()}>{photo ? "Change photo" : "Add a photo"}</Button>
              <p className={`m-0 text-[13px] font-medium leading-[18px] ${photoErr ? "text-danger" : "text-ink-2"}`} role={photoErr ? "alert" : undefined}>{photoErr ?? "Optional. Photos never go on share cards."}</p>
            </div>
          </div>
          <TextField label="Your name" value={name} onChange={setName} autoComplete="name" />
          <TextField label="Handle" prefix="@" value={handle} onChange={setHandle} autoComplete="off" hint={hint} error={error} />
          <div className="hidden dt:flex dt:flex-col dt:gap-2">{submit}{note}</div>
        </div>
      </EntryScroll>
      <div className="dt:hidden"><BottomBar>{submit}{note}</BottomBar></div>
    </EntryFrame>
  );
}
