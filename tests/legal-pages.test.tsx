import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Markdown, parseDoc } from "@/features/legal/markdown";
import { LEGAL_TABS } from "@/features/legal/LegalFrame";
import { loadLegal } from "@/features/legal/load";

const DIR = path.join(__dirname, "..", "..", "docs", "legal");

describe("legal texts", () => {
  it("has the three texts and parses each", () => {
    expect(readdirSync(DIR).sort()).toEqual(["privacy.md", "refunds.md", "terms.md"]);
    for (const s of ["terms", "privacy", "refunds"] as const) {
      const d = loadLegal(s);
      expect(d.title.length).toBeGreaterThan(3);
      expect(d.body).toContain("## ");
    }
  });
  it("keeps the product rules: no em-dash, no Rant, no wallet, no straight quotes in text", () => {
    for (const f of readdirSync(DIR)) {
      const t = readFileSync(path.join(DIR, f), "utf8");
      expect(t, f).not.toMatch(/—|–/);
      expect(t, f).not.toMatch(/rant\b/i);
      expect(t, f).not.toMatch(/wallet/i);
      expect(t, f).not.toMatch(/[a-z]'[a-z]/i);
    }
  });
  it("renders headings, lists, bold, links and email links", () => {
    const html = renderToStaticMarkup(<Markdown source={"## Head\nA **bold** [link](/x) and a@b.com.\n\n- one\n- two"} />);
    expect(html).toContain('<h3 class="lg-h">Head</h3>');
    expect(html).toContain("<b>bold</b>");
    expect(html).toContain('href="/x"');
    expect(html).toContain('href="mailto:a@b.com"');
    expect(html).toContain("<li>two</li>");
  });
  it("needs front matter", () => {
    expect(() => parseDoc("no front matter")).toThrow();
    expect(parseDoc("---\ntitle: T\nupdated: D\n---\nbody").updated).toBe("D");
  });
  it("draws the four tabs in the board order", () => {
    expect(LEGAL_TABS.map((t) => t.label)).toEqual(["Rules", "Terms", "Privacy", "Refunds"]);
  });
});
