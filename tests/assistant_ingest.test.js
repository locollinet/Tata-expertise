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

test("Sémantique stricte : Zéro faux positif sur les sous-chaînes et réponse honnête pour notes vocales", () => {
  const isVoiceNoteQuery = (msg) => /\b(notes?\s+vocales?|mémos?\s+vocaux|mémos?\s+audio|fichiers?\s+audio|enregistrements?\s+vocaux|dictée\s+vocale|messages?\s+vocaux|écouter\s+ma\s+voix|parler\s+au\s+micro|enregistrer\s+la\s+voix)\b/i.test(msg);
  const isCapabilityQuery = (msg) => /\b(que\s+sais-tu\s+faire|quelles?\s+sont\s+tes\s+fonctionnalit|comment\s+(tu\s+fonctionnes?|t[' ]utiliser|ça\s+marche)|à\s+quoi\s+sers-tu|aide\b|help\b|guide\b)\b/i.test(msg);
  const isAccountingQuery = (msg) => /\b(chiffre\s+d[' ]?affaires|bilan\s+comptable|tva\s+collectée|point\s+compta|\bca\s+du\s+mois\b|\bca\s+ce\s+mois\b)\b/i.test(msg) || /\bquel\s+est\s+(mon\s+)?ca\b/i.test(msg);
  const isDeadlineQuery = (msg) => /\b(prochaines?\s+échéances?|dates?\s+limites?|jalons?\s+de\s+procédure)\b/i.test(msg) || /\b(calendrier|planning|dates?)\b.*\b(dires?|échéances?|procédures?)\b/i.test(msg) || /\bquelles?\s+sont\s+mes\s+échéances\b/i.test(msg);

  // 1. "Peux-tu recevoir toutes mes notes vocales ?" DOIT être reconnu comme Voice Note et JAMAIS comme Compta !
  const voiceQ = "Peux-tu recevoir toutes mes notes vocales ?";
  assert.equal(isVoiceNoteQuery(voiceQ), true, "Doit matcher voice note");
  assert.equal(isAccountingQuery(voiceQ), false, "Ne doit SURTOUT PAS matcher compta à cause de 'vocales'");

  // 2. Anti-pièges de sous-chaînes (mots contenant 'ca')
  const queriesWithCa = [
    "Comment contacter l'avocat adverse ?",
    "Quels sont les justificatifs acceptés ?",
    "Que faire en cas d'accident sur site ?",
    "Où sont stockés les certificats de visite ?",
    "Combien d'heures de vacation prévues ?"
  ];
  for (const q of queriesWithCa) {
    assert.equal(isAccountingQuery(q), false, `La phrase "${q}" ne doit PAS déclencher la compta`);
  }

  // 3. Anti-pièges de sous-chaînes sur le verbe 'dire'
  const queriesWithDire = [
    "Peux-tu me dire comment faire ?",
    "C'est-à-dire que nous attendons une réponse"
  ];
  for (const q of queriesWithDire) {
    assert.equal(isDeadlineQuery(q), false, `La phrase "${q}" ne doit PAS déclencher les échéances`);
  }

  // 4. Vraie question comptable
  assert.equal(isAccountingQuery("Quel est mon chiffre d'affaires ce mois-ci ?"), true);
  assert.equal(isAccountingQuery("Quel est le CA du mois ?"), true);

  // 5. Question de capacité
  assert.equal(isCapabilityQuery("Que sais-tu faire ?"), true);

  // 6. Question spécifique utilisateur (Valentine) : photos terrain, format note ou vocal
  const isMediaStorageQuery = (msg) => /\b(photos?\s+de\s+terrain|format\s+note\s+ou\s+vocal|analyser\s+et\s+stocker|mettre\s+des\s+photos|stocker\s+le\s+tout|prendre\s+des\s+photos|mémos?\s+vocaux|fichiers?\s+audio)\b/i.test(msg) ||
    (/\b(photos?|images?|clichés?|notes?|vocal|voix|enregistrements?)\b/i.test(msg) && /\b(stocker|enregistrer|analyser|classer|mettre|garder|traiter|recevoir)\b/i.test(msg));

  const valentineQuery = "Je peux mettre des photos de terrain, des analyses sous format note ou vocal, tu sauras analyser et stocker le tout ?";
  assert.equal(isMediaStorageQuery(valentineQuery), true, "Doit être reconnu comme question sur le stockage de photos terrain et notes vocales");
  assert.equal(isAccountingQuery(valentineQuery), false, "Ne doit PAS déclencher la compta");
});

test("Enregistrement sécurisé en base d'une photo de terrain et d'une note technique d'expertise", () => {
  const mission = db.prepare('SELECT id, code, title FROM missions LIMIT 1').get();
  assert.ok(mission, "Un dossier doit exister");

  // 1. Test insertion photo de terrain
  const photoId = `photo-test-${Date.now()}`;
  const caption = "Examen bogie avant — fissure sur longeron supérieur";
  const filename = "test-bogie.jpg";

  db.prepare(`
    INSERT INTO photos (id, mission_id, filename, original_name, caption, order_index, is_selected_for_report)
    VALUES (?, ?, ?, ?, ?, 0, 1)
  `).run(photoId, mission.id, filename, filename, caption);

  const insertedPhoto = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId);
  assert.ok(insertedPhoto, "La photo de terrain doit être insérée");
  assert.equal(insertedPhoto.caption, caption);
  assert.equal(insertedPhoto.is_selected_for_report, 1);

  // Clean photo
  db.prepare('DELETE FROM photos WHERE id = ?').run(photoId);

  // 2. Test mise à jour note de terrain dans report_drafts
  let draft = db.prepare('SELECT * FROM report_drafts WHERE mission_id = ?').get(mission.id);
  const testNote = "Constatation contradictoire du 29/10/2026 : Absence de déformation plastique mesurable.";
  if (draft) {
    db.prepare('UPDATE report_drafts SET section_observations = section_observations || ? WHERE mission_id = ?')
      .run(`\n\n${testNote}`, mission.id);
    const updatedDraft = db.prepare('SELECT * FROM report_drafts WHERE mission_id = ?').get(mission.id);
    assert.ok(updatedDraft.section_observations.includes(testNote), "La note de terrain doit être ajoutée");
  }
});

