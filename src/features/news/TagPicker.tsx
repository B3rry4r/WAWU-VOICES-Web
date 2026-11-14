"use client";

import { useEffect, useState } from "react";
import { TextField, TopicChip } from "@/components/vx";
import { getMe } from "@/lib/api/feed";
import { tagWaitText, type TagChoice, type TagPick } from "./tag-choice";

/** True for an editor or an admin: the only people who can choose Verified News themselves. */
export function useIsEditor(enabled = true): boolean {
  const [yes, setYes] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    getMe().then(
      (m) => { if (live) setYes(m.roles.includes("EDITOR") || m.roles.includes("ADMIN")); },
      () => undefined,
    );
    return () => { live = false; };
  }, [enabled]);
  return yes;
}

/**
 * The tag the person picks before a post goes up (addendum 1). Nothing is chosen to begin with; "Request Verified News" is
 * open to everyone and asks for the source the editors will check. An editor sees "Verified News" in its place and names
 * the source at once. The words under the chips say what each tag means in the same plain language as the Newsroom.
 */
export function TagPicker({ value, onChange, editor, className }: { value: TagChoice; onChange: (c: TagChoice) => void; editor?: boolean; className?: string }) {
  const pick = (p: TagPick) => onChange(value.pick === p ? { ...value, pick: null } : { ...value, pick: p });
  const askSource = value.pick === "REQUEST_VERIFIED" || value.pick === "VERIFIED_NEWS";
  const wait = tagWaitText(value);
  return (
    <div className={"vx-tagpick" + (className ? " " + className : "")} role="group" aria-label="Tag your post">
      <span className="vx-caption">Choose a tag so readers know what this is. You need one to post.</span>
      <div className="vx-tagpick__row">
        <TopicChip className="is-unverified" icon="shield-alert" label="Unverified News" selected={value.pick === "UNVERIFIED_NEWS"} onClick={() => pick("UNVERIFIED_NEWS")} />
        <TopicChip className="is-gossip" icon="messages-square" label="Gossip" selected={value.pick === "GOSSIP"} onClick={() => pick("GOSSIP")} />
        {editor ? (
          <TopicChip className="is-verified" icon="shield-check" label="Verified News" selected={value.pick === "VERIFIED_NEWS"} onClick={() => pick("VERIFIED_NEWS")} />
        ) : (
          <TopicChip className="is-verified" icon="shield-check" label="Request Verified News" selected={value.pick === "REQUEST_VERIFIED"} onClick={() => pick("REQUEST_VERIFIED")} />
        )}
      </div>
      {value.pick === "UNVERIFIED_NEWS" ? <p className="vx-caption m-0" data-testid="tag-note">A news claim that has not been confirmed.</p> : null}
      {value.pick === "GOSSIP" ? <p className="vx-caption m-0" data-testid="tag-note">Talk, rumour or opinion. Not presented as fact.</p> : null}
      {askSource ? (
        <div className="grid gap-3" data-testid="tag-source">
          <p className="vx-caption m-0">
            {value.pick === "REQUEST_VERIFIED"
              ? "It posts as Unverified News. A WAWU editor checks your source, and if it holds the tag becomes Verified News."
              : "Verified News needs a named source. Readers see it."}
          </p>
          <TextField label="Your source" value={value.sourceName} onChange={(v) => onChange({ ...value, sourceName: v })} placeholder="A named person, office or outlet" maxLength={200} />
          <TextField label="Link to the source (optional)" value={value.sourceUrl} onChange={(v) => onChange({ ...value, sourceUrl: v })} placeholder="https://" inputMode="url" />
        </div>
      ) : null}
      {wait ? <p className="vx-caption m-0" role="status" data-testid="tag-wait">{wait}</p> : null}
    </div>
  );
}
