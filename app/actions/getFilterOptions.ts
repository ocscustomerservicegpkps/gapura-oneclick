'use server';

import { getGoogleSheets } from '@/lib/google-sheets';

export async function getAvailableBranches(): Promise<string[]> {
  try {
    const sheets = await getGoogleSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) return [];

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Data for Vlookup'!A1:C",
    });

    const rows = res.data.values || [];
    if (rows.length < 2) return [];

    const headers = (rows[0] as string[]).map((h) => String(h).trim().toLowerCase());
    const branchIdx = headers.findIndex((h) => h === 'branch' || h.includes('cabang'));
    const idx = branchIdx !== -1 ? branchIdx : 1;

    return Array.from(
      new Set(
        rows.slice(1)
          .map((row) => String(row[idx] || '').trim().toUpperCase())
          .filter((b) => b && b !== '-' && b.length > 0)
      )
    ).sort();
  } catch (error) {
    console.error('[getAvailableBranches] Failed to load branches from Google Sheets:', error);
    return [];
  }
}
