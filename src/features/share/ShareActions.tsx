"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/vx";
import { Button } from "@/components/vx";
import { isSignedIn } from "@/lib/api/auth";
import { recordShareEvent } from "@/lib/api/reach";
import { signInHref } from "@/lib/auth/entry-draft";

/** null until the browser has said; the page is server rendered for no account, so the first paint is the guest one. */
function useSignedInHere(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => setV(isSignedIn()), []);
  return v;
}

/** lead ruling WF, 6 Nov (B-M1): a signed-in person is not asked to sign in on the share page; they get a way into VOICES instead. */
export function SignInOrOpen({ code }: { code: string }) {
  const signed = useSignedInHere();
  if (signed === null) return <span className="inline-block min-h-[48px]" aria-hidden="true" />;
  return signed ? <Button variant="secondary" href="/">Open VOICES</Button> : <Button variant="secondary" href={signInHref(`/s/${code}`)}>Sign in</Button>;
}

/** Words about signing in: shown to a guest, never to a signed-in person. */
export function GuestOnly({ children }: { children: ReactNode }) {
  return useSignedInHere() === true ? null : <>{children}</>;
}

/** Counts one open of the link (once per browser tab). Renders nothing. */
export function LinkOpened({ code }: { code: string }) {
  useEffect(() => {
    const key = "voices-share-open-" + code;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: count it anyway */
    }
    void recordShareEvent(code, "link_open");
  }, [code]);
  return null;
}

/** The one call to action. Counts the tap, then opens the recorder; the person signs in only when they publish. */
export function AddVoice({ code, label, block }: { code: string; label: string; block?: boolean }) {
  return (
    <Link
      href={`/speak?from=${encodeURIComponent(code)}`}
      onClick={() => void recordShareEvent(code, "add_voice_tap")}
      className={"vx-btn vx-btn--primary vx-btn--l no-underline" + (block ? " vx-btn--block" : "")}
    >
      <Icon name="mic" size={22} />
      <span className="vx-btn__label">{label}</span>
    </Link>
  );
}
