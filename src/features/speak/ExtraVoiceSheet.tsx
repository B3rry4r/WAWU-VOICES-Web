"use client";
import { useEffect, useState } from "react";
import { Button, Icon, Sheet, Tabs } from "@/components/vx";
import type { ExtraVoiceOffer, PaymentMethod } from "@/lib/api/speak";
import { durationLabel, naira } from "./logic";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "card", label: "Card" },
  { id: "banktransfer", label: "Transfer" },
  { id: "ussd", label: "USSD" },
];

export interface ExtraVoiceSheetProps {
  offers: ExtraVoiceOffer[];
  freeSeconds: number;
  initial?: ExtraVoiceOffer["kind"];
  /** True when the sheet opened because the free seconds ran out on a take that is kept. */
  hasTake: boolean;
  /** The real length of the kept take, when there is one. */
  takeSeconds?: number;
  /** Drop the take and record again. */
  onRerecord?: () => void;
  paying: boolean;
  error?: string | null;
  onPay: (offer: ExtraVoiceOffer, method: PaymentMethod) => void;
  onClose: () => void;
}

/** The ExtraVoice board: two radio options, what the token adds, how to pay, one button, the way out. Prices come from the API. */
export function ExtraVoiceSheet(p: ExtraVoiceSheetProps) {
  const offers = [...p.offers].sort((a, b) => a.maxSeconds - b.maxSeconds);
  const covering = p.hasTake && p.takeSeconds !== undefined && p.takeSeconds > p.freeSeconds + 0.5 ? offers.find((o) => o.maxSeconds + 0.5 >= (p.takeSeconds ?? 0)) : undefined;
  const [kind, setKind] = useState(p.initial && offers.some((o) => o.kind === p.initial) ? p.initial : (covering ?? offers[0])?.kind);
  const [method, setMethod] = useState<PaymentMethod>("card");
  // The board draws a bottom sheet on a phone and a centred dialog on a desktop.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    setWide(m.matches);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  const chosen = offers.find((o) => o.kind === kind) ?? offers[0];
  if (!chosen) return null;
  const more = chosen.maxSeconds - p.freeSeconds;
  const tooLong = p.hasTake && p.takeSeconds !== undefined && p.takeSeconds > p.freeSeconds + 0.5;
  const take = Math.round(p.takeSeconds ?? p.freeSeconds);
  const covers = !tooLong || (p.takeSeconds ?? 0) <= chosen.maxSeconds + 0.5;
  return (
    <Sheet
      title="Need more time?"
      subtitle={tooLong ? `Your recording is ${take} seconds. A free post is ${p.freeSeconds}.` : p.hasTake ? `You reached the ${p.freeSeconds} seconds of a free post.` : "Pick how long your next voice can be."}
      variant={wide ? "dialog" : "sheet"}
      onClose={p.onClose}
      footer={
        <div className="vx-sheet__foot">
          <Button size="l" block icon="lock" loading={p.paying} disabled={!covers} onClick={() => p.onPay(chosen, method)}>
            {`Pay ${naira(chosen.priceKobo)} for ${durationLabel(chosen.maxSeconds)}`}
          </Button>
          {tooLong ? (
            <Button variant="secondary" size="l" block onClick={p.onRerecord ?? p.onClose}>Record again</Button>
          ) : (
            <Button variant="secondary" size="l" block onClick={p.onClose}>
              {p.hasTake ? `No thanks, keep my ${p.freeSeconds} seconds` : "No thanks"}
            </Button>
          )}
          <p className="vx-sheet__fine">One payment for one message. Not a subscription, nothing renews. You get a receipt in your history.</p>
        </div>
      }
    >
      <div className="vx-poll__opts" role="radiogroup" aria-label="Choose extra time">
        {offers.map((o) => {
          const on = o.kind === chosen.kind;
          return (
            <button key={o.kind} type="button" role="radio" aria-checked={on ? "true" : "false"} className="vx-opt sp-opt" onClick={() => setKind(o.kind)}>
              <span className="vx-opt__radio">{on ? <Icon name="check" size={14} strokeWidth={3.5} /> : null}</span>
              <span className="sp-opt__txt">
                <span className="sp-opt__name">{`Extra voice, ${durationLabel(o.maxSeconds)}`}</span>
                <span className="sp-opt__sub">{`Up to ${durationLabel(o.maxSeconds)} for this one message`}</span>
              </span>
              <span className="sp-opt__price">{naira(o.priceKobo)}</span>
            </button>
          );
        })}
      </div>
      <div className="sp-sum">
        <p className="sp-sum__a">
          <Icon name="clock" size={20} />
          <span>{tooLong ? (covers ? `This token covers your ${take}-second recording.` : `This token is shorter than your ${take}-second recording. Pick a longer one, or record again.`) : `Time for this voice: ${p.freeSeconds} seconds free, plus ${more} more with this token.`}</span>
        </p>
        {p.hasTake && !tooLong ? (
          <p className="sp-sum__b">
            <Icon name="circle-check" size={18} />
            <span>{`Your ${p.freeSeconds}-second recording is kept. Your free posts stay as they are.`}</span>
          </p>
        ) : null}
      </div>
      <div className="vx-field">
        <span className="vx-field__label">Pay with</span>
        <Tabs variant="segmented" block label="Payment method" value={method} onChange={(v) => setMethod(v as PaymentMethod)} items={METHODS} />
      </div>
      {p.error ? <p className="sp-err" role="alert">{p.error}</p> : null}
    </Sheet>
  );
}
