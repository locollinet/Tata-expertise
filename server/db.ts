import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data/vp_expertise.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high reliability and concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      case_reference TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'en_cours',
      insurance_client TEXT NOT NULL,
      client_contact TEXT,
      insured_party TEXT,
      third_parties TEXT,
      court_reference TEXT,
      incident_date TEXT,
      reception_date TEXT NOT NULL,
      description TEXT NOT NULL,
      current_step TEXT NOT NULL,
      next_action TEXT NOT NULL,
      next_deadline TEXT,
      billing_contact_name TEXT,
      billing_address TEXT,
      custom_hourly_rate REAL DEFAULT 190,
      custom_travel_rate REAL DEFAULT 135,
      custom_km_rate REAL DEFAULT 0.95,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      hours REAL NOT NULL,
      hourly_rate REAL NOT NULL,
      total_ht REAL NOT NULL,
      billable INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'a_facturer',
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_ht REAL NOT NULL,
      vat_amount REAL NOT NULL DEFAULT 0,
      total_ttc REAL NOT NULL,
      receipt_filename TEXT,
      status TEXT NOT NULL DEFAULT 'a_facturer',
      invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      is_refacturable INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      mission_code TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      case_title TEXT NOT NULL,
      client_ref TEXT NOT NULL,
      our_ref TEXT NOT NULL,
      date TEXT NOT NULL,
      total_ht REAL NOT NULL,
      vat_rate REAL NOT NULL DEFAULT 0.20,
      vat_amount REAL NOT NULL,
      total_ttc REAL NOT NULL,
      advance_amount REAL NOT NULL DEFAULT 0,
      net_payable REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'brouillon',
      payment_date TEXT,
      payment_method TEXT,
      paid_amount REAL NOT NULL DEFAULT 0,
      split_details TEXT,
      docx_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
      expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      time_spent REAL,
      unit_price_ht REAL NOT NULL,
      total_ht REAL NOT NULL,
      order_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credit_notes (
      id TEXT PRIMARY KEY,
      credit_number TEXT UNIQUE NOT NULL,
      original_invoice_id TEXT NOT NULL REFERENCES invoices(id),
      original_invoice_number TEXT NOT NULL,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      mission_code TEXT NOT NULL,
      date TEXT NOT NULL,
      reason TEXT NOT NULL,
      total_ht REAL NOT NULL,
      vat_amount REAL NOT NULL,
      total_ttc REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendees (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      organization TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      present_on_site INTEGER NOT NULL DEFAULT 1,
      present_remote INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      caption TEXT NOT NULL,
      taken_at TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_selected_for_report INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'autre',
      caption TEXT NOT NULL DEFAULT '',
      is_selected_for_report INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS report_drafts (
      id TEXT PRIMARY KEY,
      mission_id TEXT UNIQUE NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      title TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      section_facts TEXT NOT NULL DEFAULT '',
      section_observations TEXT NOT NULL DEFAULT '',
      section_analysis TEXT NOT NULL DEFAULT '',
      section_conclusions TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'in',
      sender TEXT NOT NULL,
      recipient TEXT NOT NULL,
      date TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      importance TEXT NOT NULL DEFAULT 'normale',
      urgency TEXT NOT NULL DEFAULT 'normale',
      status TEXT NOT NULL DEFAULT 'a_traiter',
      next_action TEXT,
      draft_reply TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS travel_orders (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      destination TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      train_info TEXT,
      hotel_info TEXT,
      notes TEXT,
      checklist TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'prevu',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registered_mails (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      tracking_number TEXT,
      status TEXT NOT NULL DEFAULT 'a_preparer',
      sent_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounting_entries (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      type TEXT NOT NULL,
      piece_number TEXT,
      date TEXT NOT NULL,
      invoice_number TEXT,
      mission_code TEXT,
      object TEXT NOT NULL,
      party TEXT NOT NULL,
      amount_ht REAL NOT NULL,
      vat_rate REAL DEFAULT 0,
      vat_amount REAL NOT NULL DEFAULT 0,
      amount_ttc REAL NOT NULL,
      frequency TEXT DEFAULT 'ponctuel',
      recurring_expense_id TEXT,
      comment TEXT
    );

    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id TEXT PRIMARY KEY,
      object TEXT NOT NULL,
      party TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'autre',
      frequency TEXT NOT NULL DEFAULT 'mensuel',
      day_of_month INTEGER NOT NULL DEFAULT 5,
      amount_ht REAL NOT NULL,
      vat_rate REAL NOT NULL DEFAULT 0,
      vat_amount REAL NOT NULL DEFAULT 0,
      amount_ttc REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      comment TEXT
    );
  `);

  try {
    db.exec("ALTER TABLE report_drafts ADD COLUMN raw_field_notes TEXT DEFAULT ''");
  } catch (_) {}

  try {
    db.exec("ALTER TABLE missions ADD COLUMN custom_billing_threshold REAL DEFAULT 3500");
  } catch (_) {}

  try {
    db.exec("ALTER TABLE missions ADD COLUMN custom_vat_rate REAL DEFAULT 0.20");
  } catch (_) {}

  try {
    db.exec("ALTER TABLE expenses ADD COLUMN vat_rate REAL DEFAULT 0.20");
  } catch (_) {}

  try {
    db.exec("ALTER TABLE accounting_entries ADD COLUMN vat_rate REAL DEFAULT 0");
  } catch (_) {}

  try {
    db.exec("ALTER TABLE accounting_entries ADD COLUMN frequency TEXT DEFAULT 'ponctuel'");
  } catch (_) {}

  try {
    db.exec("ALTER TABLE accounting_entries ADD COLUMN recurring_expense_id TEXT");
  } catch (_) {}

  // Seed default recurring expenses from Valentine's Compta_2026.xlsx if empty
  const recCount = db.prepare('SELECT COUNT(*) as c FROM recurring_expenses').get() as { c: number };
  if (recCount.c === 0) {
    const insertRec = db.prepare(`
      INSERT INTO recurring_expenses (id, object, party, category, frequency, day_of_month, amount_ht, vat_rate, vat_amount, amount_ttc, active, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const defaultRecurring = [
      ['rec-loyer', 'Loyer mensuel', 'Pecheux', 'loyer', 'mensuel', 1, 1050.00, 0, 0, 1050.00, 'Prélèvement mensuel cabinet'],
      ['rec-april', 'Assurance scooter', 'April', 'assurance', 'mensuel', 5, 50.63, 0, 0, 50.63, 'Exonéré de TVA'],
      ['rec-generali', 'Prélèvement mutuelle', 'GENERALI Vie', 'assurance', 'mensuel', 5, 390.85, 0, 0, 390.85, 'Selon courrier du 01/02/2026'],
      ['rec-urssaf', 'URSSAF', 'URSSAF IDF', 'charges_sociales', 'mensuel', 5, 11881.00, 0, 0, 11881.00, 'Sauf régularisation nov (12 001 €) et déc (11 884 €)'],
      ['rec-paybyphone', 'Abonnement stationnement', 'PayByPhone', 'transport', 'mensuel', 9, 38.00, 0, 0, 38.00, 'Forfait mensuel stationnement'],
      ['rec-adis-prev', 'Prélèvement prévoyance', 'ADIS', 'assurance', 'mensuel', 10, 532.20, 0, 0, 532.20, 'Contrat prévoyance Madelin'],
      ['rec-sfr-mob', 'Abonnement mobile', 'SFR', 'telecom', 'mensuel', 12, 9.16, 0.20, 1.83, 10.99, 'Forfait mobile pro (modifiable si hors-forfait étranger)'],
      ['rec-sfr-fixe', 'Abonnement fixe-internet', 'SFR', 'telecom', 'mensuel', 13, 16.66, 0.20, 3.33, 19.99, 'Fibre / Box cabinet'],
      ['rec-corgeco', 'Expert comptable', 'CORGECO', 'comptabilite', 'mensuel', 15, 169.01, 0.20, 33.80, 202.81, 'Honoraires cabinet comptable'],
      ['rec-urssaf-sal', 'Charges salarié', 'URSSAF IDF', 'charges_sociales', 'mensuel', 15, 113.00, 0, 0, 113.00, 'Cotisations sociales salarié'],
      ['rec-adis-ret', 'Prélèvement retraite complémentaire', 'ADIS', 'charges_sociales', 'mensuel', 20, 518.26, 0, 0, 518.26, 'Retraite complémentaire'],
      ['rec-icloud', 'Abonnement APPLE Cloud', 'APPLE', 'logiciel', 'mensuel', 24, 8.33, 0.20, 1.66, 9.99, 'Stockage iCloud Drive 2 To'],
      ['rec-paie', 'Prestation paye', 'fiche-paie.net', 'comptabilite', 'mensuel', 25, 9.90, 0.20, 1.98, 11.88, 'Édition bulletin de paie'],
    ];
    const tx = db.transaction(() => {
      for (const r of defaultRecurring) {
        insertRec.run(...r);
      }
    });
    tx();
  }
}
