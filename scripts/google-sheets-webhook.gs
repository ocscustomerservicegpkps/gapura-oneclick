/**
 * SETUP:
 * 1. Extensions -> Apps Script -> Project Settings -> Script Properties, add:
 *      WEBHOOK_URL    = https://<your-vercel-domain>/api/integrations/google-sheets/webhook
 *      WEBHOOK_SECRET = <same value as GOOGLE_SHEETS_WEBHOOK_SECRET in Vercel>
 * 2. Run installIrrsWebhookTriggers() once (also removes any legacy triggers).
 *    IMPORTANT: re-run this after pulling this update even if you installed
 *    triggers before — it now also installs an onChange trigger (deleting or
 *    inserting a row doesn't fire onEdit at all, so without onChange those
 *    changes were invisible to the webhook until the next full sync).
 * 3. Edit a row in "NON CARGO" or "CGO" and check Vercel function logs.
 */
const IRRS_TARGET_SHEETS = ['NON CARGO', 'CGO'];
const IRRS_MIN_NON_EMPTY_CELLS = 4;
const IRRS_DEBOUNCE_MS = 15000;
const IRRS_QUEUE_KEY = 'irrs_google_sheets_webhook_queue_v1';
const IRRS_LAST_SENT_PREFIX = 'irrs_google_sheets_last_sent_v1';
const IRRS_FLUSH_HANDLER = 'irrsFlushPendingWebhookQueue';
const IRRS_EDIT_HANDLER = 'irrsOnEditInstalled';
const IRRS_CHANGE_HANDLER = 'irrsOnChangeInstalled';
const IRRS_LEGACY_HANDLERS = ['onSheetEdit', 'scheduledSync'];
// onChange fires for structural edits (row/column insert or delete, sheet
// insert/delete) that onEdit never sees at all — Apps Script simply doesn't
// call onEdit for those. Without this, deleting a row in Sheets was
// completely invisible to the webhook and only ever caught by the next
// periodic full sync (daily cron or next login). EDIT/FORMAT/OTHER changeTypes
// are left alone since onEdit already covers content edits and formatting
// doesn't need a sync.
const IRRS_STRUCTURAL_CHANGE_TYPES = ['INSERT_ROW', 'REMOVE_ROW', 'INSERT_GRID', 'REMOVE_GRID'];
const IRRS_STRUCTURAL_QUEUE_KEY = '__structural__';

function installIrrsWebhookTriggers() {
  const spreadsheet = SpreadsheetApp.getActive();
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach((trigger) => {
    const handler = trigger.getHandlerFunction();
    if (
      handler === IRRS_EDIT_HANDLER ||
      handler === IRRS_CHANGE_HANDLER ||
      handler === IRRS_FLUSH_HANDLER ||
      IRRS_LEGACY_HANDLERS.indexOf(handler) !== -1
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(IRRS_EDIT_HANDLER)
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  ScriptApp.newTrigger(IRRS_CHANGE_HANDLER)
    .forSpreadsheet(spreadsheet)
    .onChange()
    .create();

  irrsVerifyWebhookConfig_();
}

function irrsOnEditInstalled(e) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;

  try {
    irrsQueueWebhookEvent_(e);
  } finally {
    lock.releaseLock();
  }
}

function irrsOnChangeInstalled(e) {
  const changeType = e && e.changeType;
  if (IRRS_STRUCTURAL_CHANGE_TYPES.indexOf(changeType) === -1) return;

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;

  try {
    // onChange gives no range/sheet for structural events (unlike onEdit), so
    // a deleted/inserted row can't be resolved to one scoped row-sync. Queue
    // an unscoped signal instead — the webhook already falls back to a full
    // reconciliation sync whenever sheetName/rowNumber are absent, which is
    // exactly what's needed to catch deletions and row-position shifts.
    const properties = PropertiesService.getDocumentProperties();
    const queue = irrsReadQueue_(properties);
    queue[IRRS_STRUCTURAL_QUEUE_KEY] = {
      triggerType: 'ON_CHANGE_' + changeType,
      changedAt: new Date().toISOString(),
    };
    properties.setProperty(IRRS_QUEUE_KEY, JSON.stringify(queue));
    irrsScheduleFlushIfNeeded_();
  } finally {
    lock.releaseLock();
  }
}

function irrsFlushPendingWebhookQueue() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return;

  try {
    const properties = PropertiesService.getDocumentProperties();
    const queue = irrsReadQueue_(properties);
    const pendingKeys = Object.keys(queue);

    if (pendingKeys.length === 0) {
      irrsDeleteFlushTriggers_();
      return;
    }

    const nextQueue = {};

    pendingKeys.forEach((key) => {
      const payload = queue[key];
      if (!payload) return;

      const response = irrsPostWebhook_(payload);
      const statusCode = response.getResponseCode();

      if (statusCode >= 200 && statusCode < 300) {
        // Structural (onChange) payloads have no sheetId/rowNumber to key a
        // last-sent dedupe entry on — nothing reads that entry for them, so
        // just skip the stamp instead of writing a bogus "undefined:undefined" key.
        if (payload.sheetId !== undefined && payload.rowNumber !== undefined) {
          properties.setProperty(
            irrsLastSentKey_(payload.sheetId, payload.rowNumber),
            String(payload.rowSignature || '')
          );
        }
        return;
      }

      nextQueue[key] = payload;
      Logger.log('[IRRS_WEBHOOK] Failed to deliver payload: %s %s', statusCode, response.getContentText());
    });

    if (Object.keys(nextQueue).length === 0) {
      properties.deleteProperty(IRRS_QUEUE_KEY);
      irrsDeleteFlushTriggers_();
      return;
    }

    properties.setProperty(IRRS_QUEUE_KEY, JSON.stringify(nextQueue));
    irrsDeleteFlushTriggers_();
    irrsScheduleFlushIfNeeded_();
  } finally {
    lock.releaseLock();
  }
}

function testIrrsWebhookForActiveRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();
  if (!range) {
    throw new Error('Select a row first.');
  }

  irrsQueueWebhookEvent_({ range: range });
  irrsFlushPendingWebhookQueue();
}

