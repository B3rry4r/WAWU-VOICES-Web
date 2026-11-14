"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/vx";
import { LinkOpened } from "./ShareActions";

/**
 * The body of /s/<code> for an open question: the server still draws the link's own title, description and picture (that is
 * what a crawler reads, with a 200); a person is moved on in the browser. replace, so Back does not return to this page.
 * The plain page stays blank while it moves, so no other screen flashes.
 */
export function ShareMoveOn({ code, to }: { code: string; to: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(to); }, [router, to]);
  return (
    <div className="min-h-dvh bg-bg text-ink" data-testid="share-move-on" aria-busy="true">
      <LinkOpened code={code} />
      <header className="mx-auto flex max-w-[1100px] items-center px-4 py-3 dt:px-8 dt:py-5">
        <Logo height={36} />
      </header>
      <noscript>
        <p className="mx-auto max-w-[480px] px-4 text-center text-body"><a className="link" href={to}>Open the question</a></p>
      </noscript>
    </div>
  );
}
