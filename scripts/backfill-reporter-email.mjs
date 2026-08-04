#!/usr/bin/env node
import 'dotenv/config';
import { google } from 'googleapis';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.split('=');
      const key = k.replace(/^--/, '');
      if (v !== undefined) args[key] = v;
      else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          args[key] = next;
          i++;
        } else {
          args[key] = true;
        }
      }
    }
  }
  return args;
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY || '';
  const key = privateKeyRaw.replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY');
  }
  return new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function getColLetter(index) {
  let col = '';
  let n = index;
  while (n >= 0) {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  }
  return col;
}

async function main() {
  const args = parseArgs(process.argv);
  const email = args.email || args.e;
  const name = args.name || args.n;
  const sheetsList = (args.sheets || 'NON CARGO,CGO').split(',').map(s => s.trim()).filter(Boolean);
  const dryRun = args.apply ? false : true;

  if (!email || !name) {
    console.error('Usage: node scripts/backfill-reporter-email.mjs --email <email> --name "<full name>" [--sheets "NON CARGO,CGO"] [--apply]');
    process.exit(1);
  }

  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  if (!SPREADSHEET_ID) {
    console.error('Missing GOOGLE_SHEET_ID');
    process.exit(1);
  }

  const auth = getAuth();
  const api = google.sheets({ version: 'v4', auth });
  const targetName = norm(name);

  const UPDATED = [];
  for (const sheetName of sheetsList) {
    const headerRes = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`,
    });
    const headers = (headerRes.data.values?.[0] || []).map(h => String(h).trim());
    const headersNorm = headers.map(norm);

    const emailCandidates = ['reporter email', 'email', 'reporter_email'];
    const nameCandidates = ['report by', 'report_by', 'pelapor', 'reporter', 'report_by_name'];

    const emailIdx = headersNorm.findIndex(h => emailCandidates.includes(h));
    const nameIdx = headersNorm.findIndex(h => nameCandidates.includes(h));

    if (emailIdx === -1) {
      console.log(`[${sheetName}] Skip: tidak menemukan kolom "Reporter Email" / "Email"`);
      continue;
    }
    if (nameIdx === -1) {
      console.log(`[${sheetName}] Peringatan: tidak menemukan kolom nama pelapor (Report By/Pelapor).`);
    }

    const allRes = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}`,
    });
    const rows = (allRes.data.values || []).slice(1); // skip header
    if (!rows.length) {
      console.log(`[${sheetName}] Tidak ada baris data`);
      continue;
    }

    const updates = [];
    rows.forEach((row, i) => {
      const currentEmail = row[emailIdx] || '';
      if (currentEmail && String(currentEmail).trim()) return;
      if (nameIdx === -1) return;
      const rowName = norm(row[nameIdx] || '');
      if (!rowName) return;

      // Match exact or contains to be more tolerant on spacing/casing
      const isMatch = rowName === targetName || rowName.includes(targetName) || targetName.includes(rowName);
      if (isMatch) {
        const rowNumber = i + 2; // +1 header, +1 1-based index
        const colLetter = getColLetter(emailIdx);
        const range = `${sheetName}!${colLetter}${rowNumber}`;
        updates.push({ range, values: [[email]] });
        UPDATED.push({ sheet: sheetName, row: rowNumber, name: row[nameIdx] || '(unknown)' });
      }
    });

    if (!updates.length) {
      console.log(`[${sheetName}] Tidak ada baris yang cocok untuk diisi email "${email}"`);
      continue;
    }

    if (dryRun) {
      console.log(`[${sheetName}] DRY-RUN: ${updates.length} baris akan diisi kolom "${headers[emailIdx]}" dengan "${email}"`);
    } else {
      await api.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });
      console.log(`[${sheetName}] Diupdate ${updates.length} baris`);
    }
  }

  console.log(`\nRingkasan: ${UPDATED.length} baris terpilih`);
  UPDATED.slice(0, 20).forEach(u => console.log(`- ${u.sheet} R${u.row} • ${u.name}`));
  if (UPDATED.length > 20) console.log(`… dan ${UPDATED.length - 20} lainnya`);

  if (dryRun) {
    console.log('\nMode: DRY-RUN. Tambahkan --apply untuk menulis perubahan.');
  }
}

main().catch(err => {
  console.error('Backfill gagal:', err.message || err);
  process.exit(1);
});

