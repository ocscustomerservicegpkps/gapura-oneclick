import 'server-only';

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * Re-encodes uploaded evidence video to the smallest H.264 file that still
 * looks like the original.
 *
 * Phone cameras write at a fixed, very generous bitrate (1080p30 is commonly
 * ~17 Mbps) because they encode in real time on a battery. Re-encoding the same
 * footage at a constant *quality* target typically lands at a fifth of that
 * with no visible difference, which is the whole point of doing this on the way
 * in rather than storing what the handset produced.
 *
 * H.264/AAC in MP4 is deliberate: HEVC and AV1 are smaller but do not play in
 * every browser the dashboard is opened in, and evidence nobody can watch is
 * worse than evidence that is a few MB larger.
 */

/**
 * Constant Rate Factor — the encoder targets a quality level and lets the size
 * fall where it may, which is exactly "as small as possible without looking
 * worse". Lower is better quality. 23 is x264's own default and the usual
 * "visually transparent for camera footage" setting; it is the conservative
 * choice on purpose, because evidence gets zoomed into to read a tail number or
 * judge damage. Raising it to 25-27 roughly halves the output again if storage
 * ever matters more than that margin.
 */
const CRF = '23';

/**
 * x264 speed/efficiency trade-off. A preset does not change the quality target —
 * CRF does that — it changes how much of the encoder's toolbox is used to hit it,
 * so a slower preset is strictly smaller at the *same* picture quality.
 *
 * Measured on a 10s 1080p30 clip at 18 Mbps (VMAF against the source, so the
 * rows are comparable only at equal VMAF, not equal CRF):
 *
 *   veryfast crf 20 -> 8.32 MB  VMAF 96.33
 *   medium   crf 23 -> 7.03 MB  VMAF 96.37   (-15.5% at the same quality)
 *   veryfast crf 21 -> 7.56 MB  VMAF 95.85
 *   medium   crf 24 -> 6.21 MB  VMAF 95.77   (-17.9% at the same quality)
 *
 * The cost is encode time: ~1.5x here, up to ~2x on high-detail footage. That is
 * affordable because `shouldReencode` below now refuses the long, already-small
 * clips that used to be the slow case, so what reaches the encoder is short.
 */
const PRESET = 'medium';

/**
 * Longest edge kept. 1080p is the practical review resolution and is the single
 * biggest size lever for 4K handsets. It does mean 4K detail is not preserved
 * for zooming — raise this if that ever matters more than storage.
 */
const MAX_EDGE = 1920;

const AUDIO_BITRATE = '96k';

/**
 * x264 will otherwise saturate every core. On the unauthenticated endpoint that
 * turns one upload into a whole-box stall, so encoding is boxed into a minority
 * of the CPU and the request just takes slightly longer.
 */
const ENCODE_THREADS = String(Math.max(1, Math.min(4, os.cpus().length - 1)));

/**
 * Encodes allowed to run at once, process-wide.
 *
 * `ENCODE_THREADS` caps what *one* encode costs; it does nothing about how many
 * run together. On the unauthenticated endpoint the per-IP limits are no defence
 * either — they are keyed by client, so a handful of distinct clients each stay
 * inside their own budget while collectively pinning every core. Sized to keep
 * the encoders to roughly half the box no matter how many uploads land at once.
 */
const MAX_CONCURRENT_ENCODES = Math.max(
  1,
  Math.floor(os.cpus().length / 2 / Number(ENCODE_THREADS))
);

/**
 * Requests allowed to queue for a slot. Past this the box is already saturated
 * and every extra waiter is just a held video buffer, so those are stored
 * uncompressed rather than queued behind a spinner the client will abandon.
 */
const MAX_ENCODE_QUEUE = 8;

let activeEncodes = 0;
const encodeQueue: Array<() => void> = [];

/** `false` when the encoder is saturated — the caller stores the original instead. */
function acquireEncodeSlot(): Promise<boolean> {
  if (activeEncodes < MAX_CONCURRENT_ENCODES) {
    activeEncodes++;
    return Promise.resolve(true);
  }
  if (encodeQueue.length >= MAX_ENCODE_QUEUE) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => encodeQueue.push(() => resolve(true)));
}

