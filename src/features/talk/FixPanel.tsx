"use client";
import { useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Banner, Button, Icon } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import * as api from "@/lib/api/talk";
import type { TextFixChange } from "@/lib/api/talk";
import { tokensLabel } from "@/lib/shared/text-price";
import { uuidKey } from "./lib";

/** The original text with each change drawn as the words that go and the words that replace them (<del> and <ins>). */
export function diffView(original: string, changes: TextFixChange[]): ReactNode[] {
  const chars = [...original];
  const out: ReactNode[] = [];
  let at = 0;
  changes.forEach((c, i) => {
    out.push(chars.slice(at, c.start).join(""));
    // A comma or full stop that stays the same is not part of the change (the board strikes "cna", not "cna,").
    const tail = /[.,;:!?]+$/.exec(c.from)?.[0] ?? "";
    const same = tail !== "" && c.to.endsWith(tail);
    const from = same ? c.from.slice(0, -tail.length) : c.from;
    const to = same ? c.to.slice(0, -tail.length) : c.to;
    if (from) out.push(<del key={`d${i}`}>{from}</del>);
    if (from && to) out.push(" ");
    if (to) out.push(<ins key={`i${i}`}>{to}</ins>);
    if (same) out.push(tail);
    at = c.start + [...c.from].length;
  });
  out.push(chars.slice(at).join(""));
  return out;
}

type State =
  | { s: "idle" }
  | { s: "busy" }
  | { s: "result"; of: string; fixed: string; changes: TextFixChange[] }
  | { s: "nothing" }
  | { s: "error"; text: string; buy: boolean };

function errorText(e: unknown): { text: string; buy: boolean } {
  if (e instanceof ApiError) {
    if (e.status === 0) return { text: "You are offline. Check your connection and try again. You have not been charged.", buy: false };
    if (e.status === 402) return { text: "You need more tokens to fix your text.", buy: true };
    if (e.status === 429) return { text: "You are going fast. Wait a moment and try again.", buy: false };
    if (e.status === 401) return { text: "Sign in to fix your text.", buy: false };
    if (e.explained && e.message.trim()) return { text: e.message, buy: false };
  }
  return { text: "We could not fix your text just now. You have not been charged.", buy: false };
}

/**
 * "Fix my text" (LCH-12, FixText-390): the AI corrects spelling, typos and grammar only. The person sees the changes and
 * chooses "Use the fix" or "Keep mine". One Idempotency-Key per text, so a retry of the same text is never charged twice.
 */
export function FixPanel({ text, costMilli, buyHref, onUse }: { text: string; costMilli: number; buyHref: string; onUse: (fixed: string) => void }): ReactElement {
  const [st, setSt] = useState<State>({ s: "idle" });
  const key = useRef<{ text: string; k: string } | null>(null);
  const busy = useRef(false);

  async function run() {
    if (busy.current || !text.trim()) return;
    busy.current = true;
    if (!key.current || key.current.text !== text) key.current = { text, k: uuidKey() };
    setSt({ s: "busy" });
    try {
      const r = await api.fixText(text, key.current.k);
      if (!r.changed || r.changes.length === 0) setSt({ s: "nothing" });
      else setSt({ s: "result", of: text, fixed: r.fixedText, changes: r.changes });
    } catch (e) {
      setSt({ s: "error", ...errorText(e) });
    } finally {
      busy.current = false;
    }
  }

  const label = `Fix my text · ${tokensLabel(costMilli)} ${costMilli === 1000 ? "token" : "tokens"}`;
  return (
    <div className="flex flex-col gap-[14px]">
      {st.s === "result" ? (
        <section aria-labelledby="fix-h" className="flex flex-col gap-[10px] rounded-[var(--radius-l)] bg-[var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--line)]">
          <div className="flex items-center gap-2">
            <Icon name="check" size={20} />
            <h2 id="fix-h" className="m-0 flex-1 text-[16px] font-bold leading-[22px]">Suggested fix</h2>
            <span className="text-[13px] font-semibold leading-[18px] text-[var(--ink-2)]">{st.changes.length === 1 ? "1 change" : `${st.changes.length} changes`}</span>
          </div>
          <p className="m-0 whitespace-pre-wrap break-words text-[15px] font-medium leading-[23px] [&_del]:text-[var(--danger)] [&_ins]:no-underline [&_ins]:font-bold [&_ins]:text-[var(--green-text)]" data-testid="fix-diff">
            {diffView(st.of, st.changes)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="m" icon="check" onClick={() => { onUse(st.fixed); setSt({ s: "idle" }); }}>Use the fix</Button>
            <Button size="m" variant="secondary" onClick={() => setSt({ s: "idle" })}>Keep mine</Button>
          </div>
          <p className="m-0 text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">Only spelling and typos change, never what you mean.</p>
        </section>
      ) : null}
      {st.s === "nothing" ? <Banner tone="info" onClose={() => setSt({ s: "idle" })}>Nothing to fix. No tokens were used.</Banner> : null}
      {st.s === "error" ? (
        <Banner tone="danger" onClose={() => setSt({ s: "idle" })} action={st.buy ? "Get tokens" : undefined} onAction={st.buy ? () => { window.location.assign(buyHref); } : undefined}>
          {st.text}
        </Banner>
      ) : null}
      <Button variant="secondary" size="m" icon="refresh-cw" block loading={st.s === "busy"} disabled={!text.trim() || st.s === "result"} onClick={() => void run()}>
        {label}
      </Button>
      <p className="m-0 text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">Charged only when a fix comes back. Your text is sent to our AI provider to be corrected, and is used for nothing else.</p>
    </div>
  );
}
