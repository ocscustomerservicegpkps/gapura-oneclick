/**
 * Real-time sync trigger for the JOUMPA Google Sheet ("Form Responses 1").
 * This is a SEPARATE Apps Script project from scripts/google-sheets-webhook.gs
 * (NON CARGO / CGO) — install it in the JOUMPA spreadsheet itself, not the
 * IRRS one. Before this script existed, JOUMPA had no real-time sync path at
 * all: only the once-daily Vercel cron ever pulled Sheets edits into
 * Supabase, so editing the sheet directly (outside this app's own
 * create/update-status forms) could sit unsynced for up to 24 hours.
 *
 * Unlike the NON CARGO/CGO webhook, this doesn't scope to a single edited
 * row — JoumpaSyncService.sync() always does a full pull+push+orphan-delete
 * pass, and the sheet is small (dozens of rows), so every queued edit or
 * structural change just asks the server to run that same full sync.
 *
 * SETUP:
 * 1. Open the JOUMPA spreadsheet -> Extensions -> Apps Script.
 * 2. Project Settings -> Script Properties, add:
 *      WEBHOOK_URL    = https://<your-vercel-domain>/api/integrations/joumpa/webhook
 *      WEBHOOK_SECRET = <same value as GOOGLE_SHEETS_WEBHOOK_SECRET in Vercel>
 * 3. Run installJoumpaWebhookTriggers() once.
 * 4. Edit a row in "Form Responses 1" and check Vercel function logs.
 */
const JOUMPA_TARGET_SHEET = 'Form Responses 1';
const JOUMPA_DEBOUNCE_MS = 15000;
const JOUMPA_PING_KEY = 'joumpa_webhook_pending_ping_v1';
const JOUMPA_FLUSH_HANDLER = 'joumpaFlushPendingPing_';
const JOUMPA_EDIT_HANDLER = 'joumpaOnEditInstalled';
const JOUMPA_CHANGE_HANDLER = 'joumpaOnChangeInstalled';
// Only structural types matter for onChange — EDIT is already covered by
// onEdit, and FORMAT/OTHER changes don't need a sync.
const JOUMPA_STRUCTURAL_CHANGE_TYPES = ['INSERT_ROW', 'REMOVE_ROW', 'INSERT_GRID', 'REMOVE_GRID'];

function installJoumpaWebhookTriggers() {
  const spreadsheet = SpreadsheetApp.getActive();
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach((trigger) => {
    const handler = trigger.getHandlerFunction();
    if (
      handler === JOUMPA_EDIT_HANDLER ||
      handler === JOUMPA_CHANGE_HANDLER ||
      handler === JOUMPA_FLUSH_HANDLER
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(JOUMPA_EDIT_HANDLER)
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  ScriptApp.newTrigger(JOUMPA_CHANGE_HANDLER)
    .forSpreadsheet(spreadsheet)
    .onChange()
    .create();

  joumpaVerifyWebhookConfig_();
}

function joumpaOnEditInstalled(e) {
  const range = e && e.range ? e.range : null;
  if (!range) return;
  if (range.getSheet().getName() !== JOUMPA_TARGET_SHEET) return;
  if (range.getRow() < 2) return;

  joumpaQueuePing_();
}

function joumpaOnChangeInstalled(e) {
  const changeType = e && e.changeType;
  if (JOUMPA_STRUCTURAL_CHANGE_TYPES.indexOf(changeType) === -1) return;

  joumpaQueuePing_();
}

function joumpaQueuePing_() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;

  try {
    PropertiesService.getDocumentProperties().setProperty(JOUMPA_PING_KEY, new Date().toISOString());
    joumpaScheduleFlushIfNeeded_();
  } finally {
    lock.releaseLock();
  }
}

function joumpaScheduleFlushIfNeeded_() {
  const hasTrigger = ScriptApp.getProjectTriggers().some((trigger) => {
    return trigger.getHandlerFunction() === JOUMPA_FLUSH_HANDLER;
  });

  if (hasTrigger) return;

  ScriptApp.newTrigger(JOUMPA_FLUSH_HANDLER)
    .timeBased()
    .after(JOUMPA_DEBOUNCE_MS)
    .create();
}

function joumpaFlushPendingPing_() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;

  try {
    ScriptApp.getProjectTriggers().forEach((trigger) => {
      if (trigger.getHandlerFunction() === JOUMPA_FLUSH_HANDLER) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    const properties = PropertiesService.getDocumentProperties();
    const pending = properties.getProperty(JOUMPA_PING_KEY);
    if (!pending) return;

    const response = joumpaPostWebhook_();
    const statusCode = response.getResponseCode();

    if (statusCode >= 200 && statusCode < 300) {
      properties.deleteProperty(JOUMPA_PING_KEY);
    } else {
      Logger.log('[JOUMPA_WEBHOOK] Failed to deliver ping: %s %s', statusCode, response.getContentText());
      // Leave the pending marker set and try again on the next edit/flush
      // rather than looping retries here — the daily cron is still the
      // safety net if every retry attempt fails.
      joumpaScheduleFlushIfNeeded_();
    }
  } finally {
    lock.releaseLock();
  }
}

function joumpaPostWebhook_() {
  const config = joumpaGetWebhookConfig_();
  return UrlFetchApp.fetch(config.url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'X-IRRS-Webhook-Secret': config.secret,
    },
    payload: JSON.stringify({ source: 'joumpa-sheet', triggeredAt: new Date().toISOString() }),
  });
}

function joumpaGetWebhookConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('WEBHOOK_SECRET');

  if (!url || !secret) {
    throw new Error('Missing WEBHOOK_URL or WEBHOOK_SECRET in Script Properties (Project Settings -> Script Properties).');
  }

  return { url: url, secret: secret };
}

function joumpaVerifyWebhookConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('WEBHOOK_SECRET');

  if (!url) Logger.log('[JOUMPA_WEBHOOK] WARNING: WEBHOOK_URL is not set in Script Properties.');
  if (!secret) Logger.log('[JOUMPA_WEBHOOK] WARNING: WEBHOOK_SECRET is not set in Script Properties.');
  if (url && secret) Logger.log('[JOUMPA_WEBHOOK] Script Properties configured.');
}
