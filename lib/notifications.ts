
import 'server-only';

import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { emailLogoAttachment, renderEmail, renderEmailText, type EmailOptions } from '@/lib/email-template';
import { reportDetailCta } from '@/lib/report-links';
import { buildReportFingerprint, isNewRecordCategory, resolveReportCategory, resolveReportBranch } from '@/lib/report-fingerprint';
import type { Report } from '@/types';

interface NotificationPayload {

    type: 'NEW_REPORT' | 'STATUS_CHANGE' | 'SLA_BREACH' | 'COMMENT';

    reportId: string;

    targetDivision?: string;

    title: string;

    message: string;

    priority?: string;

    slaDeadline?: string;
}

interface EmailAttachment {
    filename: string;
    content: Buffer;
    contentType: string;
}

interface EmailMessage {

    entity: string;

    subject: string;

    text: string;

    html?: string;

    recipients: string[];

    fingerprintBase: string;

    payload?: Record<string, unknown>;

    /** Extra parts beyond the inline logo, e.g. finalized report documents. */
    attachments?: EmailAttachment[];
}

type NewRecordNotificationSource = 'internal' | 'public' | 'batch' | 'sheets-sync';

interface TestEmailOptions {

    to: string;

    subject?: string;

    text?: string;

    requestedBy?: string;
}

let emailTransporter: nodemailer.Transporter | null = null;

function smtpConfig() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || '465');
    const secure = process.env.SMTP_SECURE
        ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
        : port === 465;
    const user = process.env.GMAIL_SMTP_USER || process.env.SMTP_USER || '';
    const pass = process.env.GMAIL_SMTP_APP_PASSWORD || process.env.SMTP_PASS || '';

    return { host, port, secure, user, pass };
}

function notificationFrom() {
    const configuredFrom = process.env.NOTIFICATION_FROM_EMAIL?.trim();
    if (configuredFrom) return configuredFrom;

    const smtpUser = process.env.GMAIL_SMTP_USER || process.env.SMTP_USER || '';
    return smtpUser ? `OneKlik <${smtpUser}>` : 'OneKlik <notifications@localhost>';
}

function hashFingerprint(value: string): string {
    return crypto.createHash('sha1').update(value).digest('hex');
}

async function reserveDelivery(
    fingerprint: string,
    entity: string,
    recipientEmail: string,
    subject: string,
    payload: Record<string, unknown>
) {
    const { error } = await supabaseAdmin
        .from('notification_delivery_log')
        .insert({
            fingerprint,
            entity,
            channel: 'EMAIL',
            recipient_email: recipientEmail,
            subject,
            payload,
            status: 'pending',
        });

    if (!error) return true;
    if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
    ) {
        // Fingerprint already reserved. Only dedupe against a prior *successful*
        // send — 'failed'/'skipped' rows must not permanently block retries.
        const { data: existing } = await supabaseAdmin
            .from('notification_delivery_log')
            .select('status')
            .eq('fingerprint', fingerprint)
            .single();

        if (existing && existing.status !== 'sent') {
            const { error: resetError } = await supabaseAdmin
                .from('notification_delivery_log')
                .update({ status: 'pending', error_message: null, payload, subject })
                .eq('fingerprint', fingerprint)
                .neq('status', 'sent');
            return !resetError;
        }

        return false;
    }

    console.warn('[NOTIFICATIONS] Failed to reserve delivery fingerprint, continuing without strict dedupe:', error);
    return true;
}

async function finalizeDelivery(
    fingerprint: string,
    status: 'sent' | 'skipped' | 'failed',
    errorMessage?: string
) {
    const updates: Record<string, unknown> = {
        status,
        sent_at: new Date().toISOString(),
    };
    if (errorMessage) updates.error_message = errorMessage;

    const { error } = await supabaseAdmin
        .from('notification_delivery_log')
        .update(updates)
        .eq('fingerprint', fingerprint);

    if (error) {
        console.warn('[NOTIFICATIONS] Failed to finalize delivery log:', error);
    }
}

