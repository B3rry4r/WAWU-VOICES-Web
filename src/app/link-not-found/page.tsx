import type { Metadata } from "next";
import { Button, Logo } from "@/components/vx";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Link not found", robots: { index: false, follow: false } };

/** What /s/<unknown code> shows (rewritten here by middleware, status 404). Rendered through the root layout: saved theme, no app chrome. */
export default function LinkNotFound() {
  return (
    <div className="min-h-dvh bg-bg text-ink" data-testid="share-not-found">
      <header className="mx-auto flex max-w-[1100px] items-center px-4 py-3 dt:px-8 dt:py-5">
        <Logo height={36} />
      </header>
      <main className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-4 pb-16 pt-16 text-center">
        <h1 className="m-0 font-display text-display-l">We could not find that.</h1>
        <p className="m-0 text-body text-ink-2">It may have been mistyped, or what it pointed to is gone.</p>
        <Button href="/">Home</Button>
      </main>
    </div>
  );
}
