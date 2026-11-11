// Synchronisation automatique des dossiers d'expertise (6 volets) et de la comptabilité (séparée)
// vers un dossier local Mac / iCloud Drive choisi dans le Finder.
// Arborescence créée sur le Mac :
// <Dossier Racine Rocco>/
// ├── Dossiers/
// │   └── <Code_Dossier>/
// │       ├── 01_Page_de_garde/
// │       ├── 02_Contrats/
// │       ├── 03_Constatations_immediates/
// │       ├── 04_Contradictoire/
// │       ├── 05_Comptes_du_prejudice/
// │       └── 06_Rapports_emis/
// └── Compta/
//     └── <AAAA-MM>/
//         ├── Justificatifs/
//         └── Factures_emises/

import { doc, setDoc } from 'firebase/firestore';
import { db as firestoreDb, auth } from '../firebase.js';
import { DossierVoletKey, EvidenceItem } from '@shared/types.js';

const DB_NAME = 'vp_expertise_local_sync';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'icloud_root_dir';

export type MacDossierSubFolder =
  | '01_Page_de_garde'
  | '02_Contrats'
  | '03_Constatations_immediates'
  | '04_Contradictoire'
  | '05_Comptes_du_prejudice'
  | '06_Rapports_emis'
  | '07_Factures_Honoraires'
  // Alias rétrocompatibles
  | 'Photos_Terrain'
  | 'Documents_Pieces'
  | 'Justificatifs_Frais'
  | 'Factures'
  | 'Rapports';

export const VOLET_TO_MAC_FOLDER: Record<DossierVoletKey, MacDossierSubFolder> = {
  garde: '01_Page_de_garde',
  contrats: '02_Contrats',
  constatations: '03_Constatations_immediates',
  contradictoire: '04_Contradictoire',
  prejudice: '05_Comptes_du_prejudice',
  rapports: '06_Rapports_emis',
};

export const ALL_DOSSIER_VOLET_FOLDERS: MacDossierSubFolder[] = [
  '01_Page_de_garde',
  '02_Contrats',
  '03_Constatations_immediates',
  '04_Contradictoire',
  '05_Comptes_du_prejudice',
  '06_Rapports_emis',
  '07_Factures_Honoraires',
];

