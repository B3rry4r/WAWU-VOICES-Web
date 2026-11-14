"use client";
import { Button } from "@/components/vx";
import { LivePlayer } from "@/features/profile/ClipPlayer";
import { getPlayUrl } from "@/lib/api/profile";
import { isSignedIn } from "@/lib/api/auth";
import type { Question } from "@/lib/api/feed";

type Override = NonNullable<Question["override"]>;

/** Only a full http(s) address becomes a button; anything else is left out. */
export function safeLink(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * What the team put up in place of the day's question (addendum 4): the message under the headline, then the picture, the
 * editor's voice note (played through a short-lived link, like any voice) and, last, the link as a button that opens in a
 * new tab. Anything the override does not carry is simply not drawn.
 */
export function OverrideMessage({ o }: { o: Override }) {
  const body = o.body?.trim() ?? "";
  const link = safeLink(o.linkUrl);
  if (!body && !o.imageUrl && !o.audioClipId && !link) return null;
  // The message is the hero's next sibling (the Home test pins that); the picture, voice note and link follow it.
  return (
    <>
      {body ? <p data-testid="override-message" className="m-0 mt-3 text-body-l text-ink-2">{body}</p> : null}
      <div className="mt-3 flex flex-col gap-3 empty:hidden" data-testid="override-extras">
      {o.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a public CDN picture of unknown size; next/image needs the domain listed
        <img data-testid="override-image" src={o.imageUrl} alt="Picture from the VOICES team" loading="lazy" className="block h-auto max-h-[360px] w-full rounded-[var(--radius-l)] object-cover" />
      ) : null}
      {o.audioClipId ? (
        <div data-testid="override-audio">
          <LivePlayer
            clipId={o.audioClipId}
            durationMs={o.audioDurationMs ?? null}
            peaks={null}
            getUrl={async (id) => (await getPlayUrl(id, isSignedIn())).url}
            failMessage="Could not play this voice note. Try again."
            tone="mint"
          />
        </div>
      ) : null}
      {link ? (
        <div>
          <Button variant="secondary" iconEnd="link" href={link} target="_blank" rel="noopener noreferrer" data-testid="override-link">Open the link</Button>
        </div>
      ) : null}
      </div>
    </>
  );
}
