import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BITRATE_BPS } from "./limits.js";

// The one stored format: MP4 container, AAC-LC, mono, 32 kbps, 24 kHz is enough for speech
// and keeps the file small. m4a plays on every browser (Chrome, Firefox, Safari incl. iOS, Android).
// Opus-in-webm does NOT play on older iOS Safari, so webm recordings are always converted.
export const OUTPUT = {
  container: "mp4",
  codec: "aac",
  channels: 1,
  sampleRate: 24000,
  bitrate: BITRATE_BPS,
  mime: "audio/mp4",
  ext: "m4a",
} as const;

/**
 * LCH-09: ffmpeg and ffprobe run at a lower priority than the API, the web server and the database (FFMPEG_NICE, 10 in
 * production, off elsewhere; 0 turns it off). On the two CPUs of the launch droplet a crowd of recordings otherwise takes
 * CPU from every page and read while it works; at a lower priority the pages stay quick and only the recordings wait.
 */
export function niceCommand(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): [string, string[]] {
  const n = Number(env.FFMPEG_NICE ?? (env.NODE_ENV === "production" ? 10 : 0));
  return n > 0 && n <= 19
    ? ["nice", ["-n", String(Math.floor(n)), cmd, ...args]]
    : [cmd, args];
}

function run(
  cmd: string,
  args: string[],
  input?: Buffer,
): Promise<{ out: Buffer; err: string }> {
  return new Promise((resolve, reject) => {
    const [c, a] = niceCommand(cmd, args);
    const p = spawn(c, a, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve({ out: Buffer.concat(out), err })
        : reject(new Error(`${cmd} exit ${code}: ${err.slice(-400)}`)),
    );
    p.stdin.on("error", () => {});
    p.stdin.end(input);
  });
}

/** Convert any browser recording (webm/opus, mp4/aac, ogg, wav) into the stored format. Input via stdin.
 *  Output goes to a temp file so the moov atom can be moved to the front (+faststart): a plain, non-fragmented
 *  m4a that Safari and iOS stream reliably (fragmented mp4 on a pipe is avoided on purpose). */
export async function normalise(
  input: Buffer,
  maxSeconds: number,
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "voices-norm-"));
  const outFile = join(dir, "out.m4a");
  try {
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        "pipe:0",
        "-vn",
        "-map_metadata",
        "-1",
        "-t",
        String(maxSeconds + 0.5),
        "-ac",
        String(OUTPUT.channels),
        "-ar",
        String(OUTPUT.sampleRate),
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=" + OUTPUT.sampleRate,
        "-c:a",
        "aac",
        "-b:a",
        String(OUTPUT.bitrate),
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
        outFile,
      ],
      input,
    );
    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** What one ffmpeg pass gives for a recording: the stored file, the waveform source and the length. */
export interface OnePass {
  audio: Buffer;
  /** 8 kHz mono signed 16-bit little-endian samples of the same levelled sound that was encoded (for the waveform). */
  pcm: Buffer;
  /** The length ffprobe would report for `audio` (the movie header of the written file). */
  durationSeconds: number;
}

/**
 * LCH-09 one-pass: converts a recording AND makes its waveform samples in a single ffmpeg run, where the pipeline used to
 * run ffprobe, ffmpeg, ffprobe and ffmpeg again (four processes, and the sound decoded three times). The stored file is made by
 * exactly the same chain as `normalise` (loudnorm=I=-16:TP=-1.5:LRA=11, aresample, mono, 24 kHz, AAC 32 kbps, faststart); the
 * levelled sound is split after the chain, once to the encoder and once down to 8 kHz for the waveform, so loudnorm still
 * runs once. The length is read from the written file's movie header, which is what ffprobe reads. Nothing is probed first:
 * a file ffmpeg cannot read as audio fails here (the caller says "not_audio"), and an over-long file is cut at maxSeconds
 * plus headroom and is then seen as too long by its measured length, the same answer as before.
 */
export async function convertOnePass(
  input: Buffer,
  maxSeconds: number,
): Promise<OnePass> {
  const dir = await mkdtemp(join(tmpdir(), "voices-norm-"));
  const outFile = join(dir, "out.m4a");
  try {
    const t = String(maxSeconds + 0.5);
    const { out } = await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        "pipe:0",
        "-filter_complex",
        "[0:a:0]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=" +
          OUTPUT.sampleRate +
          ",aformat=channel_layouts=mono,asplit=2[enc][wav];[wav]aresample=8000[pcm]",
        "-map",
        "[enc]",
        "-map_metadata",
        "-1",
        "-t",
        t,
        "-c:a",
        "aac",
        "-b:a",
        String(OUTPUT.bitrate),
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
        outFile,
        "-map",
        "[pcm]",
        "-t",
        t,
        "-f",
        "s16le",
        "pipe:1",
      ],
      input,
    );
    const audio = await readFile(outFile);
    return { audio, pcm: out, durationSeconds: mp4Duration(audio) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The length in seconds from the `mvhd` box of an MP4 (what ffprobe reports as the format duration). */
export function mp4Duration(mp4: Buffer): number {
  const moov = mp4.indexOf("moov");
  const at = moov < 0 ? -1 : mp4.indexOf("mvhd", moov);
  if (at < 0) throw new Error("no movie header");
  const v = mp4[at + 4];
  const base = at + 8; // after the type, version and flags
  if (v === 1) {
    const scale = mp4.readUInt32BE(base + 16);
    const dur = Number(mp4.readBigUInt64BE(base + 20));
    return dur / scale;
  }
  const scale = mp4.readUInt32BE(base + 8);
  return mp4.readUInt32BE(base + 12) / scale;
}

export interface Probe {
  codec: string;
  channels: number;
  sampleRate: number;
  duration: number;
  bitRate: number;
  container: string;
}

export async function probe(input: Buffer): Promise<Probe> {
  const { out } = await run(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", "pipe:0"],
    input,
  );
  const j = JSON.parse(out.toString()) as {
    streams: {
      codec_type: string;
      codec_name: string;
      channels: number;
      sample_rate: string;
    }[];
    format: { duration: string; bit_rate?: string; format_name: string };
  };
  const s = j.streams.find((x) => x.codec_type === "audio");
  if (!s) throw new Error("no audio stream");
  return {
    codec: s.codec_name,
    channels: s.channels,
    sampleRate: Number(s.sample_rate),
    duration: Number(j.format.duration),
    bitRate:
      Number(j.format.bit_rate) ||
      Math.round((input.length * 8) / Number(j.format.duration)),
    container: j.format.format_name,
  };
}
