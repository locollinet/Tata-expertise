// Synchronisation automatique des documents, photos et factures vers un dossier local Mac / iCloud Drive
// Utilise la File System Access API (Chrome / Edge / Brave sur macOS) avec persistance IndexedDB,
// ainsi qu'un mode de téléchargement automatique préfixé pour Safari macOS, et synchronisation dans Firebase Firestore.

import { doc, setDoc } from 'firebase/firestore';
import { db as firestoreDb, auth } from '../firebase.js';
import { EvidenceItem } from '@shared/types.js';

const DB_NAME = 'vp_expertise_local_sync';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'icloud_root_dir';

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
  localStorage.removeItem('vp_local_sync_disabled');
  window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));
  return { connected: true, folderName: name, mode: 'safari_auto' };
}

/**
 * Crée automatiquement le dossier d'une mission (<Code_Mission>) et ses 4 sous-dossiers
 * dans le dossier racine iCloud Drive relié sur le Mac.
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

    const safeMission = (missionCode || 'Cabinet_VP').replace(/[^a-zA-Z0-9_-]/g, '_');
    const missionDir = await rootHandle.getDirectoryHandle(safeMission, { create: true });
    await missionDir.getDirectoryHandle('Photos_Terrain', { create: true });
    await missionDir.getDirectoryHandle('Documents_Pieces', { create: true });
    await missionDir.getDirectoryHandle('Justificatifs_Frais', { create: true });
    await missionDir.getDirectoryHandle('Factures', { create: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronise automatiquement TOUS les dossiers existants (et leurs factures Word + pièces)
 * dans le dossier racine iCloud Drive du Mac dès sa connexion.
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

    // 1. Créer l'arborescence de tous les dossiers existants (en cours)
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

    // 2. Déposer toutes les factures Word (.docx) existantes dans <Code_Mission>/Factures/
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
              subFolder: 'Factures',
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
      localStorage.removeItem('vp_local_sync_disabled');
      window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));

      // Synchronise automatiquement tous les dossiers et factures existants dès la sélection du dossier racine !
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

export function getLocalSyncStatus(): { connected: boolean; folderName: string | null; mode: string | null } {
  const disabled = localStorage.getItem('vp_local_sync_disabled') === '1';
  if (disabled) {
    return { connected: false, folderName: null, mode: null };
  }
  const folderName = localStorage.getItem('vp_local_sync_folder_name') || 'iCloud Drive (Copie auto)';
  const mode = localStorage.getItem('vp_local_sync_mode') || 'safari_auto';
  return {
    connected: true,
    folderName,
    mode,
  };
}

/**
 * Enregistre simultanément une preuve / photo / document dans Firebase Firestore
 * afin que tout dépôt fait depuis Saisie Rapide ou Pièces & Documents soit aussi dans Firebase.
 */
export async function mirrorEvidenceToFirestore(params: {
  missionId: string;
  missionCode: string;
  file: File;
  title?: string;
  caption?: string;
  type?: 'photo' | 'document' | 'constat';
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
      caption: (params.caption || params.title || params.file.name).trim(),
      taken_at: new Date().toISOString(),
      order_index: Date.now(),
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
 * Écrit automatiquement un fichier (File ou Blob) dans le dossier local Mac / iCloud Drive connecté :
 * Structure créée automatiquement : <Dossier Racine iCloud>/<Code_Mission>/<SousDossier>/<NomFichier>
 */
export async function syncFileToLocalMacFolder(params: {
  missionCode: string;
  subFolder: 'Photos_Terrain' | 'Documents_Pieces' | 'Justificatifs_Frais' | 'Factures' | 'Rapports';
  fileName: string;
  data: File | Blob;
}): Promise<{ synced: boolean; path?: string; method?: string }> {
  const status = getLocalSyncStatus();
  if (!status.connected) return { synced: false };

  const safeMission = (params.missionCode || 'Cabinet_VP').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFile = params.fileName.replace(/[/\\?%*:|"<>]/g, '_');

  if (status.mode === 'native' && isFileSystemAccessSupported()) {
    try {
      const rootHandle = await getSavedDirectoryHandle();
      if (!rootHandle) return { synced: false };

      // Check or request permission
      let perm = await rootHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        perm = await rootHandle.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') return { synced: false };

      const missionDir = await rootHandle.getDirectoryHandle(safeMission, { create: true });
      const subDir = await missionDir.getDirectoryHandle(params.subFolder, { create: true });
      const fileHandle = await subDir.getFileHandle(safeFile, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(params.data);
      await writable.close();

      return {
        synced: true,
        path: `${rootHandle.name}/${safeMission}/${params.subFolder}/${safeFile}`,
        method: 'native',
      };
    } catch (err) {
      console.warn('Synchronisation dossier local Mac ignorée :', err);
      return { synced: false };
    }
  } else if (status.mode === 'safari_auto') {
    // Sur Safari, déclenche un téléchargement local nommé avec le dossier mission
    try {
      const url = URL.createObjectURL(params.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeMission}__${params.subFolder}__${safeFile}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return {
        synced: true,
        path: `iCloud Drive/${safeMission}__${params.subFolder}__${safeFile}`,
        method: 'safari_auto',
      };
    } catch {
      return { synced: false };
    }
  }

  return { synced: false };
}
