
import { normalizeIrregularityReport } from '@/lib/irregularity-report-form';

export const EDITED_IRREGULARITY_DOCX_MARKER = 'IRREGULARITY_REPORT_EDITED';

interface GenerateWordOptions {
    download?: boolean;
    filename?: string;
    logoData?: Uint8Array;
}

interface GeneratePDFOptions {
    download?: boolean;
    filename?: string;
    logoData?: Uint8Array;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getWordFilename = (report: any) => `Irregularity_Report_${report.flight_number || 'Ref'}.docx`;

async function saveBlob(blob: Blob, filename: string): Promise<void> {
    const { saveAs } = await import('file-saver');
    saveAs(blob, filename);
}

async function resolveLogoData(provided?: Uint8Array): Promise<Uint8Array | null> {
    if (provided) return provided;
    if (typeof window === 'undefined') return null;
    try {
        const response = await fetch('/logo.png');
        if (response.ok) return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
        console.error('Failed to load logo', error);
    }
    return null;
}

const normalizeUrlList = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findSavedEditedWordUrl(report: any): string | null {
    const urls = [
        ...normalizeUrlList(report?.evidence_urls),
        ...normalizeUrlList(report?.evidence_url),
    ];

    return [...urls].reverse().find((url) => {
        const decoded = decodeURIComponent(url).toUpperCase();
        return decoded.includes(EDITED_IRREGULARITY_DOCX_MARKER) && decoded.includes('.DOCX');
    }) || null;
}

export async function persistEditedWordDocument(reportId: string, blob: Blob, filename: string): Promise<string> {
    const form = new FormData();
    form.append('file', new File([blob], filename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }));
    form.append('reportId', reportId);
    form.append('evidence_submission_id', reportId);

    const uploadResponse = await fetch('/api/uploads/document', {
        method: 'POST',
        body: form,
    });

