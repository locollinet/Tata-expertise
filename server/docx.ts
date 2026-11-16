import { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ImageRun, Header, Footer } from 'docx';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import type {
  Invoice,
  ReportDraft,
  Attendee,
  Photo,
  Mission,
  DamageLine,
  DeliverableType,
  DeliverableRequestPayload,
} from '../shared/types.ts';

function escapeXml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatFrCurrency(amount: number): string {
  const fixed = (Number(amount) || 0).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formattedInt},${decPart} €`;
}

function formatFrNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  return String(Math.round(Number(num) * 100) / 100).replace('.', ',');
}

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
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              hasLogo
                ? new Paragraph({
                    children: [
                      new ImageRun({
                        data: fs.readFileSync(logoPath),
                        transformation: { width: 55, height: 58 },
                      } as any),
                    ],
                  })
                : new Paragraph({
                    children: [new TextRun({ text: "VP EXPERTISE", font: "Century Gothic", bold: true, color: "006A8E" })],
                  }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: "expertise technique", font: "Century Gothic", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "évaluation de préjudice", font: "Century Gothic", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "claim management • ingénierie mécanique", font: "Century Gothic", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "matériels ferroviaires", font: "Century Gothic", size: 16, color: "64748B" })] }),
              new Paragraph({ children: [new TextRun({ text: "engins et machines", font: "Century Gothic", size: 16, color: "64748B" })] }),
            ],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Valentine Pécheux", font: "Century Gothic", bold: true, size: 18, color: "006A8E" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "32, rue de Prony", font: "Century Gothic", size: 16, color: "475569" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "92600 Asnières-sur-Seine", font: "Century Gothic", size: 16, color: "475569" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "+33 6 38 73 68 88", font: "Century Gothic", size: 16, color: "475569" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "contact@vpexpertise.com", font: "Century Gothic", size: 16, color: "006A8E" })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "www.vpexpertise.com", font: "Century Gothic", size: 16, color: "006A8E" })] }),
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
            font: "Century Gothic",
            size: 14,
            color: "94A3B8",
          }),
        ],
      }),
    ],
  });
}

/**
 * Génère la Note d'Honoraires au format Word (.docx) en respectant à 100%
 * le modèle officiel facture.dotx de Valentine Pécheux :
 * - En-tête latéral gauche (logo + spécialités + coordonnées) et pied de page officiels
 * - Marge gauche 3828 dxa (6,75 cm)
 * - Police Century Gothic partout, titres #006A8E, texte #404040 / #595959
 * - Libellés V/RÉF. : et N/RÉF. : alignés avec tabulation
 * - Tableau épuré Century Gothic 9pt (comme dans son Excel Expertise File Register)
 *   avec IBAN / BIC à gauche des totaux et Net à payer encadré en gras
 */
export async function generateInvoiceDocx(invoice: Invoice): Promise<Buffer> {
  const templateCandidates = [
    path.resolve(process.cwd(), 'server/assets/template_facture.docx'),
    path.resolve(process.cwd(), 'sources/Facture_2026-099.docx'),
  ];
  const templatePath = templateCandidates.find(p => fs.existsSync(p));

  const formattedDate = invoice.date.includes('-')
    ? invoice.date.split('-').reverse().join('/')
    : invoice.date;

  // Client address lines (avoid duplicating client_name if first line of address already equals client_name)
  const rawAddressLines = (invoice.client_address || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  const clientLines: string[] = [invoice.client_name];
  for (const line of rawAddressLines) {
    if (line.toLowerCase() !== invoice.client_name.trim().toLowerCase()) {
      clientLines.push(line);
    }
  }

  if (templatePath) {
    const zip = await JSZip.loadAsync(fs.readFileSync(templatePath));

    // Remove heavy unused EMF image from template copy if present
    if (zip.file('word/media/image1.emf')) {
      zip.remove('word/media/image1.emf');
    }

    const clientParagraphsXml = clientLines
      .map(
        line => `
      <w:p>
        <w:pPr>
          <w:spacing w:line="276" w:lineRule="auto"/>
          <w:ind w:left="3686"/>
          <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
        </w:pPr>
        <w:r>
          <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
          <w:t>${escapeXml(line)}</w:t>
        </w:r>
      </w:p>`
      )
      .join('');

    // Ensure consistent vertical position of AFFAIRE : (aligned with Valentine Pécheux on the left sidebar)
    // In Facture_2026-103.docx, 3 client lines + 6 empty lines = 9 lines total before AFFAIRE :
    const emptyLinesAfterClientCount = Math.max(2, 9 - clientLines.length);
    const emptyLinesAfterClientXml = Array.from({ length: emptyLinesAfterClientCount })
      .map(
        (_, idx) => `
      <w:p>
        <w:pPr>
          <w:ind w:left="${idx === 0 ? '3686' : idx === 1 ? '3828' : '4394'}"/>
          <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="${idx === emptyLinesAfterClientCount - 1 ? '18' : '20'}"/></w:rPr>
        </w:pPr>
      </w:p>`
      )
      .join('');

    // Largeur utile exacte entre marge gauche (3828 dxa) et marge droite (1274 dxa) sur A4 (11906 dxa) = 6804 dxa (12,0 cm = 4320540 EMU)
    // Colonne Objet élargie à 3824 dxa + police 7.5pt (sz=15) et lignes aérées pour que
    // « Étude de documents, analyse, gestion du dossier » tienne sur une seule ligne sans retour à la ligne.
    const COL_OBJET = 3824;
    const COL_QTE = 440;
    const COL_TPS = 480;
    const COL_PU = 1030;
    const COL_MT = 1030;
    const COL_LEFT_3 = COL_OBJET + COL_QTE + COL_TPS; // 4744 dxa
    const TABLE_WIDTH = COL_LEFT_3 + COL_PU + COL_MT; // 6804 dxa

    const lines = invoice.lines || [];
    // Aération généreuse des lignes tout en tenant sur 1 page
    const rowSpacing = lines.length > 8 ? 45 : 65;
    const rowHeight = lines.length > 8 ? 260 : 300;
    const itemFontSz = 15; // 7.5pt Century Gothic : net, aéré, une seule ligne

    const itemRowsXml = lines
      .map(line => {
        const isKmSwapped =
          line.description.toLowerCase().includes('kilom') &&
          Number(line.quantity) > 1 &&
          (line.time_spent === 1 || line.time_spent === null || line.time_spent === undefined);
        const qtyVal = isKmSwapped ? 1 : line.quantity;
        const tpsVal = isKmSwapped ? line.quantity : line.time_spent;
        const tpsText =
          tpsVal !== null && tpsVal !== undefined
            ? formatFrNumber(tpsVal)
            : '';
        return `
        <w:tr>
          <w:trPr><w:trHeight w:val="${rowHeight}"/></w:trPr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${COL_OBJET}" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr>
                <w:spacing w:before="${rowSpacing}" w:after="${rowSpacing}" w:line="220" w:lineRule="auto"/>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
              </w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
                <w:t>${escapeXml(line.description)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${COL_QTE}" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr>
                <w:jc w:val="center"/>
                <w:spacing w:before="${rowSpacing}" w:after="${rowSpacing}" w:line="220" w:lineRule="auto"/>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
              </w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
                <w:t>${escapeXml(formatFrNumber(qtyVal))}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${COL_TPS}" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr>
                <w:jc w:val="center"/>
                <w:spacing w:before="${rowSpacing}" w:after="${rowSpacing}" w:line="220" w:lineRule="auto"/>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
              </w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
                <w:t>${escapeXml(tpsText)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${COL_PU}" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr>
                <w:jc w:val="right"/>
                <w:spacing w:before="${rowSpacing}" w:after="${rowSpacing}" w:line="220" w:lineRule="auto"/>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
              </w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
                <w:t>${escapeXml(formatFrCurrency(line.unit_price_ht))}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${COL_MT}" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr>
                <w:jc w:val="right"/>
                <w:spacing w:before="${rowSpacing}" w:after="${rowSpacing}" w:line="220" w:lineRule="auto"/>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
              </w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="${itemFontSz}"/><w:szCs w:val="${itemFontSz}"/></w:rPr>
                <w:t>${escapeXml(formatFrCurrency(line.total_ht))}</w:t>
              </w:r>
            </w:p>
          </w:tc>
        </w:tr>`;
      })
      .join('');

    const advanceDisplay =
      invoice.advance_amount && invoice.advance_amount > 0
        ? formatFrCurrency(invoice.advance_amount)
        : '';

    let splitXml = '';
    try {
      const splitData = typeof invoice.split_details === 'string'
        ? JSON.parse(invoice.split_details || '[]')
        : (invoice.split_details || []);
      if (Array.isArray(splitData) && splitData.length > 0) {
        const splitLinesXml = splitData.map((s: any) => {
          const pct = s.percentage ? `${s.percentage} %` : '';
          const name = s.name || s.client_name || 'Co-assureur';
          const ht = s.amount_ht ? formatFrCurrency(s.amount_ht) : (s.percentage ? formatFrCurrency((invoice.total_ht * Number(s.percentage)) / 100) : '');
          const ttc = s.net_payable ? formatFrCurrency(s.net_payable) : (s.percentage ? formatFrCurrency((invoice.net_payable * Number(s.percentage)) / 100) : '');
          const ref = s.ref ? ` (Réf: ${s.ref})` : '';
          return `
            <w:p>
              <w:pPr><w:spacing w:before="20" w:after="20"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="15"/><w:color w:val="595959"/></w:rPr></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="15"/><w:color w:val="006A8E"/></w:rPr><w:t xml:space="preserve">• ${escapeXml(name)}${ref} [${escapeXml(pct)}] : </w:t></w:r>
              <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="15"/><w:color w:val="595959"/></w:rPr><w:t xml:space="preserve">${escapeXml(ht)} HT — Net à payer TTC : </w:t></w:r>
              <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="15"/><w:color w:val="262626"/></w:rPr><w:t>${escapeXml(ttc)}</w:t></w:r>
            </w:p>`;
        }).join('');

        splitXml = `
          <w:p><w:pPr><w:spacing w:before="120" w:after="40"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="16"/><w:color w:val="006A8E"/></w:rPr></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:sz w:val="16"/><w:color w:val="006A8E"/></w:rPr><w:t>RÉPARTITION CO-ASSURANCE :</w:t></w:r>
          </w:p>
          ${splitLinesXml}
        `;
      }
    } catch (_) {}

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 w15 wp14">
  <w:body>
    <!-- En-tête Date & Numéro de Note d'Honoraires (identique à Facture_2026-103.docx) -->
    <w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="Grilledutableau"/>
        <w:tblW w:w="8253" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
        <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="3402"/>
        <w:gridCol w:w="4851"/>
      </w:tblGrid>
      <w:tr>
        <w:trPr><w:trHeight w:val="284"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="3402" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="both"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/></w:rPr>
              <w:t xml:space="preserve">DATE : </w:t>
            </w:r>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(formattedDate)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4851" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr>
              <w:ind w:left="175"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/></w:rPr>
              <w:t xml:space="preserve">NOTE D'HONORAIRES N° </w:t>
            </w:r>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(invoice.invoice_number)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- 2 paragraphes vides avant le destinataire (exactement comme Facture_2026-103.docx) -->
    <w:p><w:pPr><w:ind w:left="3828"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="20"/></w:rPr></w:pPr></w:p>
    <w:p><w:pPr><w:ind w:left="3828"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="20"/></w:rPr></w:pPr></w:p>

    <!-- Bloc Destinataire / Client -->
    ${clientParagraphsXml}

    <!-- Paragraphes vides d'alignement avec Valentine Pécheux dans la colonne de gauche -->
    ${emptyLinesAfterClientXml}

    <!-- Références Dossier (AFFAIRE, OBJET, V/RÉF., N/RÉF.) alignées pile à 1050 dxa -->
    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="1050"/></w:tabs>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
        <w:ind w:left="1050" w:right="-567" w:hanging="1050"/>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>AFFAIRE&#160;:</w:t>
      </w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:tab/></w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>${escapeXml(invoice.case_title)}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="1050"/></w:tabs>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
        <w:ind w:left="1050" w:right="-567" w:hanging="1050"/>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>OBJET&#160;:</w:t>
      </w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:tab/></w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>${escapeXml(invoice.subject)}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="1050"/></w:tabs>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
        <w:ind w:left="1050" w:hanging="1050"/>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>V/RÉF.&#160;:</w:t>
      </w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:tab/></w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>${escapeXml(invoice.client_ref)}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="1050"/></w:tabs>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
        <w:ind w:left="1050" w:hanging="1050"/>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>N/RÉF.&#160;:</w:t>
      </w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:tab/></w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>${escapeXml(invoice.our_ref)}</w:t>
      </w:r>
    </w:p>

    <!-- 2 paragraphes vides avant le tableau (exactement comme Facture_2026-103.docx) -->
    <w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="993"/></w:tabs><w:spacing w:after="60" w:line="276" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p>
    <w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="993"/></w:tabs><w:spacing w:after="60" w:line="276" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p>

    <!-- Tableau des honoraires & frais : largeur exacte 6804 dxa (12,0 cm = cx 4320540 EMU) -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="${TABLE_WIDTH}" w:type="dxa"/>
        <w:tblInd w:w="0" w:type="dxa"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblCellMar>
          <w:top w:w="0" w:type="dxa"/>
          <w:left w:w="20" w:type="dxa"/>
          <w:bottom w:w="0" w:type="dxa"/>
          <w:right w:w="20" w:type="dxa"/>
        </w:tblCellMar>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="${COL_OBJET}"/>
        <w:gridCol w:w="${COL_QTE}"/>
        <w:gridCol w:w="${COL_TPS}"/>
        <w:gridCol w:w="${COL_PU}"/>
        <w:gridCol w:w="${COL_MT}"/>
      </w:tblGrid>

      <!-- Ligne d'en-tête avec filet bas fin -->
      <w:tr>
        <w:trPr><w:trHeight w:val="260"/></w:trPr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_OBJET}" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="0" w:after="40" w:line="220" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Objet</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_QTE}" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="center"/>
              <w:spacing w:before="0" w:after="40" w:line="220" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Qté</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_TPS}" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="center"/>
              <w:spacing w:before="0" w:after="40" w:line="220" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Tps</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_PU}" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="right"/>
              <w:spacing w:before="0" w:after="40" w:line="220" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Prix Unit. HT</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_MT}" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="right"/>
              <w:spacing w:before="0" w:after="40" w:line="220" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>
              <w:t>Mt HT</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Lignes de facturation -->
      ${itemRowsXml}

      <!-- Ligne d'espacement avant totaux -->
      <w:tr>
        <w:trPr><w:trHeight w:val="200"/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="${COL_LEFT_3}" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${COL_PU}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${COL_MT}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p></w:tc>
      </w:tr>

      <!-- Total HT -->
      <w:tr>
        <w:trPr><w:trHeight w:val="220"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="${COL_LEFT_3}" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_PU}" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="595959"/>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:ind w:left="40"/>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>Total HT</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_MT}" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="595959"/>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="right"/>
              <w:ind w:right="40"/>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>${escapeXml(formatFrCurrency(invoice.total_ht))}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- IBAN + Total TVA -->
      <w:tr>
        <w:trPr><w:trHeight w:val="220"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="${COL_LEFT_3}" w:type="dxa"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>IBAN : FR76 4061 8804 8500 0403 9019 162</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_PU}" w:type="dxa"/>
            <w:tcBorders><w:left w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:ind w:left="40"/>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>Total TVA</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_MT}" w:type="dxa"/>
            <w:tcBorders><w:right w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="right"/>
              <w:ind w:right="40"/>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>${escapeXml(formatFrCurrency(invoice.vat_amount))}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Code BIC + Total TTC -->
      <w:tr>
        <w:trPr><w:trHeight w:val="220"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="${COL_LEFT_3}" w:type="dxa"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>Code BIC : BOUS FRPP XXX</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_PU}" w:type="dxa"/>
            <w:tcBorders><w:left w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:ind w:left="40"/>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>Total TTC</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_MT}" w:type="dxa"/>
            <w:tcBorders><w:right w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="right"/>
              <w:ind w:right="40"/>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>${escapeXml(formatFrCurrency(invoice.total_ttc))}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Acompte -->
      <w:tr>
        <w:trPr><w:trHeight w:val="220"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="${COL_LEFT_3}" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_PU}" w:type="dxa"/>
            <w:tcBorders>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="595959"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:ind w:left="40"/>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>Acompte</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_MT}" w:type="dxa"/>
            <w:tcBorders>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="595959"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="right"/>
              <w:ind w:right="40"/>
              <w:spacing w:before="15" w:after="15" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="16"/></w:rPr>
              <w:t>${escapeXml(advanceDisplay)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Espacement avant Net à payer -->
      <w:tr>
        <w:trPr><w:trHeight w:val="140"/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="${COL_LEFT_3}" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${COL_PU}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${COL_MT}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p></w:tc>
      </w:tr>

      <!-- Net à payer (encadré gras) -->
      <w:tr>
        <w:trPr><w:trHeight w:val="260"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="${COL_LEFT_3}" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_PU}" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="12" w:space="0" w:color="262626"/>
              <w:left w:val="single" w:sz="12" w:space="0" w:color="262626"/>
              <w:bottom w:val="single" w:sz="12" w:space="0" w:color="262626"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:ind w:left="40"/>
              <w:spacing w:before="20" w:after="20" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="262626"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="262626"/><w:sz w:val="16"/></w:rPr>
              <w:t>Net à payer</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${COL_MT}" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="12" w:space="0" w:color="262626"/>
              <w:right w:val="single" w:sz="12" w:space="0" w:color="262626"/>
              <w:bottom w:val="single" w:sz="12" w:space="0" w:color="262626"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:jc w:val="right"/>
              <w:ind w:right="40"/>
              <w:spacing w:before="20" w:after="20" w:line="200" w:lineRule="auto"/>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="262626"/><w:sz w:val="16"/></w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="262626"/><w:sz w:val="16"/></w:rPr>
              <w:t>${escapeXml(formatFrCurrency(invoice.net_payable))}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="993"/></w:tabs><w:spacing w:after="60" w:line="276" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr></w:p>
    ${splitXml}
    <w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:i/><w:color w:val="006A8E"/><w:sz w:val="20"/></w:rPr></w:pPr></w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="both"/>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:i/><w:color w:val="006A8E"/><w:sz w:val="20"/></w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:i/><w:color w:val="006A8E"/><w:sz w:val="20"/></w:rPr>
        <w:t>Merci de votre confiance !</w:t>
      </w:r>
    </w:p>

    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId8"/>
      <w:footerReference w:type="default" r:id="rId9"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1985" w:right="1274" w:bottom="1417" w:left="3828" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', documentXml);
    return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  // Fallback programmatic generation if template file is missing
  const { Packer } = await import('docx');
  const doc = new Document({
    sections: [{ headers: { default: createVPHeader() }, footers: { default: createVPFooter() }, children: [] }],
  });
  return await Packer.toBuffer(doc);
}

const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDateLongFr(isoOrRaw?: string): string {
  const s = String(isoOrRaw || '').trim();
  if (!s) {
    const now = new Date();
    return `${now.getDate()} ${FRENCH_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    return `${d === 1 ? '1er' : d} ${FRENCH_MONTHS[m - 1] || ''} ${y}`.trim();
  }
  const frMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (frMatch) {
    const d = parseInt(frMatch[1], 10);
    const m = parseInt(frMatch[2], 10);
    const y = frMatch[3];
    return `${d === 1 ? '1er' : d} ${FRENCH_MONTHS[m - 1] || ''} ${y}`.trim();
  }
  return s;
}

function formatDateCompact(isoOrRaw?: string): string {
  const s = String(isoOrRaw || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}${iso[2]}${iso[1]}`;
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (fr) return `${fr[1]}${fr[2]}${fr[3]}`;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${now.getFullYear()}`;
}

function readImageDimensionsPx(buf: Buffer): { width: number; height: number; ext: 'png' | 'jpeg' | 'webp' } {
  // PNG header
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16) || 800;
    const height = buf.readUInt32BE(20) || 600;
    return { width, height, ext: 'png' };
  }
  // JPEG SOF scanner
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 8 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = buf.readUInt16BE(i + 5) || 600;
        const width = buf.readUInt16BE(i + 7) || 800;
        return { width, height, ext: 'jpeg' };
      }
      const segLen = buf.readUInt16BE(i + 2);
      if (segLen < 2) break;
      i += 2 + segLen;
    }
    return { width: 1200, height: 900, ext: 'jpeg' };
  }
  return { width: 1200, height: 900, ext: 'jpeg' };
}

