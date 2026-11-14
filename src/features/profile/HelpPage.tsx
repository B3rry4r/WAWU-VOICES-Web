"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, IconButton, TextField, TopicChip } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { sendSupportMessage, type SupportTopic } from "@/lib/api/support";
import "./profile.css";

export const SUPPORT_EMAIL = "support@wawuafrica.com";
const TOPICS: { id: SupportTopic; label: string }[] = [
  { id: "PAYMENT", label: "A payment" },
  { id: "ACCOUNT", label: "My account" },
  { id: "CONTENT", label: "A post" },
  { id: "OTHER", label: "Something else" },
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 2000;

function sayFail(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return "You are offline. Check your connection and try again. Your message is still here.";
    if (e.status === 429) return "You are going fast. Wait a moment and try again.";
    const f = (e.details as { fields?: { message?: string }[] } | undefined)?.fields?.[0]?.message;
    if (e.status === 422 && f) return f;
  }
  return "We could not send that. Try again in a moment. Your message is still here.";
}

/** /settings/help: a short form that posts to POST /support/messages, and the address for anyone who would rather write an email.
 *  A link from the payment screen can open it with ?topic=PAYMENT&payment=<payment id>. */
export function HelpPage() {
  const router = useRouter();
  const q = useSearchParams();
  const pre = q?.get("topic")?.toUpperCase();
  const paymentId = q?.get("payment") && UUID.test(q.get("payment")!) ? q.get("payment")! : undefined;
  const [topic, setTopic] = useState<SupportTopic>(TOPICS.some((t) => t.id === pre) ? (pre as SupportTopic) : paymentId ? "PAYMENT" : "OTHER");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send() {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await sendSupportMessage({ topic, message: text, ...(email.trim() ? { contactEmail: email.trim() } : {}), ...(paymentId && topic === "PAYMENT" ? { paymentId } : {}) });
      setDone(true);
    } catch (e) {
      setErr(sayFail(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pf-page">
      <header className="pf-bar pf-only-phone">
        <IconButton icon="arrow-left" label="Back to settings" variant="ghost" onClick={() => router.push("/settings")} />
        <h1 className="t-bar-title pf-bar__t">Help and contact</h1>
      </header>
      <h1 className="pf-h1 hidden dt:block">Help and contact</h1>
      <p className="pf-lead">Tell us what went wrong and our team will look at it. For a payment, add what you were buying and when.</p>
      {done ? (
        <Banner tone="success" title="We got your message.">
          Thank you. Our team reads every message{email.trim() ? ` and will write back to ${email.trim()}` : ""}.
        </Banner>
      ) : (
        <form className="grid gap-4 dt:max-w-[560px]" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <div className="grid gap-2" role="group" aria-label="What is it about?">
            <span className="vx-eyebrow">What is it about?</span>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => <TopicChip key={t.id} label={t.label} selected={topic === t.id} onClick={() => setTopic(t.id)} />)}
            </div>
          </div>
          {paymentId && topic === "PAYMENT" ? <p className="m-0 text-caption text-[var(--ink-2)]">This message will carry the payment you came from, so we can find it.</p> : null}
          <TextField label="Your message" multiline maxLength={MAX} placeholder="What happened?" value={message} onChange={setMessage} />
          <TextField label="Email for our reply (optional)" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          {err ? <Banner tone="danger" title="Not sent">{err}</Banner> : null}
          <Button size="l" block icon="send" type="submit" loading={busy} disabled={!message.trim()}>Send message</Button>
        </form>
      )}
      <section className="pf-always" aria-label="Write to us">
        <b>Prefer email?</b>
        <span>Write to <span className="select-text font-semibold text-[var(--ink)]" data-testid="support-email">{SUPPORT_EMAIL}</span></span>
      </section>
    </div>
  );
}
