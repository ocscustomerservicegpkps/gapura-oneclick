const DRIVE_FILE_PATTERNS = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
  /docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/i,
];

function extractGoogleDriveFileId(url: string) {
  const value = String(url || '').trim();
  if (!value) return null;

  for (const pattern of DRIVE_FILE_PATTERNS) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname === 'drive.google.com') {
      return parsed.searchParams.get('id');
    }
  } catch {
    return null;
  }

  return null;
}

export function getEvidencePreviewUrl(url: string) {
  const fileId = extractGoogleDriveFileId(url);
  return fileId ? `/api/evidence/drive/${encodeURIComponent(fileId)}` : url;
}
