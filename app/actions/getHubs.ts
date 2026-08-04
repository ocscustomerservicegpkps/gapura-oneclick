
'use server';

import { getGoogleSheets } from '@/lib/google-sheets';

export async function getAvailableHubs() {
  try {
    const sheets = await getGoogleSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID is not defined');
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'Data for Vlookup'!C3:C",
    });

    const rows = response.data.values || [];

    const hubs = rows
      .map((row) => row[0])
      .filter((hub) => hub && hub.trim() !== '');

    const uniqueHubs = Array.from(new Set(hubs));

    return uniqueHubs.sort();
  } catch (error) {
    console.error('Failed to fetch HUBs:', error);
    return [];
  }
}
