#!/usr/bin/env node
// Refreshes the files this repo keeps as copies of the backend repo (B3rry4r/WAWU-VOICES-Backend).
// The backend repo is the master for all of them. Run after any of them changes there:
//   VOICES_BACKEND_DIR=../wawu-voices-backend npm run sync:shared        (copy)
//   VOICES_BACKEND_DIR=../wawu-voices-backend npm run sync:shared -- --check   (exit 1 if a copy is out of date)
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const backend = path.resolve(web, process.env.VOICES_BACKEND_DIR ?? "../wawu-voices-backend");
const check = process.argv.includes("--check");

// [file in the backend repo, copy in this repo]
const FILES = [
  ["docs/legal/terms.md", "content/legal/terms.md"],
  ["docs/legal/privacy.md", "content/legal/privacy.md"],
  ["docs/legal/refunds.md", "content/legal/refunds.md"],
  ["docs/contract/openapi.yaml", "contract/openapi.yaml"],
  ["api/src/audio-ref/normalise.ts", "e2e/vendor/normalise.ts"],
  ["api/src/audio-ref/limits.ts", "e2e/vendor/limits.ts"],
  ["api/src/units/text-price.ts", "src/lib/shared/text-price.ts"],
];

if (!existsSync(path.join(backend, "api"))) {
  console.error(`Backend repo not found at ${backend}. Set VOICES_BACKEND_DIR.`);
  process.exit(2);
}

let stale = 0;
for (const [from, to] of FILES) {
  const src = path.join(backend, from);
  const dst = path.join(web, to);
  const same = existsSync(dst) && readFileSync(src).equals(readFileSync(dst));
  if (same) continue;
  if (check) {
    console.log(`out of date: ${to} (from ${from})`);
    stale++;
  } else {
    copyFileSync(src, dst);
    console.log(`copied ${from} -> ${to}`);
  }
}
if (check && stale) process.exit(1);
console.log(check ? "all copies up to date" : "done");
