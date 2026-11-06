import type { ReactNode } from "react";

/** The small part of Markdown the legal texts use: front matter, ## headings, - lists, paragraphs, **bold**, [links](url) and email addresses. */
export interface LegalDoc { title: string; updated: string; lead: string; body: string }

export function parseDoc(src: string): LegalDoc {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src.replace(/\r\n/g, "\n"));
  if (!m) throw new Error("legal text has no front matter");
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!meta.title || !meta.updated) throw new Error("legal text needs a title and an updated line");
  return { title: meta.title, updated: meta.updated, lead: meta.lead ?? "", body: m[2].trim() };
}

/** An [OWNER: ...] gap is for the owner to fill in the markdown. It is never shown on the page. */
export const OWNER_GAP = /\s*\[OWNER:[^\]]*\]/g;
export const ownerGaps = (src: string): string[] => src.match(/\[OWNER:[^\]]*\]/g) ?? [];
export const isGap = (s: string) => /\[OWNER:/.test(s);

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|([A-Za-z0-9._-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of Array.from(text.matchAll(INLINE))) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1]) out.push(<b key={k++}>{m[1]}</b>);
    else if (m[2]) out.push(<a key={k++} href={m[3]} className="link">{m[2]}</a>);
    else out.push(<a key={k++} href={"mailto:" + m[4]} className="link">{m[4]}</a>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.split("\n");
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("## ")) { blocks.push(<h3 key={k++} className="lg-h">{line.slice(3)}</h3>); i++; continue; }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(lines[i++].slice(2).replace(OWNER_GAP, "").trim());
      blocks.push(<ul key={k++} className="lg-list">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("## ") && !lines[i].startsWith("- ")) para.push(lines[i++]);
    const text = para.join(" ").replace(OWNER_GAP, "").trim();
    if (text) blocks.push(<p key={k++} className="lg-p">{inline(text)}</p>);
  }
  return <>{blocks}</>;
}
