import 'server-only';

import { EMAIL_LOGO_BASE64, EMAIL_LOGO_HEIGHT, EMAIL_LOGO_WIDTH } from '@/lib/email-logo';

/**
 * Shared shell for every outbound OneClick email.
 *
 * The world is an operations document, not a marketing card: a masthead with
 * filed metadata, a severity rule that runs the full width instead of a status
 * pill, ruled manifest rows, and monospaced values the way ground staff read
 * them on flight paperwork. Status is a field in the header, never a floating
 * label above the headline.
 *
 * Client constraints that shape the markup: no flexbox or grid, <style> is only
 * reliable for mobile media queries, inline SVG is stripped by Gmail, and
 * anything wider than 600px re-flows. So the layout is tables with inline
 * styles, every rule and tick is a real table cell, and the logo travels with
 * the message as an inline Content-ID attachment so it renders even where a
 * client blocks remote images.
 */

/** Content-ID the header <img> points at; senders must attach a part with it. */
export const EMAIL_LOGO_CID = 'oneclick-gapura-logo';

/** Attach on every send so the masthead mark is always present. */
export function emailLogoAttachment() {
    return {
        filename: 'gapura.png',
        content: Buffer.from(EMAIL_LOGO_BASE64, 'base64'),
        contentType: 'image/png',
        cid: EMAIL_LOGO_CID,
    };
}

const INK = {
    strong: '#0b1620',
    body: '#3f4a52',
    muted: '#77848c',
    faint: '#9aa5ac',
    rule: '#dde3e1',
    ruleSoft: '#eaefed',
    sheet: '#ffffff',
    canvas: '#eceeed',
    panel: '#f7f9f8',
} as const;

export type EmailTone = 'brand' | 'alert' | 'critical';

const TONES: Record<EmailTone, { rule: string; ink: string; wash: string }> = {
    brand: { rule: '#047857', ink: '#046c4e', wash: '#f0f7f3' },
    alert: { rule: '#b45309', ink: '#a15c07', wash: '#fdf6ec' },
    critical: { rule: '#be123c', ink: '#b01235', wash: '#fdf1f3' },
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',ui-monospace,Menlo,Consolas,'Liberation Mono',monospace";

export interface EmailRow {
    label: string;
    value: string | null | undefined;
}

export interface EmailOptions {
    /** Inbox preview line. Falls back to the lead paragraph. */
    preheader?: string;
    /** Filed in the masthead as the document's state — not a label above the title. */
    status?: string;
    /** Second masthead field, e.g. a station or report reference. */
    reference?: string;
    title: string;
    lead: string;
    rows?: EmailRow[];
    /** Large monospaced value — one-time codes and nothing else. */
    code?: string;
    codeCaption?: string;
    cta?: { label: string; url: string };
    /** Someone else's words, quoted verbatim — a comment, a remark, a reason. */
    quote?: { attribution?: string; text: string };
    /** Fine print under the body, e.g. why this landed in their inbox. */
    note?: string;
    tone?: EmailTone;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Jakarta time — the operational clock every station works to. */
function filedAt(): string {
    return new Date()
        .toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jakarta',
        })
        .toUpperCase()
        .replace(',', '') + ' WIB';
}

function label(text: string, color: string): string {
    return `<span style="font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${color};">${escapeHtml(text)}</span>`;
}

function masthead(options: EmailOptions, tone: (typeof TONES)[EmailTone]): string {
    const mark = `<img src="cid:${EMAIL_LOGO_CID}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" alt="Gapura Angkasa" style="display:block;border:0;outline:none;text-decoration:none;width:${EMAIL_LOGO_WIDTH}px;height:${EMAIL_LOGO_HEIGHT}px;" />`;

    const fields = [
        options.status ? { key: 'Status', value: options.status, color: tone.ink } : null,
        options.reference ? { key: 'Reference', value: options.reference, color: INK.body } : null,
        { key: 'Filed', value: filedAt(), color: INK.body },
    ].filter(Boolean) as Array<{ key: string; value: string; color: string }>;

    const fieldRows = fields
        .map(
            (field, index) => `
                <tr>
                    <td align="right" style="padding:${index === 0 ? '0' : '7px'} 0 0 0;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${INK.faint};">${escapeHtml(field.key)}</td>
                </tr>
                <tr>
                    <td align="right" style="padding:2px 0 0 0;font-family:${MONO};font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.04em;color:${field.color};">${escapeHtml(field.value.toUpperCase())}</td>
                </tr>`
        )
        .join('');

    return `
    <tr>
        <td class="pad" style="padding:28px 34px 22px 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                <tr>
                    <td class="stack" valign="top" width="55%" style="vertical-align:top;">
                        ${mark}
                        <div style="padding-top:9px;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${INK.muted};">OneClick</div>
                    </td>
                    <td class="stack" valign="top" width="45%" style="vertical-align:top;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                            ${fieldRows}
                        </table>
                    </td>
                </tr>
            </table>
        </td>
    </tr>

    <tr>
        <td style="padding:0;font-size:0;line-height:0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                <tr><td height="3" bgcolor="${tone.rule}" style="height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
            </table>
        </td>
    </tr>`;
}

