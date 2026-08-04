
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

type MediaType = 'image' | 'video';

interface MediaCompressionOptions {

  maxSizeKB?: number;

  quality?: number;

  videoMaxSizeMB?: number;

  videoCRF?: number;
}

interface MediaCompressionResult {

  buffer: Buffer;

  size: number;

  type: MediaType;

  mimeType: string;

  width?: number;

  height?: number;

  duration?: number;

  originalSize: number;

  compressionRatio: number;
}

function detectMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  throw new Error(`Unsupported media type: ${mimeType}`);
}

async function compressImage(
  input: Buffer,
  options: MediaCompressionOptions = {}
): Promise<MediaCompressionResult> {
  const { maxSizeKB = 5, quality = 70 } = options;

  const originalSize = input.length;
  const metadata = await sharp(input).metadata();

  let targetWidth = Math.min(metadata.width || 1280, 1280);
  let targetHeight = Math.min(metadata.height || 720, 720);

  const maxSizeBytes = maxSizeKB * 1024;
  let currentQuality = quality;
  let outputBuffer: Buffer;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    outputBuffer = await sharp(input)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: currentQuality, lossless: false })
      .toBuffer();

    if (outputBuffer.length > maxSizeBytes && currentQuality > 10 && attempts < maxAttempts) {
      currentQuality = Math.max(10, currentQuality - 10);
      attempts++;
    } else {
      break;
    }
  } while (true);

  if (outputBuffer.length > maxSizeBytes) {
    const scaleFactor = Math.sqrt(maxSizeBytes / outputBuffer.length);
    targetWidth = Math.round(targetWidth * scaleFactor);
    targetHeight = Math.round(targetHeight * scaleFactor);

    outputBuffer = await sharp(input)
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: currentQuality })
      .toBuffer();
  }

  const compressionRatio = (1 - outputBuffer.length / originalSize) * 100;

  return {
    buffer: outputBuffer,
    size: outputBuffer.length,
    type: 'image',
    mimeType: 'image/webp',
    width: targetWidth,
    height: targetHeight,
    originalSize,
    compressionRatio
  };
}

async function compressVideo(
  input: Buffer,
  options: MediaCompressionOptions = {}
): Promise<MediaCompressionResult> {
  const { videoMaxSizeMB = 50, videoCRF = 28 } = options;

  const originalSize = input.length;
  const maxSizeBytes = videoMaxSizeMB * 1024 * 1024;

  let ffmpegAvailable = false;
  try {
    await execAsync('which ffmpeg');
    ffmpegAvailable = true;
  } catch {
    console.warn('[VIDEO] ffmpeg not available, skipping compression');
  }

  if (!ffmpegAvailable) {

    if (originalSize > maxSizeBytes) {
      throw new Error(`Video too large (${(originalSize / 1024 / 1024).toFixed(2)}MB). Max: ${videoMaxSizeMB}MB`);
    }

    return {
      buffer: input,
      size: input.length,
      type: 'video',
      mimeType: 'video/mp4',
      originalSize,
      compressionRatio: 0
    };
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-compress-'));
  const inputPath = path.join(tmpDir, 'input.mp4');
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {

    await fs.writeFile(inputPath, input);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = await new Promise<any>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
    const duration = metadata.format.duration;
    const width = videoStream?.width;
    const height = videoStream?.height;


    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec('libx264')
        .size(`${Math.min(width, 1920)}x?`)
        .outputOptions([
          '-crf', String(videoCRF),
          '-preset', 'medium',
          '-movflags', '+faststart',
          '-maxrate', '5M',
          '-bufsize', '10M'
        ])
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    const compressedBuffer = await fs.readFile(outputPath);
    const compressionRatio = (1 - compressedBuffer.length / originalSize) * 100;


    if (compressedBuffer.length > maxSizeBytes) {
      console.warn(`[VIDEO] Still larger than ${videoMaxSizeMB}MB after compression`);
    }

    return {
      buffer: compressedBuffer,
      size: compressedBuffer.length,
      type: 'video',
      mimeType: 'video/mp4',
      width: Math.min(width, 1920),
      height,
      duration,
      originalSize,
      compressionRatio
    };

  } finally {

    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function compressMedia(
  input: Buffer,
  mimeType: string,
  options: MediaCompressionOptions = {}
): Promise<MediaCompressionResult> {
  const type = detectMediaType(mimeType);

  if (type === 'image') {
    return compressImage(input, options);
  } else {
    return compressVideo(input, options);
  }
}

export function validateMedia(
  file: File,
  options: { maxImageSizeMB?: number; maxVideoSizeMB?: number } = {}
): { valid: boolean; error?: string } {
  const { maxImageSizeMB = 10, maxVideoSizeMB = 100 } = options;

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!isImage && !isVideo) {
    return { valid: false, error: 'Only image and video files are allowed' };
  }

  const maxSize = isImage ? maxImageSizeMB * 1024 * 1024 : maxVideoSizeMB * 1024 * 1024;

  if (file.size > maxSize) {
    const maxSizeMB = isImage ? maxImageSizeMB : maxVideoSizeMB;
    return { 
      valid: false, 
      error: `${isImage ? 'Image' : 'Video'} too large (max ${maxSizeMB}MB)` 
    };
  }

  return { valid: true };
}