function releaseEncodeSlot(): void {
  // Hand the slot straight to the next waiter rather than freeing and
  // re-taking it, so a waiter can never be skipped by a newly arriving request.
  const next = encodeQueue.shift();
  if (next) next();
  else activeEncodes--;
}

/** A pathological or hostile file must not pin a core indefinitely. */
const TIMEOUT_MS = 90_000;

/** Reading a header, not decoding — anything slower than this is a malformed file. */
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Only accept the re-encode if it saves something worth the quality risk.
 * Footage that is already efficiently encoded comes back roughly the same size
 * and is better left untouched.
 */
const MIN_SAVING_RATIO = 0.9;

/**
 * Bits per pixel per frame that this encoder's own output lands at for demanding
 * 1080p footage (the 7.03 MB / 10s measurement above is 0.090 bpp). A source
 * already at or below this cannot be beaten, so re-encoding it is pure cost.
 *
 * Sitting the threshold slightly above our own output rate matches
 * `MIN_SAVING_RATIO`: anything in the gap would come back within 10% of the
 * original and be discarded anyway, just 45 seconds later.
 */
const SKIP_BPP = 0.1;

export interface VideoCompressionResult {
  buffer: Buffer;
  mimeType: string;
  /** File extension the caller should store the result under. */
  ext: string;
  compressed: boolean;
  originalSize: number;
  size: number;
}

let ffmpegAvailable: boolean | null = null;

function run(
  command: string,
  args: string[],
  timeoutMs: number,
  captureStdout = false,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', captureStdout ? 'pipe' : 'ignore', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout = (stdout + String(chunk)).slice(0, 64_000);
    });
    child.stderr?.on('data', (chunk) => {
      // Keep only the tail; ffmpeg is chatty and the useful part is the end.
      stderr = (stderr + String(chunk)).slice(-4000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!settled) resolve({ code, stdout, stderr });
    });
  });
}

export interface VideoProbe {
  codec: string;
  width: number;
  height: number;
  fps: number;
  /** Bits per second of the video as stored. */
  bitrate: number;
}

/** Dimensions the scale filter will actually produce, for sizing decisions made before encoding. */
export function scaledDimensions(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return { width, height };
  const factor = MAX_EDGE / longest;
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
}

/**
 * Is re-encoding this source worth the CPU?
 *
 * Without this check every upload paid for a full encode, including the case
 * that can never win: a long clip that is already at a low bitrate. A 3-minute
 * 1080p clip at 1.1 Mbps took 48 seconds to re-encode and came back *larger*
 * (26 MB -> 41 MB), so `MIN_SAVING_RATIO` threw the result away — 48 seconds of
 * CPU, on an unauthenticated endpoint, to store exactly what arrived.
 *
 * Unknown or unparseable metadata re-encodes, because that is the branch where
 * something is odd about the file and normalising it is the safer answer.
 */
export function shouldReencode(probe: VideoProbe | null): boolean {
  if (!probe) return true;

  // Anything that is not already H.264 gets normalised regardless of size —
  // an HEVC clip that no reviewer's browser will play is not a saving.
  if (probe.codec !== 'h264') return true;

  const { width, height, fps, bitrate } = probe;
  if (![width, height, fps, bitrate].every((n) => Number.isFinite(n) && n > 0)) return true;

  const out = scaledDimensions(width, height);
  return bitrate > SKIP_BPP * out.width * out.height * fps;
}

function parseFps(rate: unknown): number {
  const [num, den] = String(rate ?? '').split('/');
  const n = Number(num);
  const d = den === undefined ? 1 : Number(den);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return n / d;
}

