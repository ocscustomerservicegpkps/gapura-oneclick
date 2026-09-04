import test from 'node:test';
import assert from 'node:assert/strict';
import { scaledDimensions, shouldReencode } from './video-compression.ts';

const h264 = (over) => ({ codec: 'h264', width: 1920, height: 1080, fps: 30, bitrate: 18_000_000, ...over });

test('a phone clip at its native bitrate is worth re-encoding', () => {
  assert.equal(shouldReencode(h264()), true);
});

test('4K is judged against the resolution it will be scaled down to', () => {
  // 12 Mbps of 4K is below 4K's own threshold but far above 1080p's, and 1080p
  // is what the encoder will actually produce.
  assert.equal(shouldReencode(h264({ width: 3840, height: 2160, bitrate: 12_000_000 })), true);
});

test('an already-efficient clip is left alone', () => {
  // The 3-minute 1.1 Mbps case that used to cost 48s and produce a larger file.
  assert.equal(shouldReencode(h264({ bitrate: 1_100_000 })), false);
});

test('the threshold sits just above what this encoder itself produces', () => {
  const pixelsPerSecond = 1920 * 1080 * 30;
  assert.equal(shouldReencode(h264({ bitrate: Math.round(0.09 * pixelsPerSecond) })), false);
  assert.equal(shouldReencode(h264({ bitrate: Math.round(0.11 * pixelsPerSecond) })), true);
});

test('vertical phone video is measured on its long edge', () => {
  // 1080x1920 is already within MAX_EDGE, so no downscale and the same threshold.
  assert.equal(shouldReencode(h264({ width: 1080, height: 1920, bitrate: 1_100_000 })), false);
  assert.equal(shouldReencode(h264({ width: 1080, height: 1920, bitrate: 18_000_000 })), true);
});

test('60fps gets twice the bitrate allowance', () => {
  // 8 Mbps straddles the two thresholds: 6.2 Mbps at 30fps, 12.4 Mbps at 60fps.
  const at60 = h264({ fps: 60, bitrate: 8_000_000 });
  assert.equal(shouldReencode(at60), false);
  assert.equal(shouldReencode({ ...at60, fps: 30 }), true);
});

test('a small low-bitrate clip is still left alone', () => {
  assert.equal(shouldReencode(h264({ width: 640, height: 480, bitrate: 400_000 })), false);
});

test('codecs the dashboard may not play are normalised however small they are', () => {
  for (const codec of ['hevc', 'vp9', 'av1', 'mpeg4']) {
    assert.equal(shouldReencode(h264({ codec, bitrate: 200_000 })), true, codec);
  }
});

test('unreadable metadata re-encodes rather than trusting the file', () => {
  assert.equal(shouldReencode(null), true);
  assert.equal(shouldReencode(h264({ bitrate: 0 })), true);
  assert.equal(shouldReencode(h264({ fps: 0 })), true);
  assert.equal(shouldReencode(h264({ width: 0 })), true);
  assert.equal(shouldReencode(h264({ bitrate: Number.NaN })), true);
});

test('scaledDimensions clamps the long edge and keeps aspect ratio', () => {
  assert.deepEqual(scaledDimensions(3840, 2160), { width: 1920, height: 1080 });
  assert.deepEqual(scaledDimensions(2160, 3840), { width: 1080, height: 1920 });
  assert.deepEqual(scaledDimensions(1280, 720), { width: 1280, height: 720 });
});
