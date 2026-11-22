import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase.js';

export const CABINET_WORKSPACE_ID = 'vp_expertise_cabinet';

export const CABINET_AUTHORIZED_EMAILS = [
  'valentine.pecheux@vpexpertise.com',
  'locollinet@gmail.com',
] as const;

export function isAuthorizedCabinetEmail(email?: string | null): boolean {
  if (!email) return false;
  return (CABINET_AUTHORIZED_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

export interface CabinetStatePayload {
  missions: Record<string, any>[];
  invoices: Record<string, any>[];
  credit_notes: Record<string, any>[];
  activities: Record<string, any>[];
  expenses: Record<string, any>[];
  accounting_entries: Record<string, any>[];
  report_drafts: Record<string, any>[];
  recurring_expenses?: Record<string, any>[];
  attendees?: Record<string, any>[];
  communications?: Record<string, any>[];
  damage_lines?: Record<string, any>[];
  issued_reports?: Record<string, any>[];
  travel_orders?: Record<string, any>[];
  registered_mails?: Record<string, any>[];
  documents?: Record<string, any>[];
  photos?: Record<string, any>[];
}

export interface FirestoreCabinetStatus {
  signedIn: boolean;
  emailVerified: boolean;
  authorized: boolean;
  hasCloudData: boolean;
  workspaceId: string;
  totalMissions: number;
  totalInvoices: number;
  totalAccountingEntries: number;
  totalReportDrafts: number;
  updatedAt: string | null;
}

const SCHEMA_VERSION = 2;

let knownCabinetCloudReady = false;
let lastHydratedCloudUpdatedAt: string | null = null;

function sanitizeValue(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === 'object' && !(value instanceof Date) && !(value instanceof Timestamp)) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        clean[k] = sanitizeValue(v);
      }
    }
    return clean;
  }
  return value;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function formatUpdatedAt(raw: any): string | null {
  if (raw && typeof raw.toDate === 'function') {
    return raw.toDate().toISOString();
  }
  if (typeof raw === 'string') return raw;
  return null;
}

async function readChunksFromWorkspace(
  workspaceId: string,
  filterField: 'workspaceId' | 'ownerId',
  filterValue: string
): Promise<CabinetStatePayload> {
  const datasetsPath = `workspaces/${workspaceId}/datasets`;
  let chunksSnap;
  try {
    const q = query(collection(db, datasetsPath), where(filterField, '==', filterValue));
    chunksSnap = await getDocs(q);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, datasetsPath);
  }

  const grouped: Record<string, Array<{ idx: number; items: any[] }>> = {};
  chunksSnap.forEach((docSnap) => {
    const d = docSnap.data();
    const entity = String(d.entity || '');
    if (!grouped[entity]) grouped[entity] = [];
    grouped[entity].push({
      idx: Number(d.chunkIndex || 0),
      items: Array.isArray(d.items) ? d.items : [],
    });
  });

  const flatten = (entity: string): Record<string, any>[] => {
    const list = grouped[entity] || [];
    list.sort((a, b) => a.idx - b.idx);
    return list.flatMap((c) => c.items);
  };

  const opItems = flatten('operational');
  const byOpTable = (table: string) =>
    opItems
      .filter((it) => it.__table === table)
      .map(({ __table, ...rest }) => rest);

  return {
    missions: flatten('missions'),
    invoices: flatten('invoices'),
    credit_notes: flatten('credit_notes'),
    activities: flatten('activities'),
    expenses: flatten('expenses'),
    accounting_entries: flatten('accounting_entries'),
    report_drafts: flatten('report_drafts'),
    recurring_expenses: byOpTable('recurring_expenses'),
    attendees: byOpTable('attendees'),
    communications: byOpTable('communications'),
    damage_lines: byOpTable('damage_lines'),
    issued_reports: byOpTable('issued_reports'),
    travel_orders: byOpTable('travel_orders'),
    registered_mails: byOpTable('registered_mails'),
    documents: byOpTable('documents'),
    photos: byOpTable('photos'),
  };
}