async function sendEmail(message: EmailMessage) {
    const { host, port, secure, user, pass } = smtpConfig();

    if (!user || !pass) {
        console.warn('[NOTIFICATIONS] SMTP credentials missing (GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD), email notification logged but cannot be sent.');
    } else if (!emailTransporter) {
        emailTransporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user,
                pass,
            },
        });
    }

    for (const recipient of message.recipients) {
        const fingerprint = hashFingerprint(`${message.fingerprintBase}:${recipient}`);
        const reserved = await reserveDelivery(
            fingerprint,
            message.entity,
            recipient,
            message.subject,
            message.payload || {}
        );

        if (!reserved) continue;

        try {
            if (!user || !pass || !emailTransporter) {
                await finalizeDelivery(fingerprint, 'skipped', 'SMTP credentials are missing');
                continue;
            }

            await emailTransporter.sendMail({
                from: notificationFrom(),
                to: recipient,
                subject: message.subject,
                text: message.text,
                html: message.html,
                // Inline mark, so the masthead is never a broken image.
                attachments: message.html
                    ? [emailLogoAttachment(), ...(message.attachments || [])]
                    : message.attachments,
            });

            await finalizeDelivery(fingerprint, 'sent');
        } catch (error) {
            console.error('[NOTIFICATIONS] Email send failed:', error);
            await finalizeDelivery(
                fingerprint,
                'failed',
                error instanceof Error ? error.message : 'Unknown send error'
            );
        }
    }
}

async function getNotificationRecipients(entity: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
        .from('notification_recipients')
        .select('recipient_email')
        .eq('entity', entity)
        .eq('channel', 'EMAIL')
        .eq('enabled', true);

    if (error) {
        console.warn('[NOTIFICATIONS] Failed to read notification recipients:', error);
    }

    const fromDb = ((data || []) as Array<{ recipient_email?: string | null }>)
        .map((item) => String(item.recipient_email || '').trim())
        .filter(Boolean);

    if (fromDb.length > 0) {
        return fromDb;
    }

    const fallbackEmails = (
        process.env.DEFAULT_NOTIFICATION_EMAIL || 
        process.env.GMAIL_SMTP_USER || 
        ''
    ).split(',').map(e => e.trim()).filter(Boolean);

    if (fallbackEmails.length > 0) {
        return fallbackEmails;
    }

    if (entity === 'OSC') {
        const envRecipients = (process.env.OSC_NOTIFICATION_EMAIL || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        return envRecipients;
    }

    console.warn(`[NOTIFICATIONS] No recipients configured for ${entity} (DB empty and no fallback env found).`);
    return [];
}

function reportBranch(report: Partial<Report>): string {
    return resolveReportBranch(report) || '-';
}

/** CTA only when we can address the app; a dead button is worse than none. */
function dashboardLink(path: string, label: string): { label: string; url: string } | undefined {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!raw) return undefined;
    const base = (raw.startsWith('http') ? raw : `https://${raw}`).replace(/\/+$/, '');
    return { label, url: `${base}${path}` };
}

function sourceLabel(source: NewRecordNotificationSource): string {
    switch (source) {
        case 'public':
            return 'Public form';
        case 'batch':
            return 'Batch import';
        case 'sheets-sync':
            return 'Google Sheets sync';
        case 'internal':
        default:
            return 'System input';
    }
}

export async function notifyNewRecordEmail(
    report: Partial<Report>,
    source: NewRecordNotificationSource
) {
    const category = resolveReportCategory(report);
    if (!isNewRecordCategory(report)) {
        return;
    }

    const recipients = await getNotificationRecipients('REPORT_NEW_RECORD');
    if (recipients.length === 0) {
        return;
    }

    const isUrgent = (report.severity || '').toLowerCase() === 'high';
    const severityPrefix = isUrgent ? ' [URGENT]' : '';
    const subject = `[OneClick]${severityPrefix} New record: ${report.title || report.report || 'Untitled'}`;
    const branchName = reportBranch(report);
    const reporter = report.reporter_name || report.reporter_email || '-';
    const severityLabel = report.severity ? String(report.severity).toUpperCase() : '-';


    const content: EmailOptions = {
        status: isUrgent ? 'Urgent — new record' : 'New record',
        reference: String(report.original_id || report.id || ''),
        title: String(report.title || report.report || 'Untitled record'),
        lead: 'A new record landed on OneClick and is ready for review.',
        preheader: `${severityLabel} severity · ${branchName}`,
        tone: isUrgent ? 'critical' : 'brand',
        rows: [
            { label: 'Category', value: category || '-' },
            { label: 'Severity', value: severityLabel },
            { label: 'Branch', value: branchName },
            { label: 'Reporter', value: reporter },
            { label: 'Source', value: sourceLabel(source) },
            { label: 'Sheet', value: report.source_sheet || '-' },
            { label: 'Sheet ID', value: String(report.original_id || report.id || '-') },
        ],
        cta: dashboardLink('/dashboard/analyst', 'Open in OneClick'),
    };

    const sourceFingerprint = String(report.source_fingerprint || buildReportFingerprint(report));
    await sendEmail({
        entity: 'REPORT_NEW_RECORD',
        recipients,
        subject,
        text: renderEmailText(content),
        html: renderEmail(content),
        fingerprintBase: `report-new-record:${sourceFingerprint}`,
        payload: {
            source,
            report_id: report.id || report.original_id || null,
            sheet_id: report.original_id || report.id || null,
            source_fingerprint: sourceFingerprint,
            title: report.title || report.report || null,
            category,
            branch: branchName,
            source_sheet: report.source_sheet || null,
        },
    });
}

