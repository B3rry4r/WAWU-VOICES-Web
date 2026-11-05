"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Icon, IconButton, Toast, TextField, TopicChip } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import {
  checkHandle, deleteVoiceClip, getFollowedCategories, listCategories, setFollowedCategories, updateProfile,
  type Category, type CategoryFollow, type Me, type UpdateProfileRequest,
} from "@/lib/api/profile";
import { PHOTO_MAX_BYTES, PHOTO_MIMES, uploadAvatar } from "@/lib/api/me";
import { Rail } from "@/components/shell/ShellSlots";
import { ClipPlayer } from "./ClipPlayer";
import { DeletionPending } from "./DeletionPending";
import { LoadError, LoadingBlock, NeedsProfileNotice, SignedOutNotice, errorLine } from "./states";
import { HANDLE_REASON, handleProblem, joinedLabel, placeLabel } from "./format";
import { useMe } from "./useMe";
import { VOICE_CARD_SECONDS, VoiceRecorder, uploadVoiceCard } from "./voiceCardUpload";
import type { VoiceClip } from "@/lib/api/profile";
import "./profile.css";

type HandleState = { kind: "same" } | { kind: "checking" } | { kind: "ok" } | { kind: "bad"; text: string };

export { uploadAvatar };

function VoiceCardEditor({ clip, onChange }: { clip: VoiceClip | null; onChange: (c: VoiceClip | null) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "sending">("idle");
  const [left, setLeft] = useState(VOICE_CARD_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<VoiceRecorder | null>(null);

  async function start() {
    setError(null);
    const r = new VoiceRecorder({ maxSeconds: VOICE_CARD_SECONDS, onTick: (s) => setLeft(Math.ceil(s)) });
    const err = await r.start();
    if (err) {
      setError(err === "permission_denied" ? "VOICES needs your microphone. Allow it in your browser, then try again." : err === "no_microphone" ? "No microphone found." : "Recording is not supported in this browser.");
      return;
    }
    rec.current = r;
    setState("recording");
    const result = await r.result();
    setState("sending");
    try { onChange(await uploadVoiceCard(result)); } catch (e) { setError(errorLine(e, "Could not save your Voice Card. Try again.")); }
    setState("idle");
  }
  useEffect(() => () => rec.current?.cancel(), []);

  return (
    <section className="pf-form-sec pf-vcard" aria-labelledby="vc-h">
      <h2 id="vc-h" className="pf-label">Your Voice Card</h2>
      <p className="pf-hint">Your bio is your voice, up to 10 seconds. Say who you are and where you dey.</p>
      {clip ? <ClipPlayer clip={clip} label="Voice Card" tone="forest" /> : null}
      {state === "recording" ? (
        <div className="pf-rec" role="status">
          <span className="pf-rec__dot" aria-hidden="true" />
          <span>{`Recording, ${left}s left`}</span>
          <Button size="s" variant="primary" icon="square" onClick={() => rec.current?.stop()}>Stop</Button>
        </div>
      ) : state === "sending" ? (
        <p className="pf-note" role="status">Saving your Voice Card...</p>
      ) : (
        <div className="pf-row">
          <Button variant="onforest" size="s" icon="mic" onClick={start}>{clip ? "Re-record" : "Record Voice Card"}</Button>
          {clip ? <Button variant="onforest" size="s" icon="trash-2" onClick={() => onChange(null)}>Delete</Button> : null}
        </div>
      )}
      {error ? <p className="pf-note pf-note--err" role="alert">{error}</p> : null}
    </section>
  );
}

function Form({ me, categories, followed0 }: { me: Me; categories: Category[]; followed0: CategoryFollow[] }) {
  const router = useRouter();
  const profile = me.profile!;
  const place0 = placeLabel(profile) ?? "";
  const [handle, setHandle] = useState(profile.handle);
  const [hstate, setHstate] = useState<HandleState>({ kind: "same" });
  const [place, setPlace] = useState(place0);
  const [clip, setClip] = useState<VoiceClip | null>(profile.voiceCard ?? null);
  const [followed, setFollowed] = useState<Map<string, boolean>>(new Map(followed0.map((f) => [f.categoryId, f.alertsOn])));
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ handle?: string; place?: string }>({});
  const stamp = useRef(0);

  const clean = handle.trim().toLowerCase().replace(/^@/, "");
  useEffect(() => {
    if (clean === profile.handle) { setHstate({ kind: "same" }); return; }
    const local = handleProblem(clean);
    if (local) { setHstate({ kind: "bad", text: local }); return; }
    setHstate({ kind: "checking" });
    const id = ++stamp.current;
    const t = setTimeout(() => {
      checkHandle(clean).then((r) => { if (id === stamp.current) setHstate(r.available ? { kind: "ok" } : { kind: "bad", text: HANDLE_REASON[r.reason ?? "TAKEN"] ?? "That handle is not available." }); }, () => { if (id === stamp.current) setHstate({ kind: "same" }); });
    }, 350);
    return () => clearTimeout(t);
  }, [clean, profile.handle]);

  const followChanged = useMemo(() => {
    if (followed.size !== followed0.length) return true;
    return followed0.some((f) => followed.get(f.categoryId) !== f.alertsOn);
  }, [followed, followed0]);
  const tooFew = followed.size < 3;
  const blocked = hstate.kind === "bad" || hstate.kind === "checking" || tooFew || saving;

  function toggle(id: string) {
    setFollowed((m) => { const n = new Map(m); if (n.has(id)) n.delete(id); else n.set(id, true); return n; });
  }

  async function save() {
    setSaving(true); setError(null); setFieldErr({});
    try {
      const body: UpdateProfileRequest = {};
      if (clean !== profile.handle) body.handle = clean;
      if (place.trim() !== place0) { body.state = place.trim() || null; body.city = null; }
      if ((clip?.id ?? null) !== (profile.voiceCard?.id ?? null)) body.voiceCardClipId = clip?.id ?? null;
      if (photo) body.avatarFileId = await uploadAvatar(photo.file);
      if (Object.keys(body).length) await updateProfile(body);
      if (followChanged) await setFollowedCategories([...followed].map(([categoryId, alertsOn]) => ({ categoryId, alertsOn })));
      if (profile.voiceCard && clip?.id !== profile.voiceCard.id) deleteVoiceClip(profile.voiceCard.id).catch(() => undefined);
      setSaved(true);
      setTimeout(() => router.push("/profile"), 900);
    } catch (e) {
      if (e instanceof ApiError && e.code === "HANDLE_TAKEN") setFieldErr({ handle: "That handle is taken." });
      else if (e instanceof ApiError && e.code === "VALIDATION_FAILED") {
        const f = (e.details as { fields?: { path: string; message: string }[] } | undefined)?.fields ?? [];
        const h = f.find((x) => x.path === "handle");
        if (h) setFieldErr({ handle: h.message });
        else setError(errorLine(e));
      } else setError(errorLine(e));
      setSaving(false);
    }
  }

  const handleError = fieldErr.handle ?? (hstate.kind === "bad" ? hstate.text : undefined);
  const handleHint = hstate.kind === "ok" ? "That handle is free." : "Letters, numbers, dots and underscores. People find you by it.";
  const name = profile.displayName || profile.handle;

  return (
    <>
      <div className="pf-edit">
        <header className="pf-edit__bar">
          <IconButton className="pf-only-phone" icon="x" label="Cancel without saving" onClick={() => router.push("/profile")} />
          <h1 className="pf-h1 pf-edit__h1">Edit profile</h1>
          <span className="pf-bar__sp" />
          <Button className="pf-only-desk" variant="secondary" onClick={() => router.push("/profile")}>Cancel</Button>
          <Button className="pf-only-desk" icon="check" loading={saving} disabled={blocked} onClick={save}>Save changes</Button>
        </header>

        {(
          <section className="pf-form-sec pf-photo" aria-labelledby="ph-h">
            <Avatar name={name} src={photo?.url ?? profile.avatarUrl ?? undefined} size="l" />
            <div>
              <h2 id="ph-h" className="pf-label">Profile photo</h2>
              <label className="pf-filebtn">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (!(PHOTO_MIMES as readonly string[]).includes(f.type)) return setPhotoErr("Choose a JPEG, PNG or WebP photo.");
                  if (f.size > PHOTO_MAX_BYTES) return setPhotoErr("That photo is over 5 MB. Choose a smaller one.");
                  setPhotoErr(null);
                  setPhoto({ file: f, url: URL.createObjectURL(f) });
                }} />
                <Icon name="plus" size={18} />Add photo
              </label>
              {photoErr ? <p className="pf-note pf-note--err" role="alert">{photoErr}</p> : <p className="pf-hint">Optional. Without one, your initials show. Never used on share cards.</p>}
            </div>
          </section>
        )}

        <TextField label="Handle" prefix="@" value={handle} onChange={setHandle} error={handleError} hint={handleHint} autoComplete="off" />
        <VoiceCardEditor clip={clip} onChange={setClip} />
        <TextField label="Where you are (optional)" value={place} onChange={setPlace} hint="Shown under your handle. A state or city, never your street." />

        <section className="pf-form-sec" aria-labelledby="tp-h">
          <h2 id="tp-h" className="pf-label">Topics you follow</h2>
          <p className="pf-hint">We alert you when a new question lands in these.</p>
          <div className="pf-chips">
            {categories.map((c) => <TopicChip key={c.id} label={c.name} selected={followed.has(c.id)} onClick={() => toggle(c.id)} />)}
          </div>
          {tooFew ? <p className="pf-note pf-note--err" role="alert">Pick at least 3 topics.</p> : null}
        </section>

        {error ? <p className="pf-note pf-note--err" role="alert">{error}</p> : null}
        <div className="pf-savebar pf-only-phone">
          <Button block icon="check" loading={saving} disabled={blocked} onClick={save}>Save changes</Button>
        </div>
        {saved ? <div className="pf-toast"><Toast tone="success" icon="circle-check">Profile saved</Toast></div> : null}
      </div>

      <Rail>
        <section className="pf-panel" aria-label="Preview">
          <h2 className="vx-eyebrow pf-eyebrow">Preview</h2>
          <p className="pf-label">How others see you</p>
          <div className="pf-preview">
            <Avatar name={name} src={photo?.url ?? profile.avatarUrl ?? undefined} />
            <div>
              <b>{"@" + (hstate.kind === "bad" ? profile.handle : clean || profile.handle)}</b>
              <span>{[place.trim() || undefined, joinedLabel(profile.joinedAt)].filter(Boolean).join(" · ")}</span>
            </div>
          </div>
          {clip ? <ClipPlayer clip={clip} label="Voice Card" /> : null}
          <p className="pf-hint">{`${profile.voiceCount} ${profile.voiceCount === 1 ? "voice" : "voices"} · ${me.reactionsReceived.toLocaleString("en-NG")} reactions · ${me.savedCount} saved`}</p>
          <p className="pf-hint">Your units, free posts and referral code stay private. Only you see them.</p>
        </section>
      </Rail>
    </>
  );
}

