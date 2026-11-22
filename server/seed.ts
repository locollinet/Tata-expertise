import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDatabase } from './db.js';

interface HistoricalSeedPayload {
  missions: Array<Record<string, any>>;
  invoices: Array<Record<string, any>>;
  credit_notes: Array<Record<string, any>>;
  activities: Array<Record<string, any>>;
  expenses: Array<Record<string, any>>;
  accounting_entries: Array<Record<string, any>>;
  report_drafts: Array<Record<string, any>>;
}

function resolveSeedJsonPath(): string {
  const cwdCandidate = path.resolve(process.cwd(), 'server/data/historical_seed.json');
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, 'data/historical_seed.json');
}

export function seedData() {
  const missionCount = db.prepare('SELECT COUNT(*) as count FROM missions').get() as { count: number };
  if (missionCount.count > 0) {
    return;
  }

  const seedPath = resolveSeedJsonPath();
  if (!fs.existsSync(seedPath)) {
    console.warn(`[seed] Missing historical seed file at ${seedPath}, skipping historical seed.`);
    return;
  }

  const payload = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as HistoricalSeedPayload;

  const insertMission = db.prepare(`
    INSERT INTO missions (
      id, code, title, case_reference, guarantee_type, status, insurance_client, client_contact,
      insurer_company, insured_party, insured_contact, insured_reference, broker_name, broker_reference,
      client_lawyer, third_parties, adverse_parties, stake_amount, initial_stake_amount, stake_history,
      court_reference, judicial_expert, is_judicial, co_signer, incident_date, reception_date,
      description, preliminary_analysis, pv_dommages_date, expertise_operations,
      current_step, next_action, next_deadline, billing_contact_name, billing_address,
      custom_hourly_rate, custom_travel_rate, custom_km_rate
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (
      id, invoice_number, mission_id, mission_code, client_name, client_address, subject, case_title,
      client_ref, our_ref, date, total_ht, vat_rate, vat_amount, total_ttc, advance_amount, net_payable,
      status, payment_date, payment_method, paid_amount, split_details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInvoiceLine = db.prepare(`
    INSERT INTO invoice_lines (
      id, invoice_id, activity_id, expense_id, description, quantity, time_spent, unit_price_ht, total_ht, order_index
    ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)
  `);

  const insertCreditNote = db.prepare(`
    INSERT INTO credit_notes (
      id, credit_number, original_invoice_id, original_invoice_number, mission_id, mission_code,
      date, reason, total_ht, vat_amount, total_ttc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertActivity = db.prepare(`
    INSERT INTO activities (
      id, mission_id, mission_code, date, category, label, hours, hourly_rate, total_ht,
      billable, status, invoice_id, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertExpense = db.prepare(`
    INSERT INTO expenses (
      id, mission_id, mission_code, date, category, label, quantity, unit_price, total_ht,
      vat_rate, vat_amount, total_ttc, status, invoice_id, is_refacturable
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAccounting = db.prepare(`
    INSERT INTO accounting_entries (
      id, month, type, piece_number, date, invoice_number, mission_code, object, party,
      amount_ht, vat_rate, vat_amount, amount_ttc, comment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReportDraft = db.prepare(`
    INSERT INTO report_drafts (
      id, mission_id, mission_code, title, version, section_facts, section_observations,
      section_analysis, section_conclusions, raw_field_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const m of payload.missions) {
      insertMission.run(
        m.id,
        m.code,
        m.title,
        m.case_reference || '-',
        m.guarantee_type || 'RC',
        m.status || 'en_cours',
        m.insurance_client || 'Mandant',
        m.client_contact || '',
        m.insurer_company || '',
        m.insured_party || '',
        m.insured_contact || '',
        m.insured_reference || '',
        m.broker_name || '',
        m.broker_reference || '',
        m.client_lawyer || '',
        m.third_parties || '',
        JSON.stringify(m.adverse_parties || []),
        m.stake_amount ?? null,
        m.initial_stake_amount ?? null,
        JSON.stringify(m.stake_history || []),
        m.court_reference || '',
        m.judicial_expert || '',
        m.is_judicial ? 1 : 0,
        m.co_signer || '',
        m.incident_date || '',
        m.reception_date || '2026-01-15',
        m.description || m.title,
        m.preliminary_analysis || '',
        m.pv_dommages_date || '',
        JSON.stringify(m.expertise_operations || []),
        m.current_step || '',
        m.next_action || '',
        m.next_deadline ?? null,
        m.billing_contact_name || '',
        m.billing_address || '',
        m.custom_hourly_rate ?? 190,
        m.custom_travel_rate ?? 135,
        m.custom_km_rate ?? 0.95
      );
    }

    for (const inv of payload.invoices) {
      insertInvoice.run(
        inv.id,
        inv.invoice_number,
        inv.mission_id,
        inv.mission_code,
        inv.client_name,
        inv.client_address || '-',
        inv.subject,
        inv.case_title,
        inv.client_ref || '-',
        inv.our_ref || inv.mission_code,
        inv.date,
        inv.total_ht,
        inv.vat_rate ?? 0.2,
        inv.vat_amount,
        inv.total_ttc,
        inv.advance_amount ?? 0,
        inv.net_payable ?? inv.total_ttc,
        inv.status || 'emis',
        inv.payment_date ?? null,
        inv.payment_method ?? null,
        inv.paid_amount ?? 0,
        inv.split_details ? JSON.stringify(inv.split_details) : null
      );

      const lines = Array.isArray(inv.lines) ? inv.lines : [];
      lines.forEach((ln, idx) => {
        insertInvoiceLine.run(
          `il-${inv.invoice_number}-${idx + 1}`,
          inv.id,
          ln.description,
          ln.quantity ?? 1,
          ln.time_spent ?? 1,
          ln.unit_price_ht ?? ln.total_ht,
          ln.total_ht,
          idx + 1
        );
      });
    }

    for (const cn of payload.credit_notes || []) {
      insertCreditNote.run(
        cn.id,
        cn.credit_number,
        cn.original_invoice_id,
        cn.original_invoice_number,
        cn.mission_id,
        cn.mission_code,
        cn.date,
        cn.reason,
        cn.total_ht,
        cn.vat_amount,
        cn.total_ttc
      );
    }

    for (const a of payload.activities || []) {
      insertActivity.run(
        a.id,
        a.mission_id,
        a.mission_code,
        a.date,
        a.category,
        a.label,
        a.hours,
        a.hourly_rate,
        a.total_ht,
        a.billable ?? 1,
        a.status || 'a_facturer',
        a.invoice_id ?? null,
        a.notes || ''
      );
    }

    for (const e of payload.expenses || []) {
      insertExpense.run(
        e.id,
        e.mission_id,
        e.mission_code,
        e.date,
        e.category,
        e.label,
        e.quantity ?? 1,
        e.unit_price ?? e.total_ht,
        e.total_ht,
        e.vat_rate ?? 0,
        e.vat_amount ?? 0,
        e.total_ttc ?? e.total_ht,
        e.status || 'a_facturer',
        e.invoice_id ?? null,
        e.is_refacturable ?? 1
      );
    }

    for (const acc of payload.accounting_entries || []) {
      insertAccounting.run(
        acc.id,
        acc.month,
        acc.type,
        acc.piece_number ?? null,
        acc.date,
        acc.invoice_number ?? null,
        acc.mission_code ?? null,
        acc.object,
        acc.party,
        acc.amount_ht,
        acc.vat_rate ?? 0,
        acc.vat_amount ?? 0,
        acc.amount_ttc,
        acc.comment ?? null
      );
    }

    for (const rep of payload.report_drafts || []) {
      insertReportDraft.run(
        rep.id,
        rep.mission_id,
        rep.mission_code,
        rep.title,
        rep.version ?? 1,
        rep.section_facts || '',
        rep.section_observations || '',
        rep.section_analysis || '',
        rep.section_conclusions || '',
        rep.raw_field_notes || ''
      );
    }
  });

  tx();
  console.log(
    `[seed] Seeded ${payload.missions.length} missions, ${payload.invoices.length} invoices, ` +
    `${(payload.credit_notes || []).length} credit notes, ${(payload.accounting_entries || []).length} accounting entries.`
  );
}

// Allow CLI execution (`npx tsx server/seed.ts`)
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  initDatabase();
  seedData();
}
