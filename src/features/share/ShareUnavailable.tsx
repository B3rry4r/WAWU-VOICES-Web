import { Button, Logo } from "@/components/vx";

/** A share link whose page could not be loaded because the API could not be reached. A plain page, not an error screen. */
export function ShareUnavailable() {
  return (
    <div className="min-h-dvh bg-bg text-ink" data-testid="share-unavailable">
      <header className="mx-auto flex max-w-[1100px] items-center px-4 py-3 dt:px-8 dt:py-5">
        <Logo height={36} />
      </header>
      <main className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-4 pb-16 pt-16 text-center">
        <h1 className="m-0 font-display text-display-l">We could not open that link</h1>
        <p className="m-0 text-body text-ink-2">Something is not reachable right now. Wait a moment and open the link again.</p>
        <Button href="/">Go to VOICES</Button>
      </main>
    </div>
  );
}