export function EditProfilePage() {
  const { state, reload } = useMe();
  const [extra, setExtra] = useState<{ categories: Category[]; followed: CategoryFollow[] } | null>(null);
  const [extraErr, setExtraErr] = useState<unknown>(null);
  const loadExtra = useCallback(() => {
    setExtraErr(null);
    Promise.all([listCategories(), getFollowedCategories()]).then(([c, f]) => setExtra({ categories: c.items, followed: f.categories }), setExtraErr);
  }, []);
  useEffect(() => { if (state.status === "ready") loadExtra(); }, [state.status, loadExtra]);

  if (state.status === "loading") return <div className="pf-page"><LoadingBlock /></div>;
  if (state.status === "guest") return <div className="pf-page"><SignedOutNotice what="your profile" /></div>;
  if (state.status === "error") return <div className="pf-page"><LoadError error={state.error} onRetry={reload} /></div>;
  if (state.status === "needs-profile") return <div className="pf-page"><NeedsProfileNotice /></div>;
  if (state.me.status === "DELETION_PENDING") return <DeletionPending />;
  if (extraErr) return <div className="pf-page"><LoadError error={extraErr} onRetry={loadExtra} /></div>;
  if (!extra) return <div className="pf-page"><LoadingBlock /></div>;
  return <Form me={state.me} categories={extra.categories} followed0={extra.followed} />;
}
