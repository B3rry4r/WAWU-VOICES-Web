"use client";
import { useState } from "react";
import { Banner, Button, Sheet, TextField } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import * as api from "@/lib/api/talk";
import type { Answer } from "@/lib/api/talk";
import { countChars } from "@/lib/shared/text-price";
import { failText, isOutOfPosts } from "./lib";
import { limitWords, useTextLimit } from "./textLimit";

/** Plain words for a refused edit. The server names the time limit itself, so its own line is shown for that one. */
export function editFailText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "EDIT_WINDOW_PASSED") return e.explained && e.message.trim() ? e.message : "You can only edit a post for a few minutes after you send it.";
    if (isOutOfPosts(e) || e.status === 402) return "Your edit is longer than the first version, so the extra words cost tokens, and you do not have enough. Keep it shorter or get tokens.";
    if (e.code === "VALIDATION_FAILED") {
      const f = (e.details as { fields?: { message?: string }[] } | undefined)?.fields?.[0]?.message;
      if (f) return f;
    }
    if (e.status === 404 || e.status === 410) return "This post is gone, so it cannot be edited.";
  }
  return failText(e);
}

/** Edit my own text post. Only text can be edited, and only soon after it is posted; the server decides and says so. */
export function EditSheet({ answer, onClose, onSaved }: { answer: Answer; onClose: () => void; onSaved: (a: Answer) => void }) {
  const [text, setText] = useState(answer.body ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const limit = useTextLimit();
  const n = countChars(text);
  const over = n > limit;
  const overLine = `This post is longer than ${limit.toLocaleString("en-NG")} characters. Shorten it to save your changes.`;
  const same = text.trim() === (answer.body ?? "").trim();
  async function save() {
    if (busy || same || !text.trim() || over) return;
    setBusy(true);
    setMsg(null);
    try { onSaved(await api.editAnswer(answer.id, text.trim())); } catch (e) { setMsg(editFailText(e)); } finally { setBusy(false); }
  }
  return (
    <Sheet
      title="Edit your post"
      subtitle="You can edit a text post for a few minutes after you send it. Adding words can cost tokens."
      onClose={onClose}
      footer={<div className="vx-dialog__btns"><Button size="l" block loading={busy} disabled={same || !text.trim() || over} onClick={() => void save()}>Save changes</Button></div>}
    >
      <div className="grid gap-3 pb-2">
        {msg ? <Banner tone="danger" title="Not saved">{msg}</Banner> : null}
        <TextField label="Your words" multiline value={text} onChange={(v) => setText(countChars(v) > limit && !over ? [...v].slice(0, limit).join("") : v)} />
        {over ? <p className="m-0 text-caption text-[var(--danger)]" role="status">{overLine}</p> : null}
        <p className={`m-0 text-caption ${n >= limit ? "text-[var(--danger)]" : "text-[var(--ink-2)]"}`} role={n >= limit && !over ? "status" : undefined}>{over ? `${n.toLocaleString("en-NG")} / ${limit.toLocaleString("en-NG")}` : n >= limit ? limitWords(limit) : `${n.toLocaleString("en-NG")} / ${limit.toLocaleString("en-NG")}`}</p>
      </div>
    </Sheet>
  );
}

/** The on-page confirm for deleting my own post. A deleted post never gives back the free post or tokens it used. */
export function DeleteDialog({ noun, onConfirm, onClose }: { noun: "voice" | "reply"; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      variant="dialog"
      title={`Delete this ${noun}?`}
      subtitle={`It leaves the conversation for everyone. A deleted post does not give back the free post or tokens it used.`}
      onClose={onClose}
      footer={
        <div className="vx-dialog__btns">
          <Button size="l" block loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{`Delete ${noun}`}</Button>
          <Button size="l" block variant="secondary" disabled={busy} onClick={onClose}>Keep it</Button>
        </div>
      }
    />
  );
}