/**
 * Values that are identifiers, codes, dates or statuses read better — and
 * align — in monospace; prose does not. This is the deterministic split:
 * anything that is only caps, digits and separators is data.
 */
function isDataLike(value: string): boolean {
    return value.length <= 48 && /^[A-Z0-9][A-Z0-9 ._:\/+()-]*$/.test(value);
}

/** Manifest rows: ruled, label left in small caps, value in data or prose type. */
function renderRows(rows: EmailRow[]): string {
    const visible = rows.filter(
        (row) => row.value !== null && row.value !== undefined && String(row.value).trim() !== ''
    );
    if (visible.length === 0) return '';

    const cells = visible
        .map((row) => {
            const value = String(row.value);
            const valueStyle = isDataLike(value)
                ? `font-family:${MONO};font-size:13px;line-height:19px;font-weight:600;letter-spacing:0.01em;`
                : `font-family:${SANS};font-size:14px;line-height:21px;font-weight:600;`;
            return `
            <tr>
                <td class="row-label" width="150" valign="top" style="border-top:1px solid ${INK.ruleSoft};padding:11px 14px 11px 0;font-family:${SANS};font-size:10px;line-height:18px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${INK.muted};">${escapeHtml(row.label)}</td>
                <td class="row-value" valign="top" style="border-top:1px solid ${INK.ruleSoft};padding:11px 0 11px 0;${valueStyle}color:${INK.strong};">${escapeHtml(value)}</td>
            </tr>`;
        })
        .join('');

    return `
    <tr>
        <td class="pad" style="padding:8px 34px 0 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                ${cells}
                <tr><td colspan="2" height="1" bgcolor="${INK.ruleSoft}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
            </table>
        </td>
    </tr>`;
}

/** The code sits in a ruled field, top and bottom lines in the tone colour. */
function renderCode(code: string, caption: string | undefined, tone: (typeof TONES)[EmailTone]): string {
    return `
    <tr>
        <td class="pad" style="padding:10px 34px 0 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${tone.wash};">
                <tr><td height="2" bgcolor="${tone.rule}" style="height:2px;line-height:2px;font-size:0;">&nbsp;</td></tr>
                <tr>
                    <td align="center" style="padding:8px 16px 0 16px;">${label('Verification code', tone.ink)}</td>
                </tr>
                <tr>
                    <td align="center" style="padding:8px 16px 0 16px;">
                        <div style="font-family:${MONO};font-size:38px;line-height:46px;font-weight:700;letter-spacing:0.22em;color:${INK.strong};text-indent:0.22em;">${escapeHtml(code)}</div>
                    </td>
                </tr>
                ${caption
                    ? `<tr><td align="center" style="padding:2px 20px 16px 20px;font-family:${SANS};font-size:12px;line-height:18px;color:${tone.ink};">${escapeHtml(caption)}</td></tr>`
                    : '<tr><td style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>'}
                <tr><td height="1" bgcolor="${tone.rule}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
            </table>
        </td>
    </tr>`;
}

/** Verbatim text from a person: prose type, set apart from the manifest. */
function renderQuote(quote: { attribution?: string; text: string }, tone: (typeof TONES)[EmailTone]): string {
    return `
    <tr>
        <td class="pad" style="padding:6px 34px 0 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${tone.wash};">
                <tr><td height="2" bgcolor="${tone.rule}" style="height:2px;line-height:2px;font-size:0;">&nbsp;</td></tr>
                ${quote.attribution
                    ? `<tr><td style="padding:16px 22px 0 22px;">${label(quote.attribution, tone.ink)}</td></tr>`
                    : ''}
                <tr>
                    <td style="padding:${quote.attribution ? '8px' : '18px'} 22px 18px 22px;font-family:${SANS};font-size:15px;line-height:25px;color:${INK.strong};">${escapeHtml(quote.text).replace(/\n/g, '<br />')}</td>
                </tr>
            </table>
        </td>
    </tr>`;
}

