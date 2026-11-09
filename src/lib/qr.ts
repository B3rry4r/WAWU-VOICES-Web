/**
 * A QR code drawn in the browser (LCH-05): no library, no outside service, nothing leaves the page. Byte mode, error
 * correction level M, versions 1 to 10 (up to 213 bytes), which is far more than an invite link needs. The result is a
 * matrix of dark and light modules; `qrSvgPath` turns it into one SVG path.
 */

const ECC_PER_BLOCK_M = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS_M = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
export const QR_MAX_VERSION = 10;

function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const a = Math.floor(ver / 7) + 2;
    r -= (25 * a - 10) * a - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const rawCodewords = (ver: number) => Math.floor(rawDataModules(ver) / 8);
const dataCodewords = (ver: number) => rawCodewords(ver) - ECC_PER_BLOCK_M[ver - 1] * BLOCKS_M[ver - 1];

function alignPositions(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// GF(256) with the QR polynomial 0x11D
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsEcc(data: number[], degree: number): number[] {
  let gen = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= mul(gen[j], EXP[i]);
    }
    gen = next;
  }
  // gen[0] is the leading 1; divide data * x^degree by gen
  const rem = new Array<number>(degree).fill(0);
  for (const b of data) {
    const f = b ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], f);
  }
  return rem;
}

const utf8 = (s: string): number[] => Array.from(new TextEncoder().encode(s));

/** The data codewords for `bytes` at `ver`: mode, length, bytes, terminator, padding. */
function dataStream(bytes: number[], ver: number): number[] {
  const bits: number[] = [];
  const push = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  const cap = dataCodewords(ver) * 8;
  push(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; out.length < dataCodewords(ver); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Splits into blocks, adds error correction to each and interleaves, as the standard asks. */
function codewords(data: number[], ver: number): number[] {
  const nb = BLOCKS_M[ver - 1];
  const eccLen = ECC_PER_BLOCK_M[ver - 1];
  const raw = rawCodewords(ver);
  const nShort = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb) - eccLen;
  const blocks: number[][] = [];
  const eccs: number[][] = [];
  let k = 0;
  for (let i = 0; i < nb; i++) {
    const len = shortLen + (i < nShort ? 0 : 1);
    const d = data.slice(k, k + len);
    k += len;
    blocks.push(d);
    eccs.push(rsEcc(d, eccLen));
  }
  const out: number[] = [];
  for (let i = 0; i <= shortLen; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < eccLen; i++) for (const e of eccs) out.push(e[i]);
  return out;
}

const bit = (v: number, i: number) => ((v >>> i) & 1) === 1;

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function penalty(m: boolean[][]): number {
  const n = m.length;
  let p = 0;
  const line = (get: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i < n; i++) {
      if (get(i) === get(i - 1)) run++;
      else { if (run >= 5) p += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) p += 3 + (run - 5);
    // finder-like 1011101 with four light modules on either side
    for (let i = 0; i + 11 <= n; i++) {
      const a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0].every((v, j) => (get(i + j) ? 1 : 0) === v);
      const b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1].every((v, j) => (get(i + j) ? 1 : 0) === v);
      if (a) p += 40;
      if (b) p += 40;
    }
  };
  for (let y = 0; y < n; y++) line((i) => m[y][i]);
  for (let x = 0; x < n; x++) line((i) => m[i][x]);
  let dark = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (x + 1 < n && y + 1 < n && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
  }
  p += (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
  return p;
}

/** The modules of a QR code for `text` (true = dark). Throws if the text does not fit version 10. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = utf8(text);
  let ver = 1;
  for (; ver <= QR_MAX_VERSION; ver++) {
    const lenBits = ver >= 10 ? 16 : 8;
    if (4 + lenBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  if (ver > QR_MAX_VERSION) throw new Error("That text is too long for a QR code here.");
  const all = codewords(dataStream(bytes, ver), ver);
  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setFn = (x: number, y: number, dark: boolean) => { mod[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const al = alignPositions(ver);
  for (let i = 0; i < al.length; i++) {
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  const formatBits = (maskNo: number) => {
    const d = (0 << 3) | maskNo; // level M is 00
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(bits, i));
    setFn(8, 7, bit(bits, 6));
    setFn(8, 8, bit(bits, 7));
    setFn(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(bits, i));
    setFn(8, size - 8, true);
  };
  formatBits(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit(bits, i));
      setFn(b, a, bit(bits, i));
    }
  }
  // the data, in the zig-zag order
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && k < all.length * 8) { mod[y][x] = bit(all[k >>> 3], 7 - (k & 7)); k++; }
      }
    }
  }
  // the best of the eight masks
  let best = 0;
  let bestScore = Infinity;
  let bestM: boolean[][] = mod;
  for (let mk = 0; mk < 8; mk++) {
    const trial = mod.map((row, y) => row.map((v, x) => (fn[y][x] ? v : v !== MASKS[mk](x, y))));
    const s = penalty(trial);
    if (s < bestScore) { bestScore = s; best = mk; bestM = trial; }
  }
  const out = bestM.map((r) => r.slice());
  // the format bits of the winning mask go on top of the finished matrix
  const saved = mod;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) saved[y][x] = out[y][x];
  formatBits(best);
  return saved;
}

/** One SVG path (viewBox 0 0 n n) holding every dark module as a unit square. */
export function qrSvgPath(m: boolean[][]): string {
  let d = "";
  m.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x} ${y}h1v1h-1z`; }));
  return d;
}