function isLetterDeliverable(type: DeliverableType): boolean {
  return type === 'mise_en_cause' || type === 'convocation' || type === 'mec_convocation' || type === 'courrier_position';
}

export function getDeliverableTypeLabel(type: DeliverableType): string {
  switch (type) {
    case 'mise_en_cause': return 'Mise en cause';
    case 'convocation': return 'Convocation (Appel à expertise)';
    case 'mec_convocation': return 'Mise en cause - Appel à expertise';
    case 'courrier_position': return 'Courrier de position';
    case 'constatations': return 'Constatations contradictoires';
    case 'note_situation': return 'Note de situation';
    case 'note_technique': return 'Note technique';
    case 'rapport_ead': return 'Expertise sur pièces (EAD)';
    default: return 'Document d’expertise';
  }
}

export function buildDeliverableDefaults(
  mission: Partial<Mission>,
  options: Partial<DeliverableRequestPayload> = {},
  attendees: Attendee[] = [],
  damageLines: DamageLine[] = [],
  draft?: Partial<ReportDraft> | null
) {
  const deliverableType: DeliverableType = (options.deliverable_type || 'constatations') as DeliverableType;
  const docDateIso = options.doc_date || new Date().toISOString().slice(0, 10);
  const docDateLong = formatDateLongFr(docDateIso);
  const incidentDateLong = mission.incident_date ? formatDateLongFr(mission.incident_date) : 'XX XXXX XXXX';

  const firstAdverse = Array.isArray(mission.adverse_parties) && mission.adverse_parties.length > 0
    ? mission.adverse_parties[0]
    : null;

  const clientLabel = (mission.insured_party && mission.insured_party !== '= Client' && mission.insured_party !== 'N/A')
    ? `${mission.insured_party}${mission.insurance_client ? ` (${mission.insurance_client})` : ''}`
    : (mission.insurance_client || 'nos mandants');

  const guaranteeTxt = mission.guarantee_type ? `garantie ${mission.guarantee_type}` : 'police d’assurance';

  // Recipient defaults for letters
  const defaultRecipientName = options.recipient_name?.trim() ||
    [
      firstAdverse?.party_name,
      firstAdverse?.insurer_name ? `Assureur : ${firstAdverse.insurer_name}` : '',
      firstAdverse?.expert_firm ? `${firstAdverse.expert_firm}${firstAdverse.expert_name ? ` — ${firstAdverse.expert_name}` : ''}` : '',
    ].filter(Boolean).join('\n') ||
    (mission.third_parties || 'Partie mise en cause / Destinataire');

  const defaultSubject = options.subject?.trim() || (() => {
    switch (deliverableType) {
      case 'mise_en_cause': return 'Mise en cause';
      case 'convocation': return 'Appel à expertise contradictoire';
      case 'mec_convocation': return 'Mise en cause - Appel à expertise';
      case 'courrier_position': return 'Observations complémentaires / Position';
      case 'constatations': return `CONSTATATIONS DU ${docDateLong.toUpperCase()}`;
      case 'note_situation': return `NOTE DE SITUATION`;
      case 'note_technique': return `NOTE TECHNIQUE`;
      case 'rapport_ead': return `EXPERTISE SUR PIÈCES`;
      default: return 'DOCUMENT D’EXPERTISE';
    }
  })();

  const mandateIntro = `Nous intervenons en qualité d’experte à la demande de ${mission.insurance_client || '[Mandant]'}${
    mission.client_contact ? ` en la personne de ${mission.client_contact}` : ''
  }, et pour compte des assureurs, au titre d’un sinistre susceptible de mettre en jeu la ${guaranteeTxt}${
    mission.insured_party && mission.insured_party !== 'N/A' && mission.insured_party !== '= Client'
      ? ` de ${mission.insured_party}`
      : ''
  }.${mission.court_reference ? ` La présente procédure s’inscrit dans le cadre de l’instance devant ${mission.court_reference}${mission.judicial_expert ? ` (Expert judiciaire désigné : ${mission.judicial_expert})` : ''}.` : ''}`;

  const factsDefault = draft?.section_facts?.trim() ||
    (mission.description?.trim()
      ? `Le ${incidentDateLong}, ${mission.description.trim().replace(/^le\s+\d+[^,]*,\s*/i, '')}`
      : `Sinistre survenu le ${incidentDateLong} — circonstances détaillées à compléter.`);

  const contextLines: string[] = [];
  if (mission.insured_party && mission.insured_party !== 'N/A') {
    contextLines.push(`${mission.insured_party} intervient en qualité d’assuré / exploitant.`);
  }
  if (mission.insurer_company || mission.insurance_client) {
    contextLines.push(`Donneur d’ordre / Compagnie : ${mission.insurer_company || mission.insurance_client}${mission.case_reference ? ` (Réf. ${mission.case_reference})` : ''}.`);
  }
  if (mission.broker_name && mission.broker_name !== 'N/A') {
    contextLines.push(`Courtier : ${mission.broker_name}${mission.broker_reference ? ` (Réf. ${mission.broker_reference})` : ''}.`);
  }
  for (const adv of mission.adverse_parties || []) {
    if (!adv.party_name) continue;
    const extra = [adv.insurer_name, adv.expert_firm, adv.expert_name, adv.lawyer_name ? `Me ${adv.lawyer_name}` : ''].filter(Boolean).join(' — ');
    contextLines.push(`${adv.party_name}${extra ? ` : ${extra}` : ''}.`);
  }
  const contextDefault = contextLines.join('\n') || 'Interactions contractuelles des parties à préciser selon les éléments communiqués.';

  const posture = options.convocation_posture || 'convoque';
  const callerName = options.convocation_caller?.trim() || mission.insurance_client || 'notre mandant';
  const meetingDateTxt = options.meeting_date ? formatDateLongFr(options.meeting_date) : docDateLong;
  const meetingTimeTxt = options.meeting_time?.trim() || '10h00';
  const meetingPlaceTxt = [options.meeting_place?.trim(), options.meeting_address?.trim()].filter(Boolean).join('\n') || '[Lieu / Adresse des opérations à préciser]';

  let posturePhrase = '';
  if (posture === 'convoque') {
    posturePhrase = `Les constatations contradictoires se sont déroulées ${meetingDateTxt} à ${meetingTimeTxt}, à notre initiative, sur le site de :`;
  } else if (posture === 'convoquee') {
    posturePhrase = `Les constatations contradictoires se sont déroulées ${meetingDateTxt} à ${meetingTimeTxt}, sur convocation de ${callerName}, sur les lieux du sinistre :`;
  } else {
    posturePhrase = `Les constatations se sont déroulées ${meetingDateTxt} à ${meetingTimeTxt}, en présence spontanée des intervenants, à :`;
  }

  const observationsDefault = draft?.section_observations?.trim() ||
    draft?.raw_field_notes?.trim() ||
    'Constatations matérielles relevées lors de l’examen contradictoire :\n[Compléter / affiner les relevés techniques dans Word]';

  const analysisDefault = draft?.section_analysis?.trim() ||
    mission.preliminary_analysis?.trim() ||
    '[Section d’analyse technique et d’examen des causes réservée à l’experte dans Word]';

  const claimedTotal = damageLines.reduce((s, d) => s + Number(d.claimed_amount_ht ?? d.claimed_amount ?? 0), 0);
  const retainedTotal = damageLines.reduce((s, d) => s + Number(d.retained_amount_ht ?? d.retained_amount ?? 0), 0);
  const prejudiceDefault = damageLines.length > 0
    ? `Au stade actuel des justifications communiquées, le préjudice déclaré s’élève à ${formatFrCurrency(claimedTotal)} HT pour un montant retenu de ${formatFrCurrency(retainedTotal)} HT (détail ci-dessous).`
    : mission.stake_amount
      ? `En première instance, le préjudice est estimé à titre conservatoire à ${formatFrCurrency(mission.stake_amount)} HT, sous réserve des justificatifs définitifs.`
      : 'En l’attente de la communication des devis et factures définitifs de remise en état.';

  const conclusionDefault = draft?.section_conclusions?.trim() ||
    '[Conclusions provisoires / définitives et avis sur responsabilités à compléter dans Word]';

  // Default letter body
  const letterParagraphs: string[] = [
    `Nous intervenons en qualité d’experte, agissant pour le compte de ${clientLabel}, dans le cadre de l’affaire en objet, tous droits et moyens réservés.`,
    factsDefault,
  ];
  if (deliverableType === 'mise_en_cause' || deliverableType === 'mec_convocation') {
    letterParagraphs.push(
      `La responsabilité de ${firstAdverse?.party_name || 'votre société'} est susceptible d’être engagée dans la survenance de cet événement.`
    );
  }
  if (deliverableType === 'mise_en_cause') {
    letterParagraphs.push(
      'Nous vous remercions dès à présent de bien vouloir prendre toutes les mesures conservatoires permettant de préserver le contradictoire.',
      'Nous vous invitons à ouvrir un dossier de sinistre et à nous communiquer la référence correspondante ainsi que le nom du gestionnaire en charge du dossier.',
      'Nous ne manquerons pas de vous tenir informés de l’avancement des opérations et vous présenterons le quantum du préjudice dès qu’il sera consolidé.'
    );
  } else if (deliverableType === 'convocation' || deliverableType === 'mec_convocation') {
    letterParagraphs.push(
      'Nous vous remercions dès à présent de bien vouloir prendre toutes les mesures qui permettront de préserver le contradictoire en ce qui concerne les investigations à mener.',
      `Nous procéderons aux opérations d’expertise contradictoire le ${meetingDateTxt} à ${meetingTimeTxt} à l’adresse suivante :\n${meetingPlaceTxt}`,
      'Nous vous invitons à être présent ou à vous faire représenter et à répercuter la présente convocation à l’égard de vos éventuels sous-traitants ou autres tiers concernés.',
      'Il vous est loisible d’effectuer une déclaration de sinistre auprès de votre compagnie d’assurance qui pourra missionner l’expert de son choix.',
      'Dans le cas où vous n’assisteriez pas, ou ne seriez pas représenté à la réunion, vous vous exposeriez à ce que les constatations matérielles et l’évaluation des dommages faites à titre contradictoire vous soient opposables.'
    );
    if (options.include_epi !== false) {
      letterParagraphs.push(
        'Le jour de la réunion, les présents devront être équipés des EPI habituels (chaussures de sécurité, gilet haute visibilité et casque de sécurité).'
      );
    }
  } else if (deliverableType === 'courrier_position') {
    letterParagraphs.push(
      observationsDefault,
      prejudiceDefault
    );
  }

  const copyEmailsDefault = options.copy_emails !== undefined
    ? options.copy_emails
    : attendees.map((a) => a.email).filter(Boolean).join('\n');

  return {
    deliverable_type: deliverableType,
    doc_date: docDateIso,
    doc_date_long: docDateLong,
    subject: defaultSubject,
    recipient_name: defaultRecipientName,
    recipient_email: options.recipient_email || '',
    copy_emails: copyEmailsDefault,
    body_text: options.body_text ?? letterParagraphs.join('\n\n'),
    mandate_intro: mandateIntro,
    facts_text: options.facts_text ?? factsDefault,
    context_text: options.context_text ?? contextDefault,
    posture_phrase: posturePhrase,
    meeting_place: meetingPlaceTxt,
    observations_text: options.observations_text ?? observationsDefault,
    analysis_text: options.analysis_text ?? analysisDefault,
    prejudice_text: options.prejudice_text ?? prejudiceDefault,
    conclusion_text: options.conclusion_text ?? conclusionDefault,
    co_signer: options.co_signer ?? mission.co_signer ?? '',
    cover_title: deliverableType === 'constatations'
      ? `CONSTATATIONS DU ${docDateLong.toUpperCase()}`
      : deliverableType === 'note_situation'
        ? 'NOTE DE SITUATION'
        : deliverableType === 'note_technique'
          ? 'NOTE TECHNIQUE'
          : 'EXPERTISE SUR PIÈCES',
    cover_incident_date: `SINISTRE DU ${incidentDateLong.toUpperCase()}`,
    attendees_count: attendees.length,
    damage_lines_count: damageLines.length,
  };
}

