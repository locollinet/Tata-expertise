import { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ImageRun, Header, Footer } from 'docx';
import fs from 'fs';
import path from 'path';
import { Invoice, ReportDraft, Attendee, Photo } from '../shared/types.js';

function createVPHeader(): Header {
  const logoPath = path.resolve(process.cwd(), 'server/assets/logo.jpg');
  const hasLogo = fs.existsSync(logoPath);

  const headerTable = new Table({
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
          // Logo column
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              hasLogo
                ? new Paragraph({
                    children: [
                      new ImageRun({
                        data: fs.readFileSync(logoPath),
                        transformation: { width: 55, height: 58 },
                      }),
                    ],
                  })
                : new Paragraph({
                    children: [new TextRun({ text: "VP EXPERTISE", bold: true, color: "0F3854" })],
                  }),
            ],
          }),
          // Skills & Specialties column
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: "expertise technique", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "évaluation de préjudice", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "claim management • ingénierie mécanique", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "matériels ferroviaires", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "engins et machines", size: 16, color: "64748B" })] }),
            ],
          }),
          // Contact info column
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Valentine Pécheux", bold: true, size: 18, color: "0F3854" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "32, rue de Prony", size: 16, color: "475569" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "92600 Asnières-sur-Seine", size: 16, color: "475569" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "+33 6 38 73 68 88", size: 16, color: "475569" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "contact@vpexpertise.com", size: 16, color: "0F3854" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "www.vpexpertise.com", size: 16, color: "0F3854" })] }),
            ],
          }),
        ],
      }),
    ],
  });

  return new Header({
    children: [headerTable],
  });
}

function createVPFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "EI Valentine Pécheux | N° SIREN : 830 473 195 | S. soc. : 32, rue de Prony – 92600 Asnières-sur-Seine | N° TVA : FR11830473195",
            size: 14,
            color: "94A3B8",
          }),
        ],
      }),
    ],
  });
}

export async function generateInvoiceDocx(invoice: Invoice): Promise<Buffer> {
  const tableRows: TableRow[] = [
    // Header Row
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: "Objet", bold: true, color: "0F3854" })] })],
          shading: { fill: "F1F5F9" },
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Qté", bold: true, color: "0F3854" })] })],
          shading: { fill: "F1F5F9" },
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Tps (h)", bold: true, color: "0F3854" })] })],
          shading: { fill: "F1F5F9" },
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Prix Unit. HT", bold: true, color: "0F3854" })] })],
          shading: { fill: "F1F5F9" },
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Mt HT", bold: true, color: "0F3854" })] })],
          shading: { fill: "F1F5F9" },
        }),
      ],
    }),
  ];

  // Add line items
  if (invoice.lines && invoice.lines.length > 0) {
    for (const line of invoice.lines) {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: line.description })] })],
            }),
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(line.quantity) })] })],
            }),
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: line.time_spent !== null && line.time_spent !== undefined ? String(line.time_spent).replace('.', ',') : "-" })] })],
            }),
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${line.unit_price_ht.toFixed(2).replace('.', ',')} €` })] })],
            }),
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${line.total_ht.toFixed(2).replace('.', ',')} €` })] })],
            }),
          ],
        })
      );
    }
  }

  // Summary Rows
  const addSummaryRow = (label: string, amount: number, bold: boolean = false, highlight: boolean = false) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: label, bold })] })],
            shading: highlight ? { fill: "F0F6FA" } : undefined,
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${amount.toFixed(2).replace('.', ',')} €`, bold })] })],
            shading: highlight ? { fill: "F0F6FA" } : undefined,
          }),
        ],
      })
    );
  };

  addSummaryRow("Total HT :", invoice.total_ht, true);
  addSummaryRow("Total TVA (20%) :", invoice.vat_amount);
  addSummaryRow("Total TTC :", invoice.total_ttc, true);
  if (invoice.advance_amount && invoice.advance_amount > 0) {
    addSummaryRow("Acompte déduit :", invoice.advance_amount);
  }
  addSummaryRow("Net à payer :", invoice.net_payable, true, true);

  const titleTable = new Table({
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
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `DATE : ${invoice.date.split('-').reverse().join('/')}`, bold: true, size: 20 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `NOTE D'HONORAIRES N° ${invoice.invoice_number}`, bold: true, size: 24, color: "0F3854" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        headers: {
          default: createVPHeader(),
        },
        footers: {
          default: createVPFooter(),
        },
        children: [
          titleTable,
          new Paragraph({ spacing: { after: 120 } }),
          // Client block
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: invoice.client_name, bold: true, size: 24 }),
            ],
          }),
          ...invoice.client_address.split('\n').map(line => 
            new Paragraph({
              children: [new TextRun({ text: line.trim() })],
            })
          ),
          new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: `AFFAIRE : `, bold: true }), new TextRun({ text: invoice.case_title })] }),
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `OBJET : `, bold: true }), new TextRun({ text: invoice.subject })] }),
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `VOS RÉF. : `, bold: true }), new TextRun({ text: invoice.client_ref })] }),
          new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `NOS RÉF. : `, bold: true }), new TextRun({ text: invoice.our_ref })] }),

          // Table
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),

          // Banking information
          new Paragraph({
            spacing: { before: 300, after: 60 },
            children: [
              new TextRun({ text: "IBAN : FR76 4061 8804 8500 0403 9019 162", bold: true }),
            ],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({ text: "Code BIC : BOUS FRPP XXX", bold: true }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
            children: [
              new TextRun({ text: "Merci de votre confiance !", italics: true, color: "0F3854" }),
            ],
          }),
        ],
      },
    ],
  });

  const { Packer } = await import('docx');
  return await Packer.toBuffer(doc);
}

