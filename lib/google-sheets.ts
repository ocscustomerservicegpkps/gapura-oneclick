
import 'server-only';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authClient: any = null;

function getGoogleAuth() {
  if (authClient) return authClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error('Missing Google Service Account credentials');
  }

  authClient = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
  });

  return authClient;
}

export async function getGoogleSheets() {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}
