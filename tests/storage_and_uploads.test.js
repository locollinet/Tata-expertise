import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { initDatabase, db } from '../server/db.ts';
import { seedData } from '../server/seed.ts';
import { apiRouter } from '../server/api.ts';

initDatabase();

test('Sécurité & Confidentialité : storage.rules verrouillé sur VP Expertise et historical_seed.json retiré du repo', () => {
  const seedJsonPath = path.resolve(process.cwd(), 'server/data/historical_seed.json');
  assert.equal(fs.existsSync(seedJsonPath), false, 'historical_seed.json ne doit plus être présent dans le dépôt Git');

  // seedData() doit rester silencieux et non bloquant même sans historical_seed.json
  assert.doesNotThrow(() => seedData());

  const rulesPath = path.resolve(process.cwd(), 'storage.rules');
  assert.ok(fs.existsSync(rulesPath), 'storage.rules doit exister');
  const rules = fs.readFileSync(rulesPath, 'utf-8');
  assert.ok(rules.includes('allow read, write: if false;'), 'Le deny par défaut doit être présent');
  assert.ok(rules.includes("'valentine.pecheux@vpexpertise.com'"), 'valentine.pecheux@vpexpertise.com doit être autorisé');
  assert.ok(rules.includes("'locollinet@gmail.com'"), 'locollinet@gmail.com doit être autorisé');
  assert.equal(rules.includes("'contact@vpexpertise.com'"), false, 'contact@vpexpertise.com ne doit plus être dans storage.rules');
  assert.ok(rules.includes('email_verified == true'), 'La vérification email Firebase Auth doit être exigée');
  assert.ok(rules.includes('100 * 1024 * 1024'), 'La limite Storage doit supporter les pièces lourdes jusqu’à 100 Mio');

  const fsRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
  assert.ok(fsRules.includes("'valentine.pecheux@vpexpertise.com'"), 'valentine.pecheux@vpexpertise.com doit être dans firestore.rules');
  assert.equal(fsRules.includes("'contact@vpexpertise.com'"), false, 'contact@vpexpertise.com ne doit plus être dans firestore.rules');
});

