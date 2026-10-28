import { Router } from 'express';
import { db } from './db.js';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
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
      label: `Demande de dire / Acte de ${email.sender.split('<')[0].trim()} : "${email.subject}"`,
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
      INSERT OR REPLACE INTO accounting_entries (id, month, type, piece_number, date, invoice_number, mission_code, object, party, amount_ht, vat_amount, amount_ttc, comment)
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

// ---------------- ASSISTANT IA (GEMINI 2.5 FLASH) ----------------
apiRouter.post('/assistant/chat', async (req, res) => {
  const { message, history = [], missionId } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: "Message requis" });
  }

  // 1. Gather live operational data for context
  const missions = db.prepare("SELECT * FROM missions WHERE status != 'cloture'").all() as any[];
  const enrichedMissions = missions.map(m => {
    const stats = getMissionUnbilledStats(m.id);
    return {
      code: m.code,
      title: m.title,
      client: m.insurance_client,
      insured: m.insured_party,
      status: m.status,
      next_deadline: m.next_deadline,
      next_action: m.next_action,
      unbilled_hours: stats.unbilled_hours,
      total_unbilled_ht: stats.total_unbilled_ht,
      billing_threshold: m.custom_billing_threshold || 3500,
    };
  });

  const latestInvoices = db.prepare("SELECT invoice_number, mission_code, client_name, total_ht, total_ttc, date, status FROM invoices ORDER BY date DESC LIMIT 5").all();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const revObj = db.prepare("SELECT COALESCE(SUM(total_ht), 0) as rev FROM invoices WHERE strftime('%Y-%m', date) = ? AND status != 'annule'").get(currentMonth) as { rev: number };
  const upcomingTravels = db.prepare("SELECT mission_code, destination, start_date, notes FROM travel_orders WHERE status IN ('prevu', 'confirme') ORDER BY start_date ASC LIMIT 3").all();

  // If a specific mission is selected, pull its deep details
  let specificMissionContext = '';
  if (missionId) {
    const sm = db.prepare("SELECT * FROM missions WHERE id = ?").get(missionId) as any;
    if (sm) {
      const smActs = db.prepare("SELECT date, category, label, hours, total_ht, status FROM activities WHERE mission_id = ? ORDER BY date DESC LIMIT 6").all(sm.id);
      const smDocs = db.prepare("SELECT filename, original_name, category, caption FROM documents WHERE mission_id = ? ORDER BY created_at DESC LIMIT 6").all(sm.id);
      const smAtt = db.prepare("SELECT name, organization, role FROM attendees WHERE mission_id = ?").all(sm.id);
      specificMissionContext = `
Détail du dossier sélectionné (${sm.code} - ${sm.title}) :
- Assureur : ${sm.insurance_client} | Assuré : ${sm.insured_party || 'Non précisé'}
- Réf : ${sm.case_reference} | Taux : ${sm.custom_hourly_rate || 190} €/h
- Échéance : ${sm.next_deadline || 'Aucune'} — ${sm.next_action || 'Aucune'}
- Participants enregistrés (${smAtt.length}) : ${smAtt.map((a: any) => `${a.name} (${a.organization})`).join(', ') || 'Aucun'}
- Dernières activités : ${smActs.map((a: any) => `${a.date}: ${a.label} (${a.hours}h, ${a.status})`).join(' | ')}
- Documents rattachés (${smDocs.length}) : ${smDocs.map((d: any) => `${d.original_name} (${d.category})`).join(', ')}
`;
    }
  }

  const contextPrompt = `
Tu es l'assistant exécutif IA de Valentine Pécheux, ingénieure experte fondatrice du cabinet VP EXPERTISE (Cabinet d'Ingénierie Mécanique & Matériels Ferroviaires).
Ton rôle : être concis, factuel, d'une politesse professionnelle impeccable, en français, et répondre immédiatement à ses questions sans bavardage inutile.

Voici les données réelles et à jour de son cabinet en direct de sa base :
- Dossiers actifs (${enrichedMissions.length}) :
${enrichedMissions.map(m => `  * [${m.code}] ${m.title} — Client: ${m.client} — Non facturé: ${m.total_unbilled_ht.toFixed(2)} € HT (${m.unbilled_hours}h) — Seuil: ${m.billing_threshold} € — Échéance: ${m.next_deadline || 'Aucune'} (${m.next_action || 'Aucune'})`).join('\n')}

- Chiffre d'affaires émis ce mois (${currentMonth}) : ${revObj.rev.toFixed(2)} € HT
- Dernières factures :
${latestInvoices.map((i: any) => `  * N° ${i.invoice_number} (${i.mission_code}) : ${i.total_ht.toFixed(2)} € HT (${i.status})`).join('\n')}

- Prochains déplacements :
${upcomingTravels.map((t: any) => `  * ${t.start_date} (${t.mission_code}) : ${t.destination}`).join('\n') || 'Aucun'}
${specificMissionContext}

Consignes :
1. Réponds toujours avec les chiffres et faits exacts ci-dessus.
2. Si elle demande de rédiger un message, rédige un projet prêt à être copié/envoyé (Objet, formule de politesse, corps clair, signature "Valentine Pécheux - VP Expertise").
3. Reste toujours synthétique et pratique. Pas de longs discours théoriques.
`;

  // 2. Multi-model Gemini call with automatic fallback chain
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.API_KEY;

  if (apiKey) {
    // Try reliable candidate models in sequence
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Format chat history if provided
    let conversationContext = '';
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-6);
      conversationContext = `Historique récent de la discussion :\n` +
        recentHistory.map((h: any) => `${h.sender === 'user' ? 'Valentine' : 'Assistant'} : ${h.text}`).join('\n') + '\n\n';
    }

    const fullPrompt = `${contextPrompt}\n\n${conversationContext}Demande de Valentine :\n${message}`;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          config: {
            systemInstruction: "Tu es l'assistant personnel opérationnel de Valentine Pécheux (Cabinet VP EXPERTISE - Ingénierie Mécanique & Matériels Ferroviaires). Tu réponds toujours de manière personnalisée, concrète et utile en français. Si elle te demande de rédiger un mail ou une relance, fournis un texte complet et prêt à l'envoi. Adapte toujours ta réponse à la demande précise, sans formule robotique répétitive.",
          },
        });

        const replyText = response.text?.trim();
        if (replyText && replyText.length > 0) {
          return res.json({
            reply: replyText,
            model,
            hasKey: true,
          });
        }
      } catch (err: any) {
        console.warn(`Modèle Gemini ${model} indisponible (${err.message}). Essai du suivant...`);
      }
    }
  }

  // 3. Fallback contextuel intelligent si l'API externe est temporairement inaccessible
  const lower = message.toLowerCase();
  let localReply = "";

  // Cas A : Rédaction de mail, relance ou courrier
  if (lower.includes('rédig') || lower.includes('redig') || lower.includes('relanc') || lower.includes('mail') || lower.includes('courrier') || lower.includes('ecri') || lower.includes('écri')) {
    if (lower.includes('alstom') || lower.includes('ligne 18') || lower.includes('trémie') || lower.includes('vinci')) {
      localReply = `✉️ **Projet d'e-mail de relance — ALSTOM Ligne 18 :**\n\n` +
        `**Objet :** Dossier VP2026922 (SGP Ligne 18 - Trémie OA-08) — Observations techniques suite aux Dires de VINCI\n\n` +
        `Maître, Chers confrères,\n\n` +
        `Dans le cadre des opérations d'expertise relatives au sinistre sur la dalle de couverture de la trémie OA-08 (Réf. 11161461), je vous informe que la note d'observation technique de VP EXPERTISE est en cours de finalisation en vue de l'échéance fixée au **05/11/2026**.\n\n` +
        `Afin de consolider les conclusions sur les contraintes dynamiques et la flexion résiduelle, je vous saurais gré de bien vouloir nous transmettre sans délai les procès-verbaux de contrôle du ferraillage ainsi que les notes de calcul d'étaiement initialement sollicitées.\n\n` +
        `Restant à votre entière disposition pour tout échange contradictoire préalable.\n\n` +
        `Bien confraternellement,\n\n` +
        `**Valentine Pécheux**\n` +
        `Ingénieure Spécialiste Matériels Roulants & Infrastructures Ferroviaires\n` +
        `Cabinet VP EXPERTISE — 06 12 34 56 78`;
    } else if (lower.includes('regiorail') || lower.includes('ambérieu') || lower.includes('collision')) {
      localReply = `✉️ **Projet d'e-mail de relance — REGIORAIL Ambérieu :**\n\n` +
        `**Objet :** Dossier VP2026104 — Sinistre triage Ambérieu — Transmission du rapport d'incident SNCF Réseau\n\n` +
        `Bonjour,\n\n` +
        `Faisant suite à notre dernière réunion d'expertise du dossier référencé RR-2026-AMB-09, je me permets de vous relancer concernant la communication du rapport interne d'incident et des relevés de vitesse de la rame refoulée.\n\n` +
        `Pour rappel, le délai d'instruction imparti court jusqu'au **28/11/2026** pour le dépôt de la synthèse technique.\n\n` +
        `Bien cordialement,\n\n` +
        `**Valentine Pécheux**\n` +
        `VP EXPERTISE`;
    } else {
      localReply = `✉️ **Projet de message prêt à l'envoi :**\n\n` +
        `**Objet :** Dossier d'expertise ferroviaire — Point d'étape et demande de pièces complémentaires\n\n` +
        `Bonjour,\n\n` +
        `Dans le cadre de l'instruction contradictoire en cours, je reviens vers vous concernant les documents techniques attendus pour la poursuite de nos investigations.\n\n` +
        `Afin de respecter le calendrier de procédure et de préparer utilement la prochaine réunion d'expertise, je vous remercie par avance pour votre retour d'ici la fin de semaine.\n\n` +
        `Restant à votre écoute,\n\n` +
        `Bien cordialement,\n\n` +
        `**Valentine Pécheux**\n` +
        `Cabinet VP EXPERTISE`;
    }
  }
  // Cas B : Seuils de facturation et encours
  else if (lower.includes('seuil') || lower.includes('factur') || lower.includes('3500') || lower.includes('3 500') || lower.includes('combien') || lower.includes('honorair') || lower.includes('à facturer')) {
    const overThreshold = enrichedMissions.filter(m => m.total_unbilled_ht >= m.billing_threshold);
    const totalUnbilled = enrichedMissions.reduce((acc, m) => acc + m.total_unbilled_ht, 0);
    localReply = `💰 **Synthèse de votre facturation en cours :**\n\n` +
      `* **Total en attente d'émission :** **${totalUnbilled.toFixed(2).replace('.', ',')} € HT**\n\n` +
      (overThreshold.length > 0
        ? `⚠️ **Dossier(s) ayant dépassé le seuil d'alerte (${overThreshold[0].billing_threshold} € HT) :**\n` +
          overThreshold.map(m => `* **${m.code}** (${m.title}) : **${m.total_unbilled_ht.toFixed(2).replace('.', ',')} € HT** (${m.unbilled_hours} h de vacations + frais).`).join('\n') +
          `\n\n👉 Vous pouvez générer les notes d'honoraires Word officielles au format VP Expertise en un clic dans l'onglet **Honoraires**.`
        : `✅ Aucun dossier ne dépasse actuellement votre seuil d'alerte.`);
  }
  // Cas C : Échéances, dates et calendrier
  else if (lower.includes('échéance') || lower.includes('echeance') || lower.includes('jalon') || lower.includes('dire') || lower.includes('quand') || lower.includes('planning') || lower.includes('date')) {
    const withDeadlines = enrichedMissions.filter(m => m.next_deadline).sort((a, b) => (a.next_deadline || '').localeCompare(b.next_deadline || ''));
    localReply = `📅 **Vos prochaines échéances de procédure :**\n\n` +
      withDeadlines.map(m => `* **${m.next_deadline?.split('-').reverse().join('/')}** — [${m.code}] ${m.title}\n  ↳ *Action :* ${m.next_action}`).join('\n\n') +
      `\n\n🚆 **Prochain déplacement terrain :**\n` +
      upcomingTravels.map((t: any) => `* **${t.start_date.split('-').reverse().join('/')}** : ${t.destination} (${t.mission_code})`).join('\n');
  }
  // Cas D : Comptabilité et TVA
  else if (lower.includes('compta') || lower.includes('tva') || lower.includes('chiffre') || lower.includes('ca') || lower.includes('bilan')) {
    localReply = `📊 **Situation Comptable d'Octobre 2026 :**\n\n` +
      `* **Chiffre d'affaires émis :** ${revObj.rev.toFixed(2).replace('.', ',')} € HT\n` +
      `* **TVA collectée estimée (20%) :** ${(revObj.rev * 0.20).toFixed(2).replace('.', ',')} €\n` +
      `* **Dernières factures émises :**\n` +
      latestInvoices.map((i: any) => `  * N° ${i.invoice_number} (${i.mission_code}) : ${i.total_ht.toFixed(2).replace('.', ',')} € HT (${i.status})`).join('\n') +
      `\n\nL'export journal comptable Excel est prêt dans l'onglet **Comptabilité**.`;
  }
  // Cas E : Questions sur un dossier particulier
  else if (lower.includes('alstom') || lower.includes('ligne 18')) {
    const m = enrichedMissions.find(x => x.code === 'VP2026922');
    localReply = m
      ? `🔍 **Point sur le dossier ALSTOM Ligne 18 (VP2026922) :**\n\n` +
        `* **Intitulé :** ${m.title}\n` +
        `* **Client :** ${m.client} (Réf : 11161461)\n` +
        `* **Vacations en cours :** ${m.unbilled_hours} h (${m.total_unbilled_ht.toFixed(2).replace('.', ',')} € HT)\n` +
        `* **Échéance critique :** **${m.next_deadline?.split('-').reverse().join('/')}**\n` +
        `* **Action requise :** ${m.next_action}`
      : "Dossier ALSTOM introuvable.";
  } else if (lower.includes('regiorail') || lower.includes('ambérieu')) {
    const m = enrichedMissions.find(x => x.code === 'VP2026104');
    localReply = m
      ? `🔍 **Point sur le dossier REGIORAIL Ambérieu (VP2026104) :**\n\n` +
        `* **Intitulé :** ${m.title}\n` +
        `* **Client :** ${m.client} (Réf : RR-2026-AMB-09)\n` +
        `* **Statut financier :** ⚠️ Seuil dépassé avec **${m.total_unbilled_ht.toFixed(2).replace('.', ',')} € HT** à facturer\n` +
        `* **Prochaine échéance :** **${m.next_deadline?.split('-').reverse().join('/')}**\n` +
        `* **Action requise :** ${m.next_action}`
      : "Dossier REGIORAIL introuvable.";
  } else if (lower.includes('forwardis') || lower.includes('clermont') || lower.includes('gravanche')) {
    const m = enrichedMissions.find(x => x.code === 'VP2025915');
    localReply = m
      ? `🔍 **Point sur le dossier FORWARDIS Clermont-Gravanche (VP2025915) :**\n\n` +
        `* **Intitulé :** ${m.title}\n` +
        `* **Client :** ${m.client} (Réf : FWD-2025-03)\n` +
        `* **Non facturé :** ${m.total_unbilled_ht.toFixed(2).replace('.', ',')} € HT\n` +
        `* **Prochaine échéance :** **${m.next_deadline?.split('-').reverse().join('/')}**\n` +
        `* **Action requise :** ${m.next_action}`
      : "Dossier FORWARDIS introuvable.";
  } else if (lower.includes('tla') || lower.includes('ettendorf')) {
    const m = enrichedMissions.find(x => x.code === 'VP2026728');
    localReply = m
      ? `🔍 **Point sur le dossier TLA TRANSPORTS Ettendorf (VP2026728) :**\n\n` +
        `* **Intitulé :** ${m.title}\n` +
        `* **Client :** ${m.client} (Réf : TLA-2026-ETT)\n` +
        `* **Non facturé :** ${m.total_unbilled_ht.toFixed(2).replace('.', ',')} € HT\n` +
        `* **Prochaine échéance :** **${m.next_deadline?.split('-').reverse().join('/')}**\n` +
        `* **Action requise :** ${m.next_action}`
      : "Dossier TLA TRANSPORTS introuvable.";
  }
  // Cas F : Question générale ou d'accueil
  else {
    const totalUnbilled = enrichedMissions.reduce((acc, m) => acc + m.total_unbilled_ht, 0);
    const closestDeadline = enrichedMissions.filter(m => m.next_deadline).sort((a, b) => (a.next_deadline || '').localeCompare(b.next_deadline || ''))[0];
    localReply = `Bonjour Valentine. Je suis à vos côtés pour gérer vos dossiers d'expertise ferroviaire.\n\n` +
      `📌 **Votre situation aujourd'hui :**\n` +
      `* **${enrichedMissions.length} dossiers actifs** en cours d'instruction\n` +
      `* **${totalUnbilled.toFixed(2).replace('.', ',')} € HT** de vacations et frais à facturer\n` +
      (closestDeadline ? `* Prochaine échéance : **${closestDeadline.next_deadline?.split('-').reverse().join('/')}** sur le dossier [${closestDeadline.code}] (*${closestDeadline.next_action}*)\n\n` : '\n') +
      `Que souhaitez-vous faire ? Vous pouvez me demander par exemple :\n` +
      `* *"Rédige une relance pour Alstom concernant les dires de Vinci"*\n` +
      `* *"Quels dossiers ont dépassé les 3 500 € ?"*\n` +
      `* *"Quel est mon chiffre d'affaires ce mois-ci ?"*\n` +
      `* *"Fais le point complet sur le dossier Forwardis"*`;
  }

  res.json({
    reply: localReply,
    model: 'vp-expertise-assistant (smart local context)',
    hasKey: Boolean(apiKey),
  });
});

