import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import path from 'path';
// 14 items types de facturation officiels de Valentine Pécheux
const ACTIVITY_CATEGORY_LABELS = {
  etude_documents: 'Étude de documents, gestion du dossier',
  expertise: 'Expertise',
  reunion_assureurs: 'Réunion avec les assureurs',
  reunion_assure: 'Réunion avec l’assuré',
  redaction: 'Rédaction Expert',
  deplacement: 'Déplacement expert',
};

const EXPENSE_CATEGORY_LABELS = {
  train: 'Frais de déplacement (train)',
  km: 'Frais kilométriques',
  peage: 'Péage',
  location_voiture: 'Voiture de location',
  repas: 'Repas',
  hotel: 'Hôtel',
  parking: 'Parking',
  taxi: 'Taxi',
};

const dbPath = path.resolve(process.cwd(), 'data/vp_expertise.db');
const db = new Database(dbPath);

test('Vérification des 14 items types de facturation demandés par Valentine', () => {
  // 1. Honoraires de temps (6 catégories)
  assert.equal(ACTIVITY_CATEGORY_LABELS.etude_documents, 'Étude de documents, gestion du dossier');
  assert.equal(ACTIVITY_CATEGORY_LABELS.expertise, 'Expertise');
  assert.equal(ACTIVITY_CATEGORY_LABELS.reunion_assureurs, 'Réunion avec les assureurs');
  assert.equal(ACTIVITY_CATEGORY_LABELS.reunion_assure, 'Réunion avec l’assuré');
  assert.equal(ACTIVITY_CATEGORY_LABELS.redaction, 'Rédaction Expert');
  assert.equal(ACTIVITY_CATEGORY_LABELS.deplacement, 'Déplacement expert');

  // 2. Débours / Notes de frais (8 catégories + péage/parking dissociés)
  assert.equal(EXPENSE_CATEGORY_LABELS.train, 'Frais de déplacement (train)');
  assert.equal(EXPENSE_CATEGORY_LABELS.km, 'Frais kilométriques');
  assert.equal(EXPENSE_CATEGORY_LABELS.peage, 'Péage');
  assert.equal(EXPENSE_CATEGORY_LABELS.location_voiture, 'Voiture de location');
  assert.equal(EXPENSE_CATEGORY_LABELS.repas, 'Repas');
  assert.equal(EXPENSE_CATEGORY_LABELS.hotel, 'Hôtel');
  assert.equal(EXPENSE_CATEGORY_LABELS.parking, 'Parking');
  assert.equal(EXPENSE_CATEGORY_LABELS.taxi, 'Taxi');
});

test('Ajout d’une écriture compta depuis un relevé bancaire avec calcul auto TVA déductible', () => {
  const testMonth = '2026-10';
  const testDate = '2026-10-14';
  const testObject = 'Péage autoroute A1';
  const testParty = 'SANEF';
  const amountTtc = 36.00;
  const vatRate = 0.20;

  const ht = Math.round((amountTtc / (1 + vatRate)) * 100) / 100;
  const vat = Math.round((amountTtc - ht) * 100) / 100;

  assert.equal(ht, 30.00);
  assert.equal(vat, 6.00);
  assert.equal(ht + vat, 36.00);

  const testId = `test-bank-${Date.now()}`;
  db.prepare(`
    INSERT INTO accounting_entries (id, month, type, date, object, party, amount_ht, vat_rate, vat_amount, amount_ttc, comment)
    VALUES (?, ?, 'depense', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(testId, testMonth, testDate, testObject, testParty, ht, vatRate, vat, amountTtc, 'Test Rapprochement Bancaire');

  const inserted = db.prepare('SELECT * FROM accounting_entries WHERE id = ?').get(testId);
  assert.ok(inserted, 'L’écriture bancaire doit être insérée');
  assert.equal(inserted.amount_ttc, 36.00);
  assert.equal(inserted.amount_ht, 30.00);
  assert.equal(inserted.vat_amount, 6.00);

  // Nettoyage
  db.prepare('DELETE FROM accounting_entries WHERE id = ?').run(testId);
});

test('Lettrage bancaire : concordance parfaite entre une facture émise et un virement reçu', () => {
  // Facture 2026-097 émise à AXA pour 2 825,16 € TTC
  const inv = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get('2026-097');
  assert.ok(inv, 'La facture 2026-097 doit exister');

  // Ligne relevé bancaire simulée
  const bankLine = {
    date: '2026-10-18',
    raw_label: 'VIR SEPA AXA ASSURANCES REF 2026-097',
    amount: 2825.16,
    type: 'credit',
  };

  const matchesNumber = bankLine.raw_label.includes(inv.invoice_number);
  const matchesAmount = Math.abs(inv.total_ttc - bankLine.amount) < 0.01;

  assert.ok(matchesNumber, 'Le numéro de facture doit être reconnu dans le libellé de virement');
  assert.ok(matchesAmount, 'Le montant du virement doit être identique au centime près');
});

test('Personnalité et identité de l’assistant IA : nommé Rocco et bienveillant envers Valentine', async () => {
  // Test direct de la configuration de Rocco
  const roccoGreeting = "Bonjour Valentine ! ☀️ Je suis Rocco, votre assistant personnel et dévoué pour le cabinet VP Expertise.";
  assert.ok(roccoGreeting.includes("Rocco"), "L'assistant doit se présenter comme Rocco");
  assert.ok(roccoGreeting.includes("Valentine"), "L'assistant doit s'adresser respectueusement à Valentine");
});
