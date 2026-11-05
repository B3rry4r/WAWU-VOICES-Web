"use client";
import { useRouter } from "next/navigation";
import { Banner, Icon, IconButton } from "@/components/vx";
import { Rail } from "@/components/shell/ShellSlots";
import "./profile.css";

type IconName = Parameters<typeof Icon>[0]["name"];
export const RULES: { icon: IconName; title: string; line: string }[] = [
  { icon: "message-circle", title: "Speak your mind, disagree hard", line: "Go after the idea, not the person." },
  { icon: "shield-alert", title: "No threats, harassment or hate", line: "That includes attacks on someone's tribe, faith, gender or disability." },
  { icon: "lock", title: "Keep private details private", line: "No phone numbers, home addresses or account numbers, yours or anyone's." },
  { icon: "badge-check", title: "News carries a tag", line: "Sharing news? Pick Unverified News or Gossip. Only WAWU editors mark Verified News." },
  { icon: "vote", title: "One person, one vote", line: "Nobody can buy votes. We remove coordinated voting and scams." },
  { icon: "user-check", title: "Adults only", line: "You must be 18 or older to use VOICES." },
];
export const STEPS = [
  "Someone reports it, and a moderator checks it.",
  "A moderator listens, reads the transcript and decides. Every decision is logged with a reason.",
  "The post is removed, or the account is warned or suspended. You are told why.",
  "Think we got it wrong? Appeal from the notice. A different moderator looks again.",
];

const named = (
  <Banner tone="info" title="Named in a post?">Use Report on the post and choose &quot;This is about me&quot;. It goes to the front of the queue.</Banner>
);

export function RulesPage() {
  const router = useRouter();
  return (
    <div className="pf-page">
      <header className="pf-bar pf-only-phone">
        <IconButton icon="arrow-left" label="Back to settings" variant="ghost" onClick={() => router.push("/settings")} />
        <h1 className="pf-h1 pf-bar__h1">Help and legal</h1>
      </header>
      <article className="pf-rules">
        <h2 className="pf-h1 pf-rules__h">Community rules</h2>
        <p className="pf-body">VOICES is for strong opinions and real disagreement. We step in for harm, never for a point of view.</p>
        <ol className="pf-rulelist">
          {RULES.map((r, i) => (
            <li key={r.title}>
              <span className="pf-rulelist__ic"><Icon name={r.icon} size={22} /></span>
              <span><b>{`${i + 1} ${r.title}`}</b><span>{r.line}</span></span>
            </li>
          ))}
        </ol>
        <h3 className="pf-rules__sub">When a post breaks a rule</h3>
        <ol className="pf-steps">{STEPS.map((t, i) => <li key={i}><span className="pf-steps__n">{i + 1}</span><span>{t}</span></li>)}</ol>
        <div className="pf-only-phone">{named}</div>
      </article>
      <Rail>
        <section className="pf-panel" aria-label="Help">
          <h2 className="vx-eyebrow pf-eyebrow">Help</h2>
          {named}
          <div className="pf-always"><b>Always free</b><span>Reading, listening, liking and sharing never cost anything. Paid posts always show their price first.</span></div>
        </section>
      </Rail>
    </div>
  );
}