interface NewRegistrationNotice {
    fullName: string;
    email: string;
    nik: string;
    phone: string;
    unit: string | null;
    position: string | null;
    stationId: string;
    userId: string;
}

/**
 * Tells the branch managers of a station that someone registered there and is
 * waiting for approval. Managers can only approve STAFF_CABANG at their own
 * station, so recipients are scoped to that station.
 */
export async function notifyNewStaffRegistration(notice: NewRegistrationNotice) {
    const { data: managers, error } = await supabaseAdmin
        .from('users')
        .select('email, full_name')
        .eq('station_id', notice.stationId)
        .eq('role', 'MANAGER_CABANG')
        .eq('status', 'active');

    if (error) {
        console.warn('[NOTIFICATIONS] Failed to look up station managers:', error);
        return;
    }

    const recipients = (managers || [])
        .map((manager) => String(manager.email || '').trim())
        .filter((address) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));

    if (recipients.length === 0) return;

    const { data: station } = await supabaseAdmin
        .from('stations')
        .select('code, name')
        .eq('id', notice.stationId)
        .single();

    const stationLabel = station ? `${station.code} — ${station.name}` : notice.stationId;
    const subject = `[OneClick] New staff registration at ${station?.code || notice.stationId}: ${notice.fullName}`;

    const content: EmailOptions = {
        status: 'Awaiting approval',
        reference: station?.code || notice.stationId,
        title: `${notice.fullName} registered at ${station?.code || notice.stationId}`,
        lead: 'A new staff account was created at your station. It stays inactive until you approve it.',
        preheader: `${notice.fullName} · ${stationLabel}`,
        rows: [
            { label: 'Name', value: notice.fullName },
            { label: 'Email', value: notice.email },
            { label: 'NIK', value: notice.nik },
            { label: 'Phone', value: notice.phone },
            { label: 'Work unit', value: notice.unit || '-' },
            { label: 'Position', value: notice.position || '-' },
            { label: 'Station', value: stationLabel },
        ],
        cta: dashboardLink('/dashboard/admin/users?status=pending', 'Review this account'),
        note: `You are receiving this because you are a branch manager at ${station?.code || notice.stationId}.`,
    };

    await sendEmail({
        entity: 'USER_REGISTRATION',
        recipients,
        subject,
        text: renderEmailText(content),
        html: renderEmail(content),
        // One notice per registered account per manager, even if the
        // registration handler is retried.
        fingerprintBase: `user-registration:${notice.userId}`,
        payload: {
            user_id: notice.userId,
            email: notice.email,
            station_id: notice.stationId,
            position: notice.position,
        },
    });
}

export type AccountStatusEvent = 'approved' | 'rejected' | 'suspended' | 'reactivated';

interface AccountStatusNotice {
    email: string;
    fullName: string | null;
    role: string | null;
    stationCode?: string | null;
    event: AccountStatusEvent;
    /** Distinguishes repeat transitions so a later change still sends. */
    occurredAt?: string;
}

const ACCOUNT_STATUS_COPY: Record<
    AccountStatusEvent,
    { status: string; subject: string; title: string; lead: string; note: string; tone: EmailOptions['tone'] }
