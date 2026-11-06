"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Banner, IconButton, Tabs } from "@/components/vx";
import { Rail } from "@/components/shell/ShellSlots";
import "../profile/profile.css";
import "./legal.css";

export type LegalTab = "rules" | "terms" | "privacy" | "refunds";
export const LEGAL_TABS: { id: LegalTab; label: string }[] = [
  { id: "rules", label: "Rules" },
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
  { id: "refunds", label: "Refunds" },
];
export const legalHref = (t: LegalTab) => `/settings/legal/${t}`;

/** The Rules board's frame: back bar on phone, the four tabs, then the page; the "Help" aside on desktop. */
export function LegalFrame({ tab, children }: { tab: LegalTab; children: ReactNode }) {
  const router = useRouter();
  return (
    <div className="pf-page">
      <header className="pf-bar pf-only-phone">
        <IconButton icon="arrow-left" label="Back to settings" variant="ghost" onClick={() => router.push("/settings")} />
        <h1 className="pf-h1 pf-bar__h1">Help and legal</h1>
      </header>
      <Tabs items={LEGAL_TABS} value={tab} label="Legal pages" onChange={(id) => { if (id !== tab) router.push(legalHref(id as LegalTab)); }} />
      <article className="pf-rules">{children}</article>
      <Rail>
        <section className="pf-panel" aria-label="Help">
          <h2 className="vx-eyebrow pf-eyebrow">Help</h2>
          <Banner tone="info" title="Named in a post?">Use Report on the post and choose &quot;This is about me&quot;. It goes to the front of the queue.</Banner>
          <div className="pf-always"><b>Always free</b><span>Reading, listening, liking and sharing never cost anything. Paid posts always show their price first.</span></div>
        </section>
      </Rail>
    </div>
  );
}

export function LegalHead({ title, updated, lead }: { title: string; updated: string; lead?: string }) {
  return (
    <>
      <h2 className="pf-h1 pf-rules__h">{title}</h2>
      <p className="lg-date">Last updated {updated}</p>
      {lead ? <p className="pf-body">{lead}</p> : null}
    </>
  );
}
