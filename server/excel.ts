import ExcelJS from 'exceljs';
import { AccountingEntry, Invoice } from '../shared/types.js';

export async function generateMonthlyComptaWorkbook(
  monthLabel: string, // e.g. "Octobre 2026"
  entries: AccountingEntry[],
  invoices: Invoice[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VP Expertise';
  workbook.created = new Date();

  // 1. Monthly VAT Sheet (e.g. "Octobre 2026")
  const sheet = workbook.addWorksheet(monthLabel, {
    views: [{ showGridLines: true }],
  });

  // Header banner
  sheet.mergeCells('G1:I1');
  sheet.getCell('G1').value = 'Dépenses';
  sheet.getCell('G1').alignment = { horizontal: 'center' };
  sheet.getCell('G1').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('G1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE123C' }, // Crimson for expenses
  };

  sheet.mergeCells('J1:L1');
  sheet.getCell('J1').value = 'Recettes';
  sheet.getCell('J1').alignment = { horizontal: 'center' };
  sheet.getCell('J1').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('J1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F3854' }, // Petrol blue for receipts
  };

  // Column headers in Row 2
  const headers = [
    'Pièce', 'Date', 'Facture', 'Dossier', 'Objet', 'Client / Fournisseur',
    'Montant HT', 'TVA', 'Montant TTC',
    'Montant HT', 'TVA', 'Montant TTC',
    'Commentaires'
  ];

  const headerRow = sheet.getRow(2);
  headerRow.values = headers;
  headerRow.font = { bold: true };
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' },
    };
    if (colNumber >= 7 && colNumber <= 12) {
      cell.alignment = { horizontal: 'right' };
    }
  });

  // Set column widths
  sheet.columns = [
    { width: 10 }, // Pièce
    { width: 12 }, // Date
    { width: 14 }, // Facture
    { width: 14 }, // Dossier
    { width: 32 }, // Objet
    { width: 26 }, // Client / Fournisseur
    { width: 14 }, // Dépense HT
    { width: 12 }, // Dépense TVA
    { width: 14 }, // Dépense TTC
    { width: 14 }, // Recette HT
    { width: 12 }, // Recette TVA
    { width: 14 }, // Recette TTC
    { width: 30 }, // Commentaires
  ];

  let rowIndex = 3;
  for (const entry of entries) {
    const row = sheet.getRow(rowIndex);
    const dateFormatted = entry.date.split('-').reverse().join('/');
    
    row.getCell(1).value = entry.piece_number || '';
    row.getCell(2).value = dateFormatted;
    row.getCell(3).value = entry.invoice_number || '';
    row.getCell(4).value = entry.mission_code || '';
    row.getCell(5).value = entry.object;
    row.getCell(6).value = entry.party;

    if (entry.type === 'depense') {
      row.getCell(7).value = entry.amount_ht;
      row.getCell(8).value = entry.vat_amount;
      row.getCell(9).value = entry.amount_ttc;
      row.getCell(7).numFmt = '#,##0.00 €';
      row.getCell(8).numFmt = '#,##0.00 €';
      row.getCell(9).numFmt = '#,##0.00 €';
    } else {
      row.getCell(10).value = entry.amount_ht;
      row.getCell(11).value = entry.vat_amount;
      row.getCell(12).value = entry.amount_ttc;
      row.getCell(10).numFmt = '#,##0.00 €';
      row.getCell(11).numFmt = '#,##0.00 €';
      row.getCell(12).numFmt = '#,##0.00 €';
    }

    row.getCell(13).value = entry.comment || '';
    rowIndex++;
  }

  // Total summary row
  const totalRow = sheet.getRow(rowIndex + 1);
  totalRow.getCell(6).value = 'TOTAUX DU MOIS';
  totalRow.getCell(6).font = { bold: true };
  totalRow.getCell(6).alignment = { horizontal: 'right' };

  totalRow.getCell(7).value = { formula: `SUM(G3:G${rowIndex - 1})` };
  totalRow.getCell(8).value = { formula: `SUM(H3:H${rowIndex - 1})` };
  totalRow.getCell(9).value = { formula: `SUM(I3:I${rowIndex - 1})` };
  totalRow.getCell(10).value = { formula: `SUM(J3:J${rowIndex - 1})` };
  totalRow.getCell(11).value = { formula: `SUM(K3:K${rowIndex - 1})` };
  totalRow.getCell(12).value = { formula: `SUM(L3:L${rowIndex - 1})` };

  [7, 8, 9, 10, 11, 12].forEach(col => {
    const c = totalRow.getCell(col);
    c.font = { bold: true };
    c.numFmt = '#,##0.00 €';
    c.border = { top: { style: 'thin' }, bottom: { style: 'double' } };
  });

  // 2. Factures 2026 Sheet (Suivi des encaissements)
  const facturesSheet = workbook.addWorksheet('Factures 2026', {
    views: [{ showGridLines: true }],
  });

  facturesSheet.getRow(1).values = [
    'Date', 'Facture', 'Dossier', 'Client', 'Montant HT', 'TVA', 'Montant TTC', 'Mode paiement', 'Date crédit'
  ];
  facturesSheet.getRow(1).font = { bold: true };
  facturesSheet.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = { bottom: { style: 'medium' } };
  });

  facturesSheet.columns = [
    { width: 12 }, { width: 14 }, { width: 14 }, { width: 24 },
    { width: 14 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 14 }
  ];

  let fRowIndex = 2;
  for (const inv of invoices) {
    const row = facturesSheet.getRow(fRowIndex);
    row.getCell(1).value = inv.date.split('-').reverse().join('/');
    row.getCell(2).value = inv.invoice_number;
    row.getCell(3).value = inv.mission_code;
    row.getCell(4).value = inv.client_name;
    row.getCell(5).value = inv.total_ht;
    row.getCell(6).value = inv.vat_amount;
    row.getCell(7).value = inv.total_ttc;
    row.getCell(8).value = inv.payment_method || (inv.status === 'regle' ? 'Virement' : '');
    row.getCell(9).value = inv.payment_date ? inv.payment_date.split('-').reverse().join('/') : '';

    [5, 6, 7].forEach(col => {
      row.getCell(col).numFmt = '#,##0.00 €';
    });
    fRowIndex++;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
