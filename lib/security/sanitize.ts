
const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
};

const HTML_ENTITY_REGEX = /[&<>"'/]/g;

function escapeHtml(str: string): string {
    if (!str) return '';
    return String(str).replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] || char);
}

export function sanitizeTableCell(value: unknown): string {
    if (value === null || value === undefined) return '-';
    const str = String(value);

    return escapeHtml(str);
}

// Cells that start with one of these are interpreted as a formula by Google
// Sheets / Excel when written with valueInputOption USER_ENTERED. Untrusted
// report text (e.g. from the public form) must never become a live formula —
// `=IMPORTDATA(...)`, `=HYPERLINK(...)`, `+`, `-`, `@`, and tab/CR smuggling
// are all CSV-injection vectors. Prefix a leading apostrophe so Sheets treats
// the whole cell as literal text. Non-string values pass through untouched.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function escapeSpreadsheetCell<T>(value: T): T | string {
    if (typeof value !== 'string') return value;
    if (value.length === 0) return value;
    if (FORMULA_TRIGGER.test(value)) {
        return `'${value}`;
    }
    return value;
}