> = {
    approved: {
        status: 'Account active',
        subject: 'Your OneClick account is approved',
        title: 'Your account is approved',
        lead: 'Your registration has been reviewed and approved. You can sign in to OneClick now.',
        note: 'Sign in with the email and password you registered with. Forgot it? Use "Forgot password?" on the sign-in screen.',
        tone: 'brand',
    },
    reactivated: {
        status: 'Account active',
        subject: 'Your OneClick account has been reactivated',
        title: 'Your account is active again',
        lead: 'An administrator restored access to your OneClick account. You can sign in again.',
        note: 'If you did not expect this change, contact your station administrator.',
        tone: 'brand',
    },
    rejected: {
        status: 'Registration rejected',
        subject: 'Your OneClick registration was not approved',
        title: 'Your registration was not approved',
        lead: 'Your OneClick registration has been reviewed and was not approved, so the account cannot be used to sign in.',
        note: 'If you believe this is a mistake, contact your station manager or administrator to review your details and register again.',
        tone: 'alert',
    },
    suspended: {
        status: 'Account suspended',
        subject: 'Your OneClick account has been suspended',
        title: 'Your account has been suspended',
        lead: 'Access to your OneClick account has been suspended by an administrator. Sign-in is disabled until it is restored.',
        note: 'Contact your station administrator if you need this account reinstated.',
        tone: 'critical',
    },
};

/** Tells an account holder that an admin changed their access. */
export async function notifyAccountStatusChange(notice: AccountStatusNotice) {
    const recipient = String(notice.email || '').trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return;

    const copy = ACCOUNT_STATUS_COPY[notice.event];
    const content: EmailOptions = {
        status: copy.status,
        reference: notice.stationCode || undefined,
        title: copy.title,
        lead: copy.lead,
        tone: copy.tone,
        rows: [
            { label: 'Name', value: notice.fullName || '-' },
            { label: 'Email', value: recipient },
            { label: 'Role', value: (notice.role || '-').replace(/_/g, ' ') },
            { label: 'Station', value: notice.stationCode || '-' },
        ],
        cta: signInCta(),
        note: copy.note,
    };

    await sendEmail({
        entity: 'ACCOUNT_STATUS',
        recipients: [recipient],
        subject: `[OneClick] ${copy.subject}`,
        text: renderEmailText(content),
        html: renderEmail(content),
        fingerprintBase: `account-status:${recipient}:${notice.event}:${notice.occurredAt || ''}`,
        payload: { event: notice.event, email: recipient, role: notice.role || null },
    });
}

function signInCta(): { label: string; url: string } | undefined {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!raw) return undefined;
    const base = (raw.startsWith('http') ? raw : `https://${raw}`).replace(/\/+$/, '');
    return { label: 'Go to OneClick', url: `${base}/auth/login` };
}

interface SubmittedReportNotice {
    reportId: string;
    recipientEmail: string;
    recipientRole?: string | null;
    reporterName?: string | null;
    title?: string | null;
    category?: string | null;
    severity?: string | null;
    station?: string | null;
    incidentDate?: string | null;
    flightNumber?: string | null;
    description?: string | null;
    /** Finalized DOCX/PDF, attached so the reporter keeps their own copy. */
    documents?: EmailAttachment[];
}

/**
 * Confirms a submission back to the reporter, with the documents they just
 * finalized attached.
 */
export async function notifySubmittedReport(notice: SubmittedReportNotice) {
    const recipient = String(notice.recipientEmail || '').trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return;

    const title = notice.title || 'Irregularity report';
    const attachmentNames = (notice.documents || []).map((file) => file.filename);

    const content: EmailOptions = {
        status: 'Submitted',
        reference: notice.reportId,
        title: 'Your report has been submitted',
        lead: `"${title}" is recorded in OneClick and is now with the handling team.`,
        preheader: `Report ${notice.reportId} recorded`,
        rows: [
            { label: 'Report ID', value: notice.reportId },
            { label: 'Title', value: title },
            { label: 'Category', value: notice.category || '-' },
            { label: 'Severity', value: notice.severity ? String(notice.severity).toUpperCase() : '-' },
            { label: 'Station', value: notice.station || '-' },
            { label: 'Incident date', value: notice.incidentDate || '-' },
            { label: 'Flight', value: notice.flightNumber || '-' },
            { label: 'Reported by', value: notice.reporterName || '-' },
            { label: 'Documents', value: attachmentNames.length > 0 ? attachmentNames.join(', ') : null },
        ],
        cta: reportDetailCta(notice.recipientRole, notice.reportId, 'View report'),
        note: attachmentNames.length > 0
            ? 'Your edited report documents are attached to this email. Keep them for your own records.'
            : 'You will be notified here when the handling team responds.',
    };

    await sendEmail({
        entity: 'REPORT_SUBMITTED',
        recipients: [recipient],
        subject: `[OneClick] Report submitted: ${title}`,
        text: renderEmailText(content),
        html: renderEmail(content),
        fingerprintBase: `report-submitted:${notice.reportId}:${recipient}`,
        payload: {
            report_id: notice.reportId,
            documents: attachmentNames,
        },
        attachments: notice.documents,
    });
}

