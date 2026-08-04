#!/usr/bin/env node
console.log('Starting script...');
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    throw new Error('Missing Google Service Account credentials (GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY)');
  }
  return new google.auth.JWT({ email, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

function parseWriteMapping() {
  const svcPath = path.join(ROOT, 'lib', 'services', 'reports-service.ts');
  const text = fs.readFileSync(svcPath, 'utf8');
  const start = text.indexOf('const WRITE_MAPPING');
  if (start === -1) return {};
  const end = text.indexOf('};', start);
  const block = text.slice(start, end + 2);
  const map = {};
  const re = /([a-zA-Z0-9_]+)\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block))) {
    map[m[1]] = m[2];
  }
  return map;
}

function inferType(value) {
  if (value === null || value === undefined) return 'empty';
  const v = String(value).trim();
  if (!v) return 'empty';
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v)) return 'date';
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(v)) return 'date';
  if (!isNaN(Number(v)) && v.match(/^-?\d+(\.\d+)?$/)) return 'number';
  if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))) {
    try { JSON.parse(v); return 'json'; } catch {}
  }
  return 'string';
}

async function fetchSheetValues(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

function analyzeTypes(headers, rows) {
  const result = {};
  headers.forEach((h, i) => {
    const samples = rows.map(r => r[i]).filter(v => v !== undefined && v !== '');
    const types = new Set(samples.slice(0, 1000).map(inferType));
    result[h] = {
      types: Array.from(types),
      sample: samples.slice(0, 5)
    };
  });
  return result;
}

function compareMapping(headers, writeMap) {
  const norm = s => s.trim().toLowerCase();
  const headersNorm = headers.map(norm);
  const headerSet = new Set(headersNorm);
  const mappingHeaders = Object.values(writeMap).map(norm);
  const mapHeaderSet = new Set(mappingHeaders);

  const headersWithoutMapping = headers.filter((h, idx) => !mapHeaderSet.has(headersNorm[idx]));
  const mappingWithoutHeader = Object.entries(writeMap)
    .filter(([, hh]) => !headerSet.has(norm(hh)))
    .map(([k, hh]) => ({ prop: k, header: hh }));

  return { headersWithoutMapping, mappingWithoutHeader };
}

async function main() {
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  if (!SPREADSHEET_ID) {
    console.error('Missing GOOGLE_SHEET_ID');
    process.exit(1);
  }
  const SHEETS = (process.env.DEBUG_SHEETS || 'NON CARGO,CGO').split(',').map(s => s.trim());
  const writeMap = parseWriteMapping();

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('=== Google Sheets Diagnostics ===');
  console.log(`Spreadsheet: ${SPREADSHEET_ID}`);
  console.log(`Sheets: ${SHEETS.join(', ')}`);
  console.log('');

  for (const sheetName of SHEETS) {
    console.log(`--- Sheet: ${sheetName} ---`);
    const headerRow = await fetchSheetValues(sheets, SPREADSHEET_ID, `${sheetName}!1:1`);
    const headers = (headerRow[0] || []).map(h => String(h).trim()).filter(Boolean);
    console.log(`Headers (${headers.length}):`);
    console.log(headers.join(' | '));

    const allValues = await fetchSheetValues(sheets, SPREADSHEET_ID, `${sheetName}`);
    const dataRows = allValues.slice(1);
    console.log(`Rows: ${dataRows.length}`);

    // Map rows to objects for easier inspection
    const objects = dataRows.map((r, idx) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] ?? ''; });
      o.__rowNumber = idx + 2; // account for header row
      return o;
    });

    // Print sample rows by default; print ALL when DEBUG_SHEETS_PRINT_ALL=1
    const printAll = (process.env.DEBUG_SHEETS_PRINT_ALL || '').trim() === '1';
    if (printAll) {
      console.log('All rows (object view):');
      console.log(JSON.stringify(objects, null, 2));
    } else {
      const SAMPLE_N = Number(process.env.DEBUG_SHEETS_SAMPLE || 10);
      console.log(`Sample first ${SAMPLE_N} rows (set DEBUG_SHEETS_PRINT_ALL=1 to print all):`);
      console.log(JSON.stringify(objects.slice(0, SAMPLE_N), null, 2));
    }

    const typeInfo = analyzeTypes(headers, dataRows);
    const coverage = compareMapping(headers, writeMap);

    console.log('Coverage:');
    console.log(`- Headers without mapping (${coverage.headersWithoutMapping.length}): ${coverage.headersWithoutMapping.join(' | ') || '-'}`);
    console.log(`- Mapping without header (${coverage.mappingWithoutHeader.length}):`);
    if (coverage.mappingWithoutHeader.length) {
      coverage.mappingWithoutHeader.slice(0, 50).forEach(({ prop, header }) => {
        console.log(`  • ${prop} -> ${header}`);
      });
    } else {
      console.log('  -');
    }

    const showCols = ['Status', 'Severity', 'Report Category', 'Area', 'Terminal Area Category', 'Apron Area Category', 'General Category', 'ESKLASI DIVISI', 'Target Division'];
    for (const col of showCols) {
      const idx = headers.findIndex(h => h.trim().toLowerCase() === col.trim().toLowerCase());
      if (idx !== -1) {
        const vals = dataRows.map(r => r[idx]).filter(Boolean).map(v => String(v).trim());
        const freq = {};
        vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
        console.log(`${col} filled rows: ${vals.length}/${dataRows.length}`);
        console.log(`${col} top values: ${top.map(([v, c]) => `${v}(${c})`).join(', ') || '-'}`);
      }
    }

    const sample = Object.fromEntries(Object.entries(typeInfo).map(([k, v]) => [k, v.types.join(', ')]));
    console.log('Type inference (first N rows):');
    Object.entries(sample).slice(0, 30).forEach(([k, t]) => console.log(`  ${k}: ${t}`));
    console.log('');
  }
}

main().catch(err => {
  console.error('Diagnostics failed:', err.message);
  process.exit(1);
});