function irrsQueueWebhookEvent_(e) {
  const range = e && e.range ? e.range : null;
  if (!range) return;

  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  if (IRRS_TARGET_SHEETS.indexOf(sheetName) === -1) return;

  const sheetId = sheet.getSheetId();
  const lastColumn = sheet.getLastColumn();
  const properties = PropertiesService.getDocumentProperties();
  const queue = irrsReadQueue_(properties);
  let queueChanged = false;

  // A single paste (or fill-down) can span many rows at once — e.g. adding
  // several new records in one go — but onEdit fires exactly ONE event for
  // the whole range. Iterating just range.getRow() (the top row) silently
  // dropped every other row in the paste from the real-time sync path; they
  // only caught up on the next full sync.
  const startRow = Math.max(range.getRow(), 2);
  const endRow = range.getRow() + range.getNumRows() - 1;

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
    const rowValues = sheet.getRange(rowNumber, 1, 1, lastColumn).getDisplayValues()[0] || [];
    if (irrsCountNonEmptyCells_(rowValues) < IRRS_MIN_NON_EMPTY_CELLS) continue;

    const rowSignature = irrsBuildRowSignature_(sheet, rowNumber, rowValues);
    const lastSentSignature = properties.getProperty(irrsLastSentKey_(sheetId, rowNumber));
    if (lastSentSignature === rowSignature) continue;

    const queueKey = irrsQueueRowKey_(sheetId, rowNumber);
    queue[queueKey] = {
      triggerType: 'ON_EDIT',
      sheetId: sheetId,
      sheetName: sheetName,
      rowNumber: rowNumber,
      rowSignature: rowSignature,
      editedRange: range.getA1Notation(),
      editedAt: new Date().toISOString(),
      nonEmptyCellCount: irrsCountNonEmptyCells_(rowValues),
    };
    queueChanged = true;
  }

  if (!queueChanged) return;

  properties.setProperty(IRRS_QUEUE_KEY, JSON.stringify(queue));
  irrsScheduleFlushIfNeeded_();
}

function irrsScheduleFlushIfNeeded_() {
  const hasTrigger = ScriptApp.getProjectTriggers().some((trigger) => {
    return trigger.getHandlerFunction() === IRRS_FLUSH_HANDLER;
  });

  if (hasTrigger) return;

  ScriptApp.newTrigger(IRRS_FLUSH_HANDLER)
    .timeBased()
    .after(IRRS_DEBOUNCE_MS)
    .create();
}

function irrsDeleteFlushTriggers_() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === IRRS_FLUSH_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function irrsPostWebhook_(payload) {
  const config = irrsGetWebhookConfig_();
  return UrlFetchApp.fetch(config.url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'X-IRRS-Webhook-Secret': config.secret,
    },
    payload: JSON.stringify(payload),
  });
}

function irrsGetWebhookConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('WEBHOOK_SECRET');

  if (!url || !secret) {
    throw new Error('Missing WEBHOOK_URL or WEBHOOK_SECRET in Script Properties (Project Settings -> Script Properties).');
  }

  return { url: url, secret: secret };
}

function irrsVerifyWebhookConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('WEBHOOK_SECRET');

  if (!url) Logger.log('[IRRS_WEBHOOK] WARNING: WEBHOOK_URL is not set in Script Properties.');
  if (!secret) Logger.log('[IRRS_WEBHOOK] WARNING: WEBHOOK_SECRET is not set in Script Properties.');
  if (url && secret) Logger.log('[IRRS_WEBHOOK] Script Properties configured.');
}

function irrsReadQueue_(properties) {
  const raw = properties.getProperty(IRRS_QUEUE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    Logger.log('[IRRS_WEBHOOK] Failed to parse queue, resetting: %s', error);
    return {};
  }
}

function irrsBuildRowSignature_(sheet, rowNumber, rowValues) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      [sheet.getSheetId(), rowNumber, rowValues.join('|')].join(':')
    )
  );
}

function irrsQueueRowKey_(sheetId, rowNumber) {
  return [sheetId, rowNumber].join(':');
}

function irrsLastSentKey_(sheetId, rowNumber) {
  return [IRRS_LAST_SENT_PREFIX, sheetId, rowNumber].join(':');
}

function irrsCountNonEmptyCells_(rowValues) {
  return rowValues.filter((value) => String(value || '').trim() !== '').length;
}
