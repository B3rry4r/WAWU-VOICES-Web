import { LegalFrame, LegalHead, type LegalTab } from "./LegalFrame";
import { loadLegal } from "./load";
import { isGap, Markdown } from "./markdown";

/** Terms, Privacy or Refunds: the text comes from docs/legal/<tab>.md, read when the site is built. */
export function LegalPage({ tab }: { tab: "terms" | "privacy" | "refunds" }) {
  const doc = loadLegal(tab);
  return (
    <LegalFrame tab={tab as LegalTab}>
      <LegalHead title={doc.title} updated={isGap(doc.updated) ? undefined : doc.updated} lead={doc.lead} />
      <Markdown source={doc.body} />
    </LegalFrame>
  );
}
