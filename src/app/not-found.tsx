import type { Metadata } from "next";
import { Button } from "@/components/vx";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

/** The app's 404: renders inside the root layout (shell and saved theme), in the design's type and colours. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-4 pb-16 pt-16 text-center" data-testid="app-not-found">
      <h1 className="m-0 font-display text-display-l">We could not find that page</h1>
      <p className="m-0 text-body text-ink-2">It may have moved, or the address may be mistyped.</p>
      <Button href="/">Go to VOICES</Button>
    </div>
  );
}