/** `null` when ffprobe fails or reports no video stream — the caller treats that as "re-encode". */
async function probeVideo(filePath: string): Promise<VideoProbe | null> {
  try {
    const { code, stdout } = await run('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,r_frame_rate,bit_rate',
      '-show_entries', 'format=bit_rate',
      '-of', 'json',
      filePath,
    ], PROBE_TIMEOUT_MS, true);
    if (code !== 0) return null;

    const parsed = JSON.parse(stdout) as {
      streams?: Array<Record<string, unknown>>;
      format?: Record<string, unknown>;
    };
    const stream = parsed.streams?.[0];
    if (!stream) return null;

    // Container bitrate covers audio too, so it over-states the video slightly.
    // That biases the decision towards re-encoding, which is the safe direction.
    const bitrate = Number(stream.bit_rate) || Number(parsed.format?.bit_rate) || 0;

    return {
      codec: String(stream.codec_name || ''),
      width: Number(stream.width) || 0,
      height: Number(stream.height) || 0,
      fps: parseFps(stream.r_frame_rate),
      bitrate,
    };
  } catch (error) {
    console.error('[VIDEO] ffprobe failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Cached so a missing binary costs one probe per process, not one per upload. */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  try {
    const { code } = await run('ffmpeg', ['-version'], 5_000);
    ffmpegAvailable = code === 0;
  } catch {
    ffmpegAvailable = false;
  }
  if (!ffmpegAvailable) {
    console.warn('[VIDEO] ffmpeg not found — evidence video will be stored without re-encoding');
  }
  return ffmpegAvailable;
}

/**
 * Returns the re-encoded video, or the original untouched when ffmpeg is
 * unavailable, fails, or cannot make the file meaningfully smaller. Never
 * throws: a compression problem must not cost the reporter their upload.
 */
export async function compressEvidenceVideo(
  input: Buffer,
  sourceMimeType: string,
  sourceExt: string,
): Promise<VideoCompressionResult> {
  const passthrough: VideoCompressionResult = {
    buffer: input,
    mimeType: sourceMimeType,
    ext: sourceExt,
    compressed: false,
    originalSize: input.length,
    size: input.length,
  };

  if (!(await isFfmpegAvailable())) return passthrough;

  // Created inside the try so an unwritable or full tmpdir reaches the
  // passthrough handler below instead of throwing out of a function documented
  // never to throw. Cleanup is then conditional on it having been created.
  let dir: string | undefined;
  let slotHeld = false;

  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-video-'));
    const inputPath = path.join(dir, `in-${randomUUID()}`);
    const outputPath = path.join(dir, `out-${randomUUID()}.mp4`);

    await fs.writeFile(inputPath, input);

    // Probing reads a header and costs milliseconds, so whether an encode is
    // worth doing is settled before queueing for one of the few encode slots.
    if (!shouldReencode(await probeVideo(inputPath))) return passthrough;

    if (!(await acquireEncodeSlot())) {
      console.warn('[VIDEO] encoder saturated — storing original without re-encoding');
      return passthrough;
    }
    slotHeld = true;

    const { code, stderr } = await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-i', inputPath,
      // ffmpeg applies the source display matrix while filtering, so the output
      // frames are already upright and need no rotation metadata of their own.
      '-vf', `scale='if(gte(iw,ih),min(${MAX_EDGE},iw),-2)':'if(gte(iw,ih),-2,min(${MAX_EDGE},ih))'`,
      '-c:v', 'libx264', '-crf', CRF, '-preset', PRESET, '-pix_fmt', 'yuv420p',
      '-threads', ENCODE_THREADS,
      '-c:a', 'aac', '-b:a', AUDIO_BITRATE,
      // Evidence must not carry the reporter's GPS coordinates or device id.
      '-map_metadata', '-1',
      // Moves the index to the front so the dashboard can start playing before
      // the whole file has arrived.
      '-movflags', '+faststart',
      '-y', outputPath,
    ], TIMEOUT_MS);

    if (code !== 0) {
      console.error('[VIDEO] ffmpeg exited', code, stderr.slice(-500));
      return passthrough;
    }

    const output = await fs.readFile(outputPath);
    if (output.length === 0 || output.length > input.length * MIN_SAVING_RATIO) {
      return passthrough;
    }

    return {
      buffer: output,
      mimeType: 'video/mp4',
      ext: 'mp4',
      compressed: true,
      originalSize: input.length,
      size: output.length,
    };
  } catch (error) {
    console.error('[VIDEO] Compression failed, storing original:', error instanceof Error ? error.message : error);
    return passthrough;
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    if (slotHeld) releaseEncodeSlot();
  }
}
