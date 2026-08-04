import type { ReactNode } from 'react';

type MarkdownSegment =
    | { type: 'text'; content: string }
    | { type: 'code'; content: string; language: string };

function splitFencedCode(content: string): MarkdownSegment[] {
    const segments: MarkdownSegment[] = [];
    const pattern = /```([\w-]+)?\s*\n?([\s\S]*?)```/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
        if (match.index > cursor) {
            segments.push({ type: 'text', content: content.slice(cursor, match.index) });
        }

        segments.push({
            type: 'code',
            language: match[1] || '',
            content: match[2].trimEnd(),
        });
        cursor = match.index + match[0].length;
    }

    if (cursor < content.length) {
        segments.push({ type: 'text', content: content.slice(cursor) });
    }

    return segments.length > 0 ? segments : [{ type: 'text', content }];
}

function safeHref(href: string): string | null {
    return /^(https?:\/\/|mailto:)/i.test(href) ? href : null;
}

function renderInline(text: string, keyPrefix: string): ReactNode {
    const tokenPattern = /(`[^`\n]+`|\*\*.+?\*\*|__.+?__|\*[^*\n]+?\*|_[^_\n]+?_|!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|\[E\d+])/g;
    const nodes: ReactNode[] = [];
    let cursor = 0;
    let index = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(text)) !== null) {
        if (match.index > cursor) {
            nodes.push(text.slice(cursor, match.index));
        }

        const token = match[0];
        const key = `${keyPrefix}-${index++}`;

        if (token.startsWith('`')) {
            nodes.push(
                <code key={key} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.88em] text-slate-800">
                    {token.slice(1, -1)}
                </code>,
            );
        } else if (token.startsWith('**') || token.startsWith('__')) {
            nodes.push(
                <strong key={key} className="font-semibold text-slate-950">
                    {token.slice(2, -2)}
                </strong>,
            );
        } else if (token.startsWith('*') || token.startsWith('_')) {
            nodes.push(
                <em key={key} className="italic text-slate-700">
                    {token.slice(1, -1)}
                </em>,
            );
        } else if (/^\[E\d+]$/.test(token)) {
            nodes.push(
                <span key={key} className="font-mono text-[0.78em] font-semibold text-emerald-700">
                    {token}
                </span>,
            );
        } else {
            const imageMatch = token.match(/^!\[([^\]]*)]\(([^)]+)\)$/);
            const linkMatch = token.match(/^\[([^\]]+)]\(([^)]+)\)$/);
            const label = imageMatch?.[1] || linkMatch?.[1] || token;
            const href = safeHref(imageMatch?.[2] || linkMatch?.[2] || '');

            nodes.push(
                href ? (
                    <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800"
                    >
                        {label}
                    </a>
                ) : (
                    <span key={key}>{label}</span>
                ),
            );
        }

        cursor = match.index + token.length;
    }

    if (cursor < text.length) {
        nodes.push(text.slice(cursor));
    }

    return nodes;
}