function resolveCanonicalVoletFolder(subFolder: MacDossierSubFolder): string {
  switch (subFolder) {
    case 'Factures':
      return '07_Factures_Honoraires';
    case 'Photos_Terrain':
    case 'Documents_Pieces':
      return '03_Constatations_immediates';
    case 'Rapports':
      return '06_Rapports_emis';
    default:
      return subFolder;
  }
}

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSavedDirectoryHandle(): Promise<any | null> {
  try {
    const db = await openHandleDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveDirectoryHandle(handle: any | null): Promise<void> {
  try {
    const db = await openHandleDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      if (handle) {
        tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      } else {
        tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IDB errors
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function enableAutoDownloadSync(): { connected: boolean; folderName: string; mode: 'safari_auto' } {
  const name = 'iCloud Drive (Copie auto)';
  localStorage.setItem('vp_local_sync_folder_name', name);
  localStorage.setItem('vp_local_sync_mode', 'safari_auto');
  localStorage.setItem('vp_local_sync_last_at', new Date().toISOString());
  localStorage.removeItem('vp_local_sync_disabled');
  window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));
  return { connected: true, folderName: name, mode: 'safari_auto' };
}

function markSyncSuccess(detail?: string) {
  localStorage.setItem('vp_local_sync_last_at', new Date().toISOString());
  if (detail) localStorage.setItem('vp_local_sync_last_path', detail);
  window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));
}

export async function getDossiersRootHandle(rootHandle: any): Promise<{ handle: any; folderName: string }> {
  try {
    const handle = await rootHandle.getDirectoryHandle('01_Dossiers_Expertise', { create: false });
    return { handle, folderName: '01_Dossiers_Expertise' };
  } catch {
    try {
      const handle = await rootHandle.getDirectoryHandle('Dossiers', { create: false });
      return { handle, folderName: 'Dossiers' };
    } catch {
      const handle = await rootHandle.getDirectoryHandle('01_Dossiers_Expertise', { create: true });
      return { handle, folderName: '01_Dossiers_Expertise' };
    }
  }
}

export async function getComptaRootHandle(rootHandle: any): Promise<{ handle: any; folderName: string }> {
  try {
    const handle = await rootHandle.getDirectoryHandle('02_Frais_Generaux_Compta', { create: false });
    return { handle, folderName: '02_Frais_Generaux_Compta' };
  } catch {
    try {
      const handle = await rootHandle.getDirectoryHandle('Compta', { create: false });
      return { handle, folderName: 'Compta' };
    } catch {
      const handle = await rootHandle.getDirectoryHandle('02_Frais_Generaux_Compta', { create: true });
      return { handle, folderName: '02_Frais_Generaux_Compta' };
    }
  }
}

/**
 * Crée automatiquement le dossier d'un dossier d'expertise dans `01_Dossiers_Expertise/<Code_Dossier>`
 * avec ses 6 sous-dossiers numérotés (01 à 06) + le dossier `02_Frais_Generaux_Compta/` séparé à la racine.
 */
export async function ensureMissionFolderOnMac(missionCode: string): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;
  try {
    const rootHandle = await getSavedDirectoryHandle();
    if (!rootHandle) return false;
    let perm = await rootHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      perm = await rootHandle.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') return false;

    const { handle: dossiersRoot, folderName: dossiersName } = await getDossiersRootHandle(rootHandle);
    await getComptaRootHandle(rootHandle);

    const safeMission = (missionCode || 'Cabinet_VP').replace(/[^a-zA-Z0-9_-]/g, '_');
    const missionDir = await dossiersRoot.getDirectoryHandle(safeMission, { create: true });
    for (const folder of ALL_DOSSIER_VOLET_FOLDERS) {
      await missionDir.getDirectoryHandle(folder, { create: true });
    }
    markSyncSuccess(`${rootHandle.name}/${dossiersName}/${safeMission}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronise automatiquement TOUS les dossiers existants (6 volets + factures) et le dossier Compta
 * dans le dossier racine du Mac dès sa connexion.
 */
export async function syncAllExistingMissionsToMac(): Promise<{ missionsSynced: number; filesSynced: number }> {
  let missionsSynced = 0;
  let filesSynced = 0;
  if (!isFileSystemAccessSupported()) return { missionsSynced, filesSynced };

  try {
    const rootHandle = await getSavedDirectoryHandle();
    if (!rootHandle) return { missionsSynced, filesSynced };
    let perm = await rootHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      perm = await rootHandle.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') return { missionsSynced, filesSynced };

    // 1. Créer le dossier Compta séparé + l'arborescence 01..06 de tous les dossiers
    await getComptaRootHandle(rootHandle);
    const missionsRes = await fetch('/api/missions');
    if (missionsRes.ok) {
      const missions = await missionsRes.json();
      for (const m of missions) {
        if (m.code) {
          await ensureMissionFolderOnMac(m.code);
          missionsSynced++;
        }
      }
    }

    // 2. Déposer toutes les factures Word (.docx) dans Dossiers/<Code>/07_Factures_Honoraires/ ET dans Compta/<AAAA-MM>/Factures_emises/
    const invoicesRes = await fetch('/api/invoices');
    if (invoicesRes.ok) {
      const invoices = await invoicesRes.json();
      for (const inv of invoices) {
        try {
          const docxRes = await fetch(`/api/invoices/${inv.id}/docx`);
          if (docxRes.ok) {
            const blob = await docxRes.blob();
            await syncFileToLocalMacFolder({
              missionCode: inv.our_ref || 'Cabinet_VP',
              subFolder: '07_Factures_Honoraires',
              fileName: `Facture_${inv.invoice_number}.docx`,
              data: blob,
            });
            // Nettoyage automatique si une ancienne copie se trouvait dans 01_Page_de_garde
            try {
              const { handle: dossiersRoot } = await getDossiersRootHandle(rootHandle);
              const safeMission = (inv.our_ref || 'Cabinet_VP').replace(/[^a-zA-Z0-9_-]/g, '_');
              const missionDir = await dossiersRoot.getDirectoryHandle(safeMission, { create: false });
              const gardeDir = await missionDir.getDirectoryHandle('01_Page_de_garde', { create: false });
              await gardeDir.removeEntry(`Facture_${inv.invoice_number}.docx`);
            } catch {
              // Ignorer si déjà absent
            }
            const month = (inv.date || '2026-10').slice(0, 7);
            await syncComptaFileToMac({
              month,
              subFolder: 'Factures_emises',
              fileName: `Facture_${inv.invoice_number}.docx`,
              data: blob,
            });
            filesSynced++;
          }
        } catch {
          // Ignore individual invoice error
        }
      }
    }
  } catch (err) {
    console.warn('Erreur lors de la synchronisation initiale des dossiers existants :', err);
  }
  return { missionsSynced, filesSynced };
}

export async function connectLocalMacFolder(): Promise<{
  connected: boolean;
  folderName: string;
  mode: 'native' | 'safari_auto';
  iframeBlocked?: boolean;
  missionsSynced?: number;
  filesSynced?: number;
}> {
  if (isFileSystemAccessSupported()) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        id: 'vp_expertise_icloud',
        mode: 'readwrite',
        startIn: 'documents',
      });
      await saveDirectoryHandle(dirHandle);
      localStorage.setItem('vp_local_sync_folder_name', dirHandle.name);
      localStorage.setItem('vp_local_sync_mode', 'native');
      localStorage.setItem('vp_local_sync_last_at', new Date().toISOString());
      localStorage.removeItem('vp_local_sync_disabled');
      window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));

      const stats = await syncAllExistingMissionsToMac();

      return {
        connected: true,
        folderName: dirHandle.name,
        mode: 'native',
        missionsSynced: stats.missionsSynced,
        filesSynced: stats.filesSynced,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { connected: false, folderName: '', mode: 'native' };
      }
      if (err?.name === 'SecurityError' || String(err?.message || '').toLowerCase().includes('sub frame')) {
        return { connected: false, folderName: '', mode: 'safari_auto', iframeBlocked: true };
      }
      throw err;
    }
  } else {
    return enableAutoDownloadSync();
  }
}

export async function disconnectLocalMacFolder(): Promise<void> {
  await saveDirectoryHandle(null);
  localStorage.removeItem('vp_local_sync_folder_name');
  localStorage.removeItem('vp_local_sync_mode');
  localStorage.setItem('vp_local_sync_disabled', '1');
  window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));
}

export function getLocalSyncStatus(): {
  connected: boolean;
  folderName: string | null;
  mode: string | null;
  lastSyncedAt: string | null;
  lastPath: string | null;
} {
  const disabled = localStorage.getItem('vp_local_sync_disabled') === '1';
  if (disabled) {
    return { connected: false, folderName: null, mode: null, lastSyncedAt: null, lastPath: null };
  }
  const folderName = localStorage.getItem('vp_local_sync_folder_name') || 'Rocco_Mac (Synchronisé)';
  const mode = localStorage.getItem('vp_local_sync_mode') || 'safari_auto';
  const lastSyncedAt = localStorage.getItem('vp_local_sync_last_at');
  const lastPath = localStorage.getItem('vp_local_sync_last_path');
  return {
    connected: true,
    folderName,
    mode,
    lastSyncedAt,
    lastPath,
  };
}

export function isLocalSyncConnected(): boolean {
  return getLocalSyncStatus().connected;
}

export function getLocalSyncFolderName(): string {
  return getLocalSyncStatus().folderName || 'Rocco_VP_Expertise';
}

/**
 * Enregistre simultanément une pièce / photo / document dans Firebase Firestore
 */
export async function mirrorEvidenceToFirestore(params: {
  missionId: string;
  missionCode: string;
  file: File;
  title?: string;
  caption?: string;
  type?: 'photo' | 'document' | 'constat';
  pieceNumber?: number;
  section?: DossierVoletKey;
  serverFilename?: string;
  isSelectedForReport?: boolean;
}): Promise<void> {
  try {
    const uid = auth.currentUser?.uid || 'user-expert-valentine';
    const evidenceId = `evid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let fileDataUrl = '';
    if (params.file.type.startsWith('image/') && params.file.size < 900_000) {
      fileDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(params.file);
      });
    }
    const evidenceDoc: EvidenceItem = {
      id: evidenceId,
      mission_id: params.missionId,
      mission_code: params.missionCode,
      title: (params.title || params.caption || params.file.name).trim(),
      type: params.type || (params.file.type.startsWith('image/') ? 'photo' : 'document'),
      file_url: fileDataUrl || (params.serverFilename ? `/uploads/${params.serverFilename}` : ''),
      filename: params.file.name,
      file_size: params.file.size,
      mime_type: params.file.type,
      caption: (params.caption || params.title || '').trim(),
      taken_at: new Date().toISOString(),
      order_index: Date.now(),
      piece_number: params.pieceNumber,
      section: params.section,
      is_selected_for_report: params.isSelectedForReport ?? true,
      created_by: uid,
      created_at: new Date().toISOString(),
    };
    await setDoc(doc(firestoreDb, `missions/${params.missionId}/evidences`, evidenceId), evidenceDoc);
  } catch (err) {
    console.warn('Miroir Firebase Firestore optionnel ignoré :', err);
  }
}

