import type { EvidenceKind } from '@/lib/evidence-mime';

type Signature = { mime: string; bytes: number[]; offset: number };

const SIGNATURES: Signature[] = [
    // Images
    { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF], offset: 0 },
    { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 },
    { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 }, // GIF8
    { mime: 'image/bmp', bytes: [0x42, 0x4D], offset: 0 }, // BM
    { mime: 'image/tiff', bytes: [0x49, 0x49, 0x2A, 0x00], offset: 0 }, // TIFF little-endian
    { mime: 'image/tiff', bytes: [0x4D, 0x4D, 0x00, 0x2A], offset: 0 }, // TIFF big-endian

    // Video
    { mime: 'video/webm', bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 }, // EBML (WebM/Matroska)
    { mime: 'video/mpeg', bytes: [0x00, 0x00, 0x01, 0xBA], offset: 0 }, // MPEG program stream
    { mime: 'video/mpeg', bytes: [0x00, 0x00, 0x01, 0xB3], offset: 0 }, // MPEG video stream

    // Documents
    { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2D], offset: 0 }, // %PDF-
    { mime: 'application/zip', bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0 }, // OOXML (docx/xlsx/pptx)
    { mime: 'application/zip', bytes: [0x50, 0x4B, 0x05, 0x06], offset: 0 }, // empty archive
    { mime: 'application/zip', bytes: [0x50, 0x4B, 0x07, 0x08], offset: 0 }, // spanned archive
    { mime: 'application/x-ole-storage', bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], offset: 0 }, // legacy .doc/.xls/.ppt
    { mime: 'application/rtf', bytes: [0x7B, 0x5C, 0x72, 0x74, 0x66], offset: 0 }, // {\rtf
];

const DOCUMENT_CONTAINERS = new Set(['application/pdf', 'application/zip', 'application/x-ole-storage', 'application/rtf']);

/** ISO base media brands that are stills, not video, despite sharing the `ftyp` header with MP4. */
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'avif']);

function matchesAt(buffer: Buffer, bytes: number[], offset: number): boolean {
    if (buffer.length < offset + bytes.length) return false;
    for (let i = 0; i < bytes.length; i++) {
        if (buffer[offset + i] !== bytes[i]) return false;
    }
    return true;
}

function ascii(buffer: Buffer, start: number, length: number): string {
    return buffer.subarray(start, start + length).toString('latin1');
}

function detectMimeType(buffer: Buffer): string | null {
    // RIFF containers all start with the same four bytes — the sub-type at
    // byte 8 is what separates a WebP image from an AVI video. Detecting on
    // the prefix alone made every AVI look like a WebP.
    if (matchesAt(buffer, [0x52, 0x49, 0x46, 0x46], 0)) {
        const subType = ascii(buffer, 8, 4);
        if (subType === 'WEBP') return 'image/webp';
        if (subType === 'AVI ') return 'video/x-msvideo';
        return null;
    }

    // ISO base media (`ftyp` at byte 4) covers MP4, MOV, 3GP — and HEIC, which
    // is an image sharing the same container.
    if (matchesAt(buffer, [0x66, 0x74, 0x79, 0x70], 4)) {
        const brand = ascii(buffer, 8, 4).trim().toLowerCase();
        if (HEIF_BRANDS.has(brand)) return 'image/heic';
        if (brand === 'qt') return 'video/quicktime';
        if (brand.startsWith('3g')) return 'video/3gpp';
        return 'video/mp4';
    }

    for (const sig of SIGNATURES) {
        if (matchesAt(buffer, sig.bytes, sig.offset)) return sig.mime;
    }
    return null;
}

/** CSV/TXT carry no magic bytes, so "is it plausibly text" is the only check available. */
function looksLikeText(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, 1024);
    for (const byte of sample) {
        // NUL and other C0 controls (bar tab/LF/CR/FF/ESC) mean binary payload.
        if (byte === 0) return false;
        if (byte < 0x09 || (byte > 0x0D && byte < 0x20 && byte !== 0x1B)) return false;
    }
    return true;
}

function kindOfDetected(detected: string): EvidenceKind | null {
    if (detected.startsWith('image/')) return 'image';
    if (detected.startsWith('video/')) return 'video';
    if (DOCUMENT_CONTAINERS.has(detected)) return 'document';
    return null;
}

export function validateImageFile(buffer: Buffer, claimedType: string): { valid: boolean; error?: string } {
    if (!claimedType.startsWith('image/')) {
        return { valid: false, error: 'Claimed type is not an image' };
    }
    // SVG is markup, not a raster image — it executes script when served inline.
    if (claimedType === 'image/svg+xml') {
        return { valid: false, error: 'SVG uploads are not allowed' };
    }

    const detected = detectMimeType(buffer);
    if (!detected || !detected.startsWith('image/')) {
        return {
            valid: false,
            error: `File content does not match claimed type. Claimed: ${claimedType}, Detected: ${detected || 'unknown'}`,
        };
    }

    return { valid: true };
}

/**
 * Confirms the bytes on the wire actually are the *kind* of file the request
 * claims. Deliberately checks the kind rather than the exact MIME: a `.docx`
 * is a zip and a `.mov` may be branded `isom`, so byte-exact matching would
 * reject legitimate uploads while adding nothing — what matters is that an
 * executable or HTML payload cannot arrive dressed as evidence.
 */
export function validateEvidenceBuffer(
    buffer: Buffer,
    kind: EvidenceKind,
    claimedType: string,
): { valid: boolean; error?: string } {
    if (claimedType === 'image/svg+xml') {
        return { valid: false, error: 'SVG uploads are not allowed' };
    }

    const detected = detectMimeType(buffer);

    if (!detected) {
        // Plain-text documents are the only allowed type without a signature.
        const isTextDocument = kind === 'document' && claimedType.startsWith('text/');
        if (isTextDocument && looksLikeText(buffer)) return { valid: true };
        return { valid: false, error: `Unrecognised file content for claimed type ${claimedType}` };
    }

    const detectedKind = kindOfDetected(detected);
    if (detectedKind !== kind) {
        return {
            valid: false,
            error: `File content does not match claimed type. Claimed: ${claimedType} (${kind}), Detected: ${detected}`,
        };
    }

    return { valid: true };
}
