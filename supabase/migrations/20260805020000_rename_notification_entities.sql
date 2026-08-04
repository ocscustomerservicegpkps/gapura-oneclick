-- Retire the "IRRS" wording from notification entity keys. These values are
-- referenced by lib/notifications.ts and shown in the admin notification
-- settings, so code and data are renamed together. Delivery fingerprints are
-- untouched, so existing de-duplication history stays valid.
UPDATE public.notification_recipients
SET entity = CASE entity
    WHEN 'IRRS_NEW_RECORD'    THEN 'REPORT_NEW_RECORD'
    WHEN 'IRRS_REPORT_CLOSED' THEN 'REPORT_CLOSED'
    WHEN 'IRRS_TEST_EMAIL'    THEN 'SMTP_TEST'
    WHEN 'IRRS_NEW_REPORT'    THEN 'REPORT_NEW'
    WHEN 'IRRS_SLA_BREACH'    THEN 'REPORT_SLA_BREACH'
    WHEN 'IRRS_STATUS_CHANGE' THEN 'REPORT_STATUS_CHANGE'
    WHEN 'IRRS_COMMENT'       THEN 'REPORT_COMMENT'
    ELSE entity
END
WHERE entity LIKE 'IRRS!_%' ESCAPE '!';

-- Division-scoped variants (e.g. IRRS_NEW_REPORT_OCS) keep their suffix.
UPDATE public.notification_recipients
SET entity = 'REPORT_' || substring(entity from 6)
WHERE entity LIKE 'IRRS!_%' ESCAPE '!';

UPDATE public.notification_delivery_log
SET entity = CASE entity
    WHEN 'IRRS_NEW_RECORD'    THEN 'REPORT_NEW_RECORD'
    WHEN 'IRRS_REPORT_CLOSED' THEN 'REPORT_CLOSED'
    WHEN 'IRRS_TEST_EMAIL'    THEN 'SMTP_TEST'
    WHEN 'IRRS_NEW_REPORT'    THEN 'REPORT_NEW'
    WHEN 'IRRS_SLA_BREACH'    THEN 'REPORT_SLA_BREACH'
    WHEN 'IRRS_STATUS_CHANGE' THEN 'REPORT_STATUS_CHANGE'
    WHEN 'IRRS_COMMENT'       THEN 'REPORT_COMMENT'
    ELSE 'REPORT_' || substring(entity from 6)
END
WHERE entity LIKE 'IRRS!_%' ESCAPE '!';