function makeCourrierParagraphXml(
  text: string,
  opts: {
    indentLeft?: number;
    jc?: 'both' | 'right' | 'center' | 'left';
    bold?: boolean;
    italic?: boolean;
    color?: string;
    size?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    line?: number;
    prefixLabel?: string;
  } = {}
): string {
  const sz = opts.size ?? 20;
  const color = opts.color ?? '404040';
  const line = opts.line ?? 276;
  const ind = opts.indentLeft !== undefined ? `<w:ind w:left="${opts.indentLeft}"/>` : '';
  const jc = opts.jc ? `<w:jc w:val="${opts.jc}"/>` : '';
  const spacing = `<w:spacing${opts.spaceBefore !== undefined ? ` w:before="${opts.spaceBefore}"` : ''}${opts.spaceAfter !== undefined ? ` w:after="${opts.spaceAfter}"` : ''} w:line="${line}" w:lineRule="auto"/>`;
  const rPrBase = `<w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="${color}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${opts.italic ? '<w:i/>' : ''}`;
  const prefixRun = opts.prefixLabel
    ? `<w:r><w:rPr>${rPrBase}<w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(opts.prefixLabel)}</w:t></w:r>`
    : '';
  const mainRun = `<w:r><w:rPr>${rPrBase}${opts.bold ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  return `<w:p><w:pPr>${spacing}${ind}${jc}<w:rPr>${rPrBase}</w:rPr></w:pPr>${prefixRun}${mainRun}</w:p>`;
}

function makeReportParagraphXml(
  text: string,
  style: 'VPETitre1' | 'VPETitre2' | 'VPETexte' | 'VPEListe',
  opts: { pageBreakBefore?: boolean; bold?: boolean; italic?: boolean; jc?: 'center' | 'both' | 'left' | 'right'; indentLeft?: number; spaceBefore?: number; spaceAfter?: number } = {}
): string {
  const pPrInner = [
    `<w:pStyle w:val="${style}"/>`,
    opts.pageBreakBefore ? '<w:pageBreakBefore/>' : '',
    (opts.spaceBefore !== undefined || opts.spaceAfter !== undefined)
      ? `<w:spacing${opts.spaceBefore !== undefined ? ` w:before="${opts.spaceBefore}"` : ''}${opts.spaceAfter !== undefined ? ` w:after="${opts.spaceAfter}"` : ''}/>`
      : '',
    opts.indentLeft !== undefined ? `<w:ind w:left="${opts.indentLeft}"/>` : '',
    opts.jc ? `<w:jc w:val="${opts.jc}"/>` : '',
  ].filter(Boolean).join('');
  const rPrInner = [
    `<w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/>`,
    opts.bold ? '<w:b/>' : '',
    opts.italic ? '<w:i/>' : '',
  ].filter(Boolean).join('');
  return `<w:p><w:pPr>${pPrInner}</w:pPr><w:r>${rPrInner ? `<w:rPr>${rPrInner}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function makeSignatureDrawingXml(embedId: string, cx: number, cy: number, indentLeft: number): string {
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="40"/><w:ind w:left="${indentLeft}"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="901" name="Signature VP"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="901" name="signature_vp.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${embedId}" cstate="print"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function makeStyledTableXml(
  headers: string[],
  colWidths: number[],
  rows: string[][]
): string {
  const totalWidth = colWidths.reduce((s, w) => s + w, 0);
  const gridCols = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  const borders = `<w:tblBorders>
    <w:top w:val="single" w:sz="4" w:space="0" w:color="0D688D"/>
    <w:left w:val="single" w:sz="4" w:space="0" w:color="0D688D"/>
    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="0D688D"/>
    <w:right w:val="single" w:sz="4" w:space="0" w:color="0D688D"/>
    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="0D688D"/>
    <w:insideV w:val="single" w:sz="4" w:space="0" w:color="0D688D"/>
  </w:tblBorders>`;

  const headerRowXml = `<w:tr><w:trPr><w:tblHeader/><w:trHeight w:hRule="atLeast" w:val="360"/></w:trPr>${headers
    .map(
      (h, idx) =>
        `<w:tc><w:tcPr><w:tcW w:w="${colWidths[idx]}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F7FA"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="VPETexte"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(h)}</w:t></w:r></w:p></w:tc>`
    )
    .join('')}</w:tr>`;

  const bodyRowsXml = rows
    .map(
      (r) =>
        `<w:tr><w:trPr><w:trHeight w:hRule="atLeast" w:val="320"/></w:trPr>${r
          .map(
            (cell, idx) =>
              `<w:tc><w:tcPr><w:tcW w:w="${colWidths[idx]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="VPETexte"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`
          )
          .join('')}</w:tr>`
    )
    .join('');

  return `<w:tbl><w:tblPr><w:tblStyle w:val="Grilledutableau"/><w:tblW w:w="${totalWidth}" w:type="dxa"/>${borders}</w:tblPr><w:tblGrid>${gridCols}</w:tblGrid>${headerRowXml}${bodyRowsXml}</w:tbl>`;
}

function resolvePhotoBufferOnDisk(photo: Photo): Buffer | null {
  const cleanFilename = path.basename(photo.filename || '');
  if (!cleanFilename) return null;
  const candidatePaths = [
    process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR, cleanFilename) : '',
    path.resolve(process.cwd(), 'data/uploads', cleanFilename),
    path.resolve(process.cwd(), 'public/uploads', cleanFilename),
    path.resolve(process.cwd(), 'uploads', cleanFilename),
  ].filter(Boolean);
  const hit = candidatePaths.find((p) => fs.existsSync(p));
  if (!hit) return null;
  try {
    return fs.readFileSync(hit);
  } catch {
    return null;
  }
}

function isUsefulPhotoCaption(caption?: string): boolean {
  const c = String(caption || '').trim();
  if (!c) return false;
  if (/^(img|dsc|pxl|photo|capture|screenshot)[_-]?\d*\.(jpe?g|png|webp|heic)$/i.test(c)) return false;
  if (/^photo-\d+\.(jpe?g|png|webp)$/i.test(c)) return false;
  return true;
}

export interface GenerateDeliverableParams {
  mission: Partial<Mission>;
  options: DeliverableRequestPayload;
  attendees?: Attendee[];
  photos?: Photo[];
  damageLines?: DamageLine[];
  draft?: Partial<ReportDraft> | null;
}

export async function generateDeliverableDocx({
  mission,
  options,
  attendees = [],
  photos = [],
  damageLines = [],
  draft = null,
}: GenerateDeliverableParams): Promise<Buffer> {
  const defaults = buildDeliverableDefaults(mission, options, attendees, damageLines, draft);
  const type = defaults.deliverable_type;

  // 1. BRANCHE COURRIERS (Mise en cause / Convocation / MEC + Convocation / Position)
  if (isLetterDeliverable(type)) {
    const tplPath = path.resolve(process.cwd(), 'server/assets/template_courrier.docx');
    const zip = await JSZip.loadAsync(fs.readFileSync(tplPath));
    let docXml = await zip.file('word/document.xml')!.async('string');

    const bodyParts: string[] = [];
    // Bloc destinataire (indented 2977)
    const recipientLines = (defaults.recipient_name || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of recipientLines) {
      bodyParts.push(makeCourrierParagraphXml(line, { indentLeft: 2977, spaceAfter: 0 }));
    }
    if (options.recipient_email?.trim()) {
      bodyParts.push(makeCourrierParagraphXml(options.recipient_email.trim(), { indentLeft: 2977, color: '0563C1', spaceAfter: 120 }));
    } else {
      bodyParts.push(makeCourrierParagraphXml('', { indentLeft: 2977, spaceAfter: 120 }));
    }

    bodyParts.push(makeCourrierParagraphXml('Envoi par courriel et courrier recommandé AR', { indentLeft: 2552, spaceBefore: 80, spaceAfter: 180 }));
    bodyParts.push(makeCourrierParagraphXml(mission.code || '', { prefixLabel: 'N/Réf. : ', spaceAfter: 20 }));
    if (mission.case_reference) {
      bodyParts.push(makeCourrierParagraphXml(mission.case_reference, { prefixLabel: 'V/Réf. : ', spaceAfter: 20 }));
    }
    bodyParts.push(makeCourrierParagraphXml(mission.title || '', { prefixLabel: 'Affaire : ', spaceAfter: 20 }));
    bodyParts.push(makeCourrierParagraphXml(defaults.subject, { prefixLabel: 'Objet : ', bold: true, spaceAfter: 180 }));
    bodyParts.push(makeCourrierParagraphXml(`Asnières-sur-Seine, le ${defaults.doc_date_long}`, { jc: 'right', spaceAfter: 180 }));
    bodyParts.push(makeCourrierParagraphXml('Madame, Monsieur,', { jc: 'both', spaceAfter: 140 }));

    // Paragraphes du corps
    const rawParas = defaults.body_text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const para of rawParas) {
      const subLines = para.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      // Detect centered meeting place block right after address header
      const isAddressBlock = subLines.length >= 2 && /à l’adresse suivante\s*:$/i.test(subLines[0]);
      if (isAddressBlock) {
        bodyParts.push(makeCourrierParagraphXml(subLines[0], { jc: 'both', spaceAfter: 80 }));
        for (const addrLine of subLines.slice(1)) {
          bodyParts.push(makeCourrierParagraphXml(addrLine, { jc: 'center', bold: false, spaceAfter: 20 }));
        }
        bodyParts.push(makeCourrierParagraphXml('', { spaceAfter: 80 }));
      } else {
        for (const l of subLines) {
          bodyParts.push(makeCourrierParagraphXml(l, { jc: 'both', spaceAfter: 120 }));
        }
      }
    }

    bodyParts.push(
      makeCourrierParagraphXml(
        'Nous vous prions d’agréer, Madame, Monsieur, l’expression de nos salutations distinguées.',
        { jc: 'both', spaceBefore: 120, spaceAfter: 80 }
      )
    );

    // Signature PNG embedded as rId8 in template_courrier.docx (1370906 x 508662 EMU)
    bodyParts.push(makeSignatureDrawingXml('rId8', 1370906, 508662, 3544));
    bodyParts.push(
      makeCourrierParagraphXml(
        defaults.co_signer ? `Valentine Pécheux & ${defaults.co_signer}` : 'Valentine Pécheux',
        { indentLeft: 3544, bold: true, spaceAfter: 160 }
      )
    );

    const copyLines = (defaults.copy_emails || '').split(/\r?\n|,|;/).map((s) => s.trim()).filter(Boolean);
    if (copyLines.length > 0) {
      copyLines.forEach((email, idx) => {
        bodyParts.push(
          makeCourrierParagraphXml(email, {
            prefixLabel: idx === 0 ? 'Copie : ' : '            ',
            color: '0563C1',
            spaceAfter: 20,
          })
        );
      });
    }

    docXml = docXml.replace('{{COURRIER_BODY_XML}}', bodyParts.join(''));
    zip.file('word/document.xml', docXml);
    return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  // 2. BRANCHE RAPPORTS & NOTES (Constatations / Note de situation / Note technique / EAD)
  const tplPath = path.resolve(process.cwd(), 'server/assets/template_rapport.docx');
  const zip = await JSZip.loadAsync(fs.readFileSync(tplPath));
  let docXml = await zip.file('word/document.xml')!.async('string');
  let relsXml = await zip.file('word/_rels/document.xml.rels')!.async('string');
  let ctXml = await zip.file('[Content_Types].xml')!.async('string');
  let footer1Xml = zip.file('word/footer1.xml') ? await zip.file('word/footer1.xml')!.async('string') : '';

  // Fill cover & running footer tokens
  const docTag = type === 'constatations'
    ? 'CONSTATATIONS'
    : type === 'note_situation'
      ? 'NOTE_SITUATION'
      : type === 'note_technique'
        ? 'NOTE_TECHNIQUE'
        : 'EAD';
  docXml = docXml
    .replace(/\{\{COVER_AFFAIRE\}\}/g, escapeXml(mission.title || ''))
    .replace(/\{\{COVER_V_REF\}\}/g, escapeXml(mission.case_reference || '—'))
    .replace(/\{\{COVER_N_REF\}\}/g, escapeXml(mission.code || ''))
    .replace(/\{\{COVER_DOC_TITLE\}\}/g, escapeXml(defaults.cover_title))
    .replace(/\{\{COVER_INCIDENT_DATE\}\}/g, escapeXml(defaults.cover_incident_date));

  if (footer1Xml) {
    footer1Xml = footer1Xml
      .replace(/\{\{FOOTER_CODE\}\}/g, escapeXml(mission.code || ''))
      .replace(/\{\{FOOTER_CLIENT_REF\}\}/g, escapeXml(mission.case_reference || '—'))
      .replace(/\{\{FOOTER_DOC_TAG\}\}/g, escapeXml(docTag))
      .replace(/\{\{FOOTER_DATE\}\}/g, escapeXml(formatDateCompact(defaults.doc_date)));
    zip.file('word/footer1.xml', footer1Xml);
  }

  const bodyParts: string[] = [];

  // 1. INTRODUCTION (Page 2 start)
  bodyParts.push(makeReportParagraphXml('INTRODUCTION', 'VPETitre1', { pageBreakBefore: true }));
  bodyParts.push(makeReportParagraphXml(defaults.mandate_intro, 'VPETexte'));
  bodyParts.push(
    makeReportParagraphXml(
      'Le présent document est établi tous droits et moyens de nos requérants réservés et sous toutes réserves des conditions et clauses de la police d’assurance.',
      'VPETexte'
    )
  );
  bodyParts.push(makeReportParagraphXml('Circonstances de l’affaire', 'VPETitre2'));
  for (const line of defaults.facts_text.split(/\r?\n/).filter((l) => l.trim())) {
    bodyParts.push(makeReportParagraphXml(line.trim(), 'VPETexte'));
  }

  bodyParts.push(makeReportParagraphXml('Libellé de la présente mission', 'VPETitre2'));
  const missionScopeItems = [
    'Prendre connaissance du dossier et des pièces communiquées,',
    'Participer aux opérations d’expertise contradictoire,',
    'Déterminer les causes et origines du sinistre,',
    'Évaluer le quantum du préjudice,',
    'Rédiger le présent document et formaliser l’avis technique.',
  ];
  for (const item of missionScopeItems) {
    bodyParts.push(makeReportParagraphXml(item, 'VPEListe'));
  }

  // 2. ÉLÉMENTS CONTEXTUELS
  bodyParts.push(makeReportParagraphXml('ÉLÉMENTS CONTEXTUELS DE L’EXPERTISE', 'VPETitre1'));
  bodyParts.push(makeReportParagraphXml('Documents communiqués', 'VPETitre2'));
  bodyParts.push(makeReportParagraphXml('Les éléments techniques et contractuels nous ont été remis par nos mandants et les parties.', 'VPETexte'));
  bodyParts.push(makeReportParagraphXml('Interactions contractuelles des parties', 'VPETitre2'));
  for (const line of defaults.context_text.split(/\r?\n/).filter((l) => l.trim())) {
    bodyParts.push(makeReportParagraphXml(line.trim(), 'VPETexte'));
  }

  // 3. DÉROULEMENT & PARTICIPANTS (3-column exact table: Nom | Qualité | Partie représentée)
  const filteredAttendees = options.attendee_filter_meeting
    ? attendees.filter((a) => !a.meeting_label || a.meeting_label === options.attendee_filter_meeting)
    : attendees;

  if (type === 'constatations' || type === 'note_situation' || filteredAttendees.length > 0) {
    bodyParts.push(makeReportParagraphXml('DÉROULEMENT DE L’EXPERTISE', 'VPETitre1'));
    bodyParts.push(makeReportParagraphXml(defaults.posture_phrase, 'VPETexte'));
    for (const loc of defaults.meeting_place.split(/\r?\n/).filter((l) => l.trim())) {
      bodyParts.push(makeReportParagraphXml(loc.trim(), 'VPETexte', { jc: 'center', spaceAfter: 40 }));
    }
    bodyParts.push(makeReportParagraphXml('Présents :', 'VPETexte', { spaceBefore: 120, spaceAfter: 80 }));
    if (filteredAttendees.length > 0) {
      bodyParts.push(
        makeStyledTableXml(
          ['Nom', 'Qualité', 'Partie représentée'],
          [2689, 4110, 1994],
          filteredAttendees.map((a) => [
            a.name || '—',
            a.role || (a.present_remote && !a.present_on_site ? 'Participant (Visio)' : '—'),
            a.organization || '—',
          ])
        )
      );
      bodyParts.push(makeReportParagraphXml('', 'VPETexte', { spaceAfter: 120 }));
    } else {
      bodyParts.push(makeReportParagraphXml('Liste des présents à compléter ou scanner depuis la feuille d’émargement.', 'VPETexte', { italic: true }));
    }
  }

  // 4. CONSTATATIONS & GRILLE PHOTOS 2 COLONNES
  bodyParts.push(makeReportParagraphXml(type === 'rapport_ead' ? 'EXPERTISE SUR PIÈCES' : 'CONSTATATIONS', 'VPETitre1'));
  for (const obsLine of defaults.observations_text.split(/\r?\n/).filter((l) => l.trim())) {
    bodyParts.push(makeReportParagraphXml(obsLine.trim(), 'VPETexte'));
  }

  const selectedPhotos = (options.include_photos === false ? [] : photos).filter((p) => p.is_selected_for_report);
  if (selectedPhotos.length > 0) {
    bodyParts.push(makeReportParagraphXml('Photographies et illustrations terrain', 'VPETitre2'));
    let nextPhotoId = 500;
    const ensureExtInCt = (ext: string) => {
      if (!ctXml.includes(`Extension="${ext}"`)) {
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        ctXml = ctXml.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`);
      }
    };

    // Build 2-column borderless photo grid (4535 twips per col matching VP2026649_Constatations_V3VP.docx)
    const gridRows: string[] = [];
    const colWidthEmu = 2784475; // exact width from VP2026649 (~292 px)
    for (let i = 0; i < selectedPhotos.length; i += 2) {
      const pair = [selectedPhotos[i], selectedPhotos[i + 1]];
      const cellsXml = pair.map((ph) => {
        if (!ph) {
          return `<w:tc><w:tcPr><w:tcW w:w="4535" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="VPETexte"/></w:pPr></w:p></w:tc>`;
        }
        const buf = resolvePhotoBufferOnDisk(ph);
        if (!buf) {
          return `<w:tc><w:tcPr><w:tcW w:w="4535" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:pStyle w:val="VPETexte"/><w:jc w:val="center"/></w:pPr><w:r><w:t>[Photo : ${escapeXml(ph.original_name)}]</w:t></w:r></w:p></w:tc>`;
        }
        const dims = readImageDimensionsPx(buf);
        const ext = dims.ext === 'png' ? 'png' : 'jpeg';
        ensureExtInCt(ext);
        nextPhotoId++;
        const rId = `rIdPhoto${nextPhotoId}`;
        const mediaName = `photo_${nextPhotoId}.${ext}`;
        zip.file(`word/media/${mediaName}`, buf);
        relsXml = relsXml.replace(
          '</Relationships>',
          `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`
        );
        const cy = Math.round((colWidthEmu * dims.height) / Math.max(1, dims.width));
        const imgXml = `<w:p><w:pPr><w:pStyle w:val="VPETexte"/><w:spacing w:after="40"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${colWidthEmu}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${nextPhotoId}" name="${escapeXml(mediaName)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${nextPhotoId}" name="${escapeXml(mediaName)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" cstate="print"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${colWidthEmu}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
        const captionXml = isUsefulPhotoCaption(ph.caption)
          ? `<w:p><w:pPr><w:pStyle w:val="VPETexte"/><w:spacing w:after="120"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:sz w:val="18"/></w:rPr><w:t>${escapeXml(ph.caption)}</w:t></w:r></w:p>`
          : `<w:p><w:pPr><w:pStyle w:val="VPETexte"/><w:spacing w:after="120"/></w:pPr></w:p>`;
        return `<w:tc><w:tcPr><w:tcW w:w="4535" w:type="dxa"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar><w:vAlign w:val="top"/></w:tcPr>${imgXml}${captionXml}</w:tc>`;
      });
      gridRows.push(`<w:tr><w:trPr><w:jc w:val="center"/></w:trPr>${cellsXml.join('')}</w:tr>`);
    }

    bodyParts.push(
      `<w:tbl><w:tblPr><w:tblStyle w:val="Grilledutableau"/><w:tblW w:w="9070" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4535"/><w:gridCol w:w="4535"/></w:tblGrid>${gridRows.join('')}</w:tbl>`
    );
  }

  // 5. ANALYSE – DISCUSSION (Espace réservé à l'experte dans Word)
  bodyParts.push(makeReportParagraphXml('ANALYSE – DISCUSSION', 'VPETitre1'));
  for (const aLine of defaults.analysis_text.split(/\r?\n/).filter((l) => l.trim())) {
    bodyParts.push(makeReportParagraphXml(aLine.trim(), 'VPETexte', { italic: !draft?.section_analysis && !mission.preliminary_analysis }));
  }

  // 6. ÉVALUATION DU PRÉJUDICE
  bodyParts.push(makeReportParagraphXml('ÉVALUATION DU PRÉJUDICE', 'VPETitre1'));
  bodyParts.push(makeReportParagraphXml(defaults.prejudice_text, 'VPETexte'));
  if (options.include_damage_table !== false && damageLines.length > 0) {
    const claimedTot = damageLines.reduce((s, l) => s + Number(l.claimed_amount_ht ?? l.claimed_amount ?? 0), 0);
    const retainedTot = damageLines.reduce((s, l) => s + Number(l.retained_amount_ht ?? l.retained_amount ?? 0), 0);
    const dmgRows = damageLines.map((l) => [
      l.label || '—',
      formatFrCurrency(Number(l.claimed_amount_ht ?? l.claimed_amount ?? 0)),
      formatFrCurrency(Number(l.retained_amount_ht ?? l.retained_amount ?? 0)),
      l.comment || l.notes || '—',
    ]);
    dmgRows.push(['TOTAL PRÉJUDICE HT', formatFrCurrency(claimedTot), formatFrCurrency(retainedTot), '']);
    bodyParts.push(
      makeStyledTableXml(
        ['Poste / Désignation', 'Réclamé HT', 'Retenu HT', 'Observations'],
        [3200, 1600, 1600, 2670],
        dmgRows
      )
    );
    bodyParts.push(makeReportParagraphXml('', 'VPETexte', { spaceAfter: 120 }));
  }

  // 7. CONCLUSION & SIGNATURE VP
  bodyParts.push(makeReportParagraphXml('CONCLUSION', 'VPETitre1'));
  for (const cLine of defaults.conclusion_text.split(/\r?\n/).filter((l) => l.trim())) {
    bodyParts.push(makeReportParagraphXml(cLine.trim(), 'VPETexte', { italic: !draft?.section_conclusions }));
  }
  bodyParts.push(
    makeReportParagraphXml(`Fait à Asnières-sur-Seine, le ${defaults.doc_date_long}`, 'VPETexte', { spaceBefore: 160, spaceAfter: 80 })
  );
  // Signature rId8 present in template_rapport.docx
  bodyParts.push(makeSignatureDrawingXml('rId8', 1370906, 508662, 4961));
  bodyParts.push(
    makeReportParagraphXml(
      defaults.co_signer ? `Valentine Pécheux & ${defaults.co_signer}` : 'Valentine Pécheux',
      'VPETexte',
      { indentLeft: 4961, bold: true, spaceAfter: 0 }
    )
  );

  docXml = docXml.replace('{{RAPPORT_BODY_XML}}', bodyParts.join(''));
  zip.file('word/document.xml', docXml);
  zip.file('word/_rels/document.xml.rels', relsXml);
  zip.file('[Content_Types].xml', ctXml);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function generateReportDocx(
  draft: ReportDraft,
  missionTitle: string,
  caseRef: string,
  attendees: Attendee[] = [],
  photos: Photo[] = [],
  missionOverride?: Partial<Mission>,
  damageLines: DamageLine[] = []
): Promise<Buffer> {
  const mission: Partial<Mission> = missionOverride || {
    id: draft.mission_id,
    code: draft.mission_code,
    title: missionTitle,
    case_reference: caseRef,
    insurance_client: 'Mandant',
  };
  return generateDeliverableDocx({
    mission,
    options: {
      deliverable_type: 'constatations',
      include_photos: true,
      include_damage_table: damageLines.length > 0,
    },
    attendees,
    photos,
    damageLines,
    draft,
  });
}