/** Bulletproof button: the fill lives on a td so Outlook keeps it. */
function renderCta(cta: { label: string; url: string }, tone: (typeof TONES)[EmailTone]): string {
    return `
    <tr>
        <td class="pad" style="padding:26px 34px 0 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                    <td bgcolor="${tone.rule}" style="border-radius:3px;">
                        <a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(cta.label)}</a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>`;
}

export function renderEmail(options: EmailOptions): string {
    const tone = TONES[options.tone || 'brand'];
    const preheader = options.preheader || options.lead;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(options.title)}</title>
<style>
@media only screen and (max-width:480px) {
    .shell { padding: 18px 10px !important; }
    .pad { padding-left: 22px !important; padding-right: 22px !important; }
    .stack { display: block !important; width: 100% !important; }
    .stack + .stack { padding-top: 18px !important; }
    .stack td[align="right"] { text-align: left !important; }
    .row-label { display: block !important; width: 100% !important; padding: 11px 0 0 0 !important; }
    .row-value { display: block !important; width: 100% !important; padding: 3px 0 11px 0 !important; border-top: 0 !important; }
    .title { font-size: 23px !important; line-height: 30px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${INK.canvas};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preheader)}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${INK.canvas};">
<tr>
<td class="shell" align="center" style="padding:34px 16px;">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:collapse;background-color:${INK.sheet};border:1px solid ${INK.rule};">

        ${masthead(options, tone)}

        <tr>
            <td class="pad" style="padding:30px 34px 0 34px;">
                <h1 class="title" style="margin:0;font-family:${SANS};font-size:27px;line-height:34px;font-weight:700;letter-spacing:-0.035em;color:${INK.strong};">${escapeHtml(options.title)}</h1>
            </td>
        </tr>

        <tr>
            <td class="pad" style="padding:13px 34px 20px 34px;">
                <p style="margin:0;font-family:${SANS};font-size:15px;line-height:25px;color:${INK.body};">${escapeHtml(options.lead)}</p>
            </td>
        </tr>

        ${options.code ? renderCode(options.code, options.codeCaption, tone) : ''}
        ${options.quote ? renderQuote(options.quote, tone) : ''}
        ${options.rows ? renderRows(options.rows) : ''}
        ${options.cta ? renderCta(options.cta, tone) : ''}

        ${options.note
            ? `<tr>
            <td class="pad" style="padding:24px 34px 0 34px;">
                <p style="margin:0;font-family:${SANS};font-size:12px;line-height:19px;color:${INK.muted};">${escapeHtml(options.note)}</p>
            </td>
        </tr>`
            : ''}

        <tr>
            <td class="pad" style="padding:30px 34px 0 34px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                    <tr><td height="1" bgcolor="${INK.rule}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
                </table>
            </td>
        </tr>

        <tr>
            <td class="pad" style="padding:16px 34px 28px 34px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                    <tr>
                        <td class="stack" valign="top" width="50%" style="vertical-align:top;">${label('OneClick · Gapura Angkasa', INK.muted)}</td>
                        <td class="stack" align="right" valign="top" width="50%" style="vertical-align:top;font-family:${SANS};font-size:11px;line-height:17px;color:${INK.faint};">Generated automatically. Replies to this address are not monitored.</td>
                    </tr>
                </table>
            </td>
        </tr>

    </table>

</td>
</tr>
</table>
</body>
</html>`;
}

/** Plain-text twin of {@link renderEmail}, for clients that refuse HTML. */
export function renderEmailText(options: EmailOptions): string {
    const lines: string[] = [];

    if (options.status) lines.push(`STATUS: ${options.status.toUpperCase()}`);
    if (options.reference) lines.push(`REFERENCE: ${options.reference}`);
    lines.push(`FILED: ${filedAt()}`, '', options.title, '', options.lead);

    if (options.code) {
        lines.push('', `VERIFICATION CODE: ${options.code}`);
        if (options.codeCaption) lines.push(options.codeCaption);
    }

    if (options.quote) {
        lines.push('', options.quote.attribution ? `${options.quote.attribution}:` : 'Message:', options.quote.text);
    }

    const rows = (options.rows || []).filter(
        (row) => row.value !== null && row.value !== undefined && String(row.value).trim() !== ''
    );
    if (rows.length > 0) {
        lines.push('');
        for (const row of rows) lines.push(`${row.label}: ${row.value}`);
    }

    if (options.cta) lines.push('', `${options.cta.label}: ${options.cta.url}`);
    if (options.note) lines.push('', options.note);

    lines.push(
        '',
        '--',
        'OneClick · Gapura Angkasa',
        'Generated automatically. Replies to this address are not monitored.'
    );
    return lines.join('\n');
}