// ---------------- ASSISTANT MULTIMODAL INGESTION ----------------
apiRouter.post('/assistant/ingest', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const instruction = (req.body.text || req.body.instruction || '').trim();
    const preselectedMissionId = req.body.missionId;

    if (!file && !instruction) {
      return res.status(400).json({ error: "Veuillez fournir un justificatif ou une consigne." });
    }

    // 1. Fetch active missions for target resolution
    const missions = db.prepare('SELECT id, code, title, case_reference, insurance_client, insured_party, custom_hourly_rate FROM missions ORDER BY code DESC').all() as any[];

    let matchedMission = preselectedMissionId ? missions.find(m => m.id === preselectedMissionId || m.code.toLowerCase() === preselectedMissionId.toLowerCase()) : null;

    // Check if filename / instruction references a mission
    if (!matchedMission && instruction) {
      const lowerInst = instruction.toLowerCase();
      matchedMission = missions.find(m => 
        lowerInst.includes(m.code.toLowerCase()) || 
        (m.title && lowerInst.includes(m.title.toLowerCase().slice(0, 10))) ||
        (m.insurance_client && lowerInst.includes(m.insurance_client.toLowerCase())) ||
        (m.case_reference && lowerInst.includes(m.case_reference.toLowerCase())) ||
        (m.code.includes('922') && (lowerInst.includes('alstom') || lowerInst.includes('ligne 18'))) ||
        (m.code.includes('104') && (lowerInst.includes('regiorail') || lowerInst.includes('ambérieu') || lowerInst.includes('amberieu')))
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.API_KEY;
    let extracted: any = null;
    let modelUsed = 'Règles déterministes locales';

    // 2. Multimodal analysis via Gemini if API key is present and file provided
    if (apiKey && file) {
      const candidateModels = [
        process.env.GEMINI_MODEL,
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ].filter(Boolean) as string[];

      const fileBuffer = fs.readFileSync(file.path);
      const mimeType = file.mimetype === 'application/pdf' ? 'application/pdf' : (file.mimetype.startsWith('image/') ? file.mimetype : 'image/jpeg');

      const systemPrompt = `Tu es l'assistant d'ingestion comptable et juridique de VP EXPERTISE (Cabinet d'Ingénierie Mécanique & Ferroviaire de Valentine Pécheux, Expert de Justice).

Dossiers d'expertise en cours :
${missions.map(m => `- [${m.code}] (ID: ${m.id}) : ${m.title} (Réf : ${m.case_reference}, Assureur : ${m.insurance_client}, Assuré : ${m.insured_party || 'N/A'})`).join('\n')}

Instruction de Valentine : "${instruction || 'Analyse ce justificatif ou document.'}"
Nom du fichier original : "${file.originalname}"

Consignes :
1. Catégorise l'action :
   - "expense" si c'est un ticket de train, note d'hôtel, restaurant, péage, taxi, carburant, frais de déplacement.
   - "document" si c'est un Dire d'avocat, un PV de constatation contradictoire, une convocation, une note technique ou un courrier de procédure.
   - "new_mission" si c'est une nouvelle ordonnance de référé ou une nouvelle lettre de mission désignant une affaire inexistante dans la liste.
   - "activity" si c'est un relevé d'heures ou une vacation.
2. Pour une dépense ("expense") :
   - Extrait la date au format YYYY-MM-DD.
   - Calcule avec rigueur :
     * Billets SNCF / RATP : TVA à 10% (HT = TTC / 1.10).
     * Hôtel / Hébergement : TVA à 10%.
     * Restauration : TVA à 10%.
     * Péage / Taxi / Fournitures : TVA à 20%.
     * Kilométrique : TVA à 0%.
     * Contrôle arithmétique : total_ttc = round(amount_ht + vat_amount, 2).
   - Rapproche la dépense du dossier mentionné par Valentine ou le plus pertinent.
3. Pour un document ("document") :
   - Extrait le titre, la catégorie (dire, pv, technique, autre) et l'échéance de réponse si mentionnée (format YYYY-MM-DD).
4. Pour un nouveau dossier ("new_mission") :
   - Extrait le titre du sinistre, la référence, l'assureur ou tribunal, la date et l'assuré.

Renvoie UNIQUEMENT un JSON valide respectant ce schéma sans balise Markdown ni texte additionnel :
{
  "action_type": "expense" | "document" | "new_mission" | "activity",
  "confidence": 0.95,
  "matched_mission_id": "id du dossier correspondant ou null",
  "matched_mission_code": "code du dossier correspondant (ex: VP2026922) ou null",
  "summary": "Résumé en français court et clair pour Valentine",
  "payload": {
    "date": "YYYY-MM-DD",
    "category": "train" | "hotel" | "repas" | "peage" | "autre",
    "label": "Libellé de la dépense",
    "supplier": "Fournisseur",
    "amount_ht": 0.0,
    "vat_rate": 0.10,
    "vat_amount": 0.0,
    "total_ttc": 0.0,
    "document_title": "Titre du document",
    "document_category": "dire" | "pv" | "technique" | "autre",
    "deadline": "YYYY-MM-DD",
    "new_mission_title": "Titre",
    "new_mission_case_reference": "Réf",
    "new_mission_client": "Assureur/Client",
    "new_mission_insured": "Assuré",
    "new_mission_court": "Tribunal"
  }
}`;

      const ai = new GoogleGenAI({ apiKey });
      for (const mName of candidateModels) {
        try {
          const result = await ai.models.generateContent({
            model: mName,
            contents: [
              {
                role: 'user',
                parts: [
                  { text: systemPrompt },
                  {
                    inlineData: {
                      mimeType,
                      data: fileBuffer.toString('base64'),
                    },
                  },
                ],
              },
            ],
          });

          const rawText = result.text || '';
          const cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && parsed.action_type) {
            extracted = parsed;
            modelUsed = mName;
            break;
          }
        } catch (modelErr: any) {
          console.warn(`[Ingest] Modèle ${mName} indisponible :`, modelErr.message);
        }
      }
    }

    // 3. Fallback déterministe local (si pas de clé API ou modèle échoué ou saisie textuelle)
    if (!extracted) {
      const lower = `${instruction} ${file ? file.originalname : ''}`.toLowerCase();
      const today = new Date().toISOString().slice(0, 10);

      // Check for mission match if not already found
      if (!matchedMission) {
        matchedMission = missions.find(m => 
          lower.includes(m.code.toLowerCase()) || 
          lower.includes(m.title.toLowerCase().slice(0, 10)) ||
          (m.code.includes('922') && (lower.includes('alstom') || lower.includes('ligne 18'))) ||
          (m.code.includes('104') && (lower.includes('regiorail') || lower.includes('ambérieu') || lower.includes('amberieu')))
        ) || missions[0];
      }

      // Detect action type
      if (lower.includes('dire') || lower.includes('conclusions') || lower.includes('avocat') || lower.includes('signifi')) {
        extracted = {
          action_type: 'document',
          confidence: 0.90,
          matched_mission_id: matchedMission?.id || null,
          matched_mission_code: matchedMission?.code || null,
          summary: `Pièce de procédure détectée pour le dossier ${matchedMission?.code || ''}`,
          payload: {
            date: today,
            document_title: file ? file.originalname.replace(/\.[^.]+$/, '') : "Dire d'avocat reçu",
            document_category: 'dire',
            deadline: null,
          },
        };
      } else if (lower.includes('ordonnance') || lower.includes('désignation') || lower.includes('designation') || lower.includes('nouveau dossier')) {
        extracted = {
          action_type: 'new_mission',
          confidence: 0.88,
          matched_mission_id: null,
          matched_mission_code: null,
          summary: "Nouvelle désignation judiciaire détectée",
          payload: {
            date: today,
            new_mission_title: instruction ? instruction.replace(/nouveau dossier/i, '').trim() : "Nouvelle mission d'expertise ferroviaire",
            new_mission_case_reference: "Réf à préciser",
            new_mission_client: "Tribunal Judiciaire",
            new_mission_court: "TJ",
          },
        };
      } else {
        // Default to Expense
        let category: 'train' | 'hotel' | 'repas' | 'peage' | 'autre' = 'train';
        let vat_rate = 0.10;
        let label = "Déplacement ferroviaire SNCF";
        let supplier = "SNCF Voyageurs";

        if (lower.includes('hotel') || lower.includes('ibis') || lower.includes('novotel') || lower.includes('nuit')) {
          category = 'hotel';
          vat_rate = 0.10;
          label = "Hébergement hôtel intervention";
          supplier = "Hôtel";
        } else if (lower.includes('restaurant') || lower.includes('repas') || lower.includes('dejeuner') || lower.includes('diner')) {
          category = 'repas';
          vat_rate = 0.10;
          label = "Repas réunion d'expertise";
          supplier = "Restauration";
        } else if (lower.includes('peage') || lower.includes('aprr') || lower.includes('vinci') || lower.includes('taxi')) {
          category = 'peage';
          vat_rate = 0.20;
          label = "Frais de péage autoroutier / Taxi";
          supplier = "Société d'autoroutes";
        }

        // Amount extraction
        const amountMatch = lower.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)/i) || lower.match(/(?:montant|total|prix|de)\s*(\d+(?:[.,]\d{1,2})?)/i);
        const amount_raw = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 118.00;
        const amount_ht = Math.round((amount_raw / (1 + vat_rate)) * 100) / 100;
        const vat_amount = Math.round((amount_raw - amount_ht) * 100) / 100;
        const total_ttc = Math.round((amount_ht + vat_amount) * 100) / 100;

        extracted = {
          action_type: 'expense',
          confidence: 0.85,
          matched_mission_id: matchedMission?.id || null,
          matched_mission_code: matchedMission?.code || null,
          summary: `${label} (${total_ttc.toFixed(2).replace('.', ',')} € TTC) rattaché à [${matchedMission?.code || 'Sans dossier'}]`,
          payload: {
            date: today,
            category,
            label,
            supplier,
            amount_ht,
            vat_rate,
            vat_amount,
            total_ttc,
          },
        };
      }
    }

    // 4. Ensure payload arithmetic is 100% deterministic
    if (extracted.action_type === 'expense' && extracted.payload) {
      const p = extracted.payload;
      const rate = typeof p.vat_rate === 'number' ? p.vat_rate : 0.10;
      let ht = typeof p.amount_ht === 'number' && p.amount_ht > 0 ? p.amount_ht : (p.total_ttc ? Math.round((p.total_ttc / (1 + rate)) * 100) / 100 : 0);
      let vat = Math.round(ht * rate * 100) / 100;
      let ttc = Math.round((ht + vat) * 100) / 100;

      p.amount_ht = ht;
      p.vat_rate = rate;
      p.vat_amount = vat;
      p.total_ttc = ttc;
      if (!p.date) p.date = new Date().toISOString().slice(0, 10);
    }

    // 5. Attach file details if present
    const fileInfo = file ? {
      filename: file.filename,
      original_name: file.originalname,
      mime_type: file.mimetype,
      file_size: file.size,
      url: `/uploads/${file.filename}`,
    } : null;

    res.json({
      success: true,
      model: modelUsed,
      file: fileInfo,
      action: extracted,
    });
  } catch (err: any) {
    console.error("[Assistant Ingest Error] :", err);
    res.status(500).json({ error: err.message || "Erreur lors de l'ingestion du document." });
  }
});

