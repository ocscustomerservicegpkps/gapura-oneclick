import type { DivisionDocument } from '@/types';
import { resolveMaterialLinks } from '@/lib/division-documents-material-links';
import {
    addAdvancedExcelTable,
    configureExcelWorkbook,
    excelDate,
    excelHyperlink,
} from '@/lib/excel-export-style';

export async function exportDivisionDocumentsToExcel(documents: DivisionDocument[]) {
    const exceljs = await import('exceljs');
    const workbook = new exceljs.Workbook();
    const sheet = workbook.addWorksheet('Circulars & Materials');
    configureExcelWorkbook(workbook, 'Gapura Oneclick Circulars and Materials');
    addAdvancedExcelTable({
        workbook,
        worksheet: sheet,
        name: 'DivisionDocumentsTable',
        columns: [
            { header: 'Date', kind: 'date', width: 15 },
            { header: 'Location', kind: 'text', width: 22 },
            { header: 'Agenda', kind: 'multiline', width: 34 },
            { header: 'PIC / Division', kind: 'text', width: 22 },
            { header: 'Station', kind: 'identifier', width: 15 },
            { header: 'Airline', kind: 'text', width: 20 },
            { header: 'Participants', kind: 'multiline', width: 30 },
            { header: 'Material Links', kind: 'url', width: 40 },
        ],
        rows: documents.map((document) => {
            const links = resolveMaterialLinks(document);
            const linkLabel = links.map((link) => `${link.title || 'Link'}: ${link.url}`).join('\n');
            return [
                excelDate(document.meeting_date || document.created_at),
                document.activity_location || '',
                document.title || '',
                document.activity_pic || '',
                document.station_code || document.station_name || '',
                document.airline || '',
                document.participants || '',
                links.length ? excelHyperlink(links[0].url, linkLabel) : '',
            ];
        }),
        freezeRows: 1,
        emptyMessage: 'No circulars or materials available',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const now = new Date();
    anchor.download = `Circulars-Materials-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}
