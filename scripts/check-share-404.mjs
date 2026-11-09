// Proof for G8 against a running production build (`next build` then `next start`, or nginx in front):
//   node scripts/check-share-404.mjs http://127.0.0.1:3000 [code]
// An unknown or removed share code must answer HTTP 404 with noindex and the words "We could not find that".
const base = process.argv[2] || "http://127.0.0.1:3000";
const code = process.argv[3] || "zzzzzzz";
let bad = 0;
for (let i = 0; i < 3; i++) {
  const r = await fetch(`${base}/s/${code}`);
  const body = await r.text();
  const robots = r.headers.get("x-robots-tag") || "";
  const ok = r.status === 404 && /noindex/.test(robots) && body.includes("We could not find that");
  console.log(`try ${i + 1}: status ${r.status}, x-robots-tag "${robots}", words ${body.includes("We could not find that")} ${ok ? "OK" : "FAIL"}`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
