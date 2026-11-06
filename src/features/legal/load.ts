import { readFileSync } from "node:fs";
import path from "node:path";
import { parseDoc, type LegalDoc } from "./markdown";

export type LegalSlug = "terms" | "privacy" | "refunds";

/** Read at build time (the pages are static): docs/legal/<slug>.md, one folder above web/. */
export function loadLegal(slug: LegalSlug): LegalDoc {
  const file = path.join(process.cwd(), "..", "docs", "legal", slug + ".md");
  return parseDoc(readFileSync(file, "utf8"));
}
