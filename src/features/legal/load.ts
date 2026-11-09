import { readFileSync } from "node:fs";
import path from "node:path";
import { parseDoc, type LegalDoc } from "./markdown";

export type LegalSlug = "terms" | "privacy" | "refunds";

/** Read at build time (the pages are static): content/legal/<slug>.md in this repo, a copy of the backend repo's docs/legal (scripts/sync-shared.mjs). */
export function loadLegal(slug: LegalSlug): LegalDoc {
  const file = path.join(process.cwd(), "content", "legal", slug + ".md");
  return parseDoc(readFileSync(file, "utf8"));
}
