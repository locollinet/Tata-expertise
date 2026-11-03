// Synchronisation automatique des documents, photos et factures vers un dossier local Mac / iCloud Drive
// Utilise la File System Access API (Chrome / Edge / Brave sur macOS) avec persistance IndexedDB,
// ainsi qu'un mode de téléchargement automatique préfixé pour Safari macOS.

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

export async function connectLocalMacFolder(): Promise<{ connected: boolean; folderName: string; mode: 'native' | 'safari_auto' }> {
  if (isFileSystemAccessSupported()) {
    const dirHandle = await (window as any).showDirectoryPicker({
      id: 'vp_expertise_icloud',
      mode: 'readwrite',
      startIn: 'documents',
    });
    await saveDirectoryHandle(dirHandle);
    localStorage.setItem('vp_local_sync_folder_name', dirHandle.name);
    localStorage.setItem('vp_local_sync_mode', 'native');
    window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));
    return { connected: true, folderName: dirHandle.name, mode: 'native' };
  } else {
    // Safari fallback: enable automatic local download mirror for iCloud Drive
    localStorage.setItem('vp_local_sync_folder_name', 'iCloud Drive (Téléchargements auto)');
    localStorage.setItem('vp_local_sync_mode', 'safari_auto');
    window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));
    return { connected: true, folderName: 'iCloud Drive (Téléchargements auto)', mode: 'safari_auto' };
  }
}

export async function disconnectLocalMacFolder(): Promise<void> {
  await saveDirectoryHandle(null);
  localStorage.removeItem('vp_local_sync_folder_name');
  localStorage.removeItem('vp_local_sync_mode');
  window.dispatchEvent(new CustomEvent('vp-local-sync-changed'));
}

export function getLocalSyncStatus(): { connected: boolean; folderName: string | null; mode: string | null } {
  const folderName = localStorage.getItem('vp_local_sync_folder_name');
  const mode = localStorage.getItem('vp_local_sync_mode');
  return {
    connected: Boolean(folderName),
    folderName,
    mode,
  };
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
