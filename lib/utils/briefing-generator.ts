
interface BriefingData {

    tanggal: string;

    waktu: string;

    tempat: string;

    topik: string;

    pembicara: string;

    notulensi: string;
}

export async function generateBriefingWord(data: BriefingData, signatureDataUrl: string | null): Promise<Blob> {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ImageRun, Packer } = await import('docx');

    const createBoldText = (text: string, size = 24) => new TextRun({ text, bold: true, font: "Arial", size });
    const createNormalText = (text: string, size = 24) => new TextRun({ text, font: "Arial", size });

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

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { size: 24, font: "Arial" },
                    paragraph: { spacing: { line: 240, lineRule: "auto" } }
                }
            }
        },
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [new TextRun({ text: "FORM BRIEFING F-OP-03", bold: true, font: "Arial", size: 32 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [createBoldText("Tanggal")] })], width: { size: 25, type: WidthType.PERCENTAGE } }),
                                new TableCell({ children: [new Paragraph({ children: [createNormalText(`: ${data.tanggal}`)] })], width: { size: 75, type: WidthType.PERCENTAGE } }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [createBoldText("Waktu")] })] }),
                                new TableCell({ children: [new Paragraph({ children: [createNormalText(`: ${data.waktu}`)] })] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [createBoldText("Tempat")] })] }),
                                new TableCell({ children: [new Paragraph({ children: [createNormalText(`: ${data.tempat}`)] })] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [createBoldText("Pemberi Briefing")] })] }),
                                new TableCell({ children: [new Paragraph({ children: [createNormalText(`: ${data.pembicara}`)] })] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [createBoldText("Topik / Agenda")] })] }),
                                new TableCell({ children: [new Paragraph({ children: [createNormalText(`: ${data.topik}`)] })] }),
                            ]
                        }),
                    ]
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),
                new Paragraph({
                    children: [createBoldText("Notulensi / Catatan Briefing:")],
                    spacing: { after: 100 }
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            children: [createNormalText(data.notulensi || "\n\n\n\n")],
                                            spacing: { before: 100, after: 100 }
                                        })
                                    ],
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                                })
                            ]
                        })
                    ]
                }),
                new Paragraph({ text: "", spacing: { after: 400 } }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        new Paragraph({ alignment: AlignmentType.CENTER, children: [createNormalText("Disiapkan Oleh,")] }),
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: signatureRun ? [signatureRun] : [],
                                            spacing: signatureRun ? { before: 200, after: 200 } : { before: 600, after: 200 }
                                        }),
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [
                                                new TextRun({ text: `( ${data.pembicara || '....................'} )`, bold: true, underline: { type: "single" }, font: "Arial", size: 24 })
                                            ]
                                        }),
                                    ],
                                    width: { size: 50, type: WidthType.PERCENTAGE }
                                }),
                                new TableCell({
                                    children: [
                                        new Paragraph({ alignment: AlignmentType.CENTER, children: [createNormalText("Mengetahui,")] }),
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            spacing: { before: 600, after: 200 },
                                            children: [createNormalText("")]
                                        }),
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [
                                                new TextRun({ text: `( .................... )`, bold: true, underline: { type: "single" }, font: "Arial", size: 24 })
                                            ]
                                        }),
                                    ],
                                    width: { size: 50, type: WidthType.PERCENTAGE }
                                })
                            ]
                        })
                    ]
                })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    return blob;
}