export async function generateReportDocx(
  draft: ReportDraft,
  missionTitle: string,
  caseRef: string,
  attendees: Attendee[] = [],
  photos: Photo[] = []
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({ text: "VP EXPERTISE — RAPPORT D'EXPERTISE TECHNIQUE", bold: true, size: 32, color: "0F3854" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Dossier : ${draft.mission_code} — ${missionTitle}`, bold: true, size: 24 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Référence sinistre : ${caseRef} | Version de travail : v${draft.version}`, italics: true }),
      ],
    }),

    // Section 1 : Rappel des faits
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: "1. Rappel des faits et cadre de la mission", bold: true, color: "0F3854" })],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [new TextRun({ text: draft.section_facts || "Aucun fait renseigné à ce stade." })],
    }),

    // Section 2 : Participants
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: "2. Participants aux opérations d'expertise", bold: true, color: "0F3854" })],
    }),
  ];

  if (attendees.length > 0) {
    const attendeeRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Nom & Prénom", bold: true })] })], shading: { fill: "F1F5F9" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Organisme / Partie", bold: true })] })], shading: { fill: "F1F5F9" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qualité / Rôle", bold: true })] })], shading: { fill: "F1F5F9" } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Présence", bold: true })] })], shading: { fill: "F1F5F9" } }),
        ],
      }),
      ...attendees.map(a => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.name })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.organization })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.role })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.present_on_site ? "Sur site" : (a.present_remote ? "Visio" : "Excusé") })] })] }),
        ],
      })),
    ];
    children.push(new Table({ rows: attendeeRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: "Aucun participant saisi.", italics: true })] }));
  }

  // Section 3 : Constatations matérielles
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: "3. Constatations matérielles et investigations sur site", bold: true, color: "0F3854" })],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [new TextRun({ text: draft.section_observations || "Constatations en attente de formalisation." })],
    })
  );

  // Selected photos
  const selectedPhotos = photos.filter(p => p.is_selected_for_report);
  if (selectedPhotos.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        children: [new TextRun({ text: "Photographies et pièces justificatives sélectionnées", bold: true })],
      })
    );
    for (const photo of selectedPhotos) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({ text: `Cliché : ${photo.caption || photo.original_name}`, bold: true, italics: true }),
          ],
        })
      );
      // If photo file exists on disk and is readable, embed it
      const photoPath = path.resolve(process.cwd(), 'data/uploads', photo.filename);
      if (fs.existsSync(photoPath)) {
        try {
          const imageBuffer = fs.readFileSync(photoPath);
          children.push(
            new Paragraph({
              spacing: { after: 140 },
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 450,
                    height: 300,
                  },
                } as any),
              ],
            })
          );
        } catch {
          children.push(new Paragraph({ children: [new TextRun({ text: `[Fichier image : ${photo.original_name}]`, italics: true })] }));
        }
      }
    }
  }

  // Section 4 : Analyse technique (Experte)
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: "4. Analyse technique et examen des responsabilités", bold: true, color: "0F3854" })],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [new TextRun({ text: draft.section_analysis || "[Section d'analyse technique réservée à l'experte]", italics: !draft.section_analysis })],
    }),

    // Section 5 : Synthèse & Conclusions provisoires
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: "5. Conclusions provisoires et prochaines démarches", bold: true, color: "0F3854" })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: draft.section_conclusions || "Conclusions en cours d'élaboration." })],
    })
  );

  const doc = new Document({
    sections: [
      {
        headers: {
          default: createVPHeader(),
        },
        footers: {
          default: createVPFooter(),
        },
        children,
      },
    ],
  });

  const { Packer } = await import('docx');
  return await Packer.toBuffer(doc);
}
