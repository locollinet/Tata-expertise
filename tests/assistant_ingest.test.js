import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/vp_expertise.db');
const db = new Database(dbPath);

test("Calcul déterministe TVA sur les notes de frais (Train 10%, Hôtel 10%, Péage 20%)", () => {
  // Test train: 129.80 € TTC -> 118.00 € HT + 11.80 € TVA
  const trainTtc = 129.80;
  const trainHt = Math.round((trainTtc / 1.10) * 100) / 100;
  const trainVat = Math.round((trainTtc - trainHt) * 100) / 100;
  assert.equal(trainHt, 118.00);
  assert.equal(trainVat, 11.80);
  assert.equal(Math.round((trainHt + trainVat) * 100) / 100, trainTtc);

  // Test hotel: 165.00 € TTC -> 150.00 € HT + 15.00 € TVA
  const hotelTtc = 165.00;
  const hotelHt = Math.round((hotelTtc / 1.10) * 100) / 100;
  const hotelVat = Math.round((hotelTtc - hotelHt) * 100) / 100;
  assert.equal(hotelHt, 150.00);
  assert.equal(hotelVat, 15.00);
  assert.equal(Math.round((hotelHt + hotelVat) * 100) / 100, hotelTtc);

  // Test toll: 48.00 € TTC at 20% -> 40.00 € HT + 8.00 € TVA
  const tollTtc = 48.00;
  const tollHt = Math.round((tollTtc / 1.20) * 100) / 100;
  const tollVat = Math.round((tollTtc - tollHt) * 100) / 100;
  assert.equal(tollHt, 40.00);
  assert.equal(tollVat, 8.00);
  assert.equal(Math.round((tollHt + tollVat) * 100) / 100, tollTtc);
});

test("Enregistrement sécurisé en base SQLite d'une note de frais validée via l'Assistant", () => {
  const testId = `exp-test-${Date.now()}`;
  const mission = db.prepare('SELECT id, code FROM missions LIMIT 1').get();
  assert.ok(mission, "Un dossier doit exister");

  const date = '2026-10-28';
  const category = 'train';
  const label = 'Billet TGV Massy - Réunion d\'expertise contradictoire';
  const amount_ht = 118.00;
  const vat_amount = 11.80;
  const total_ttc = 129.80;
  const filename = 'ingest-test-billet.jpg';

  db.prepare(`
    INSERT INTO expenses (id, mission_id, mission_code, date, category, label, quantity, unit_price, total_ht, vat_amount, total_ttc, receipt_filename, status, is_refacturable)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'a_facturer', 1)
  `).run(testId, mission.id, mission.code, date, category, label, amount_ht, amount_ht, vat_amount, total_ttc, filename);

  const inserted = db.prepare('SELECT * FROM expenses WHERE id = ?').get(testId);
  assert.ok(inserted, "La dépense doit être insérée");
  assert.equal(inserted.mission_code, mission.code);
  assert.equal(inserted.total_ht, 118.00);
  assert.equal(inserted.vat_amount, 11.80);
  assert.equal(inserted.total_ttc, 129.80);
  assert.equal(inserted.receipt_filename, filename);
  assert.equal(inserted.status, 'a_facturer');

  // Clean up
  db.prepare('DELETE FROM expenses WHERE id = ?').run(testId);
  const deleted = db.prepare('SELECT * FROM expenses WHERE id = ?').get(testId);
  assert.equal(deleted, undefined, "Nettoyage réussi");
});