test('Pièces > 1 Mo : upload PDF 1,5 Mo, détection perte Cloud Run (404 strict), restauration /uploads/cache et suppression', async () => {
  const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data/uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/uploads', express.static(uploadsDir));
  app.use('/uploads', (_req, res) => {
    res.status(404).json({ error: 'Fichier introuvable sur le cache serveur local.' });
  });
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  let createdMissionId = null;
  let uploadedFilename = null;
  let ingestTempFilename = null;

  try {
    // 1. Créer une mission de test isolée
    const createRes = await fetch(`${baseUrl}/api/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `VP-STOR-${Date.now()}`,
        title: 'Test PDF volumineux > 1 Mo',
        case_reference: 'REF-STOR-1',
        insurance_client: 'AXA TEST',
      }),
    });
    assert.equal(createRes.status, 200);
    const created = await createRes.json();
    createdMissionId = created.id;

    // 2. Construire un PDF synthétique de 1,5 Mio (> limite Firestore 1 Mio)
    const sizeBytes = Math.floor(1.5 * 1024 * 1024);
    const pdfBuf = Buffer.alloc(sizeBytes, 0x20);
    Buffer.from('%PDF-1.4\n%Test-1.5MB\n').copy(pdfBuf, 0);

    const fd = new FormData();
    fd.append('section', 'contradictoire');
    fd.append('category', 'procedure_dires');
    fd.append('files', new Blob([pdfBuf], { type: 'application/pdf' }), 'Rapport_Volumineux_1_5Mo.pdf');

    const upRes = await fetch(`${baseUrl}/api/missions/${createdMissionId}/documents`, {
      method: 'POST',
      body: fd,
    });
    assert.equal(upRes.status, 200);
    const upJson = await upRes.json();
    assert.equal(upJson.documents.length, 1);
    const docId = upJson.documents[0].id;
    uploadedFilename = upJson.documents[0].filename;
    assert.ok(uploadedFilename, 'Un nom de fichier serveur doit être retourné');

    // 3. Vérifier la présence sur disque et la lecture via /uploads/
    const check1 = await fetch(`${baseUrl}/api/uploads/check-missing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: [uploadedFilename, '../etc/passwd'] }),
    });
    assert.equal(check1.status, 200);
    const check1Json = await check1.json();
    assert.deepEqual(check1Json.missing, [], 'Le fichier présent ne doit pas être signalé manquant et path traversal ignoré');

    // 4. Simuler un redémarrage Cloud Run (effacement disque local uniquement)
    const diskPath = path.join(uploadsDir, uploadedFilename);
    assert.ok(fs.existsSync(diskPath));
    fs.unlinkSync(diskPath);

    // Vérifier que /uploads/<file> renvoie un vrai 404 (jamais HTML 200)
    const missingHttp = await fetch(`${baseUrl}/uploads/${uploadedFilename}`);
    assert.equal(missingHttp.status, 404, '/uploads/<manquant> doit renvoyer 404 pour déclencher le fallback Firebase Storage');

    // Vérifier check-missing détecte le fichier absent
    const check2 = await fetch(`${baseUrl}/api/uploads/check-missing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: [uploadedFilename] }),
    });
    const check2Json = await check2.json();
    assert.deepEqual(check2Json.missing, [uploadedFilename]);

    // 5. Refus path traversal sur /api/uploads/cache
    const badCacheFd = new FormData();
    badCacheFd.append('filename', '../evil.pdf');
    badCacheFd.append('file', new Blob([pdfBuf], { type: 'application/pdf' }), 'evil.pdf');
    const badCacheRes = await fetch(`${baseUrl}/api/uploads/cache`, { method: 'POST', body: badCacheFd });
    assert.equal(badCacheRes.status, 400);

    // 6. Restauration du PDF 1,5 Mo depuis le client (simulant Firebase Storage -> serveur)
    const cacheFd = new FormData();
    cacheFd.append('filename', uploadedFilename);
    cacheFd.append('file', new Blob([pdfBuf], { type: 'application/pdf' }), uploadedFilename);
    const cacheRes = await fetch(`${baseUrl}/api/uploads/cache`, { method: 'POST', body: cacheFd });
    assert.equal(cacheRes.status, 200);
    const cacheJson = await cacheRes.json();
    assert.equal(cacheJson.cached, true);
    assert.equal(cacheJson.filename, uploadedFilename);

    const restoredHttp = await fetch(`${baseUrl}/uploads/${uploadedFilename}`);
    assert.equal(restoredHttp.status, 200);
    const restoredBuf = Buffer.from(await restoredHttp.arrayBuffer());
    assert.equal(restoredBuf.length, sizeBytes, 'Le PDF restauré doit avoir la taille exacte de 1,5 Mio');

    // 7. Ingestion d'un PDF > 1 Mo via /api/assistant/ingest (sans crash, même hors-ligne)
    const ingFd = new FormData();
    ingFd.append('missionId', createdMissionId);
    ingFd.append('text', 'Dire adverse volumineux');
    ingFd.append('file', new Blob([pdfBuf], { type: 'application/pdf' }), 'Dire_Adverse_1_5Mo.pdf');
    const ingRes = await fetch(`${baseUrl}/api/assistant/ingest`, { method: 'POST', body: ingFd });
    assert.equal(ingRes.status, 200);
    const ingJson = await ingRes.json();
    assert.equal(ingJson.success, true);
    assert.equal(ingJson.file?.file_size, sizeBytes);
    ingestTempFilename = ingJson.file?.filename || null;

    // 8. Suppression document retourne filename et nettoie le disque
    const delRes = await fetch(`${baseUrl}/api/documents/${docId}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    const delJson = await delRes.json();
    assert.equal(delJson.filename, uploadedFilename);
    assert.equal(fs.existsSync(diskPath), false);
    uploadedFilename = null;
  } finally {
    if (uploadedFilename) {
      const p = path.join(uploadsDir, uploadedFilename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (ingestTempFilename) {
      const p = path.join(uploadsDir, ingestTempFilename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (createdMissionId) {
      db.prepare('DELETE FROM missions WHERE id = ?').run(createdMissionId);
    }
    server.close();
  }
});
