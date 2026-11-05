"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Banner, Icon, Logo } from "@/components/vx";
import { ApiError, NetworkError } from "@/lib/api/client";
import { isSignedIn } from "@/lib/api/auth";
import { getMe } from "@/lib/api/me";

/** The entry screens draw their own page (the shell lists these routes as chromeless): a full-height column whose middle scrolls. */
export function EntryFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex h-dvh flex-col overflow-hidden bg-bg text-ink ${className}`}>{children}</div>;
}

/** Scrolls on its own so the bottom action bar stays put, as the phone boards draw it. */
export function EntryScroll({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main data-entry-scroll="" className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}>{children}</main>;
}

export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-none flex-col gap-2 bg-surface px-4 pb-6 pt-3 shadow-[0_-1px_0_var(--line)]">{children}</div>;
}

/** Phone: back arrow (when there is somewhere to go back to), progress bar and "N of 2" (Topics and ProfileSetup). */
export function StepHeader({ step, back }: { step: 1 | 2; back?: string }) {
  return (
    <header className="flex h-[107px] flex-none items-center gap-3 px-4 pb-1 pt-[47px] dt:hidden">
      {back ? <Link href={back} className="vx-iconbtn vx-iconbtn--s vx-iconbtn--ghost -ml-2 text-ink" aria-label="Back"><Icon name="arrow-left" size={24} /></Link> : null}
      <span className="block h-[6px] flex-1 rounded-full bg-surface-2" role="img" aria-label={`Step ${step} of 2`}>
        <i className="block h-[6px] rounded-full bg-green" style={{ width: `${step * 50}%` }} />
      </span>
      <span className="text-[14px] font-semibold leading-[18px] text-ink-2">{step} of 2</span>
    </header>
  );
}

/** Desktop header of the set-up steps: the logo at the left, "Step N of 2" with its bar at the right (none on Country). */
export function DeskHeader({ step }: { step?: 1 | 2 }) {
  return (
    <header className="mx-auto hidden w-full max-w-[1120px] flex-none items-center justify-between px-8 py-6 dt:flex">
      <Link href="/welcome" className="flex" aria-label="VOICES home"><Logo height={34} alt="VOICES home" /></Link>
      {step ? (
        <span className="flex items-center gap-4">
          <span className="block h-[6px] w-[100px] rounded-full bg-surface-2" role="img" aria-label={`Step ${step} of 2`}>
            <i className="block h-[6px] rounded-full bg-green" style={{ width: `${step * 50}%` }} />
          </span>
          <span className="text-[14px] font-semibold leading-[18px] text-ink-2">Step {step} of 2</span>
        </span>
      ) : null}
    </header>
  );
}

/** The content column: a plain column on a phone, the centred white card of the 1440 boards from 1024 px. `wide` sets the card width. */
export function DeskCard({ wide = "dt:max-w-[560px]", children }: { wide?: string; children: ReactNode }) {
  return <div className={`mx-auto flex w-full max-w-[560px] flex-col gap-5 px-4 pb-6 pt-1 dt:my-auto dt:rounded-[28px] dt:border dt:border-line dt:bg-surface dt:p-8 ${wide}`}>{children}</div>;
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

const e403 = (e: unknown): boolean => e instanceof ApiError && e.code === "ACCOUNT_SUSPENDED";

export function ErrorBanner({ error, onRetry, fallback, title = "This did not work" }: { error: unknown; onRetry?: () => void; fallback: string; title?: string }) {
  const off = isOffline(error);
  return (
    <Banner tone={off ? "offline" : "danger"} title={off ? "You are offline" : e403(error) ? "This account cannot be used" : title} action={onRetry && !e403(error) ? "Try again" : undefined} onAction={onRetry}>
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
