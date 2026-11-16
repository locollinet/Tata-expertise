import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import JSZip from 'jszip';
import { initDatabase, db } from '../server/db.ts';
import { apiRouter } from '../server/api.ts';
import { generateDeliverableDocx, buildDeliverableDefaults } from '../server/docx.ts';
import { mapMacFolderToSectionAndCategory } from '../shared/folderMapping.ts';

initDatabase();

test("Sécurité & Confidentialité : les modèles Word dans server/assets/ ne contiennent aucune donnée client", async () => {
  const forbiddenTerms = [
    'sncf', 'tfef', 'time fret', 'baroncourt', 'trsi', 'transdev',
    'verallia', 'rave', 'combirail', 'greis', 'perrine', 'berthelier', 'vp202',
  ];
  for (const tplName of ['template_courrier.docx', 'template_rapport.docx']) {
    const tplPath = path.resolve(process.cwd(), 'server/assets', tplName);
    assert.ok(fs.existsSync(tplPath), `${tplName} doit exister dans server/assets/`);
    const zip = await JSZip.loadAsync(fs.readFileSync(tplPath));
    for (const entryName of Object.keys(zip.files)) {
      if (entryName.endsWith('.xml') || entryName.endsWith('.rels')) {
        const xmlText = (await zip.file(entryName).async('string')).toLowerCase();
        for (const term of forbiddenTerms) {
          assert.equal(xmlText.includes(term), false, `Terme confidentiel "${term}" détecté dans ${tplName}:${entryName}`);
        }
      }
    }
  }
  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'server/assets/signature_vp.png')), 'signature_vp.png doit exister');
});

