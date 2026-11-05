"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Banner, Icon, Logo } from "@/components/vx";
import { ApiError, NetworkError } from "@/lib/api/client";
import { isSignedIn } from "@/lib/api/auth";
import { getMe } from "@/lib/api/me";

/**
 * The entry screens draw their own page with no tab bar or side nav (the boards show none). The shell still
 * wraps every route, so this layer sits over it. When the shell lists these routes as chromeless (request in
 * the W1 hand-back) the layer can become a plain div.
 */
export function EntryFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  // The shell does not apply a saved theme on load yet, so the entry screens do: "light" or "dark" saved in Settings wins over the device.
  useEffect(() => {
    try {
      const t = window.localStorage.getItem("voices-theme");
      if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    } catch {
      /* storage unavailable: follow the device */
    }
  }, []);
  return <div className={`fixed inset-0 z-[70] flex flex-col overflow-hidden bg-bg text-ink ${className}`}>{children}</div>;
}

/** Scrolls on its own so the bottom action bar stays put, as the phone boards draw it. */
export function EntryScroll({ children }: { children: ReactNode }) {
  return <main data-entry-scroll="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>;
}

export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-none flex-col gap-2 bg-surface px-4 pb-6 pt-3 shadow-[0_-1px_0_var(--line)]">{children}</div>;
}

/** Back arrow, progress bar and "N of 2" (Topics and ProfileSetup). */
export function StepHeader({ step, back }: { step: 1 | 2; back: string }) {
  return (
    <header className="flex flex-none items-center gap-3 px-4 pb-1 h-[107px] pt-[47px] dt:h-auto dt:mx-auto dt:w-full dt:max-w-[560px] dt:flex-col dt:items-start dt:gap-4 dt:pt-8">
      <Link href="/" className="hidden dt:block" aria-label="VOICES home"><Logo height={34} alt="VOICES home" /></Link>
      <div className="flex w-full items-center gap-3">
        <Link href={back} className="vx-iconbtn vx-iconbtn--s vx-iconbtn--ghost -ml-2 text-ink" aria-label="Back"><Icon name="arrow-left" size={24} /></Link>
        <span className="block h-[6px] flex-1 rounded-full bg-surface-2" role="img" aria-label={`Step ${step} of 2`}>
          <i className="block h-[6px] rounded-full bg-green" style={{ width: `${step * 50}%` }} />
        </span>
        <span className="text-[14px] font-semibold leading-[18px] text-ink-2">
          <span className="dt:hidden">{step} of 2</span>
          <span className="hidden dt:inline">Step {step} of 2</span>
        </span>
      </div>
    </header>
  );
}

/** The drawn switch: 52 by 32, green when on. A real checkbox with role switch underneath. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <>
      <input type="checkbox" role="switch" className="vx-sr peer" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={`relative h-8 w-[52px] flex-none rounded-full peer-focus-visible:shadow-focus ${checked ? "bg-green" : "bg-surface-2 shadow-[inset_0_0_0_1.5px_var(--line-strong)]"}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full ${checked ? "left-6 bg-surface shadow-1" : "left-1 bg-line-strong"}`} />
      </span>
    </>
  );
}

/** Words for a refusal: the server's own words when it explained itself, else ours. Offline gets its own line. */
export function refusalWords(e: unknown, fallback: string): string {
  if (e instanceof NetworkError) return "Could not reach VOICES. Check your connection and try again.";
  if (e instanceof ApiError && e.explained && e.message) return e.message.replace(/\s*—\s*/g, ", ");
  return fallback;
}

export const isOffline = (e: unknown): boolean => e instanceof NetworkError;

export function ErrorBanner({ error, onRetry, fallback, title = "This did not work" }: { error: unknown; onRetry?: () => void; fallback: string; title?: string }) {
  const off = isOffline(error);
  return (
    <Banner tone={off ? "offline" : "danger"} title={off ? "You are offline" : title} action={onRetry ? "Try again" : undefined} onAction={onRetry}>
      {refusalWords(error, fallback)}
    </Banner>
  );
}

/** A signed-in person with no VOICES profile goes on to finish it (topics), never stranded; one with a profile goes to `to`. */
export async function sendSignedIn(replace: (path: string) => void, to = "/"): Promise<void> {
  try {
    const me = await getMe();
    replace(me.profileComplete ? to : "/join/topics");
  } catch {
    replace(to);
  }
}

/** Signed-in people have no business on a guest entry page: send them on. Returns true while that runs. */
export function useSkipIfSignedIn(to = "/"): boolean {
  const router = useRouter();
  const [skipping, setSkipping] = useState(false);
  useEffect(() => {
    if (isSignedIn()) {
      setSkipping(true);
      void sendSignedIn((p) => router.replace(p), to);
    }
  }, [router, to]);
  return skipping;
}

/** On a page everyone may read (Home): a signed-in person who has no VOICES profile yet is sent to finish it. */
export function useFinishProfile(): void {
  const router = useRouter();
  useEffect(() => {
    if (!isSignedIn()) return;
    getMe().then((me) => { if (!me.profileComplete) router.replace("/join/topics"); }, () => undefined);
  }, [router]);
}

/** Join steps after sign-in need a session: without one, go to the sign-up form. */
export function useNeedSession(): boolean {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!isSignedIn()) router.replace("/sign-in?mode=join");
    else setOk(true);
  }, [router]);
  return ok;
}