export interface CommentRecipient {
    email: string;
    fullName?: string | null;
    role?: string | null;
    /** Owner of the report vs. someone who commented on it earlier. */
    relation: 'owner' | 'participant';
}

interface CommentNotice {
    reportId: string;
    reportTitle?: string | null;
    authorName: string;
    authorRole?: string | null;
    excerpt: string;
    commentId: string;
    attachmentCount?: number;
    recipients: CommentRecipient[];
}

/**
 * Emails a new comment to the report owner and to everyone already in the
 * thread. Sent per recipient because the CTA has to point at the report detail
 * page that the recipient's own role is allowed to open.
 */
export async function notifyReportCommentEmail(notice: CommentNotice) {
    const seen = new Set<string>();
    const trimmedExcerpt = notice.excerpt.length > 400
        ? `${notice.excerpt.slice(0, 400).trimEnd()}…`
        : notice.excerpt;

    for (const recipient of notice.recipients) {
        const email = String(recipient.email || '').trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
        if (seen.has(email.toLowerCase())) continue;
        seen.add(email.toLowerCase());

        const isOwner = recipient.relation === 'owner';
        const title = notice.reportTitle || 'Irregularity report';

        const content: EmailOptions = {
            status: isOwner ? 'New comment' : 'Thread reply',
            reference: notice.reportId,
            title: isOwner
                ? `New comment on your report`
                : `New reply on a report you commented on`,
            lead: isOwner
                ? `${notice.authorName} commented on "${title}".`
                : `${notice.authorName} added a comment to "${title}", a report you are following.`,
            preheader: `${notice.authorName}: ${trimmedExcerpt.slice(0, 90)}`,
            quote: {
                attribution: `${notice.authorName}${notice.authorRole ? ` · ${notice.authorRole.replace(/_/g, ' ')}` : ''}`,
                text: trimmedExcerpt || '(attachment only, no message)',
            },
            rows: [
                { label: 'Report ID', value: notice.reportId },
                { label: 'Report', value: title },
                {
                    label: 'Attachments',
                    value: notice.attachmentCount ? `${notice.attachmentCount} file(s)` : null,
                },
            ],
            cta: reportDetailCta(recipient.role, notice.reportId, 'Open the thread'),
            note: isOwner
                ? 'Reply from the report page so the whole handling team sees your response.'
                : 'You are receiving this because you commented on this report earlier.',
        };

        await sendEmail({
            entity: isOwner ? 'REPORT_COMMENT_OWNER' : 'REPORT_COMMENT_PARTICIPANT',
            recipients: [email],
            subject: `[OneClick] New comment on ${title}`,
            text: renderEmailText(content),
            html: renderEmail(content),
            fingerprintBase: `report-comment:${notice.commentId}:${email}`,
            payload: {
                report_id: notice.reportId,
                comment_id: notice.commentId,
                relation: recipient.relation,
            },
        });
    }
}

export async function notifyReportClosedEmail(report: Partial<Report>) {
    const recipient = String(report.reporter_email || '').trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        return;
    }

    const reportId = String(report.id || report.original_id || report.sheet_id || 'unknown');
    const title = report.title || report.report || report.description || 'OneClick Report';
    const closedAt = new Date().toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
    });
    const resolutionNotes = report.action_taken || report.gapura_kps_action_taken || report.preventive_action || report.remarks_gapura_kps || '-';

    const subject = `[OneClick] Report closed: ${title}`;
    const content: EmailOptions = {
        status: 'Closed',
        reference: reportId,
        title: 'Your report has been closed',
        lead: `"${title}" is now closed. Here is what was recorded against it.`,
        preheader: `Closed on ${closedAt}`,
        rows: [
            { label: 'Report ID', value: reportId },
            { label: 'Status', value: 'CLOSED' },
            { label: 'Closure date', value: closedAt },
            { label: 'Branch', value: reportBranch(report) },
            { label: 'Flight', value: report.flight_number || '-' },
            { label: 'Resolution summary', value: String(resolutionNotes) },
        ],
        note: 'Something still unresolved? Reply to the team that handled your report, or file a new one in OneClick.',
    };

    await sendEmail({
        entity: 'REPORT_CLOSED',
        recipients: [recipient],
        subject,
        text: renderEmailText(content),
        html: renderEmail(content),
        fingerprintBase: `report-closed:${reportId}`,
        payload: {
            report_id: report.id || null,
            sheet_id: report.original_id || report.sheet_id || null,
            title,
            status: 'CLOSED',
            branch: reportBranch(report),
        },
    });
}

