import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/vp_expertise.db');
const db = new Database(dbPath);

test('Vérification Facture 2026-097 (Mission VP2026922) au centime exact', () => {
  const inv = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get('2026-097');
  assert.ok(inv, 'La facture 2026-097 doit exister');
  assert.equal(inv.total_ht, 2354.30);
  assert.equal(inv.vat_amount, 470.86);
  assert.equal(inv.total_ttc, 2825.16);
  assert.equal(inv.net_payable, 2825.16);

  const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY order_index').all(inv.id);
  assert.equal(lines.length, 6);
  const sumLines = lines.reduce((acc, l) => acc + l.total_ht, 0);
  assert.equal(Math.round(sumLines * 100) / 100, 2354.30);
});

test('Vérification Facture 2026-098 (Mission VP2025915) au centime exact', () => {
  const inv = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get('2026-098');
  assert.ok(inv, 'La facture 2026-098 doit exister');
  assert.equal(inv.total_ht, 3194.80);
  assert.equal(inv.vat_amount, 638.96);
  assert.equal(inv.total_ttc, 3833.76);
  assert.equal(inv.net_payable, 3833.76);

  const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY order_index').all(inv.id);
  assert.equal(lines.length, 6);
  const sumLines = lines.reduce((acc, l) => acc + l.total_ht, 0);
  assert.equal(Math.round(sumLines * 100) / 100, 3194.80);
});

test('Vérification Facture 2026-099 (Mission VP2026728) au centime exact', () => {
  const inv = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get('2026-099');
  assert.ok(inv, 'La facture 2026-099 doit exister');
  assert.equal(inv.total_ht, 4717.20);
  assert.equal(inv.vat_amount, 943.44);
  assert.equal(inv.total_ttc, 5660.64);
  assert.equal(inv.net_payable, 5660.64);

  const lines = db.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY order_index').all(inv.id);
  assert.equal(lines.length, 8);
  const sumLines = lines.reduce((acc, l) => acc + l.total_ht, 0);
  assert.equal(Math.round(sumLines * 100) / 100, 4717.20);
});

test('Verrou anti-double facturation : statut des éléments facturés et réservés', () => {
  // Check that all unbilled activities have status 'a_facturer'
  const unbilledActivities = db.prepare('SELECT * FROM activities WHERE status = ?').all('a_facturer');
  assert.ok(unbilledActivities.length > 0, 'Il doit y avoir des activités non facturées');

  for (const act of unbilledActivities) {
    assert.equal(act.invoice_id, null, 'Une activité non facturée ne doit avoir aucun invoice_id');
  }

  // Simulate reserving an activity in a draft invoice
  const testAct = unbilledActivities[0];
  const reserveStmt = db.prepare("UPDATE activities SET status = 'reserve' WHERE id = ? AND status = 'a_facturer'");
  const res = reserveStmt.run(testAct.id);
  assert.equal(res.changes, 1, 'La réservation doit réussir pour un statut a_facturer');

  // Attempting to reserve again (e.g. concurrent user or double click) must fail (0 changes)
  const concurrentRes = reserveStmt.run(testAct.id);
  assert.equal(concurrentRes.changes, 0, 'Une seconde réservation concurrente doit échouer');

  // Rollback test status
  db.prepare("UPDATE activities SET status = 'a_facturer' WHERE id = ?").run(testAct.id);
});

test('Calcul arithmétique déterministe avec barème kilométrique et TVA 20%', () => {
  const km = 70;
  const kmRate = 0.95;
  const htKm = Math.round(km * kmRate * 100) / 100;
  assert.equal(htKm, 66.50);

  const hoursExpertise = 1.5;
  const rateExpertise = 190.00;
  const htExpertise = Math.round(hoursExpertise * rateExpertise * 100) / 100;
  assert.equal(htExpertise, 285.00);

  const totalHT = htKm + htExpertise;
  assert.equal(totalHT, 351.50);

  const tva = Math.round(totalHT * 0.20 * 100) / 100;
  assert.equal(tva, 70.30);

  const ttc = totalHT + tva;
  assert.equal(ttc, 421.80);
});