test("Génération des 8 types de livrables Word (.docx) fidèles aux modèles VP Expertise + grille photos 2 cols", async () => {
  // Prepare a tiny valid 1x1 PNG in data/uploads for embedded photo grid testing
  const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data/uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const testPhotoName = `test-grid-${Date.now()}.png`;
  const testPhotoPath = path.join(uploadsDir, testPhotoName);
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQzwAEjFAMAAYNAgH9l5hZAAAAAElFTkSuQmCC';
  fs.writeFileSync(testPhotoPath, Buffer.from(tinyPngBase64, 'base64'));

  try {
    const sampleMission = {
      id: 'm-unit-doc',
      code: 'VP2099999',
      title: 'ASSUREUR TEST — Incident matériel roulant sur triage démo',
      case_reference: 'REF-CLI-999',
      guarantee_type: 'RC',
      insurance_client: 'ASSUREUR TEST',
      client_contact: 'Mme Jeanne MARTIN',
      insured_party: 'EXPLOITANT TEST',
      adverse_parties: [
        { party_name: 'TIERS RÉSEAU', insurer_name: 'AXA', expert_firm: 'CABINET CONFRÈRE', expert_name: 'M. Paul DURAND' },
      ],
      stake_amount: 14500,
      incident_date: '2026-10-05',
      court_reference: 'TJ de Nanterre RG 26/001',
      judicial_expert: 'M. Expert Judiciaire',
      description: 'Le 5 octobre 2026, accrochage à faible vitesse lors d’une manœuvre.',
    };

    const attendees = [
      {
        id: 'att-1', mission_id: sampleMission.id, name: 'Paul DURAND',
        organization: 'TIERS RÉSEAU', role: 'Expert assurances', present_on_site: true, present_remote: false,
      },
      {
        id: 'att-2', mission_id: sampleMission.id, name: 'Jeanne MARTIN',
        organization: 'EXPLOITANT TEST', role: 'Responsable matériel', present_on_site: true, present_remote: false,
      },
    ];

    const photos = [
      {
        id: 'ph-1', mission_id: sampleMission.id, filename: testPhotoName, original_name: 'photo_avarie.png',
        caption: 'Vue générale du bogie', order_index: 0, is_selected_for_report: true, created_at: '2026-10-20',
      },
      {
        id: 'ph-2', mission_id: sampleMission.id, filename: testPhotoName, original_name: 'IMG_0002.jpg',
        caption: '', order_index: 1, is_selected_for_report: false, created_at: '2026-10-20',
      },
    ];

    const damageLines = [
      {
        id: 'dmg-1', mission_id: sampleMission.id, mission_code: sampleMission.code, category: 'materiel',
        label: 'Remplacement essieu', claimed_amount: 12000, claimed_amount_ht: 12000,
        retained_amount: 9500, retained_amount_ht: 9500, comment: 'Réfaction vétusté', piece_numbers: [1], order_index: 0, created_at: '2026-10-20',
      },
    ];

    const deliverableTypes = [
      'mise_en_cause',
      'convocation',
      'mec_convocation',
      'courrier_position',
      'constatations',
      'note_situation',
      'note_technique',
      'rapport_ead',
    ];

    for (const dType of deliverableTypes) {
      const buf = await generateDeliverableDocx({
        mission: sampleMission,
        options: {
          deliverable_type: dType,
          doc_date: '2026-11-16',
          convocation_posture: 'convoquee',
          convocation_caller: 'TIERS RÉSEAU',
          meeting_date: '2026-10-20',
          meeting_time: '11h00',
          meeting_place: 'Atelier Nord',
          include_epi: true,
          include_photos: true,
          include_damage_table: true,
          co_signer: 'Alexandre Popineau',
        },
        attendees,
        photos,
        damageLines,
        draft: {
          section_observations: 'Constatations relevées sur essieu avant.',
        },
      });

      assert.ok(Buffer.isBuffer(buf) && buf.length > 10000, `DOCX ${dType} doit être non-vide`);
      const zip = await JSZip.loadAsync(buf);
      const docXml = await zip.file('word/document.xml').async('string');
      const relsXml = await zip.file('word/_rels/document.xml.rels').async('string');

      assert.equal(/\{\{[A-Z0-9_]+\}\}/.test(docXml), false, `Aucun placeholder {{...}} résiduel dans ${dType}`);
      assert.ok(docXml.includes('VP2099999'), `${dType} doit contenir la référence dossier VP2099999`);
      assert.ok(docXml.includes('rId8'), `${dType} doit inclure la signature manuscrite rId8`);
      assert.ok(docXml.includes('Valentine Pécheux'), `${dType} doit signer Valentine Pécheux`);
      assert.ok(zip.file('word/media/image1.png'), `${dType} doit contenir image1.png (signature)`);

      if (['mise_en_cause', 'convocation', 'mec_convocation', 'courrier_position'].includes(dType)) {
        assert.ok(docXml.includes('Envoi par courriel et courrier recommandé AR'), `${dType} doit mentionner RAR`);
        if (dType === 'convocation' || dType === 'mec_convocation') {
          assert.ok(docXml.includes('opposables'), `${dType} doit contenir la clause d'opposabilité`);
          assert.ok(docXml.includes('EPI habituels'), `${dType} doit inclure le rappel EPI`);
        }
      } else {
        const footer1Xml = await zip.file('word/footer1.xml').async('string');
        assert.equal(/\{\{[A-Z0-9_]+\}\}/.test(footer1Xml), false, `Aucun placeholder résiduel dans footer1 de ${dType}`);
        assert.ok(footer1Xml.includes('VP2099999'), `Footer1 de ${dType} doit contenir VP2099999`);
        assert.ok(docXml.includes('sur convocation de TIERS RÉSEAU'), `${dType} doit refléter la posture de convocation`);
        assert.ok(docXml.includes('Partie représentée'), `${dType} doit contenir le tableau 3 colonnes Présents`);
        assert.ok(docXml.includes('Paul DURAND'), `${dType} doit lister les participants`);
        assert.ok(docXml.includes('4535'), `${dType} doit bâtir la grille 2 colonnes pour la photo sélectionnée`);
        assert.ok(relsXml.includes('media/photo_501.png'), `${dType} doit embarquer uniquement la photo sélectionnée`);
        assert.ok(!relsXml.includes('media/photo_502'), `${dType} ne doit PAS embarquer la photo non cochée`);
        assert.ok(docXml.includes('Remplacement essieu'), `${dType} doit inclure le tableau Comptes du préjudice`);
      }
    }

    // Check posture variations
    const p1 = buildDeliverableDefaults(sampleMission, { deliverable_type: 'constatations', convocation_posture: 'convoque' });
    const p2 = buildDeliverableDefaults(sampleMission, { deliverable_type: 'constatations', convocation_posture: 'spontanee' });
    assert.ok(p1.posture_phrase.includes('à notre initiative'));
    assert.equal(p2.posture_phrase.includes('en présence spontanée'), true);
  } finally {
    if (fs.existsSync(testPhotoPath)) fs.unlinkSync(testPhotoPath);
  }
});

