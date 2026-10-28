import { Router } from 'express';
import { db } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateInvoiceDocx, generateReportDocx } from './docx.js';
import { generateMonthlyComptaWorkbook } from './excel.js';
import { Invoice, InvoiceLine, ReportDraft, Attendee, Photo } from '../shared/types.js';

export const apiRouter = Router();

// Configure multer for file uploads (stored in data/uploads)
const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

// Helper to calculate unbilled amounts for a mission
function getMissionUnbilledStats(missionId: string) {
  const act = db.prepare(`
    SELECT COALESCE(SUM(hours), 0) as unbilled_hours, COALESCE(SUM(total_ht), 0) as act_ht
    FROM activities WHERE mission_id = ? AND status = 'a_facturer' AND billable = 1
  `).get(missionId) as { unbilled_hours: number; act_ht: number };

  const exp = db.prepare(`
    SELECT COALESCE(SUM(total_ht), 0) as exp_ht
    FROM expenses WHERE mission_id = ? AND status = 'a_facturer' AND is_refacturable = 1
  `).get(missionId) as { exp_ht: number };

  const total_ht = Math.round((act.act_ht + exp.exp_ht) * 100) / 100;
  return {
    unbilled_hours: act.unbilled_hours,
    unbilled_expenses: exp.exp_ht,
    total_unbilled_ht: total_ht,
  };
}

// ---------------- DASHBOARD / AUJOURD'HUI ----------------
apiRouter.get('/dashboard', (_req, res) => {
  const billingThreshold = Number(process.env.BILLING_THRESHOLD_REMINDER || 3500);

  // 1. Get all active missions and check thresholds
  const missions = db.prepare("SELECT * FROM missions WHERE status != 'cloture'").all() as any[];
  const urgentActions: any[] = [];
  let totalUnbilledHT = 0;
  let missionsOverThresholdCount = 0;
  let unbilledHoursTotal = 0;

  for (const m of missions) {
    const stats = getMissionUnbilledStats(m.id);
    totalUnbilledHT += stats.total_unbilled_ht;
    unbilledHoursTotal += stats.unbilled_hours;

    const missionThreshold = m.custom_billing_threshold ? Number(m.custom_billing_threshold) : billingThreshold;
    if (stats.total_unbilled_ht >= missionThreshold) {
      missionsOverThresholdCount++;
      urgentActions.push({
        id: `alert-bill-${m.id}`,
        mission_code: m.code,
        mission_title: m.title,
        label: `Honoraires en attente : ${stats.total_unbilled_ht.toFixed(2).replace('.', ',')} € HT (seuil de ${missionThreshold.toLocaleString('fr-FR')} € dépassé)`,
        deadline: m.next_deadline || undefined,
        type: 'rappel_facturation',
      });
    }

    if (m.next_deadline) {
      urgentActions.push({
        id: `alert-dead-${m.id}`,
        mission_code: m.code,
        mission_title: m.title,
        label: `Échéance dossier : ${m.next_action}`,
        deadline: m.next_deadline,
        type: 'echeance',
      });
    }
  }

  // 2. Urgent communications
  const urgentEmails = db.prepare(`
    SELECT * FROM communications WHERE urgency = 'urgente' AND status = 'a_traiter' ORDER BY date DESC
  `).all() as any[];

  for (const email of urgentEmails) {
    urgentActions.push({
      id: `alert-email-${email.id}`,
      mission_code: email.mission_code,
      mission_title: email.subject,
      label: `Email urgent de ${email.sender.split('<')[0].trim()} : "${email.subject}"`,
      type: 'email_urgent',
    });
  }

  // 3. Upcoming travels
  const upcomingTravels = db.prepare(`
    SELECT * FROM travel_orders WHERE status IN ('prevu', 'confirme') ORDER BY start_date ASC LIMIT 5
  `).all() as any[];

  for (const t of upcomingTravels) {
    urgentActions.push({
      id: `alert-travel-${t.id}`,
      mission_code: t.mission_code,
      mission_title: t.destination,
      label: `Déplacement prévu le ${t.start_date.split('-').reverse().join('/')} : ${t.destination}`,
      deadline: t.start_date,
      type: 'deplacement',
    });
  }

  // 4. Latest invoices
  const latestInvoices = db.prepare(`
    SELECT * FROM invoices ORDER BY date DESC LIMIT 5
  `).all();

  // 5. Monthly revenue (Octobre 2026)
  const currentMonth = '2026-10';
  const revenueObj = db.prepare(`
    SELECT COALESCE(SUM(total_ht), 0) as rev FROM invoices WHERE strftime('%Y-%m', date) = ? AND status != 'annule'
  `).get(currentMonth) as { rev: number };

  res.json({
    urgent_actions: urgentActions,
    total_unbilled_ht: Math.round(totalUnbilledHT * 100) / 100,
    missions_over_threshold_count: missionsOverThresholdCount,
    unbilled_hours_total: unbilledHoursTotal,
    pending_emails_count: urgentEmails.length,
    active_missions_count: missions.length,
    monthly_revenue_ht: revenueObj.rev,
    latest_invoices: latestInvoices,
    upcoming_travels: upcomingTravels.map(t => ({ ...t, checklist: JSON.parse(t.checklist || '[]') })),
  });
});