function parseTableCells(line: string): string[] {
    return line
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split('|')
        .map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isBlockStart(lines: string[], index: number): boolean {
    const line = lines[index]?.trim() || '';
    const nextLine = lines[index + 1] || '';

    return (
        !line
        || /^#{1,3}\s+/.test(line)
        || /^[-*]\s+/.test(line)
        || /^\d+\.\s+/.test(line)
        || /^>\s?/.test(line)
        || /^-{3,}$/.test(line)
        || (line.includes('|') && isTableDivider(nextLine))
    );
}

function renderTextSegment(content: string, segmentIndex: number): ReactNode[] {
    const lines = content.split(/\r?\n/);
    const elements: ReactNode[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index].trim();
        const key = `segment-${segmentIndex}-${index}`;

        if (!line) {
            index += 1;
            continue;
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            const level = heading[1].length;
            const children = renderInline(heading[2], `${key}-heading`);

            if (level === 1) {
                elements.push(<h2 key={key} className="pt-2 text-xl font-semibold text-slate-950">{children}</h2>);
            } else if (level === 2) {
                elements.push(<h3 key={key} className="pt-2 text-lg font-semibold text-slate-950">{children}</h3>);
            } else {
                elements.push(<h4 key={key} className="pt-1 text-base font-semibold text-slate-900">{children}</h4>);
            }

            index += 1;
            continue;
        }

        if (line.includes('|') && isTableDivider(lines[index + 1] || '')) {
            const headers = parseTableCells(line);
            const rows: string[][] = [];
            index += 2;

            while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                rows.push(parseTableCells(lines[index]));
                index += 1;
            }

            elements.push(
                <div key={key} className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead className="bg-slate-50 text-slate-800">
                            <tr>
                                {headers.map((header, columnIndex) => (
                                    <th key={`${key}-head-${columnIndex}`} className="border-b border-slate-200 px-3 py-2 font-semibold">
                                        {renderInline(header, `${key}-head-${columnIndex}`)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row, rowIndex) => (
                                <tr key={`${key}-row-${rowIndex}`}>
                                    {row.map((cell, columnIndex) => (
                                        <td key={`${key}-cell-${rowIndex}-${columnIndex}`} className="px-3 py-2 align-top text-slate-700">
                                            {renderInline(cell, `${key}-cell-${rowIndex}-${columnIndex}`)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>,
            );
            continue;
        }

        if (/^[-*]\s+/.test(line)) {
            const items: string[] = [];

            while (index < lines.length) {
                const item = lines[index].trim();
                if (/^[-*]\s+/.test(item)) {
                    items.push(item.replace(/^[-*]\s+/, ''));
                    index += 1;
                    continue;
                }
                if (!item && /^[-*]\s+/.test(lines[index + 1]?.trim() || '')) {
                    index += 1;
                    continue;
                }
                break;
            }

            elements.push(
                <ul key={key} className="ml-5 list-disc space-y-1.5 marker:text-emerald-600">
                    {items.map((item, itemIndex) => (
                        <li key={`${key}-${itemIndex}`} className="pl-1">
                            {renderInline(item, `${key}-${itemIndex}`)}
                        </li>
                    ))}
                </ul>,
            );
            continue;
        }

        if (/^\d+\.\s+/.test(line)) {
            const items: string[] = [];
            const start = Number(line.match(/^(\d+)\./)?.[1] || '1');

            while (index < lines.length) {
                const item = lines[index].trim();
                if (/^\d+\.\s+/.test(item)) {
                    items.push(item.replace(/^\d+\.\s+/, ''));
                    index += 1;
                    continue;
                }
                if (!item && /^\d+\.\s+/.test(lines[index + 1]?.trim() || '')) {
                    index += 1;
                    continue;
                }
                break;
            }

            elements.push(
                <ol key={key} start={start} className="ml-5 list-decimal space-y-2 marker:font-semibold marker:text-emerald-700">
                    {items.map((item, itemIndex) => (
                        <li key={`${key}-${itemIndex}`} className="pl-1">
                            {renderInline(item, `${key}-${itemIndex}`)}
                        </li>
                    ))}
                </ol>,
            );
            continue;
        }

        if (/^>\s?/.test(line)) {
            const quoteLines: string[] = [];

            while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
                quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
                index += 1;
            }

            elements.push(
                <blockquote key={key} className="border-l-2 border-emerald-500 pl-4 text-slate-600">
                    {renderInline(quoteLines.join(' '), `${key}-quote`)}
                </blockquote>,
            );
            continue;
        }

        if (/^-{3,}$/.test(line)) {
            elements.push(<hr key={key} className="border-slate-200" />);
            index += 1;
            continue;
        }

        const paragraph: string[] = [line];
        index += 1;

        while (index < lines.length && !isBlockStart(lines, index)) {
            paragraph.push(lines[index].trim());
            index += 1;
        }

        elements.push(
            <p key={key} className="break-words">
                {renderInline(paragraph.join(' '), `${key}-paragraph`)}
            </p>,
        );
    }

    return elements;
}

export function AssistantMarkdown({ content }: { content: string }) {
    return (
        <div className="min-w-0 space-y-3 break-words text-[15px] leading-7 text-slate-700">
            {splitFencedCode(content).flatMap((segment, index): ReactNode[] =>
                segment.type === 'code'
                    ? [
                        <div key={`code-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                            {segment.language ? (
                                <div className="border-b border-white/10 px-3 py-1.5 font-mono text-[11px] text-slate-400">
                                    {segment.language}
                                </div>
                            ) : null}
                            <pre className="overflow-x-auto p-3 font-mono text-xs leading-5 text-slate-100">
                                <code>{segment.content}</code>
                            </pre>
                        </div>,
                    ]
                    : renderTextSegment(segment.content, index),
            )}
        </div>
    );
}