// Commit action validated by user in ActionPreviewCard
apiRouter.post('/assistant/commit-action', (req, res) => {
  try {
    const { action_type, mission_id, payload, filename, original_name } = req.body;
    if (!action_type) {
      return res.status(400).json({ error: "Type d'action requis." });
    }

    if (action_type === 'expense') {
      if (!mission_id) return res.status(400).json({ error: "Veuillez sélectionner un dossier de rattachement." });
      const mission = db.prepare('SELECT id, code FROM missions WHERE id = ?').get(mission_id) as any;
      if (!mission) return res.status(404).json({ error: "Dossier introuvable." });

      const date = payload.date || new Date().toISOString().slice(0, 10);
      const category = payload.category || 'train';
      const label = (payload.label || 'Note de frais terrain').trim();
      const amount_ht = Number(payload.amount_ht) || 0;
      const vat_amount = Number(payload.vat_amount) || 0;
      const total_ttc = Math.round((amount_ht + vat_amount) * 100) / 100;
      const id = `exp-${uuidv4().slice(0, 8)}`;

      db.prepare(`
        INSERT INTO expenses (id, mission_id, mission_code, date, category, label, quantity, unit_price, total_ht, vat_amount, total_ttc, receipt_filename, status, is_refacturable)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'a_facturer', 1)
      `).run(id, mission.id, mission.code, date, category, label, amount_ht, amount_ht, vat_amount, total_ttc, filename || null);

      return res.json({
        success: true,
        action_type: 'expense',
        id,
        mission_code: mission.code,
        message: `Frais de ${amount_ht.toFixed(2).replace('.', ',')} € HT (${category}) enregistré avec succès dans [${mission.code}].`,
      });
    }

    if (action_type === 'document') {
      if (!mission_id) return res.status(400).json({ error: "Veuillez sélectionner un dossier de rattachement." });
      const mission = db.prepare('SELECT id, code FROM missions WHERE id = ?').get(mission_id) as any;
      if (!mission) return res.status(404).json({ error: "Dossier introuvable." });

      const id = `doc-${uuidv4().slice(0, 8)}`;
      const docFilename = filename || `doc-${Date.now()}.pdf`;
      const docOriginalName = original_name || payload.document_title || 'Document';
      const cat = payload.document_category || 'autre';
      const caption = (payload.document_title || payload.label || 'Pièce de procédure').trim();

      db.prepare(`
        INSERT INTO documents (id, mission_id, mission_code, filename, original_name, mime_type, file_size, category, caption, is_selected_for_report)
        VALUES (?, ?, ?, ?, ?, 'application/pdf', 1024, ?, ?, 0)
      `).run(id, mission.id, mission.code, docFilename, docOriginalName, cat, caption);

      if (payload.deadline) {
        db.prepare(`
          UPDATE missions SET next_deadline = ?, next_action = ? WHERE id = ?
        `).run(payload.deadline, `Remise réponse à la pièce : ${caption}`, mission.id);
      }

      return res.json({
        success: true,
        action_type: 'document',
        id,
        mission_code: mission.code,
        message: `Document classé avec succès dans [${mission.code}].`,
      });
    }

    if (action_type === 'activity') {
      if (!mission_id) return res.status(400).json({ error: "Veuillez sélectionner un dossier de rattachement." });
      const mission = db.prepare('SELECT id, code, custom_hourly_rate FROM missions WHERE id = ?').get(mission_id) as any;
      if (!mission) return res.status(404).json({ error: "Dossier introuvable." });

      const id = `act-${uuidv4().slice(0, 8)}`;
      const date = payload.date || new Date().toISOString().slice(0, 10);
      const hours = Number(payload.hours) || 1;
      const rate = mission.custom_hourly_rate || 190;
      const total_ht = Math.round(hours * rate * 100) / 100;
      const label = (payload.label || 'Vacation d\'expertise').trim();

      db.prepare(`
        INSERT INTO activities (id, mission_id, mission_code, date, category, label, hours, hourly_rate, total_ht, billable, status)
        VALUES (?, ?, ?, ?, 'expertise', ?, ?, ?, ?, 1, 'a_facturer')
      `).run(id, mission.id, mission.code, date, label, hours, rate, total_ht);

      return res.json({
        success: true,
        action_type: 'activity',
        id,
        mission_code: mission.code,
        message: `Pointage de ${hours} h enregistré dans [${mission.code}].`,
      });
    }

    return res.status(400).json({ error: `Type d'action "${action_type}" non géré.` });
  } catch (err: any) {
    console.error("[Assistant Commit Error] :", err);
    res.status(500).json({ error: err.message || "Erreur lors de l'enregistrement de l'action." });
  }
});