test("Mapping bidirectionnel des vrais sous-dossiers iCloud, mode Judiciaire et fichiers en vrac", () => {
  // Dossiers réels envoyés par Valentine par email
  assert.deepEqual(mapMacFolderToSectionAndCategory('Éléments de la mission', 'ordre.pdf'), {
    section: 'contrats', category: 'contrat_client', subSection: 'elements_mission',
  });
  assert.deepEqual(mapMacFolderToSectionAndCategory('Contrats', 'police.pdf'), {
    section: 'contrats', category: 'contrat_client', subSection: '',
  });
  assert.equal(mapMacFolderToSectionAndCategory('Préjudice', 'facture.pdf').section, 'prejudice');
  assert.deepEqual(mapMacFolderToSectionAndCategory('RCI-Photos', 'photo1.jpg'), {
    section: 'constatations', category: 'photo_terrain', subSection: 'jour_j',
  });
  assert.deepEqual(mapMacFolderToSectionAndCategory("Opérations d'expertise", 'relevé.pdf'), {
    section: 'constatations', category: 'note_technique', subSection: 'visite_terrain',
  });

  // Mode Judiciaire
  assert.deepEqual(mapMacFolderToSectionAndCategory('NAP', 'nap1.pdf'), {
    section: 'contradictoire', category: 'judicial_nap', subSection: 'nap',
  });
  assert.deepEqual(mapMacFolderToSectionAndCategory('Rapport-Pré-rapport', 'prerapport.docx'), {
    section: 'rapports', category: 'judicial_pre_rapport', subSection: 'pre_rapport',
  });
  assert.deepEqual(mapMacFolderToSectionAndCategory('Dires de partie 1', 'annexe3.pdf'), {
    section: 'contradictoire', category: 'judicial_dire', subSection: 'dires', groupLabel: 'Dires de partie 1',
  });

  // Fichiers "en vrac" à la racine du dossier
  assert.equal(mapMacFolderToSectionAndCategory('', 'IMG_2045.jpg').section, 'constatations');
  assert.equal(mapMacFolderToSectionAndCategory('', 'Dire_SNCF.pdf').section, 'contradictoire');
  assert.equal(mapMacFolderToSectionAndCategory('', 'Devis_Reparation.pdf').section, 'prejudice');
  assert.equal(mapMacFolderToSectionAndCategory('', 'Contrat_maintenance.pdf').section, 'contrats');
  assert.equal(mapMacFolderToSectionAndCategory('', 'Rapport_EAD_v2.docx').section, 'rapports');
});

