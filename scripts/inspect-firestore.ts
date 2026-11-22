import fs from 'fs';
import path from 'path';
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

async function main() {
  const config = loadFirebaseConfig();
  if (!config.projectId || config.projectId === 'remixed-project-id') {
    throw new Error('firebase-applet-config.json does not contain a valid projectId.');
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({ projectId: config.projectId });

  const db =
    config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);

  const dossierArgIdx = process.argv.indexOf('--dossier');
  const dossierCodeFilter =
    dossierArgIdx !== -1 && process.argv[dossierArgIdx + 1]
      ? process.argv[dossierArgIdx + 1].trim().toUpperCase()
      : null;

  console.log(`Projet Firebase : ${config.projectId}`);
  console.log(`Base Firestore  : ${config.firestoreDatabaseId || '(default)'}`);
  console.log('---');

  const workspacesSnap = await db.collection('workspaces').get();
  if (workspacesSnap.empty) {
    console.log('Aucun document dans /workspaces (base encore vide).');
    return;
  }

  for (const wsDoc of workspacesSnap.docs) {
    const ws = wsDoc.data();
    const updatedAt =
      ws.updatedAt && typeof ws.updatedAt.toDate === 'function'
        ? ws.updatedAt.toDate().toISOString()
        : ws.updatedAt || 'N/A';

    console.log(`\nWorkspace : /workspaces/${wsDoc.id}`);
    console.log(`  cabinetName            : ${ws.cabinetName}`);
    console.log(`  schemaVersion          : ${ws.schemaVersion}`);
    console.log(`  updatedAt              : ${updatedAt}`);
    console.log(`  manifest totals        : missions=${ws.totalMissions}, invoices=${ws.totalInvoices}, compta=${ws.totalAccountingEntries}, rapports=${ws.totalReportDrafts}`);

    const chunksSnap = await db.collection(`workspaces/${wsDoc.id}/datasets`).get();
    const entities: Record<string, any[]> = {};
    for (const cDoc of chunksSnap.docs) {
      const c = cDoc.data();
      const ent = String(c.entity || 'unknown');
      if (!entities[ent]) entities[ent] = [];
      if (Array.isArray(c.items)) {
        entities[ent].push(...c.items);
      }
    }

    const missions = entities.missions || [];
    const invoices = entities.invoices || [];
    const creditNotes = entities.credit_notes || [];
    const activities = entities.activities || [];
    const expenses = entities.expenses || [];
    const accounting = entities.accounting_entries || [];
    const reportDrafts = entities.report_drafts || [];
    const operational = entities.operational || [];

    const invoiceLinesCount = invoices.reduce(
      (acc, inv) => acc + (Array.isArray(inv.lines) ? inv.lines.length : 0),
      0
    );

    const opByTable: Record<string, number> = {};
    for (const item of operational) {
      const t = String(item.__table || 'other');
      opByTable[t] = (opByTable[t] || 0) + 1;
    }

    console.log(`  chunks lus             : ${chunksSnap.size}`);
    console.log(`  missions               : ${missions.length} (actifs=${missions.filter((m) => m.status !== 'cloture').length}, clôturés=${missions.filter((m) => m.status === 'cloture').length})`);
    console.log(`  invoices               : ${invoices.length} (invoice_lines=${invoiceLinesCount})`);
    console.log(`  credit_notes           : ${creditNotes.length}`);
    console.log(`  activities             : ${activities.length}`);
    console.log(`  expenses               : ${expenses.length}`);
    console.log(`  accounting_entries     : ${accounting.length}`);
    console.log(`  report_drafts          : ${reportDrafts.length}`);
    console.log(`  operational tables     :`, opByTable);

    // Relational integrity verification
    const missionIds = new Set(missions.map((m) => m.id));
    const invoiceIds = new Set(invoices.map((i) => i.id));
    const orphanInvoices = invoices.filter((i) => !missionIds.has(i.mission_id)).length;
    const orphanCreditNotes = creditNotes.filter(
      (cn) => !missionIds.has(cn.mission_id) || !invoiceIds.has(cn.original_invoice_id)
    ).length;
    const orphanReports = reportDrafts.filter((r) => !missionIds.has(r.mission_id)).length;
    const orphanActivities = activities.filter((a) => !missionIds.has(a.mission_id)).length;
    const orphanExpenses = expenses.filter((e) => !missionIds.has(e.mission_id)).length;

    console.log(
      `  intégrité relationnelle: orphelins factures=${orphanInvoices}, avoirs=${orphanCreditNotes}, rapports=${orphanReports}, vacations=${orphanActivities}, frais=${orphanExpenses}`
    );

    if (dossierCodeFilter) {
      const found = missions.find((m) => String(m.code || '').toUpperCase() === dossierCodeFilter);
      if (found) {
        const mInvoices = invoices.filter((i) => i.mission_id === found.id);
        const mReport = reportDrafts.find((r) => r.mission_id === found.id);
        console.log(`\n  Détail dossier ${dossierCodeFilter}:`);
        console.log(`    titre    : ${found.title}`);
        console.log(`    statut   : ${found.status}`);
        console.log(`    mandant  : ${found.insurance_client}`);
        console.log(`    factures : ${mInvoices.length} (${mInvoices.map((i) => `${i.invoice_number}:${i.total_ht}€HT`).join(', ') || 'aucune'})`);
        console.log(`    rapport  : ${mReport ? `oui (v${mReport.version})` : 'non'}`);
      } else {
        console.log(`\n  Dossier ${dossierCodeFilter} non trouvé dans ce workspace.`);
      }
    }
  }
}

main().catch((err: any) => {
  const msg = err?.message || String(err);
  if (msg.includes('PERMISSION_DENIED') || msg.includes('7 PERMISSION_DENIED') || msg.includes('403')) {
    console.error('\nAccès refusé (PERMISSION_DENIED).');
    console.error('Vérifie que ton identité locale (gcloud auth application-default login) ou le compte de service AI Studio dispose bien du rôle IAM roles/datastore.viewer sur le projet.');
  } else {
    console.error('Erreur inspection Firestore :', msg);
  }
  process.exit(1);
});
