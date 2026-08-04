
import sharp from 'sharp';

interface CompressionResult {

  buffer: Buffer;

  size: number;

  format: string;

  width: number;

  height: number;

  originalSize: number;

  compressionRatio: number;
}

export async function compressToExactSize(
  input: Buffer | ArrayBuffer,
  targetSizeKB: number = 500
): Promise<CompressionResult> {
  const inputBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const originalSize = inputBuffer.length;
  const targetSizeBytesEarly = targetSizeKB * 1024;

  if (originalSize <= targetSizeBytesEarly) {
    const dims = await sharp(inputBuffer).metadata();
    return {
      buffer: inputBuffer,
      size: originalSize,
      format: dims.format || 'webp',
      width: dims.width || 0,
      height: dims.height || 0,
      originalSize,
      compressionRatio: 0
    };
  }

  let metadata;
  try {
    metadata = await sharp(inputBuffer).metadata();
  } catch {
    throw new Error('Invalid image format');
  }

  const originalWidth = metadata.width || 800;
  const originalHeight = metadata.height || 600;

  let targetWidth = Math.min(originalWidth, 1280);
  let targetHeight = Math.min(originalHeight, 720);

  const targetSizeBytes = targetSizeKB * 1024;
  let outputBuffer: Buffer;
  let quality = 70;

  outputBuffer = await sharp(inputBuffer)
    .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  let attempts = 0;
  while (outputBuffer.length > targetSizeBytes && attempts < 15) {
    attempts++;

    if (quality > 10) {
      quality -= 10;
    } else {

      targetWidth = Math.round(targetWidth * 0.8);
      targetHeight = Math.round(targetHeight * 0.8);
    }

    outputBuffer = await sharp(inputBuffer)
      .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  const compressionRatio = (1 - outputBuffer.length / originalSize) * 100;
  const outputMetadata = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    size: outputBuffer.length,
    format: 'webp',
    width: outputMetadata.width || 0,
    height: outputMetadata.height || 0,
    originalSize,
    compressionRatio
  };
}