test("Endpoints API : Judiciaire, lot Dire + N annexes, feuille d'émargement, nettoyage notes et preview/export DOCX", async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api`;

  let createdMissionId = null;
  try {
    // 1. Créer un dossier judiciaire
    const code = `VP-TEST-${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        title: 'Affaire Judiciaire Test',
        case_reference: 'CLI-JUD-1',
        insurance_client: 'AXA TEST',
        is_judicial: true,
        court_reference: 'TJ Paris',
        judicial_expert: 'M. Expert',
      }),
    });
    assert.equal(createRes.status, 200);
    const created = await createRes.json();
    createdMissionId = created.id;

    // 2. Preview deliverable auto-filled from Synthesis Table
    const prevRes = await fetch(`${baseUrl}/missions/${createdMissionId}/deliverable-preview?type=constatations`);
    assert.equal(prevRes.status, 200);
    const prev = await prevRes.json();
    assert.ok(prev.mandate_intro.includes('AXA TEST'));
    assert.ok(prev.mandate_intro.includes('TJ Paris'));

    // 3. Parse attendance list deterministically + batch insert
    const parseRes = await fetch(`${baseUrl}/missions/${createdMissionId}/parse-attendance-sheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Jean DUPONT ; Avocat ; Cabinet XYZ ; j.dupont@xyz.fr\nClaire LEFEBVRE ; Ingénieur ; RATP' }),
    });
    assert.equal(parseRes.status, 200);
    const parsed = await parseRes.json();
    assert.equal(parsed.attendees.length, 2);
    assert.equal(parsed.attendees[0].name, 'Jean DUPONT');
    assert.equal(parsed.attendees[0].organization, 'Cabinet XYZ');

    const batchRes = await fetch(`${baseUrl}/missions/${createdMissionId}/attendees/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendees: parsed.attendees, meeting_label: 'Réunion 1' }),
    });
    assert.equal(batchRes.status, 200);
    const batchJson = await batchRes.json();
    assert.equal(batchJson.count, 2);

    // 4. Clean raw notes cleanly
    const cleanRes = await fetch(`${baseUrl}/missions/${createdMissionId}/clean-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_notes: 'fissure sur boggie avant droit\nmesure cote D égale à 1358mm' }),
    });
    assert.equal(cleanRes.status, 200);
    const cleaned = await cleanRes.json();
    assert.ok(cleaned.cleaned_observations.includes('Fissure sur boggie avant droit'));

    // 5. Upload groupé (Dire + 2 annexes)
    const fd = new FormData();
    fd.append('section', 'contradictoire');
    fd.append('sub_section', 'dires');
    fd.append('category', 'judicial_dire');
    fd.append('document_group_label', 'Dire Partie 1 + 2 annexes');
    fd.append('source_origin', 'Partie adverse');
    fd.append('files', new Blob(['dire content'], { type: 'text/plain' }), 'Dire_Partie1.txt');
    fd.append('files', new Blob(['annexe 1'], { type: 'text/plain' }), 'Annexe1.txt');
    const upRes = await fetch(`${baseUrl}/missions/${createdMissionId}/documents`, {
      method: 'POST',
      body: fd,
    });
    assert.equal(upRes.status, 200);
    const upJson = await upRes.json();
    assert.equal(upJson.documents.length, 2);
    assert.equal(upJson.documents[0].document_group_id, upJson.documents[1].document_group_id);
    assert.equal(upJson.documents[0].document_group_label, 'Dire Partie 1 + 2 annexes');

    // 6. Export real DOCX via POST /api/missions/:id/deliverable-docx
    const docxRes = await fetch(`${baseUrl}/missions/${createdMissionId}/deliverable-docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliverable_type: 'mise_en_cause', recipient_name: 'SNCF TEST' }),
    });
    assert.equal(docxRes.status, 200);
    const ab = await docxRes.arrayBuffer();
    assert.ok(ab.byteLength > 10000);

    // 7. Commande Rocco texte "Prépare une mise en cause..."
    const roccoRes = await fetch(`${baseUrl}/assistant/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionId: createdMissionId,
        text: `Prépare une convocation pour demain 14h30 sur ${code}`,
      }),
    });
    assert.equal(roccoRes.status, 200);
    const roccoJson = await roccoRes.json();
    assert.equal(roccoJson.action?.action_type, 'deliverable_draft');
    assert.equal(roccoJson.action?.payload?.deliverable_type, 'convocation');
    assert.equal(roccoJson.action?.payload?.meeting_time, '14h30');
  } finally {
    if (createdMissionId) {
      // Clean up synthetic test files created in uploadsDir for this mission
      const docs = db.prepare('SELECT filename FROM documents WHERE mission_id = ?').all(createdMissionId);
      const uDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data/uploads');
      for (const d of docs) {
        const p = path.join(uDir, d.filename);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      db.prepare('DELETE FROM missions WHERE id = ?').run(createdMissionId);
    }
    server.close();
  }
});
