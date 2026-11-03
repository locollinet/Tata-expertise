import { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ImageRun, Header, Footer } from 'docx';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { Invoice, ReportDraft, Attendee, Photo } from '../shared/types.js';

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
          <w:spacing w:after="0" w:line="276" w:lineRule="auto"/>
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

    const lines = invoice.lines || [];
    const itemRowsXml = lines
      .map(line => {
        const tpsText =
          line.time_spent !== null && line.time_spent !== undefined
            ? formatFrNumber(line.time_spent)
            : '';
        return `
        <w:tr>
          <w:trPr><w:trHeight w:val="340"/></w:trPr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="4053" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
                <w:t>${escapeXml(line.description)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="750" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
                <w:t>${escapeXml(formatFrNumber(line.quantity))}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="750" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
                <w:t>${escapeXml(tpsText)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="1350" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:jc w:val="right"/><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
                <w:t>${escapeXml(formatFrCurrency(line.unit_price_ht))}</w:t>
              </w:r>
            </w:p>
          </w:tc>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="1350" w:type="dxa"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:jc w:val="right"/><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r>
                <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
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
        : '-   €';

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
    <!-- En-tête Date & Numéro de Note d'Honoraires -->
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
            <w:pPr><w:jc w:val="both"/></w:pPr>
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
            <w:pPr><w:ind w:left="175"/></w:pPr>
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

    <w:p><w:pPr><w:ind w:left="3828"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="20"/></w:rPr></w:pPr></w:p>

    <!-- Bloc Destinataire / Client -->
    ${clientParagraphsXml}

    <w:p><w:pPr><w:ind w:left="3828"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="20"/></w:rPr></w:pPr></w:p>
    <w:p><w:pPr><w:ind w:left="3828"/><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/></w:rPr></w:pPr></w:p>

    <!-- Références Dossier (AFFAIRE, OBJET, V/RÉF., N/RÉF.) -->
    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="993"/></w:tabs>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
        <w:ind w:left="993" w:right="-567" w:hanging="993"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t xml:space="preserve">AFFAIRE : </w:t>
      </w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/></w:rPr><w:tab/></w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>${escapeXml(invoice.case_title)}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="993"/></w:tabs>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
        <w:ind w:left="993" w:right="-567" w:hanging="993"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t xml:space="preserve">OBJET : </w:t>
      </w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/></w:rPr><w:tab/></w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>${escapeXml(invoice.subject)}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="993"/></w:tabs>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
        <w:ind w:left="992" w:hanging="992"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>V/RÉF.&#160;:</w:t>
      </w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/></w:rPr><w:tab/></w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>${escapeXml(invoice.client_ref)}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="993"/></w:tabs>
        <w:spacing w:after="60" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="006A8E"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>N/RÉF.&#160;:</w:t>
      </w:r>
      <w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="18"/></w:rPr><w:tab/></w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="404040"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
        <w:t>${escapeXml(invoice.our_ref)}</w:t>
      </w:r>
    </w:p>

    <w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>

    <!-- Tableau des honoraires & frais (Format Century Gothic identique au registre Excel) -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="8253" w:type="dxa"/>
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
        <w:gridCol w:w="4053"/>
        <w:gridCol w:w="750"/>
        <w:gridCol w:w="750"/>
        <w:gridCol w:w="1350"/>
        <w:gridCol w:w="1350"/>
      </w:tblGrid>

      <!-- Ligne d'en-tête avec filet bas fin -->
      <w:tr>
        <w:trPr><w:trHeight w:val="320"/></w:trPr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="4053" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>Objet</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="750" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>Qté</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="750" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>Tps</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>Prix Unit. HT</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders><w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
              <w:t>Mt HT</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Lignes de facturation -->
      ${itemRowsXml}

      <!-- Ligne d'espacement avant totaux -->
      <w:tr>
        <w:trPr><w:trHeight w:val="260"/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="5553" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr><w:p/></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1350" w:type="dxa"/></w:tcPr><w:p/></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1350" w:type="dxa"/></w:tcPr><w:p/></w:tc>
      </w:tr>

      <!-- Total HT -->
      <w:tr>
        <w:trPr><w:trHeight w:val="280"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5553" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>
          <w:p/>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="595959"/>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:ind w:left="80"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>Total HT</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="595959"/>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:ind w:right="80"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(formatFrCurrency(invoice.total_ht))}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- IBAN + Total TVA -->
      <w:tr>
        <w:trPr><w:trHeight w:val="280"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5553" w:type="dxa"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>IBAN : FR76 4061 8804 8500 0403 9019 162</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders><w:left w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:ind w:left="80"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>Total TVA</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders><w:right w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:ind w:right="80"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(formatFrCurrency(invoice.vat_amount))}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Code BIC + Total TTC -->
      <w:tr>
        <w:trPr><w:trHeight w:val="280"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5553" w:type="dxa"/><w:gridSpan w:val="3"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>Code BIC : BOUS FRPP XXX</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders><w:left w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:ind w:left="80"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>Total TTC</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders><w:right w:val="single" w:sz="6" w:space="0" w:color="595959"/></w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:ind w:right="80"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(formatFrCurrency(invoice.total_ttc))}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Acompte -->
      <w:tr>
        <w:trPr><w:trHeight w:val="280"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5553" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>
          <w:p/>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="595959"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:ind w:left="80"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>Acompte </w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="595959"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:ind w:right="80"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(advanceDisplay)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- Espacement avant Net à payer -->
      <w:tr>
        <w:trPr><w:trHeight w:val="180"/></w:trPr>
        <w:tc><w:tcPr><w:tcW w:w="5553" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr><w:p/></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1350" w:type="dxa"/></w:tcPr><w:p/></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1350" w:type="dxa"/></w:tcPr><w:p/></w:tc>
      </w:tr>

      <!-- Net à payer (encadré gras) -->
      <w:tr>
        <w:trPr><w:trHeight w:val="320"/></w:trPr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5553" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>
          <w:p/>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="12" w:space="0" w:color="595959"/>
              <w:left w:val="single" w:sz="12" w:space="0" w:color="595959"/>
              <w:bottom w:val="single" w:sz="12" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:ind w:left="80"/><w:spacing w:before="30" w:after="30"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>Net à payer </w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1350" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="12" w:space="0" w:color="595959"/>
              <w:right w:val="single" w:sz="12" w:space="0" w:color="595959"/>
              <w:bottom w:val="single" w:sz="12" w:space="0" w:color="595959"/>
            </w:tcBorders>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="right"/><w:ind w:right="80"/><w:spacing w:before="30" w:after="30"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:b/><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr>
              <w:t>${escapeXml(formatFrCurrency(invoice.net_payable))}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>
    <w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>

    <w:p>
      <w:pPr><w:jc w:val="both"/></w:pPr>
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