/**
 * Écrit automatiquement un justificatif comptable ou un frais de déplacement dans le dossier `Compta/<AAAA-MM>/`
 * séparé des dossiers d'expertise sur le Mac :
 * `<Dossier Racine>/Compta/<AAAA-MM>/<Justificatifs | Factures_emises>/<NomFichier>`
 */
export async function syncComptaFileToMac(params: {
  month: string; // YYYY-MM
  subFolder?: 'Justificatifs' | 'Factures_emises';
  fileName: string;
  data: File | Blob;
}): Promise<{ synced: boolean; path?: string; method?: string }> {
  const status = getLocalSyncStatus();
  if (!status.connected) return { synced: false };

  const safeMonth = (params.month || new Date().toISOString().slice(0, 7)).replace(/[^0-9-]/g, '');
  const targetSub = params.subFolder || 'Justificatifs';
  const safeFile = params.fileName.replace(/[/\\?%*:|"<>]/g, '_');

  if (status.mode === 'native' && isFileSystemAccessSupported()) {
    try {
      const rootHandle = await getSavedDirectoryHandle();
      if (!rootHandle) return { synced: false };

      let perm = await rootHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        perm = await rootHandle.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') return { synced: false };

      const { handle: comptaRoot, folderName: comptaName } = await getComptaRootHandle(rootHandle);
      const monthDir = await comptaRoot.getDirectoryHandle(safeMonth, { create: true });
      const subDir = await monthDir.getDirectoryHandle(targetSub, { create: true });
      const fileHandle = await subDir.getFileHandle(safeFile, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(params.data);
      await writable.close();

      const fullPath = `${rootHandle.name}/${comptaName}/${safeMonth}/${targetSub}/${safeFile}`;
      markSyncSuccess(fullPath);
      return {
        synced: true,
        path: fullPath,
        method: 'native',
      };
    } catch (err) {
      console.warn('Synchronisation dossier Compta Mac ignorée :', err);
      return { synced: false };
    }
  } else if (status.mode === 'safari_auto') {
    try {
      const url = URL.createObjectURL(params.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Compta__${safeMonth}__${targetSub}__${safeFile}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      const fullPath = `Compta/${safeMonth}/${targetSub}/${safeFile}`;
      markSyncSuccess(fullPath);
      return {
        synced: true,
        path: fullPath,
        method: 'safari_auto',
      };
    } catch {
      return { synced: false };
    }
  }
  return { synced: false };
}

/**
 * Écrit automatiquement un fichier d'expertise dans le volet correspondant du dossier :
 * `<Dossier Racine>/Dossiers/<Code_Dossier>/<01..06_Volet>/<NomFichier>`
 * (Si `subFolder === 'Justificatifs_Frais'`, route automatiquement vers `Compta/<AAAA-MM>/Justificatifs/` !)
 */
export async function syncFileToLocalMacFolder(params: {
  missionCode: string;
  subFolder: MacDossierSubFolder;
  fileName: string;
  data: File | Blob;
  month?: string;
}): Promise<{ synced: boolean; path?: string; method?: string }> {
  // Règle Valentine : tous les justificatifs de frais vont dans le dossier Compta séparé des dossiers techniques
  if (params.subFolder === 'Justificatifs_Frais') {
    const month = params.month || new Date().toISOString().slice(0, 7);
    const prefixedName = params.missionCode ? `${params.missionCode}_${params.fileName}` : params.fileName;
    return syncComptaFileToMac({
      month,
      subFolder: 'Justificatifs',
      fileName: prefixedName,
      data: params.data,
    });
  }

  const status = getLocalSyncStatus();
  if (!status.connected) return { synced: false };

  const safeMission = (params.missionCode || 'Cabinet_VP').replace(/[^a-zA-Z0-9_-]/g, '_');
  const canonicalVolet = resolveCanonicalVoletFolder(params.subFolder);
  const safeFile = params.fileName.replace(/[/\\?%*:|"<>]/g, '_');

  if (status.mode === 'native' && isFileSystemAccessSupported()) {
    try {
      const rootHandle = await getSavedDirectoryHandle();
      if (!rootHandle) return { synced: false };

      let perm = await rootHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        perm = await rootHandle.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') return { synced: false };

      const { handle: dossiersRoot, folderName: dossiersName } = await getDossiersRootHandle(rootHandle);
      const missionDir = await dossiersRoot.getDirectoryHandle(safeMission, { create: true });
      for (const folder of ALL_DOSSIER_VOLET_FOLDERS) {
        await missionDir.getDirectoryHandle(folder, { create: true });
      }
      const subDir = await missionDir.getDirectoryHandle(canonicalVolet, { create: true });
      const fileHandle = await subDir.getFileHandle(safeFile, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(params.data);
      await writable.close();

      const fullPath = `${rootHandle.name}/${dossiersName}/${safeMission}/${canonicalVolet}/${safeFile}`;
      markSyncSuccess(fullPath);
      return {
        synced: true,
        path: fullPath,
        method: 'native',
      };
    } catch (err) {
      console.warn('Synchronisation dossier local Mac ignorée :', err);
      return { synced: false };
    }
  } else if (status.mode === 'safari_auto') {
    try {
      const url = URL.createObjectURL(params.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dossiers__${safeMission}__${canonicalVolet}__${safeFile}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      const fullPath = `Dossiers/${safeMission}/${canonicalVolet}/${safeFile}`;
      markSyncSuccess(fullPath);
      return {
        synced: true,
        path: fullPath,
        method: 'safari_auto',
      };
    } catch {
      return { synced: false };
    }
  }

  return { synced: false };
}

export interface UntrackedMacFile {
  id: string;
  file: File;
  fileName: string;
  cleanName: string;
  relativePath: string;
  subFolder: string;
  inferredSection: DossierVoletKey;
  inferredCategory: string;
  size: number;
  lastModified: number;
}

function normalizeFileNameForComparison(name: string): string {
  return String(name || '')
    .trim()
    .replace(/^Pi[eè]ce[_\s-]*n?[°o]?[_\s-]*\d+[_\s-]*/i, '')
    .toLowerCase();
}

function mapMacFolderToSectionAndCategory(folderName: string): { section: DossierVoletKey; category: string } {
  const lower = folderName.toLowerCase();
  if (lower.includes('02_contrat') || lower.includes('contrat')) {
    return { section: 'contrats', category: 'contrat_client' };
  }
  if (lower.includes('04_contradictoire') || lower.includes('contradictoire') || lower.includes('dire')) {
    return { section: 'contradictoire', category: 'procedure_dires' };
  }
  if (lower.includes('05_comptes') || lower.includes('prejudice') || lower.includes('préjudice')) {
    return { section: 'prejudice', category: 'justificatif_prejudice' };
  }
  if (lower.includes('06_rapport') || lower.includes('rapport')) {
    return { section: 'rapports', category: 'rapport_emis' };
  }
  return { section: 'constatations', category: 'note_technique' };
}

/**
 * Scanne le dossier local Mac `<Racine>/01_Dossiers_Expertise/<Code_Dossier>/`
 * pour détecter les fichiers déposés directement via le Finder qui ne sont pas encore dans l'application.
 */
export async function scanUntrackedMacFilesForMission(
  missionCode: string,
  existingAppFileNames: string[]
): Promise<UntrackedMacFile[]> {
  const status = getLocalSyncStatus();
  if (!status.connected || status.mode !== 'native' || !isFileSystemAccessSupported()) {
    return [];
  }

  try {
    const rootHandle = await getSavedDirectoryHandle();
    if (!rootHandle) return [];

    const perm = await rootHandle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') return [];

    const { handle: dossiersRoot } = await getDossiersRootHandle(rootHandle);
    const safeMission = (missionCode || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeMission) return [];

    let missionDir: any;
    try {
      missionDir = await dossiersRoot.getDirectoryHandle(safeMission, { create: false });
    } catch {
      return [];
    }

    const existingNormalized = new Set(
      existingAppFileNames.flatMap(n => [
        String(n || '').trim().toLowerCase(),
        normalizeFileNameForComparison(n),
      ])
    );

    const untracked: UntrackedMacFile[] = [];

    const shouldIgnoreFile = (fileName: string, folderName: string): boolean => {
      if (!fileName || fileName.startsWith('.') || fileName.startsWith('~$')) return true;
      const lower = fileName.toLowerCase();
      if (lower === 'thumbs.db' || lower === 'desktop.ini') return true;
      // Ignorer les fichiers générés automatiquement par l'app (synthèse, décompte CSV, factures honoraires)
      if (lower.startsWith('synthese_dossier_') || lower.startsWith('fiche_de_garde_')) return true;
      if (lower.startsWith('decompte_prejudice_') && lower.endsWith('.csv')) return true;
      if (lower.startsWith('facture_') && lower.endsWith('.docx')) return true;
      if (lower.startsWith('projet_rapport_') && lower.endsWith('.docx')) return true;
      if (folderName === '07_Factures_Honoraires') return true;
      return false;
    };

    const scanDirectoryEntries = async (dirHandle: any, folderLabel: string) => {
      for await (const [entryName, entryHandle] of dirHandle.entries()) {
        if (entryHandle.kind === 'file') {
          if (shouldIgnoreFile(entryName, folderLabel)) continue;
          const normRaw = entryName.trim().toLowerCase();
          const normClean = normalizeFileNameForComparison(entryName);
          if (existingNormalized.has(normRaw) || existingNormalized.has(normClean)) {
            continue;
          }
          try {
            const fileObj: File = await entryHandle.getFile();
            const { section, category } = mapMacFolderToSectionAndCategory(folderLabel);
            untracked.push({
              id: `${folderLabel}/${entryName}`,
              file: fileObj,
              fileName: entryName,
              cleanName: entryName.replace(/^Pi[eè]ce[_\s-]*n?[°o]?[_\s-]*\d+[_\s-]*/i, ''),
              relativePath: folderLabel ? `${folderLabel}/${entryName}` : entryName,
              subFolder: folderLabel || 'Racine du dossier (En vrac)',
              inferredSection: section,
              inferredCategory: category,
              size: fileObj.size,
              lastModified: fileObj.lastModified,
            });
          } catch {
            // Ignore unreadable file
          }
        } else if (entryHandle.kind === 'directory' && !entryName.startsWith('.')) {
          if (entryName === '07_Factures_Honoraires') continue;
          await scanDirectoryEntries(entryHandle, folderLabel ? `${folderLabel}/${entryName}` : entryName);
        }
      }
    };

    await scanDirectoryEntries(missionDir, '');
    return untracked.sort((a, b) => b.lastModified - a.lastModified);
  } catch (err) {
    console.warn('Scan Finder Mac ignoré :', err);
    return [];
  }
}