export async function sendTestEmail(options: TestEmailOptions) {
    const to = String(options.to || '').trim();
    if (!to) {
        throw new Error('Recipient email is required');
    }

    const subject = options.subject || '[OneClick] SMTP test';
    const content: EmailOptions = {
        status: 'Delivery test',
        title: 'SMTP is working',
        lead: options.text || 'This test message was sent from OneClick, so mail delivery is configured correctly.',
        rows: [
            { label: 'Transport', value: 'Gmail SMTP' },
            { label: 'Sent at', value: new Date().toISOString() },
            { label: 'Requested by', value: options.requestedBy || '-' },
        ],
    };

    await sendEmail({
        entity: 'SMTP_TEST',
        recipients: [to],
        subject,
        text: renderEmailText(content),
        html: renderEmail(content),
        fingerprintBase: `smtp-test:${to}:${Date.now()}`,
        payload: {
            type: 'smtp-test',
            requested_by: options.requestedBy || null,
        },
    });
}

const NOTIFICATION_ENTITY: Record<NotificationPayload['type'], string> = {
    NEW_REPORT: 'REPORT_NEW',
    SLA_BREACH: 'REPORT_SLA_BREACH',
    STATUS_CHANGE: 'REPORT_STATUS_CHANGE',
    COMMENT: 'REPORT_COMMENT',
};

async function sendNotification(payload: NotificationPayload): Promise<void> {
    const entity = payload.targetDivision
        ? `${NOTIFICATION_ENTITY[payload.type]}_${payload.targetDivision.toUpperCase()}`
        : NOTIFICATION_ENTITY[payload.type];

    const recipients = await getNotificationRecipients(entity);
    if (recipients.length === 0) {
        return;
    }

    const subject = `[OneClick] ${payload.title}`;
    const toneByType: Record<NotificationPayload['type'], EmailOptions['tone']> = {
        NEW_REPORT: 'brand',
        SLA_BREACH: 'critical',
        STATUS_CHANGE: 'brand',
        COMMENT: 'brand',
    };
    const statusByType: Record<NotificationPayload['type'], string> = {
        NEW_REPORT: 'New report',
        SLA_BREACH: 'SLA breached',
        STATUS_CHANGE: 'Status change',
        COMMENT: 'New comment',
    };

    const content: EmailOptions = {
        status: statusByType[payload.type],
        reference: payload.reportId,
        title: payload.title,
        lead: payload.message,
        tone: toneByType[payload.type],
        rows: [
            { label: 'Report ID', value: payload.reportId },
            { label: 'Division', value: payload.targetDivision || null },
            { label: 'Priority', value: payload.priority || null },
            { label: 'SLA deadline', value: payload.slaDeadline || null },
        ],
        cta: dashboardLink(`/dashboard/reports/${payload.reportId}`, 'Open report'),
    };

    await sendEmail({
        entity,
        recipients,
        subject,
        text: renderEmailText(content),
        html: renderEmail(content),
        fingerprintBase: `report-${payload.type.toLowerCase()}:${payload.reportId}:${payload.message}`,
        payload: {
            type: payload.type,
            report_id: payload.reportId,
            target_division: payload.targetDivision || null,
            priority: payload.priority || null,
            sla_deadline: payload.slaDeadline || null,
        },
    });
}

export async function notifyNewReport(
    reportId: string,
    targetDivision: string,
    title: string,
    priority: string,
    slaDeadline: string
): Promise<void> {
    await sendNotification({
        type: 'NEW_REPORT',
        reportId,
        targetDivision,
        title,
        message: `Laporan baru masuk untuk divisi ${targetDivision}`,
        priority,
        slaDeadline,
    });
}

export async function notifySLABreach(
    reportId: string,
    title: string,
    hoursOverdue: number
): Promise<void> {
    await sendNotification({
        type: 'SLA_BREACH',
        reportId,
        title,
        message: `SLA terlewati ${hoursOverdue} jam untuk laporan: ${title}`,
    });
}

export async function notifyStatusChange(
    reportId: string,
    title: string,
    oldStatus: string,
    newStatus: string
): Promise<void> {
    await sendNotification({
        type: 'STATUS_CHANGE',
        reportId,
        title,
        message: `Status berubah dari ${oldStatus} ke ${newStatus}`,
    });
}
