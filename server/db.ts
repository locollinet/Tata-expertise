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
      insured_reference TEXT,
      broker_name TEXT,
      broker_reference TEXT,
      third_parties TEXT,
      adverse_parties TEXT DEFAULT '[]',
      stake_amount REAL,
      initial_stake_amount REAL,
      stake_history TEXT DEFAULT '[]',
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
      receipt_original_name TEXT,
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
      piece_number INTEGER,
      sub_section TEXT DEFAULT 'terrain',
      is_selected_for_report INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      piece_number INTEGER,
      section TEXT DEFAULT 'constatations',
      sub_section TEXT DEFAULT '',
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'autre',
      caption TEXT NOT NULL DEFAULT '',
      is_selected_for_report INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS damage_lines (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Matériel roulant',
      label TEXT NOT NULL,
      claimed_amount REAL NOT NULL DEFAULT 0,
      retained_amount REAL NOT NULL DEFAULT 0,
      comment TEXT DEFAULT '',
      piece_numbers TEXT NOT NULL DEFAULT '[]',
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issued_reports (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      mission_code TEXT NOT NULL,
      report_type TEXT NOT NULL DEFAULT 'Rapport d''étape',
      title TEXT NOT NULL,
      sent_date TEXT NOT NULL,
      recipient TEXT NOT NULL,
      filename TEXT,
      original_name TEXT,
      attached_piece_numbers TEXT NOT NULL DEFAULT '[]',
      notes TEXT DEFAULT '',
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
      receipt_filename TEXT,
      receipt_original_name TEXT,
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

  // Safe incremental schema migrations
  const alterStatements = [
    "ALTER TABLE report_drafts ADD COLUMN raw_field_notes TEXT DEFAULT ''",
    "ALTER TABLE missions ADD COLUMN custom_billing_threshold REAL DEFAULT 3500",
    "ALTER TABLE missions ADD COLUMN custom_vat_rate REAL DEFAULT 0.20",
    "ALTER TABLE missions ADD COLUMN insured_reference TEXT",
    "ALTER TABLE missions ADD COLUMN broker_name TEXT",
    "ALTER TABLE missions ADD COLUMN broker_reference TEXT",
    "ALTER TABLE missions ADD COLUMN adverse_parties TEXT DEFAULT '[]'",
    "ALTER TABLE missions ADD COLUMN stake_amount REAL",
    "ALTER TABLE missions ADD COLUMN initial_stake_amount REAL",
    "ALTER TABLE missions ADD COLUMN stake_history TEXT DEFAULT '[]'",
    "ALTER TABLE expenses ADD COLUMN vat_rate REAL DEFAULT 0.20",
    "ALTER TABLE expenses ADD COLUMN receipt_original_name TEXT",
    "ALTER TABLE accounting_entries ADD COLUMN vat_rate REAL DEFAULT 0",
    "ALTER TABLE accounting_entries ADD COLUMN frequency TEXT DEFAULT 'ponctuel'",
    "ALTER TABLE accounting_entries ADD COLUMN recurring_expense_id TEXT",
    "ALTER TABLE accounting_entries ADD COLUMN receipt_filename TEXT",
    "ALTER TABLE accounting_entries ADD COLUMN receipt_original_name TEXT",
    "ALTER TABLE documents ADD COLUMN piece_number INTEGER",
    "ALTER TABLE documents ADD COLUMN section TEXT DEFAULT 'constatations'",
    "ALTER TABLE documents ADD COLUMN sub_section TEXT DEFAULT ''",
    "ALTER TABLE photos ADD COLUMN piece_number INTEGER",
    "ALTER TABLE photos ADD COLUMN sub_section TEXT DEFAULT 'terrain'",
  ];

  for (const stmt of alterStatements) {
    try {
      db.exec(stmt);
    } catch (_) {}
  }

  // Non-destructive migration of existing missions (adverse_parties, stake_amount, numbered pieces, damage_lines, issued_reports)
  try {
    const allMissions = db.prepare('SELECT * FROM missions').all() as any[];
    for (const m of allMissions) {
      let currentAdverse: any[] = [];
      try {
        currentAdverse = m.adverse_parties ? JSON.parse(m.adverse_parties) : [];
      } catch {
        currentAdverse = [];
      }

      if (currentAdverse.length === 0 && m.third_parties) {
        if (m.code === 'VP2026922') {
          currentAdverse = [
            {
              id: 'adv-sgp',
              party_name: 'Société du Grand Paris (SGP)',
              expert_firm: 'Saretec',
              expert_name: 'M. Pechereau',
              lawyer_name: 'Me Laurent (Cab. Gide)',
              reference: 'SGP-L18-OA08',
            },
            {
              id: 'adv-vinci',
              party_name: 'VINCI Construction Grands Projets',
              expert_firm: 'Polyexpert',
              expert_name: 'Marc Vasseur',
              lawyer_name: '',
              reference: 'SIN-2026-4412',
            },
          ];
        } else if (m.code === 'VP2025915') {
          currentAdverse = [
            {
              id: 'adv-sncf',
              party_name: 'SNCF Réseau',
              expert_firm: 'Saretec',
              expert_name: 'Pechereau',
              lawyer_name: '',
              reference: 'RES-2025-889',
            },
          ];
        } else {
          const parts = String(m.third_parties)
            .split(/[/,;]/)
            .map((s: string) => s.trim())
            .filter(Boolean);
          currentAdverse = parts.map((name: string, idx: number) => ({
            id: `adv-${m.id}-${idx + 1}`,
            party_name: name,
            expert_firm: idx === 0 ? 'Saretec' : '',
            expert_name: idx === 0 ? 'Confrère mandaté' : '',
            lawyer_name: '',
            reference: '',
          }));
        }
        db.prepare('UPDATE missions SET adverse_parties = ? WHERE id = ?').run(JSON.stringify(currentAdverse), m.id);
      }

      if (m.stake_amount === null || m.stake_amount === undefined) {
        let initialStake = 450000;
        let currentStake = 450000;
        let history: any[] = [];
        let brokerName = m.broker_name || null;
        let brokerRef = m.broker_reference || null;
        let insuredRef = m.insured_reference || null;

        if (m.code === 'VP2026922') {
          initialStake = 2800000;
          currentStake = 3150000;
          brokerName = 'Marsh France';
          brokerRef = 'MRSH-26-8841';
          insuredRef = 'ALS-L18-SIN04';
          history = [
            { id: 'stk-1', date: '2026-04-30', amount: 2800000, note: 'Estimation initiale à réception du mandat' },
            { id: 'stk-2', date: '2026-09-25', amount: 3150000, note: 'Réévaluation après chiffrage contradictoire sous trémie OA-08' },
          ];
        } else if (m.code === 'VP2025915') {
          initialStake = 1200000;
          currentStake = 980000;
          brokerName = 'Willis Towers Watson';
          brokerRef = 'WTW-2025-119';
          insuredRef = 'FWD-wagons-09';
          history = [
            { id: 'stk-1', date: '2025-08-17', amount: 1200000, note: 'Estimation initiale (immobilisation + réparations)' },
            { id: 'stk-2', date: '2026-09-09', amount: 980000, note: 'Ajustement suite à réunion d’expertise à Fos' },
          ];
        } else {
          initialStake = 350000;
          currentStake = 350000;
          history = [
            { id: 'stk-1', date: m.reception_date || '2026-06-01', amount: 350000, note: 'Estimation initiale du préjudice' },
          ];
        }

        db.prepare(`
          UPDATE missions
          SET stake_amount = ?, initial_stake_amount = ?, stake_history = ?,
              broker_name = COALESCE(broker_name, ?),
              broker_reference = COALESCE(broker_reference, ?),
              insured_reference = COALESCE(insured_reference, ?)
          WHERE id = ?
        `).run(currentStake, initialStake, JSON.stringify(history), brokerName, brokerRef, insuredRef, m.id);
      }

      // Ensure sequential piece_number & section on existing documents of this mission
      const docs = db.prepare('SELECT * FROM documents WHERE mission_id = ? ORDER BY created_at ASC, id ASC').all(m.id) as any[];
      let nextPiece = 1;
      for (const d of docs) {
        if (d.piece_number && d.piece_number >= nextPiece) {
          nextPiece = d.piece_number + 1;
        }
      }
      for (const d of docs) {
        if (!d.piece_number) {
          let inferredSection = d.section || 'constatations';
          if (d.category === 'contrat_client') inferredSection = 'contrats';
          else if (d.category === 'procedure_dires') inferredSection = 'contradictoire';
          else if (d.category === 'justificatif_prejudice') inferredSection = 'prejudice';
          else if (d.category === 'rapport_emis' || d.category === 'note_technique') inferredSection = 'rapports';
          else inferredSection = 'constatations';

          db.prepare('UPDATE documents SET piece_number = ?, section = ? WHERE id = ?').run(nextPiece++, inferredSection, d.id);
        }
      }

      // Seed default damage lines and issued report for flagship mission VP2026922 if empty
      if (m.code === 'VP2026922') {
        const dmgCount = db.prepare('SELECT COUNT(*) as c FROM damage_lines WHERE mission_id = ?').get(m.id) as { c: number };
        if (dmgCount.c === 0) {
          const insertDmg = db.prepare(`
            INSERT INTO damage_lines (id, mission_id, mission_code, category, label, claimed_amount, retained_amount, comment, piece_numbers, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertDmg.run(
            'dmg-1', m.id, m.code, 'Matériel & Équipements',
            'Remise en état sous-station électrique et câblages sous trémie OA-08',
            1850000, 1680000,
            'Déduction de 170 k€ correspondant à une mise à niveau non imputable au sinistre',
            JSON.stringify([1, 2]), 1
          );
          insertDmg.run(
            'dmg-2', m.id, m.code, 'Frais de déblaiement & sécurisation',
            'Étayage d’urgence, relevés laser 3D et évacuation des gravats de dalle',
            620000, 620000,
            'Frais intégralement justifiés par les constats immédiats du jour J',
            JSON.stringify([3]), 2
          );
          insertDmg.run(
            'dmg-3', m.id, m.code, 'Pertes immatérielles / Retard chantier',
            'Immobilisation des équipes d’essais ferroviaires Alstom (6 semaines)',
            980000, 850000,
            'Retenu sur base des feuilles de pointage contradictoires',
            JSON.stringify([4]), 3
          );
        }

        const repCount = db.prepare('SELECT COUNT(*) as c FROM issued_reports WHERE mission_id = ?').get(m.id) as { c: number };
        if (repCount.c === 0) {
          const insertRep = db.prepare(`
            INSERT INTO issued_reports (id, mission_id, mission_code, report_type, title, sent_date, recipient, filename, original_name, attached_piece_numbers, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertRep.run(
            'irep-1', m.id, m.code, 'Rapport préliminaire',
            'Rapport préliminaire de constatations immédiates — Trémie OA-08',
            '2026-05-18', 'AXA XL (Yannick DELAUNAY) & Marsh France',
            null, 'Rapport_Preliminaire_VP2026922_2026-05-18.docx',
            JSON.stringify([1, 2]),
            'Envoi initial après la première visite sur site et recueil des éléments du jour J.'
          );
          insertRep.run(
            'irep-2', m.id, m.code, 'Rapport d’étape',
            'Note technique d’étape n°2 — Analyse contradictoire & chiffrage provisoire',
            '2026-09-28', 'AXA XL (Yannick DELAUNAY)',
            null, 'Rapport_Etape_2_VP2026922_2026-09-28.docx',
            JSON.stringify([1, 2, 3, 4]),
            'Diffusé suite à la réunion contradictoire du 25/09/2026 à Massy.'
          );
        }
      }
    }
  } catch (err) {
    console.warn('Migration non-destructive ignorée :', err);
  }

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
