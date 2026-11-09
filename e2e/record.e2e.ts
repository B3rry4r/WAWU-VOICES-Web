import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { normalise, probe } from './vendor/normalise.js';

const PORT = 14060;
const out = await build({ entryPoints: [new URL('./page.ts', import.meta.url).pathname], bundle: true, write: false, format: 'iife', target: 'es2022' });
const js = out.outputFiles[0].text;
const srv = createServer((_, res) => { res.setHeader('content-type', 'text/html'); res.end(`<!doctype html><title>t</title><button id=b>x</button><script>${js}</script>`); }).listen(PORT, '127.0.0.1');

const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };
try {
  const ctx = await browser.newContext({ permissions: ['microphone'] });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.click('#b'); // a real tap, as iOS requires a gesture

  await t('Chromium offers webm/opus', async () => assert.equal(await page.evaluate(() => window.mime), 'audio/webm;codecs=opus'));
  let b64 = '';
  await t('records 3 s through the reference recorder', async () => {
    const r = (await page.evaluate(() => window.run(10, 3000))) as any;
    assert.equal(r.err, null);
    assert.equal(r.stoppedBy, 'user');
    assert.ok(r.seconds > 2.8 && r.seconds < 3.6, 'seconds ' + r.seconds);
    assert.ok(r.size > 2000, 'size ' + r.size);
    assert.ok(r.ticks >= 25, 'ticks ' + r.ticks);
    b64 = r.b64;
  });
  await t('the recording normalises to mono AAC mp4 on the server', async () => {
    const raw = Buffer.from(b64, 'base64');
    const before = await probe(raw);
    assert.equal(before.codec, 'opus');
    const m = await probe(await normalise(raw, 10));
    assert.equal(m.codec, 'aac'); assert.equal(m.channels, 1);
    assert.ok(Math.abs(m.duration - 3) < 0.7, 'dur ' + m.duration);
  });
  await t('auto-stops at the limit', async () => {
    const r = (await page.evaluate(() => window.run(2, null))) as any;
    assert.equal(r.stoppedBy, 'limit');
    assert.ok(r.seconds >= 1.9 && r.seconds <= 2.0001, 'seconds ' + r.seconds);
  });
  await t('permission denied is reported, not thrown', async () => assert.equal(await page.evaluate(() => window.deny()), 'permission_denied'));
} finally {
  await browser.close();
  srv.close();
}
console.log(failed ? 'FAILED ' + failed : 'ALL PASSED');
process.exit(failed ? 1 : 0);
