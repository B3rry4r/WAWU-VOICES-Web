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

function run(
  cmd: string,
  args: string[],
  input?: Buffer,
): Promise<{ out: Buffer; err: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
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