// ---------------- MISSIONS ----------------
apiRouter.get('/missions', (req, res) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  const statusFilter = req.query.status as string;

  let sql = 'SELECT * FROM missions WHERE 1=1';
  const params: any[] = [];

  if (statusFilter && statusFilter !== 'all') {
    sql += ' AND status = ?';
    params.push(statusFilter);
  }

  if (query) {
    sql += ' AND (LOWER(code) LIKE ? OR LOWER(title) LIKE ? OR LOWER(case_reference) LIKE ? OR LOWER(insurance_client) LIKE ?)';
    const p = `%${query}%`;
    params.push(p, p, p, p);
  }

  sql += ' ORDER BY created_at DESC';
  const missions = db.prepare(sql).all(...params) as any[];

  const enriched = missions.map(m => {
    const stats = getMissionUnbilledStats(m.id);
    return {
      ...m,
      unbilled_hours: stats.unbilled_hours,
      unbilled_expenses: stats.unbilled_expenses,
      total_unbilled_ht: stats.total_unbilled_ht,
    };
  });

  res.json(enriched);
});

apiRouter.post('/missions', (req, res) => {
  const {
    code, title, case_reference, status = 'en_cours', insurance_client, client_contact,
    insured_party, third_parties, court_reference, incident_date, reception_date = new Date().toISOString().slice(0, 10),
    description = '', current_step = '', next_action = '', next_deadline, billing_contact_name,
    billing_address, custom_hourly_rate = 190, custom_travel_rate = 135, custom_km_rate = 0.95
  } = req.body;

  if (!code || !title || !case_reference || !insurance_client) {
    return res.status(400).json({ error: "Code, titre, référence et client assureur sont obligatoires" });
  }

  const id = `m-${uuidv4().slice(0, 8)}`;
  try {
    db.prepare(`
      INSERT INTO missions (
        id, code, title, case_reference, status, insurance_client, client_contact,
        insured_party, third_parties, court_reference, incident_date, reception_date,
        description, current_step, next_action, next_deadline, billing_contact_name,
        billing_address, custom_hourly_rate, custom_travel_rate, custom_km_rate
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      id, code, title, case_reference, status, insurance_client, client_contact,
      insured_party, third_parties, court_reference, incident_date, reception_date,
      description, current_step, next_action, next_deadline, billing_contact_name,
      billing_address, custom_hourly_rate, custom_travel_rate, custom_km_rate
    );

    // Create default report draft
    db.prepare(`
      INSERT INTO report_drafts (id, mission_id, mission_code, title, version, section_facts, section_observations, section_analysis, section_conclusions)
      VALUES (?, ?, ?, ?, 1, '', '', '', '')
    `).run(`rd-${id}`, id, code, `Projet de rapport d'expertise — ${title}`);

    res.json({ id, message: "Mission créée avec succès" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/missions/:id', (req, res) => {
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id) as any;
  if (!mission) {
    return res.status(404).json({ error: "Mission non trouvée" });
  }

  const stats = getMissionUnbilledStats(mission.id);
  const activities = db.prepare('SELECT * FROM activities WHERE mission_id = ? ORDER BY date DESC').all(mission.id);
  const expenses = db.prepare('SELECT * FROM expenses WHERE mission_id = ? ORDER BY date DESC').all(mission.id);
  const invoices = db.prepare('SELECT * FROM invoices WHERE mission_id = ? ORDER BY date DESC').all(mission.id);
  const attendees = db.prepare('SELECT * FROM attendees WHERE mission_id = ?').all(mission.id);
  const photos = db.prepare('SELECT * FROM photos WHERE mission_id = ? ORDER BY order_index ASC').all(mission.id);
  const documents = db.prepare('SELECT * FROM documents WHERE mission_id = ? ORDER BY created_at DESC').all(mission.id);
  const draft = db.prepare('SELECT * FROM report_drafts WHERE mission_id = ?').get(mission.id);
  const communications = db.prepare('SELECT * FROM communications WHERE mission_id = ? ORDER BY date DESC').all(mission.id);
  const travels = db.prepare('SELECT * FROM travel_orders WHERE mission_id = ? ORDER BY start_date DESC').all(mission.id) as any[];
  const lrar = db.prepare('SELECT * FROM registered_mails WHERE mission_id = ? ORDER BY created_at DESC').all(mission.id);

  res.json({
    ...mission,
    unbilled_hours: stats.unbilled_hours,
    unbilled_expenses: stats.unbilled_expenses,
    total_unbilled_ht: stats.total_unbilled_ht,
    activities,
    expenses,
    invoices,
    attendees,
    photos,
    documents,
    report_draft: draft,
    communications,
    travels: travels.map(t => ({ ...t, checklist: JSON.parse(t.checklist || '[]') })),
    registered_mails: lrar,
  });
});

apiRouter.put('/missions/:id', (req, res) => {
  const m = req.body;
  try {
    db.prepare(`
      UPDATE missions SET
        title = ?, case_reference = ?, status = ?, insurance_client = ?, client_contact = ?,
        insured_party = ?, third_parties = ?, court_reference = ?, incident_date = ?, reception_date = ?,
        description = ?, current_step = ?, next_action = ?, next_deadline = ?, billing_contact_name = ?,
        billing_address = ?, custom_hourly_rate = ?, custom_travel_rate = ?, custom_km_rate = ?,
        custom_billing_threshold = ?, custom_vat_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      m.title, m.case_reference, m.status, m.insurance_client, m.client_contact,
      m.insured_party, m.third_parties, m.court_reference, m.incident_date, m.reception_date,
      m.description, m.current_step, m.next_action, m.next_deadline, m.billing_contact_name,
      m.billing_address, m.custom_hourly_rate, m.custom_travel_rate, m.custom_km_rate,
      m.custom_billing_threshold, m.custom_vat_rate,
      req.params.id
    );
    res.json({ message: "Mission mise à jour avec succès" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- ACTIVITIES / POINTAGE ----------------
apiRouter.post('/activities', (req, res) => {
  const { mission_id, date, category, label, hours, hourly_rate, notes, billable = true } = req.body;
  if (!mission_id || !date || !label || hours === undefined) {
    return res.status(400).json({ error: "Mission, date, libellé et heures sont requis" });
  }

  const mission = db.prepare('SELECT code, custom_hourly_rate, custom_travel_rate FROM missions WHERE id = ?').get(mission_id) as any;
  if (!mission) return res.status(404).json({ error: "Mission introuvable" });

  const rate = hourly_rate !== undefined ? Number(hourly_rate) : (category === 'deplacement' ? (mission.custom_travel_rate || 135) : (mission.custom_hourly_rate || 190));
  const total_ht = Math.round(Number(hours) * rate * 100) / 100;
  const id = `act-${uuidv4().slice(0, 8)}`;

  db.prepare(`
    INSERT INTO activities (id, mission_id, mission_code, date, category, label, hours, hourly_rate, total_ht, billable, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'a_facturer', ?)
  `).run(id, mission_id, mission.code, date, category, label, Number(hours), rate, total_ht, billable ? 1 : 0, notes);

  res.json({ id, total_ht, message: "Pointage enregistré" });
});

apiRouter.delete('/activities/:id', (req, res) => {
  const act = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id) as any;
  if (!act) return res.status(404).json({ error: "Activité introuvable" });
  if (act.status === 'facture') return res.status(400).json({ error: "Impossible de supprimer une activité déjà facturée" });

  db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  res.json({ message: "Activité supprimée" });
});

// ---------------- EXPENSES / FRAIS ----------------
apiRouter.post('/expenses', upload.single('receipt'), (req, res) => {
  const { mission_id, date, category, label, quantity = 1, unit_price, is_refacturable = true } = req.body;
  if (!mission_id || !date || !label || unit_price === undefined) {
    return res.status(400).json({ error: "Mission, date, libellé et prix unitaire requis" });
  }

  const mission = db.prepare('SELECT code FROM missions WHERE id = ?').get(mission_id) as any;
  if (!mission) return res.status(404).json({ error: "Mission introuvable" });

  const qty = Number(quantity);
  const up = Number(unit_price);
  const total_ht = Math.round(qty * up * 100) / 100;
  // Apply TVA standard 20% on reimbursable expenses (hotel, meal, transport) or 0% on mileage
  const vat_rate = category === 'km' ? 0 : 0.20;
  const vat_amount = Math.round(total_ht * vat_rate * 100) / 100;
  const total_ttc = Math.round((total_ht + vat_amount) * 100) / 100;

  const id = `exp-${uuidv4().slice(0, 8)}`;
  const receipt_filename = req.file ? req.file.filename : null;

  db.prepare(`
    INSERT INTO expenses (id, mission_id, mission_code, date, category, label, quantity, unit_price, total_ht, vat_amount, total_ttc, receipt_filename, status, is_refacturable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'a_facturer', ?)
  `).run(id, mission_id, mission.code, date, category, label, qty, up, total_ht, vat_amount, total_ttc, receipt_filename, is_refacturable ? 1 : 0);

  res.json({ id, total_ht, total_ttc, message: "Frais enregistré" });
});

apiRouter.delete('/expenses/:id', (req, res) => {
  const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id) as any;
  if (!exp) return res.status(404).json({ error: "Frais introuvable" });
  if (exp.status === 'facture') return res.status(400).json({ error: "Impossible de supprimer un frais déjà facturé" });

  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ message: "Frais supprimé" });
});

// ---------------- INVOICES / HONORAIRES ----------------
apiRouter.get('/invoices', (_req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices ORDER BY date DESC').all() as any[];
  const enriched = invoices.map(inv => {
    const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY order_index ASC').all(inv.id);
    return {
      ...inv,
      split_details: inv.split_details ? JSON.parse(inv.split_details) : null,
      lines,
    };
  });
  res.json(enriched);
});

apiRouter.get('/invoices/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
  if (!inv) return res.status(404).json({ error: "Facture non trouvée" });

  const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY order_index ASC').all(inv.id);
  res.json({
    ...inv,
    split_details: inv.split_details ? JSON.parse(inv.split_details) : null,
    lines,
  });
});

// Prepare a draft invoice from selected items with anti-double-billing reservation
apiRouter.post('/invoices/prepare', (req, res) => {
  const { mission_id, activity_ids = [], expense_ids = [], subject, advance_amount = 0, date = new Date().toISOString().slice(0, 10) } = req.body;

  if (!mission_id || (activity_ids.length === 0 && expense_ids.length === 0)) {
    return res.status(400).json({ error: "Veuillez sélectionner au moins une activité ou un frais non facturé" });
  }

  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id) as any;
  if (!mission) return res.status(404).json({ error: "Mission non trouvée" });

  const invoiceId = `inv-${uuidv4().slice(0, 8)}`;
  
  // Calculate next sequential invoice number for preview (e.g. 2026-100)
  const currentYear = new Date().getFullYear();
  const maxInv = db.prepare(`
    SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1
  `).get(`${currentYear}-%`) as { invoice_number: string } | undefined;

  let nextNum = `${currentYear}-001`;
  if (maxInv) {
    const parts = maxInv.invoice_number.split('-');
    const seq = parseInt(parts[1], 10) + 1;
    nextNum = `${currentYear}-${String(seq).padStart(3, '0')}`;
  }

  const prepareTransaction = db.transaction(() => {
    let lines: any[] = [];
    let totalHT = 0;
    let orderIndex = 1;

    // 1. Process activities
    for (const actId of activity_ids) {
      const act = db.prepare("SELECT * FROM activities WHERE id = ? AND status = 'a_facturer'").get(actId) as any;
      if (!act) {
        throw new Error(`L'activité ${actId} n'est plus disponible pour facturation (déjà réservée ou facturée)`);
      }

      lines.push({
        id: `line-${uuidv4().slice(0, 8)}`,
        invoice_id: invoiceId,
        activity_id: act.id,
        expense_id: null,
        description: act.label,
        quantity: 1,
        time_spent: act.hours,
        unit_price_ht: act.hourly_rate,
        total_ht: act.total_ht,
        order_index: orderIndex++,
      });
      totalHT += act.total_ht;
    }

    // 2. Process expenses
    for (const expId of expense_ids) {
      const exp = db.prepare("SELECT * FROM expenses WHERE id = ? AND status = 'a_facturer'").get(expId) as any;
      if (!exp) {
        throw new Error(`Le frais ${expId} n'est plus disponible pour facturation`);
      }

      lines.push({
        id: `line-${uuidv4().slice(0, 8)}`,
        invoice_id: invoiceId,
        activity_id: null,
        expense_id: exp.id,
        description: exp.label,
        quantity: exp.quantity,
        time_spent: exp.category === 'km' ? 1.0 : null,
        unit_price_ht: exp.unit_price,
        total_ht: exp.total_ht,
        order_index: orderIndex++,
      });
      totalHT += exp.total_ht;
    }

    totalHT = Math.round(totalHT * 100) / 100;
    const vatRate = 0.20;
    const vatAmount = Math.round(totalHT * vatRate * 100) / 100;
    const totalTTC = Math.round((totalHT + vatAmount) * 100) / 100;
    const advance = Number(advance_amount) || 0;
    const netPayable = Math.round((totalTTC - advance) * 100) / 100;

    const invoiceSubject = subject || `Mission d’expertise depuis le ${mission.reception_date.split('-').reverse().join('/')}`;

    // Insert invoice FIRST so foreign key references to invoices(id) are valid
    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, mission_id, mission_code, client_name, client_address,
        subject, case_title, client_ref, our_ref, date, total_ht, vat_rate, vat_amount,
        total_ttc, advance_amount, net_payable, status, paid_amount
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, 'brouillon', 0
      )
    `).run(
      invoiceId, nextNum, mission.id, mission.code, mission.insurance_client,
      mission.billing_address || `${mission.insurance_client}\nService Sinistres`,
      invoiceSubject, mission.title, mission.case_reference, mission.code,
      date, totalHT, vatRate, vatAmount, totalTTC, advance, netPayable
    );

    // Insert invoice lines
    const insertLine = db.prepare(`
      INSERT INTO invoice_lines (id, invoice_id, activity_id, expense_id, description, quantity, time_spent, unit_price_ht, total_ht, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of lines) {
      insertLine.run(l.id, l.invoice_id, l.activity_id, l.expense_id, l.description, l.quantity, l.time_spent, l.unit_price_ht, l.total_ht, l.order_index);
    }

    // Now update activity and expense statuses to reserved with invoice_id
    for (const actId of activity_ids) {
      db.prepare("UPDATE activities SET status = 'reserve', invoice_id = ? WHERE id = ?").run(invoiceId, actId);
    }
    for (const expId of expense_ids) {
      db.prepare("UPDATE expenses SET status = 'reserve', invoice_id = ? WHERE id = ?").run(invoiceId, expId);
    }

    return { invoiceId, nextNum, totalHT, vatAmount, totalTTC, netPayable, linesCount: lines.length };
  });

  try {
    const result = prepareTransaction();
    res.json({
      message: "Brouillon de note d'honoraires préparé avec succès",
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Finalize/Emit invoice
apiRouter.post('/invoices/:id/emit', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
  if (!inv) return res.status(404).json({ error: "Facture non trouvée" });

  const emitTx = db.transaction(() => {
    // 1. Move activities and expenses to status = 'facture'
    db.prepare("UPDATE activities SET status = 'facture' WHERE invoice_id = ?").run(inv.id);
    db.prepare("UPDATE expenses SET status = 'facture' WHERE invoice_id = ?").run(inv.id);

    // 2. Set invoice status to 'emis'
    db.prepare("UPDATE invoices SET status = 'emis', updated_at = datetime('now') WHERE id = ?").run(inv.id);

    // 3. Insert or update corresponding accounting entry for the month
    const month = inv.date.slice(0, 7);
    db.prepare(`
      INSERT INTO accounting_entries (id, month, type, piece_number, date, invoice_number, mission_code, object, party, amount_ht, vat_amount, amount_ttc, comment)
      VALUES (?, ?, 'recette', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `acc-${inv.invoice_number}`, month, `R-${inv.invoice_number.split('-')[1]}`, inv.date,
      inv.invoice_number, inv.mission_code, `Note d'honoraires n° ${inv.invoice_number}`,
      inv.client_name, inv.total_ht, inv.vat_amount, inv.total_ttc, inv.subject
    );
  });

  try {
    emitTx();
    res.json({ message: `Facture ${inv.invoice_number} émise avec succès et enregistrée en comptabilité` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel a draft invoice (releases reserved activities & expenses)
apiRouter.post('/invoices/:id/cancel', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
  if (!inv) return res.status(404).json({ error: "Facture non trouvée" });
  if (inv.status === 'emis' || inv.status === 'regle') {
    return res.status(400).json({ error: "Une facture déjà émise ne peut être annulée. Émettez un avoir (note de crédit)." });
  }

  const cancelTx = db.transaction(() => {
    // Release reserved items
    db.prepare("UPDATE activities SET status = 'a_facturer', invoice_id = NULL WHERE invoice_id = ?").run(inv.id);
    db.prepare("UPDATE expenses SET status = 'a_facturer', invoice_id = NULL WHERE invoice_id = ?").run(inv.id);
    db.prepare("DELETE FROM invoice_lines WHERE invoice_id = ?").run(inv.id);
    db.prepare("DELETE FROM invoices WHERE id = ?").run(inv.id);
  });

  try {
    cancelTx();
    res.json({ message: "Brouillon de facture annulé et éléments libérés" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Record invoice payment
apiRouter.post('/invoices/:id/payment', (req, res) => {
  const { payment_date = new Date().toISOString().slice(0, 10), payment_method = 'Virement', paid_amount, split_details } = req.body;
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
  if (!inv) return res.status(404).json({ error: "Facture non trouvée" });

  const amount = Number(paid_amount) || inv.net_payable;
  const newStatus = amount >= inv.net_payable ? 'regle' : 'regle_partiel';

  db.prepare(`
    UPDATE invoices SET
      status = ?, payment_date = ?, payment_method = ?, paid_amount = ?, split_details = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, payment_date, payment_method, amount, split_details ? JSON.stringify(split_details) : null, req.params.id);

  res.json({ message: "Règlement enregistré avec succès", status: newStatus });
});

// Download invoice DOCX
apiRouter.get('/invoices/:id/docx', async (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
  if (!inv) return res.status(404).json({ error: "Facture non trouvée" });

  const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY order_index ASC').all(inv.id) as any[];
  const invoiceData: Invoice = { ...inv, lines };

  try {
    const docxBuffer = await generateInvoiceDocx(invoiceData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Facture_${inv.invoice_number}.docx`);
    res.send(docxBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- CREDIT NOTES / AVOIRS ----------------
apiRouter.post('/credit-notes', (req, res) => {
  const { original_invoice_id, reason, date = new Date().toISOString().slice(0, 10) } = req.body;
  const original = db.prepare('SELECT * FROM invoices WHERE id = ?').get(original_invoice_id) as any;
  if (!original) return res.status(404).json({ error: "Facture d'origine non trouvée" });

  const currentYear = new Date().getFullYear();
  const maxAV = db.prepare("SELECT credit_number FROM credit_notes WHERE credit_number LIKE ? ORDER BY credit_number DESC LIMIT 1").get(`AV-${currentYear}-%`) as any;
  let nextAV = `AV-${currentYear}-001`;
  if (maxAV) {
    const seq = parseInt(maxAV.credit_number.split('-')[2], 10) + 1;
    nextAV = `AV-${currentYear}-${String(seq).padStart(3, '0')}`;
  }

  const id = `cn-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO credit_notes (id, credit_number, original_invoice_id, original_invoice_number, mission_id, mission_code, date, reason, total_ht, vat_amount, total_ttc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nextAV, original.id, original.invoice_number, original.mission_id, original.mission_code, date, reason, -original.total_ht, -original.vat_amount, -original.total_ttc);

  db.prepare("UPDATE invoices SET status = 'annule' WHERE id = ?").run(original.id);

  res.json({ id, credit_number: nextAV, message: `Avoir ${nextAV} généré avec succès` });
});

apiRouter.get('/credit-notes', (_req, res) => {
  const notes = db.prepare('SELECT * FROM credit_notes ORDER BY date DESC').all();
  res.json(notes);
});

// ---------------- REPORT DRAFTS & DOCX ----------------
apiRouter.get('/reports/:missionId', (req, res) => {
  const draft = db.prepare('SELECT * FROM report_drafts WHERE mission_id = ?').get(req.params.missionId);
  res.json(draft || {});
});

apiRouter.put('/reports/:missionId', (req, res) => {
  const { title, section_facts, section_observations, section_analysis, section_conclusions, raw_field_notes = '' } = req.body;
  const existing = db.prepare('SELECT * FROM report_drafts WHERE mission_id = ?').get(req.params.missionId) as any;

  if (existing) {
    db.prepare(`
      UPDATE report_drafts SET
        title = ?, section_facts = ?, section_observations = ?, section_analysis = ?,
        section_conclusions = ?, raw_field_notes = ?, version = version + 1, updated_at = datetime('now')
      WHERE mission_id = ?
    `).run(title, section_facts, section_observations, section_analysis, section_conclusions, raw_field_notes, req.params.missionId);
  } else {
    const mission = db.prepare('SELECT code FROM missions WHERE id = ?').get(req.params.missionId) as any;
    db.prepare(`
      INSERT INTO report_drafts (id, mission_id, mission_code, title, version, section_facts, section_observations, section_analysis, section_conclusions, raw_field_notes)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).run(`rd-${uuidv4().slice(0, 8)}`, req.params.missionId, mission?.code || '', title, section_facts, section_observations, section_analysis, section_conclusions, raw_field_notes);
  }

  res.json({ message: "Brouillon de rapport mis à jour" });
});

apiRouter.get('/reports/:missionId/docx', async (req, res) => {
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.missionId) as any;
  if (!mission) return res.status(404).json({ error: "Mission non trouvée" });

  let draft = db.prepare('SELECT * FROM report_drafts WHERE mission_id = ?').get(mission.id) as any;
  if (!draft) {
    draft = {
      id: 'default',
      mission_id: mission.id,
      mission_code: mission.code,
      title: `Rapport d'expertise — ${mission.title}`,
      version: 1,
      section_facts: '',
      section_observations: '',
      section_analysis: '',
      section_conclusions: '',
    };
  }

  const attendees = db.prepare('SELECT * FROM attendees WHERE mission_id = ?').all(mission.id) as Attendee[];
  const photos = db.prepare('SELECT * FROM photos WHERE mission_id = ? AND is_selected_for_report = 1 ORDER BY order_index ASC').all(mission.id) as Photo[];

  try {
    const buffer = await generateReportDocx(draft, mission.title, mission.case_reference, attendees, photos);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Projet_Rapport_${mission.code}.docx`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- PHOTOS & TERRAIN ----------------
apiRouter.post('/photos', upload.single('photo'), (req, res) => {
  const { mission_id, caption = '' } = req.body;
  if (!mission_id || !req.file) {
    return res.status(400).json({ error: "Mission et fichier image requis" });
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM photos WHERE mission_id = ?').get(mission_id) as { c: number };
  const id = `photo-${uuidv4().slice(0, 8)}`;

  db.prepare(`
    INSERT INTO photos (id, mission_id, filename, original_name, caption, order_index, is_selected_for_report)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(id, mission_id, req.file.filename, req.file.originalname, caption || req.file.originalname, count.c);

  res.json({ id, filename: req.file.filename, message: "Photo ajoutée avec succès" });
});

apiRouter.put('/photos/:id', (req, res) => {
  const { caption, order_index, is_selected_for_report } = req.body;
  db.prepare(`
    UPDATE photos SET
      caption = COALESCE(?, caption),
      order_index = COALESCE(?, order_index),
      is_selected_for_report = COALESCE(?, is_selected_for_report)
    WHERE id = ?
  `).run(caption, order_index, is_selected_for_report !== undefined ? (is_selected_for_report ? 1 : 0) : null, req.params.id);

  res.json({ message: "Photo mise à jour" });
});

apiRouter.delete('/photos/:id', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id) as any;
  if (photo) {
    const fPath = path.resolve(uploadsDir, photo.filename);
    if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
    db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  }
  res.json({ message: "Photo supprimée" });
});

// ---------------- DOCUMENTS & PIÈCES DU DOSSIER ----------------
apiRouter.get('/missions/:id/documents', (req, res) => {
  const docs = db.prepare('SELECT * FROM documents WHERE mission_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(docs);
});

apiRouter.post('/missions/:id/documents', upload.array('files', 15), (req, res) => {
  const mission = db.prepare('SELECT code FROM missions WHERE id = ?').get(req.params.id) as any;
  if (!mission) return res.status(404).json({ error: "Mission non trouvée" });

  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    return res.status(400).json({ error: "Aucun fichier reçu" });
  }

  const category = (req.body.category as string) || 'autre';
  const customCaption = (req.body.caption as string) || '';

  const insertStmt = db.prepare(`
    INSERT INTO documents (id, mission_id, mission_code, filename, original_name, mime_type, file_size, category, caption, is_selected_for_report)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const createdDocs: any[] = [];
  for (const f of files) {
    const docId = `doc-${uuidv4().slice(0, 8)}`;
    const isImage = f.mimetype.startsWith('image/');
    insertStmt.run(
      docId,
      req.params.id,
      mission.code,
      f.filename,
      f.originalname,
      f.mimetype,
      f.size,
      category,
      customCaption || f.originalname,
      isImage ? 1 : 0
    );

    // If it's an image, also create photo entry so report generator can pick it up
    if (isImage) {
      const count = db.prepare('SELECT COUNT(*) as c FROM photos WHERE mission_id = ?').get(req.params.id) as { c: number };
      db.prepare(`
        INSERT INTO photos (id, mission_id, filename, original_name, caption, order_index, is_selected_for_report)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(`photo-${uuidv4().slice(0, 8)}`, req.params.id, f.filename, f.originalname, customCaption || f.originalname, count.c);
    }

    createdDocs.push({ id: docId, filename: f.filename, original_name: f.originalname });
  }

  res.json({ message: `${createdDocs.length} document(s) rattaché(s) au dossier`, documents: createdDocs });
});

apiRouter.put('/documents/:id', (req, res) => {
  const { caption, category, is_selected_for_report } = req.body;
  db.prepare(`
    UPDATE documents SET
      caption = COALESCE(?, caption),
      category = COALESCE(?, category),
      is_selected_for_report = COALESCE(?, is_selected_for_report)
    WHERE id = ?
  `).run(
    caption,
    category,
    is_selected_for_report !== undefined ? (is_selected_for_report ? 1 : 0) : null,
    req.params.id
  );
  res.json({ message: "Document mis à jour" });
});

apiRouter.delete('/documents/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
  if (doc) {
    const fPath = path.resolve(uploadsDir, doc.filename);
    if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  }
  res.json({ message: "Document supprimé" });
});

// ---------------- ATTENDEES / PRÉSENTS ----------------
apiRouter.post('/attendees', (req, res) => {
  const { mission_id, name, organization, role, email, phone, present_on_site = true, present_remote = false } = req.body;
  if (!mission_id || !name || !organization) {
    return res.status(400).json({ error: "Mission, nom et organisme requis" });
  }

  const id = `att-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO attendees (id, mission_id, name, organization, role, email, phone, present_on_site, present_remote)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, mission_id, name, organization, role || '', email || null, phone || null, present_on_site ? 1 : 0, present_remote ? 1 : 0);

  res.json({ id, message: "Participant enregistré" });
});

apiRouter.delete('/attendees/:id', (req, res) => {
  db.prepare('DELETE FROM attendees WHERE id = ?').run(req.params.id);
  res.json({ message: "Participant supprimé" });
});

// ---------------- COMMUNICATIONS & EMAILS ----------------
apiRouter.get('/communications', (req, res) => {
  const { mission_id, status } = req.query;
  let sql = 'SELECT * FROM communications WHERE 1=1';
  const params: any[] = [];

  if (mission_id) {
    sql += ' AND mission_id = ?';
    params.push(mission_id);
  }
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY date DESC';
  const comms = db.prepare(sql).all(...params);
  res.json(comms);
});

apiRouter.post('/communications', (req, res) => {
  const { mission_id, sender, recipient = "Valentine PECHEUX", date = new Date().toISOString().slice(0, 16).replace('T', ' '), subject, body, importance = 'normale', urgency = 'normale' } = req.body;
  if (!mission_id || !sender || !subject || !body) {
    return res.status(400).json({ error: "Mission, expéditeur, objet et corps du message requis" });
  }

  const mission = db.prepare('SELECT code FROM missions WHERE id = ?').get(mission_id) as any;
  const id = `comm-${uuidv4().slice(0, 8)}`;

  // Draft reply helper suggestion
  const draft_reply = `Bonjour,\n\nBien reçu votre message concernant le dossier ${mission?.code || ''}.\nNous avons bien pris note des éléments transmis et revenons vers vous dans les meilleurs délais.\n\nBien cordialement,\nValentine PECHEUX`;

  db.prepare(`
    INSERT INTO communications (id, mission_id, mission_code, direction, sender, recipient, date, subject, body, importance, urgency, status, draft_reply)
    VALUES (?, ?, ?, 'in', ?, ?, ?, ?, ?, ?, ?, 'a_traiter', ?)
  `).run(id, mission_id, mission?.code || '', sender, recipient, date, subject, body, importance, urgency, draft_reply);

  res.json({ id, message: "Communication rattachée au dossier" });
});

apiRouter.put('/communications/:id', (req, res) => {
  const { status, next_action, draft_reply, importance, urgency } = req.body;
  db.prepare(`
    UPDATE communications SET
      status = COALESCE(?, status),
      next_action = COALESCE(?, next_action),
      draft_reply = COALESCE(?, draft_reply),
      importance = COALESCE(?, importance),
      urgency = COALESCE(?, urgency)
    WHERE id = ?
  `).run(status, next_action, draft_reply, importance, urgency, req.params.id);

  res.json({ message: "Communication mise à jour" });
});

// ---------------- TRAVEL ORDERS & LRAR ----------------
apiRouter.post('/travels', (req, res) => {
  const { mission_id, destination, start_date, end_date, train_info, hotel_info, notes, checklist = [] } = req.body;
  if (!mission_id || !destination || !start_date || !end_date) {
    return res.status(400).json({ error: "Mission, destination et dates requises" });
  }

  const mission = db.prepare('SELECT code FROM missions WHERE id = ?').get(mission_id) as any;
  const id = `travel-${uuidv4().slice(0, 8)}`;

  db.prepare(`
    INSERT INTO travel_orders (id, mission_id, mission_code, destination, start_date, end_date, train_info, hotel_info, notes, checklist, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prevu')
  `).run(id, mission_id, mission?.code || '', destination, start_date, end_date, train_info, hotel_info, notes, JSON.stringify(checklist));

  res.json({ id, message: "Déplacement programmé" });
});

apiRouter.put('/travels/:id', (req, res) => {
  const { destination, start_date, end_date, train_info, hotel_info, notes, checklist, status } = req.body;
  db.prepare(`
    UPDATE travel_orders SET
      destination = COALESCE(?, destination),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      train_info = COALESCE(?, train_info),
      hotel_info = COALESCE(?, hotel_info),
      notes = COALESCE(?, notes),
      checklist = COALESCE(?, checklist),
      status = COALESCE(?, status)
    WHERE id = ?
  `).run(destination, start_date, end_date, train_info, hotel_info, notes, checklist ? JSON.stringify(checklist) : null, status, req.params.id);

  res.json({ message: "Déplacement mis à jour" });
});

apiRouter.post('/lrar', (req, res) => {
  const { mission_id, recipient, subject, tracking_number, status = 'a_preparer', sent_date, notes } = req.body;
  if (!mission_id || !recipient || !subject) {
    return res.status(400).json({ error: "Mission, destinataire et objet requis" });
  }

  const mission = db.prepare('SELECT code FROM missions WHERE id = ?').get(mission_id) as any;
  const id = `lrar-${uuidv4().slice(0, 8)}`;

  db.prepare(`
    INSERT INTO registered_mails (id, mission_id, mission_code, recipient, subject, tracking_number, status, sent_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, mission_id, mission?.code || '', recipient, subject, tracking_number, status, sent_date, notes);

  res.json({ id, message: "Suivi LRAR créé" });
});

apiRouter.put('/lrar/:id', (req, res) => {
  const { recipient, subject, tracking_number, status, sent_date, notes } = req.body;
  db.prepare(`
    UPDATE registered_mails SET
      recipient = COALESCE(?, recipient),
      subject = COALESCE(?, subject),
      tracking_number = COALESCE(?, tracking_number),
      status = COALESCE(?, status),
      sent_date = COALESCE(?, sent_date),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(recipient, subject, tracking_number, status, sent_date, notes, req.params.id);

  res.json({ message: "Courrier LRAR mis à jour" });
});

// ---------------- COMPTA & TVA MENSUELLE ----------------
apiRouter.get('/compta/entries', (req, res) => {
  const month = (req.query.month as string) || '2026-10';
  const entries = db.prepare('SELECT * FROM accounting_entries WHERE month = ? ORDER BY date ASC').all(month);
  
  // Calculate totals
  let totDepenseHT = 0, totDepenseTVA = 0, totDepenseTTC = 0;
  let totRecetteHT = 0, totRecetteTVA = 0, totRecetteTTC = 0;

  for (const e of entries as any[]) {
    if (e.type === 'depense') {
      totDepenseHT += e.amount_ht;
      totDepenseTVA += e.vat_amount;
      totDepenseTTC += e.amount_ttc;
    } else {
      totRecetteHT += e.amount_ht;
      totRecetteTVA += e.vat_amount;
      totRecetteTTC += e.amount_ttc;
    }
  }

  res.json({
    month,
    entries,
    summary: {
      depenses_ht: Math.round(totDepenseHT * 100) / 100,
      depenses_tva: Math.round(totDepenseTVA * 100) / 100,
      depenses_ttc: Math.round(totDepenseTTC * 100) / 100,
      recettes_ht: Math.round(totRecetteHT * 100) / 100,
      recettes_tva: Math.round(totRecetteTVA * 100) / 100,
      recettes_ttc: Math.round(totRecetteTTC * 100) / 100,
      tva_nette_a_payer: Math.round((totRecetteTVA - totDepenseTVA) * 100) / 100,
    },
  });
});

apiRouter.post('/compta/entries', (req, res) => {
  const { month, type, piece_number, date, invoice_number, mission_code, object, party, amount_ht, vat_amount = 0, amount_ttc, comment } = req.body;
  if (!month || !type || !date || !object || !party || amount_ht === undefined) {
    return res.status(400).json({ error: "Mois, type, date, objet, tiers et montant HT requis" });
  }

  const ht = Number(amount_ht);
  const vat = Number(vat_amount);
  const ttc = amount_ttc !== undefined ? Number(amount_ttc) : Math.round((ht + vat) * 100) / 100;
  const id = `acc-${uuidv4().slice(0, 8)}`;

  db.prepare(`
    INSERT INTO accounting_entries (id, month, type, piece_number, date, invoice_number, mission_code, object, party, amount_ht, vat_amount, amount_ttc, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, month, type, piece_number || null, date, invoice_number || null, mission_code || null, object, party, ht, vat, ttc, comment || null);

  res.json({ id, message: "Écriture comptable ajoutée" });
});

// Export monthly Excel workbook matching Compta_2026 format
apiRouter.get('/compta/export', async (req, res) => {
  const month = (req.query.month as string) || '2026-10';
  const entries = db.prepare('SELECT * FROM accounting_entries WHERE month = ? ORDER BY date ASC').all(month) as any[];
  const invoices = db.prepare("SELECT * FROM invoices WHERE status != 'annule' ORDER BY date ASC").all() as any[];

  const [yearStr, monthNum] = month.split('-');
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const monthLabel = `${monthNames[parseInt(monthNum, 10) - 1]} ${yearStr}`;

  try {
    const excelBuffer = await generateMonthlyComptaWorkbook(monthLabel, entries, invoices);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Compta_${monthLabel.replace(' ', '_')}.xlsx`);
    res.send(excelBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