    const uploadResult = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !uploadResult?.url) {
        throw new Error(uploadResult?.error || 'Gagal menyimpan dokumen Word');
    }

    let existingEvidenceUrls: string[] = [];
    try {
        const existingRes = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
            cache: 'no-store',
        });
        if (existingRes.ok) {
            const existingData = await existingRes.json().catch(() => ({}));
            existingEvidenceUrls = normalizeUrlList(existingData?.evidence_urls)
                .concat(normalizeUrlList(existingData?.evidence_url));
        }
    } catch {

    }

    const filteredExisting = existingEvidenceUrls.filter((url) => {
        const decoded = decodeURIComponent(String(url || '')).toUpperCase();
        return !(decoded.includes('IRREGULARITY_REPORT_EDITED') && decoded.includes('.DOCX'));
    });
    const mergedUrls = [...new Set([...filteredExisting, uploadResult.url])].filter(Boolean);

    const patchBody: Record<string, unknown> = { evidence_urls: mergedUrls };
    if (uploadResult.evidence_file_id || uploadResult.evidenceFileId) {
        patchBody.evidence_file_ids = [uploadResult.evidence_file_id || uploadResult.evidenceFileId];
    }

    const patchResponse = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
    });

    const patchResult = await patchResponse.json().catch(() => ({}));
    if (!patchResponse.ok) {
        throw new Error(patchResult?.error || 'Gagal menghubungkan dokumen Word ke laporan');
    }

    return uploadResult.url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function downloadSavedWordOrGenerate(report: any, signatureDataUrl?: string | null) {
    const savedUrl = findSavedEditedWordUrl(report);
    if (savedUrl) {
        try {

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(savedUrl, { mode: 'cors', signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const blob = await response.blob();
                await saveBlob(blob, getWordFilename(report));
                return;
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.warn('[DOCX] Download fetch failed or timed out:', error);

        }

        const link = document.createElement('a');
        link.href = savedUrl;
        link.download = getWordFilename(report);
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    await generateWord(report, signatureDataUrl);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function downloadLatestSavedWordOrGenerate(report: any, signatureDataUrl?: string | null) {
    const reportId = report?.id;
    if (!reportId) {
        await downloadSavedWordOrGenerate(report, signatureDataUrl);
        return;
    }

    try {
        const response = await fetch(`/api/reports/${encodeURIComponent(String(reportId))}?_=${Date.now()}`, {
            cache: 'no-store',
        });
        if (response.ok) {
            const latestReport = await response.json();
            await downloadSavedWordOrGenerate({ ...report, ...latestReport }, signatureDataUrl);
            return;
        }
    } catch (error) {
        console.warn('[DOCX] Failed to fetch latest report before Word download:', error);
    }

    await downloadSavedWordOrGenerate(report, signatureDataUrl);
}

export const generatePDF = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    report: any,
    signatureDataUrl?: string | null,
    options: GeneratePDFOptions = {},
) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const docData = normalizeIrregularityReport(report);

    const marginX = 14;
    let currentY = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (marginX * 2);

    const logoData = await resolveLogoData(options.logoData);
    if (logoData) doc.addImage(logoData, 'PNG', marginX, currentY, 45, 25);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(docData.doc_title, pageWidth / 2, currentY + 28, { align: 'center' });

    currentY += 34;

    autoTable(doc, {
        startY: currentY,
        body: [
            ['REFERENCE NO', docData.reference_no || '-'],
            ['TO', docData.to || '-'],
            ['FROM', docData.from || '-'],
            ['CC', docData.cc || ''],
            ['SUBJECT', docData.subject || ''],
            ['ATTACHMENT', docData.attachment || '']
        ],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.5 },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.25, fontStyle: 'bold' },
            1: { cellWidth: contentWidth * 0.75 }
        },
        margin: { left: marginX, right: marginX }
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('I. FLIGHT DATA', marginX, currentY);
    currentY += 4;

    autoTable(doc, {
        startY: currentY,
        body: [
            ['Date Of Occurrence', docData.incident_date || '-', 'STD/ATD', docData.std_atd || ''],
            ['Branch', docData.branch || '-', 'PAX', docData.pax || ''],
            ['Flight Number', docData.flight_number || '-', 'BGE', docData.bge || ''],
            ['Aircraft Registration', docData.aircraft_reg || '-', 'Gate/Parking Stand', docData.gate_stand || '-'],
            ['Route', docData.route || '-', 'Delay (Code/Duration)*', docData.delay || '-']
        ],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.5 },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.25, fontStyle: 'bold' },
            1: { cellWidth: contentWidth * 0.25 },
            2: { cellWidth: contentWidth * 0.25, fontStyle: 'bold' },
            3: { cellWidth: contentWidth * 0.25 }
        },
        margin: { left: marginX, right: marginX }
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('II. OFFICER(S) ON DUTY', marginX, currentY);
    currentY += 4;

    const officersData = docData.officers.map((o, i: number) => [
        (i + 1).toString(),
        o.name || '',
        o.company || '',
        o.function || ''
    ]);

    for (let i = officersData.length + 1; i <= 10; i++) {
        officersData.push([i.toString(), '', '', '']);
    }

    autoTable(doc, {
        startY: currentY,
        head: [['NO', 'NAME', 'COMPANY', 'FUNCTION']],
        body: officersData,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        styles: { fontSize: 10, cellPadding: 2, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.5 },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.10, halign: 'center' },
            1: { cellWidth: contentWidth * 0.40 },
            2: { cellWidth: contentWidth * 0.20 },
            3: { cellWidth: contentWidth * 0.30 }
        },
        margin: { left: marginX, right: marginX }
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 4;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('III. CHRONOLOGY OF EVENT', marginX, currentY);
    currentY += 4;

    if (currentY > doc.internal.pageSize.getHeight() - 70) {
        doc.addPage();
        currentY = marginX;
    }

    const chronologyData = docData.chronology.map((c) => [
        c.time || '',
        c.description || ''
    ]);

    for (let i = chronologyData.length; i < 8; i++) {
        chronologyData.push(['', '']);
    }

    autoTable(doc, {
        startY: currentY,
        head: [['TIME IN LOCAL', 'DESCRIPTION/REMARK']],
        body: chronologyData,
        theme: 'grid',
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        styles: { fontSize: 10, cellPadding: 2, minCellHeight: 8, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.5 },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.25, halign: 'center' },
            1: { cellWidth: contentWidth * 0.75 }
        },
        margin: { left: marginX, right: marginX }
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 8;

    const addBoxSection = (title: string, content: string) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (currentY > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage();
            currentY = marginX;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(title, marginX, currentY);
        currentY += 4;

        autoTable(doc, {
            startY: currentY,
            body: [[content || '']],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3, minCellHeight: 20, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.5 },
            margin: { left: marginX, right: marginX }
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 8;
    };

    addBoxSection('IV. POTENTIAL/ROOT CAUSE(S)', docData.root_cause);
    addBoxSection('V. CORRECTIVE ACTION(S)', docData.action_taken);
    addBoxSection('VI. PREVENTIVE ACTION(S)', docData.preventive_action);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (currentY > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        currentY = marginX;
    }

    const startSignatureY = currentY;

    doc.setLineWidth(0.5);
    doc.rect(marginX, startSignatureY, contentWidth, 50);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Location: ', marginX + 5, startSignatureY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(docData.branch || '-', marginX + 25, startSignatureY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Date of Prepared: ', marginX + (contentWidth / 2) + 5, startSignatureY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(docData.incident_date || '-', marginX + (contentWidth / 2) + 38, startSignatureY + 6);

    doc.line(marginX, startSignatureY + 15, marginX + contentWidth, startSignatureY + 15);
    doc.line(marginX + (contentWidth / 2), startSignatureY + 15, marginX + (contentWidth / 2), startSignatureY + 50);

    doc.text('Prepared by,', marginX + (contentWidth / 4), startSignatureY + 22, { align: 'center' });
    doc.text(docData.reporter_title, marginX + (contentWidth / 4), startSignatureY + 30, { align: 'center' });

    if (signatureDataUrl) {
        doc.addImage(signatureDataUrl, 'PNG', marginX + (contentWidth / 4) - 15, startSignatureY + 31, 30, 10);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`( ${docData.reporter_name || '...................'} )`, marginX + (contentWidth / 4), startSignatureY + 46, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.text('Acknowledge by,', marginX + contentWidth - (contentWidth / 4), startSignatureY + 22, { align: 'center' });
    doc.text(docData.acknowledge_label, marginX + contentWidth - (contentWidth / 4), startSignatureY + 30, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text('( ........................ )', marginX + contentWidth - (contentWidth / 4), startSignatureY + 46, { align: 'center' });

    currentY = startSignatureY + 55;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('*) Additional Information (if required/if existing)', marginX, currentY);

    currentY += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('F-OP-02', marginX, currentY);

    const blob = doc.output('blob');
    if (options.download !== false) {
        await saveBlob(blob, options.filename || `Irregularity_Report_${docData.flight_number || 'Ref'}.pdf`);
    }
    return blob;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generateWord = async (report: any, signatureDataUrl?: string | null, options: GenerateWordOptions = {}) => {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, ImageRun } = await import('docx');
    const docData = normalizeIrregularityReport(report);

    const createBoldText = (text: string) => new TextRun({ text, bold: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createTextCell = (text: string, isBold: boolean = false, options: any = {}) => {
        return new TableCell({
            children: [new Paragraph({
                children: isBold ? [createBoldText(text)] : [new TextRun(text)],
                spacing: { before: 40, after: 40 },
                alignment: options.alignment || AlignmentType.LEFT
            })],
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
            ...options
        });
    };

    const titleSection = [];

    const logoData = await resolveLogoData(options.logoData);
    if (logoData) {
        titleSection.push(
            new Paragraph({
                children: [
                    new ImageRun({
                        data: logoData,
                        transformation: {
                            width: 140,
                            height: 79,
                        },
                        type: 'png'
                    })
                ],
                alignment: AlignmentType.LEFT,
                spacing: { after: 200 }
            })
        );
    }

    titleSection.push(
        new Paragraph({
            children: [new TextRun({ text: docData.doc_title, bold: true, color: '111827', size: 32 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 }
        })
    );

    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    createTextCell("REFERENCE NO", true, { width: { size: 25, type: WidthType.PERCENTAGE } }),
                    createTextCell(docData.reference_no || "-", false, { width: { size: 75, type: WidthType.PERCENTAGE } }),
                ]
            }),
            new TableRow({
                children: [
                    createTextCell("TO", true),
                    createTextCell(docData.to || "-"),
                ]
            }),
            new TableRow({
                children: [
                    createTextCell("FROM", true),
                    createTextCell(docData.from || "-"),
                ]
            }),
            new TableRow({
                children: [
                    createTextCell("CC", true),
                    createTextCell(docData.cc || ""),
                ]
            }),
            new TableRow({
                children: [
                    createTextCell("SUBJECT", true),
                    createTextCell(docData.subject || ""),
                ]
            }),
            new TableRow({
                children: [
                    createTextCell("ATTACHMENT", true),
                    createTextCell(docData.attachment || ""),
                ]
            }),
        ],
    });

    const sectionI = [
        new Paragraph({ text: "" }),
        new Paragraph({
            children: [createBoldText('I. FLIGHT DATA')],
            spacing: { before: 100, after: 100 }
        })
    ];

    const flightDataRows = [
        ['Date Of Occurrence', docData.incident_date || '-', 'STD/ATD', docData.std_atd || ''],
        ['Branch', docData.branch || '-', 'PAX', docData.pax || ''],
        ['Flight Number', docData.flight_number || '-', 'BGE', docData.bge || ''],
        ['Aircraft Registration', docData.aircraft_reg || '-', 'Gate/Parking Stand', docData.gate_stand || '-'],
        ['Route', docData.route || '-', 'Delay (Code/Duration)*', docData.delay || '-'],
    ];

    const flightTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: flightDataRows.map(([leftLabel, leftValue, rightLabel, rightValue]) =>
            new TableRow({
                children: [
                    createTextCell(leftLabel, true, { width: { size: 25, type: WidthType.PERCENTAGE } }),
                    createTextCell(leftValue, false, { width: { size: 25, type: WidthType.PERCENTAGE } }),
                    createTextCell(rightLabel, true, { width: { size: 25, type: WidthType.PERCENTAGE } }),
                    createTextCell(rightValue, false, { width: { size: 25, type: WidthType.PERCENTAGE } }),
                ]
            })
        )
    });

    const sectionII = [
        new Paragraph({ text: "" }),
        new Paragraph({
            children: [createBoldText('II. OFFICER(S) ON DUTY')],
            spacing: { before: 100, after: 100 }
        })
    ];

    const officerRows = [];
    officerRows.push(new TableRow({
        children: [
            createTextCell("NO", true, { width: { size: 10, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER }),
            createTextCell("NAME", true, { width: { size: 30, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER }),
            createTextCell("COMPANY", true, { width: { size: 30, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER }),
            createTextCell("FUNCTION", true, { width: { size: 30, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER }),
        ]
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    docData.officers.forEach((officer: any, idx: number) => {
        officerRows.push(new TableRow({
            children: [
                createTextCell(`${idx + 1}`, false, { alignment: AlignmentType.CENTER }),
                createTextCell(officer.name || "-"),
                createTextCell(officer.company || ""),
                createTextCell(officer.function || ""),
            ]
        }));
    });

    for (let i = officerRows.length; i <= 10; i++) {
        officerRows.push(new TableRow({
            children: [
                 createTextCell(`${i}`, false, { alignment: AlignmentType.CENTER }),
                 createTextCell(""),
                 createTextCell(""),
                 createTextCell(""),
            ]
        }));
    }

    const officersTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: officerRows
    });

    const noteSectionII = [
        new Paragraph({
            children: [new TextRun({ text: "*) Additional Information (if required/if existing)", size: 18 })],
            spacing: { before: 50, after: 200 }
        })
    ];

    const sectionIII = [
        new Paragraph({ text: "" }),
        new Paragraph({
            children: [createBoldText('III. CHRONOLOGY OF EVENT')],
            spacing: { before: 100, after: 100 }
        })
    ];

    const chronologyRows = [];
    chronologyRows.push(new TableRow({
        children: [
            createTextCell("TIME IN LOCAL", true, { width: { size: 25, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER }),
            createTextCell("DESCRIPTION/REMARK", true, { width: { size: 75, type: WidthType.PERCENTAGE }, alignment: AlignmentType.CENTER }),
        ]
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    docData.chronology.forEach((entry: any) => {
        chronologyRows.push(new TableRow({
            children: [
                createTextCell(entry.time || "", false, { alignment: AlignmentType.CENTER }),
                createTextCell(entry.description || ""),
            ]
        }));
    });

    for (let i = chronologyRows.length; i <= 8; i++) {
        chronologyRows.push(new TableRow({
            children: [
                createTextCell(""),
                createTextCell(""),
            ]
        }));
    }

    const chronologyTable = new Table({
         width: { size: 100, type: WidthType.PERCENTAGE },
         rows: chronologyRows
    });

    const sectionIV = [
        new Paragraph({ text: "" }),
        new Paragraph({
            children: [createBoldText('IV. POTENTIAL/ROOT CAUSE(S)')],
            spacing: { before: 100, after: 100 }
        })
    ];

    const rootCauseTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    createTextCell(docData.root_cause || "\n\n", false)
                ]
            })
        ]
    });

    const sectionV = [
        new Paragraph({ text: "" }),
        new Paragraph({
            children: [createBoldText('V. CORRECTIVE ACTION(S)')],
            spacing: { before: 100, after: 100 }
        })
    ];

    const correctiveActionTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    createTextCell(docData.action_taken || "\n\n", false)
                ]
            })
        ]
    });

    const sectionVI = [
        new Paragraph({ text: "" }),
        new Paragraph({
            children: [createBoldText('VI. PREVENTIVE ACTION(S)')],
            spacing: { before: 100, after: 100 }
        })
    ];

    const preventiveActionTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    createTextCell(docData.preventive_action || "\n\n", false)
                ]
            })
        ]
    });

    let signatureRun: InstanceType<typeof ImageRun> | undefined = undefined;
    if (signatureDataUrl) {
        try {
            const base64Data = signatureDataUrl.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            signatureRun = new ImageRun({
                data: bytes,
                transformation: {
                    width: 140,
                    height: 50,
                },
                type: 'png'
            });
        } catch(e) {
            console.error("Failed to parse signature image", e);
        }
    }

    const signatureTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Location: ", bold: true, font: "Arial", size: 24 }),
                                    new TextRun({ text: docData.branch || '.........................', font: "Arial", size: 24 })
                                ],
                                spacing: { after: 100 }
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Date of Prepared: ", bold: true, font: "Arial", size: 24 }),
                                    new TextRun({ text: docData.incident_date || '-', font: "Arial", size: 24 })
                                ],
                                spacing: { after: 200 }
                            }),
                        ],
                        columnSpan: 2,
                        borders: { top: { style: BorderStyle.SINGLE, size: 4 }, bottom: { style: BorderStyle.NONE, size: 4 }, left: { style: BorderStyle.SINGLE, size: 4 }, right: { style: BorderStyle.SINGLE, size: 4 } },
                        margins: { top: 50, bottom: 50, left: 100, right: 100 }
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({ text: "Prepared by,", spacing: { after: 50 }, alignment: AlignmentType.CENTER }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: docData.reporter_title || "Controller Operation Airside", font: "Arial", size: 24 }),
                                ],
                                alignment: AlignmentType.CENTER
                            }),
                            new Paragraph({
                                children: signatureRun ? [signatureRun] : [],
                                spacing: signatureRun ? { before: 10, after: 10 } : { before: 500, after: 100 },
                                alignment: AlignmentType.CENTER
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "(  ", bold: true, font: "Arial", size: 24 }),
                                    new TextRun({ text: `${docData.reporter_name || '...................'}`, bold: true, underline: { type: "single" }, font: "Arial", size: 24 }),
                                    new TextRun({ text: "  )", bold: true, font: "Arial", size: 24 }),
                                ],
                                alignment: AlignmentType.CENTER
                            }),
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE, size: 4 }, bottom: { style: BorderStyle.SINGLE, size: 4 }, left: { style: BorderStyle.SINGLE, size: 4 }, right: { style: BorderStyle.NONE, size: 4 } },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    }),
                    new TableCell({
                        children: [
                            new Paragraph({ text: "Acknowledge by,", spacing: { after: 50 }, alignment: AlignmentType.CENTER }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: docData.acknowledge_label, font: "Arial", size: 24 })
                                ],
                                alignment: AlignmentType.CENTER
                            }),
                            new Paragraph({ text: "", spacing: { before: 500, after: 100 } }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "( ", bold: true, font: "Arial", size: 24 }),
                                    new TextRun({ text: " ........................ ", bold: true, underline: { type: "single" }, font: "Arial", size: 24 }),
                                    new TextRun({ text: " )", bold: true, font: "Arial", size: 24 }),
                                ],
                                alignment: AlignmentType.CENTER
                            }),
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE, size: 4 }, bottom: { style: BorderStyle.SINGLE, size: 4 }, left: { style: BorderStyle.NONE, size: 4 }, right: { style: BorderStyle.SINGLE, size: 4 } },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    })
                ]
            })
        ],
    });

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        size: 24,
                        font: "Arial"
                    },
                    paragraph: {
                        spacing: {
                            line: 240,
                            lineRule: "auto"
                        }
                    }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 720,
                        right: 720,
                        bottom: 720,
                        left: 720,
                        header: 720,
                        footer: 720,
                    }
                }
            },
            children: [
                ...titleSection,
                headerTable,
                ...sectionI,
                flightTable,
                ...sectionII,
                officersTable,
                ...noteSectionII,
                ...sectionIII,
                chronologyTable,
                ...sectionIV,
                rootCauseTable,
                ...sectionV,
                correctiveActionTable,
                ...sectionVI,
                preventiveActionTable,
                new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),
                signatureTable,
                new Paragraph({
                    children: [new TextRun({ text: "*) Additional Information (if required/if existing)", font: "Arial", size: 20 })],
                    spacing: { before: 100 }
                }),
                new Paragraph({
                    children: [new TextRun({ text: "F-OP-02", font: "Arial", size: 20, bold: true })],
                    spacing: { before: 800 }
                })
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    if (options.download !== false) {
        await saveBlob(blob, options.filename || getWordFilename(report));
    }
    return blob;
};