export async function getFirestoreCabinetStatus(): Promise<FirestoreCabinetStatus> {
  const user = auth.currentUser;
  if (!user) {
    knownCabinetCloudReady = false;
    return {
      signedIn: false,
      emailVerified: false,
      authorized: false,
      hasCloudData: false,
      workspaceId: CABINET_WORKSPACE_ID,
      totalMissions: 0,
      totalInvoices: 0,
      totalAccountingEntries: 0,
      totalReportDrafts: 0,
      updatedAt: null,
    };
  }

  const authorized = Boolean(user.emailVerified) && isAuthorizedCabinetEmail(user.email);
  if (!authorized) {
    knownCabinetCloudReady = false;
    return {
      signedIn: true,
      emailVerified: Boolean(user.emailVerified),
      authorized: false,
      hasCloudData: false,
      workspaceId: CABINET_WORKSPACE_ID,
      totalMissions: 0,
      totalInvoices: 0,
      totalAccountingEntries: 0,
      totalReportDrafts: 0,
      updatedAt: null,
    };
  }

  const wsPath = `workspaces/${CABINET_WORKSPACE_ID}`;
  try {
    const snap = await getDoc(doc(db, 'workspaces', CABINET_WORKSPACE_ID));
    if (!snap.exists()) {
      knownCabinetCloudReady = false;
      return {
        signedIn: true,
        emailVerified: true,
        authorized: true,
        hasCloudData: false,
        workspaceId: CABINET_WORKSPACE_ID,
        totalMissions: 0,
        totalInvoices: 0,
        totalAccountingEntries: 0,
        totalReportDrafts: 0,
        updatedAt: null,
      };
    }

    const data = snap.data();
    knownCabinetCloudReady = true;
    return {
      signedIn: true,
      emailVerified: true,
      authorized: true,
      hasCloudData: true,
      workspaceId: CABINET_WORKSPACE_ID,
      totalMissions: Number(data.totalMissions || 0),
      totalInvoices: Number(data.totalInvoices || 0),
      totalAccountingEntries: Number(data.totalAccountingEntries || 0),
      totalReportDrafts: Number(data.totalReportDrafts || 0),
      updatedAt: formatUpdatedAt(data.updatedAt),
    };
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, wsPath);
    }
    return {
      signedIn: true,
      emailVerified: Boolean(user.emailVerified),
      authorized,
      hasCloudData: false,
      workspaceId: CABINET_WORKSPACE_ID,
      totalMissions: 0,
      totalInvoices: 0,
      totalAccountingEntries: 0,
      totalReportDrafts: 0,
      updatedAt: null,
    };
  }
}

