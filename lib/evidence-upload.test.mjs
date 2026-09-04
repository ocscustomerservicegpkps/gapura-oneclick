import assert from 'node:assert/strict';
import test from 'node:test';
import { checkEvidenceFile, classifyEvidence, evidenceKindFromUrl, extensionForUpload } from './evidence-mime.ts';
import { validateEvidenceBuffer, validateImageFile } from './security/file-validation.ts';

/** Builds a buffer starting with the given bytes, padded so offset checks have room. */
const bytes = (...values) => Buffer.concat([Buffer.from(values), Buffer.alloc(64)]);
const isoMedia = (brand) => Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftyp', 'latin1'),
  Buffer.from(brand, 'latin1'),
  Buffer.alloc(48),
]);
const riff = (subType) => Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from(subType, 'latin1'),
  Buffer.alloc(48),
]);

const JPEG = bytes(0xFF, 0xD8, 0xFF);
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), Buffer.alloc(64)]);
const DOCX = bytes(0x50, 0x4B, 0x03, 0x04);
const LEGACY_DOC = bytes(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);
const WEBM = bytes(0x1A, 0x45, 0xDF, 0xA3);

test('classification accepts images, videos and documents', () => {
  assert.equal(classifyEvidence('image/jpeg', 'photo.jpg'), 'image');
  assert.equal(classifyEvidence('video/mp4', 'clip.mp4'), 'video');
  assert.equal(classifyEvidence('application/pdf', 'form.pdf'), 'document');
  assert.equal(
    classifyEvidence('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'report.docx'),
    'document',
  );
  // Safari/Android often send an empty or generic MIME — the extension decides.
  assert.equal(classifyEvidence('', 'clip.mov'), 'video');
  assert.equal(classifyEvidence('application/octet-stream', 'sheet.xlsx'), 'document');
});

test('classification rejects executables and inline-scriptable types', () => {
  assert.equal(classifyEvidence('image/svg+xml', 'logo.svg'), null);
  assert.equal(classifyEvidence('text/html', 'page.html'), null);
  assert.equal(classifyEvidence('application/x-msdownload', 'setup.exe'), null);
  assert.equal(classifyEvidence('application/zip', 'bundle.zip'), null);
});

test('size caps are applied per kind', () => {
  assert.equal(checkEvidenceFile({ name: 'a.jpg', type: 'image/jpeg', size: 9 * 1024 * 1024 }).ok, true);

  const bigImage = checkEvidenceFile({ name: 'a.jpg', type: 'image/jpeg', size: 11 * 1024 * 1024 });
  assert.equal(bigImage.ok, false);
  assert.equal(bigImage.tooLarge, true);

  // A 20 MB video is fine where a 20 MB image is not.
  assert.equal(checkEvidenceFile({ name: 'a.mp4', type: 'video/mp4', size: 20 * 1024 * 1024 }).ok, true);
  assert.equal(checkEvidenceFile({ name: 'a.mp4', type: 'video/mp4', size: 26 * 1024 * 1024 }).ok, false);

  const badType = checkEvidenceFile({ name: 'a.exe', type: 'application/x-msdownload', size: 10 });
  assert.equal(badType.ok, false);
  assert.equal(badType.tooLarge, false);
});

test('magic bytes confirm the declared kind', () => {
  assert.equal(validateEvidenceBuffer(JPEG, 'image', 'image/jpeg').valid, true);
  assert.equal(validateEvidenceBuffer(PDF, 'document', 'application/pdf').valid, true);
  assert.equal(validateEvidenceBuffer(DOCX, 'document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').valid, true);
  assert.equal(validateEvidenceBuffer(LEGACY_DOC, 'document', 'application/msword').valid, true);
  assert.equal(validateEvidenceBuffer(WEBM, 'video', 'video/webm').valid, true);
  assert.equal(validateEvidenceBuffer(isoMedia('isom'), 'video', 'video/mp4').valid, true);
  assert.equal(validateEvidenceBuffer(isoMedia('qt  '), 'video', 'video/quicktime').valid, true);
});

test('magic bytes reject a payload masquerading as another kind', () => {
  const html = Buffer.from('<html><script>alert(1)</script></html>', 'latin1');
  assert.equal(validateEvidenceBuffer(html, 'document', 'application/pdf').valid, false);
  assert.equal(validateEvidenceBuffer(html, 'image', 'image/png').valid, false);
  // A real PDF cannot be smuggled in as a video and vice versa.
  assert.equal(validateEvidenceBuffer(PDF, 'video', 'video/mp4').valid, false);
  assert.equal(validateEvidenceBuffer(WEBM, 'image', 'image/webp').valid, false);
  // SVG stays blocked regardless of what the bytes look like.
  assert.equal(validateEvidenceBuffer(JPEG, 'image', 'image/svg+xml').valid, false);
});

test('plain-text documents are allowed only when the bytes are actually text', () => {
  const csv = Buffer.from('flight,station\nGA123,CGK\n', 'latin1');
  assert.equal(validateEvidenceBuffer(csv, 'document', 'text/csv').valid, true);

  const binary = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x00, 0x01]); // ELF executable
  assert.equal(validateEvidenceBuffer(binary, 'document', 'text/plain').valid, false);
});

test('RIFF sub-type separates WebP images from AVI video', () => {
  assert.equal(validateEvidenceBuffer(riff('WEBP'), 'image', 'image/webp').valid, true);
  assert.equal(validateEvidenceBuffer(riff('AVI '), 'video', 'video/x-msvideo').valid, true);
  assert.equal(validateEvidenceBuffer(riff('AVI '), 'image', 'image/webp').valid, false);
});

test('HEIC is detected as an image, not as MP4 video', () => {
  assert.equal(validateEvidenceBuffer(isoMedia('heic'), 'image', 'image/heic').valid, true);
  assert.equal(validateImageFile(isoMedia('heic'), 'image/heic').valid, true);
});

test('validateImageFile still rejects non-images', () => {
  assert.equal(validateImageFile(PDF, 'image/png').valid, false);
  assert.equal(validateImageFile(JPEG, 'image/svg+xml').valid, false);
  assert.equal(validateImageFile(JPEG, 'image/jpeg').valid, true);
});

test('stored extension never inherits an unlisted one from the filename', () => {
  assert.equal(extensionForUpload('document', 'text/plain', 'report.html'), 'txt');
  assert.equal(extensionForUpload('document', 'application/pdf', 'form.pdf'), 'pdf');
  assert.equal(extensionForUpload('video', 'video/quicktime', 'clip.mov'), 'mov');
  assert.equal(extensionForUpload('image', 'image/webp', 'photo.jpg'), 'jpg');
  assert.equal(extensionForUpload('video', 'video/mp4', 'noextension'), 'mp4');
});

test('stored URLs are classified back to a kind for rendering', () => {
  assert.equal(evidenceKindFromUrl('https://x.supabase.co/storage/v1/object/public/uploads/e/a-b.mp4'), 'video');
  assert.equal(evidenceKindFromUrl('https://x.supabase.co/storage/v1/object/public/uploads/e/a-b.webp'), 'image');
  assert.equal(evidenceKindFromUrl('https://x.supabase.co/storage/v1/object/public/uploads/e/a-b.pdf?token=1'), 'document');
  assert.equal(evidenceKindFromUrl('https://drive.google.com/file/d/abc/view'), null);
});