export async function pushCabinetStateToFirestore(
  providedPayload?: CabinetStatePayload
): Promise<{
  chunksWritten: number;
  totalMissions: number;
  totalInvoices: number;
  totalAccountingEntries: number;
  totalReportDrafts: number;
}> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Connectez-vous avec votre compte cabinet (valentine.pecheux@vpexpertise.com) pour synchroniser Firebase.');
  }
  if (!user.emailVerified || !isAuthorizedCabinetEmail(user.email)) {
    throw new Error(`Le compte ${user.email || 'actuel'} n’est pas autorisé à accéder à l’espace VP Expertise.`);
  }

  let payload = providedPayload;
  if (!payload) {
    const res = await fetch('/api/sync/export-state');
    if (!res.ok) {
      throw new Error("Impossible d'exporter l'état du cabinet pour la synchronisation Firebase.");
    }
    payload = (await res.json()) as CabinetStatePayload;
  }

  const uid = user.uid;
  const missions = payload.missions || [];
  const invoices = payload.invoices || [];
  const creditNotes = payload.credit_notes || [];
  const activities = payload.activities || [];
  const expenses = payload.expenses || [];
  const accountingEntries = payload.accounting_entries || [];
  const reportDrafts = payload.report_drafts || [];

  const operationalBundle = [
    ...(payload.recurring_expenses || []).map((r) => ({ __table: 'recurring_expenses', ...r })),
    ...(payload.attendees || []).map((r) => ({ __table: 'attendees', ...r })),
    ...(payload.communications || []).map((r) => ({ __table: 'communications', ...r })),
    ...(payload.damage_lines || []).map((r) => ({ __table: 'damage_lines', ...r })),
    ...(payload.issued_reports || []).map((r) => ({ __table: 'issued_reports', ...r })),
    ...(payload.travel_orders || []).map((r) => ({ __table: 'travel_orders', ...r })),
    ...(payload.registered_mails || []).map((r) => ({ __table: 'registered_mails', ...r })),
    ...(payload.documents || []).map((r) => ({ __table: 'documents', ...r })),
    ...(payload.photos || []).map((r) => ({ __table: 'photos', ...r })),
  ];

  const chunkSpecs: Array<{
    id: string;
    entity: string;
    chunkIndex: number;
    items: Record<string, any>[];
  }> = [];

  const pushEntityChunks = (entity: string, list: Record<string, any>[], chunkSize: number) => {
    const parts = chunkArray(list, chunkSize);
    parts.forEach((items, idx) => {
      chunkSpecs.push({
        id: `${entity}_${String(idx).padStart(2, '0')}`,
        entity,
        chunkIndex: idx,
        items: items.map((item) => sanitizeValue(item)),
      });
    });
  };

  pushEntityChunks('missions', missions, 80);
  pushEntityChunks('invoices', invoices, 150);
  pushEntityChunks('accounting_entries', accountingEntries, 500);
  pushEntityChunks('report_drafts', reportDrafts, 160);
  if (creditNotes.length > 0) pushEntityChunks('credit_notes', creditNotes, 200);
  if (activities.length > 0) pushEntityChunks('activities', activities, 300);
  if (expenses.length > 0) pushEntityChunks('expenses', expenses, 300);
  if (operationalBundle.length > 0) pushEntityChunks('operational', operationalBundle, 300);

  const chunkIds = chunkSpecs.map((c) => c.id);
  const wsPath = `workspaces/${CABINET_WORKSPACE_ID}`;
  const wsRef = doc(db, 'workspaces', CABINET_WORKSPACE_ID);

  try {
    const existingWs = await getDoc(wsRef);
    const existingChunkIds: string[] = existingWs.exists() && Array.isArray(existingWs.data()?.chunkIds)
      ? existingWs.data().chunkIds
      : [];

    const wsBatch = writeBatch(db);
    if (existingWs.exists()) {
      wsBatch.update(wsRef, {
        cabinetName: 'VP EXPERTISE',
        totalMissions: missions.length,
        totalInvoices: invoices.length,
        totalAccountingEntries: accountingEntries.length,
        totalReportDrafts: reportDrafts.length,
        chunkIds,
        schemaVersion: SCHEMA_VERSION,
        updatedAt: serverTimestamp(),
      });
    } else {
      wsBatch.set(wsRef, {
        ownerId: uid,
        cabinetName: 'VP EXPERTISE',
        totalMissions: missions.length,
        totalInvoices: invoices.length,
        totalAccountingEntries: accountingEntries.length,
        totalReportDrafts: reportDrafts.length,
        chunkIds,
        schemaVersion: SCHEMA_VERSION,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await wsBatch.commit();

    const specBatches = chunkArray(chunkSpecs, 8);
    for (const group of specBatches) {
      const batch = writeBatch(db);
      for (const spec of group) {
        const chunkRef = doc(db, 'workspaces', CABINET_WORKSPACE_ID, 'datasets', spec.id);
        batch.set(chunkRef, {
          ownerId: uid,
          workspaceId: CABINET_WORKSPACE_ID,
          entity: spec.entity,
          chunkIndex: spec.chunkIndex,
          itemCount: spec.items.length,
          items: spec.items,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    const obsoleteIds = existingChunkIds.filter((oldId) => !chunkIds.includes(oldId));
    if (obsoleteIds.length > 0) {
      const delBatch = writeBatch(db);
      for (const oldId of obsoleteIds) {
        delBatch.delete(doc(db, 'workspaces', CABINET_WORKSPACE_ID, 'datasets', oldId));
      }
      await delBatch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, wsPath);
  }

  knownCabinetCloudReady = true;
  lastHydratedCloudUpdatedAt = new Date().toISOString();
  window.dispatchEvent(new CustomEvent('vp-firestore-sync-changed'));
  return {
    chunksWritten: chunkSpecs.length,
    totalMissions: missions.length,
    totalInvoices: invoices.length,
    totalAccountingEntries: accountingEntries.length,
    totalReportDrafts: reportDrafts.length,
  };
}

export async function loadCabinetStateFromFirestore(): Promise<{
  payload: CabinetStatePayload;
  updatedAt: string | null;
} | null> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !isAuthorizedCabinetEmail(user.email)) return null;

  const sharedPath = `workspaces/${CABINET_WORKSPACE_ID}`;
  let sharedSnap;
  try {
    sharedSnap = await getDoc(doc(db, 'workspaces', CABINET_WORKSPACE_ID));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, sharedPath);
  }

  if (sharedSnap.exists()) {
    knownCabinetCloudReady = true;
    const payload = await readChunksFromWorkspace(CABINET_WORKSPACE_ID, 'workspaceId', CABINET_WORKSPACE_ID);
    return {
      payload,
      updatedAt: formatUpdatedAt(sharedSnap.data()?.updatedAt),
    };
  }

  // Seamless one-time promotion if data was previously saved under a legacy per-UID workspace
  try {
    const legacySnap = await getDoc(doc(db, 'workspaces', user.uid));
    if (legacySnap.exists()) {
      const legacyPayload = await readChunksFromWorkspace(user.uid, 'ownerId', user.uid);
      if (legacyPayload.missions.length > 0) {
        await pushCabinetStateToFirestore(legacyPayload);
        return {
          payload: legacyPayload,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Ignore if no legacy workspace exists
  }

  return null;
}

export async function hydrateBackendFromFirestore(force = false): Promise<{
  hydrated: boolean;
  missionsCount: number;
  invoicesCount: number;
}> {
  const cloud = await loadCabinetStateFromFirestore();
  if (!cloud || cloud.payload.missions.length === 0) {
    return { hydrated: false, missionsCount: 0, invoicesCount: 0 };
  }

  if (!force && lastHydratedCloudUpdatedAt && cloud.updatedAt && lastHydratedCloudUpdatedAt === cloud.updatedAt) {
    return {
      hydrated: false,
      missionsCount: cloud.payload.missions.length,
      invoicesCount: cloud.payload.invoices.length,
    };
  }

  const res = await fetch('/api/sync/import-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cloud.payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erreur lors de l'hydratation depuis Firebase Firestore.");
  }

  lastHydratedCloudUpdatedAt = cloud.updatedAt || new Date().toISOString();
  window.dispatchEvent(new CustomEvent('vp-firestore-sync-changed'));
  return {
    hydrated: true,
    missionsCount: cloud.payload.missions.length,
    invoicesCount: cloud.payload.invoices.length,
  };
}

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAutoSyncToFirestore(delayMs = 2000): void {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !isAuthorizedCabinetEmail(user.email)) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(async () => {
    try {
      if (!knownCabinetCloudReady) {
        const status = await getFirestoreCabinetStatus();
        if (!status.authorized || !status.hasCloudData) return;
      }
      await pushCabinetStateToFirestore();
    } catch (err) {
      console.warn('[Firestore AutoSync] Synchronisation différée ignorée :', err);
    }
  }, delayMs);
}
