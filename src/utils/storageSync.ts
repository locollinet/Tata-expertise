import { ref, uploadBytes, getDownloadURL, getBlob, deleteObject } from 'firebase/storage';
import { auth, storage } from '../firebase.js';
import { isAuthorizedCabinetEmail } from './firestoreSync.js';

export const CABINET_STORAGE_PREFIX = 'cabinet/vp_expertise_cabinet/uploads';

const cloudUrlCache = new Map<string, string>();
const resolvedUrlCache = new Map<string, string>();
const pendingResolutions = new Map<string, Promise<string>>();

export function extractSafeUploadName(filenameOrPath?: string | null): string {
  if (!filenameOrPath) return '';
  const cleaned = String(filenameOrPath).split('?')[0].split('#')[0];
  const base = cleaned.split('/').pop()?.trim() || '';
  if (!base || base === '.' || base === '..' || base.includes('..') || base.includes('\\')) {
    return '';
  }
  return base;
}

export function canUseCabinetCloudStorage(): boolean {
  const user = auth.currentUser;
  return Boolean(user && user.emailVerified && isAuthorizedCabinetEmail(user.email));
}

function storageRefForFilename(safeName: string) {
  return ref(storage, `${CABINET_STORAGE_PREFIX}/${safeName}`);
}

function isDirectExternalOrBlobUrl(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  );
}

/**
 * Upload a binary file (PDF > 1 MiB, site photo, DOCX, receipt) to Firebase Storage
 * so it persists across Cloud Run container restarts without hitting Firestore's 1 MiB document cap.
 */
export async function uploadFileToCloudStorage(
  serverFilename: string,
  data: Blob | File,
  metadata?: { originalName?: string; missionCode?: string }
): Promise<string | null> {
  const safeName = extractSafeUploadName(serverFilename);
  if (!safeName || !canUseCabinetCloudStorage()) return null;

  try {
    const fileRef = storageRefForFilename(safeName);
    const customMetadata: Record<string, string> = {};
    if (metadata?.originalName) customMetadata.originalName = metadata.originalName.slice(0, 200);
    if (metadata?.missionCode) customMetadata.missionCode = metadata.missionCode.slice(0, 64);

    await uploadBytes(fileRef, data, {
      contentType: data.type || 'application/octet-stream',
      customMetadata: Object.keys(customMetadata).length > 0 ? customMetadata : undefined,
    });

    const downloadUrl = await getDownloadURL(fileRef);
    cloudUrlCache.set(safeName, downloadUrl);
    resolvedUrlCache.set(safeName, `/uploads/${encodeURIComponent(safeName)}`);
    return downloadUrl;
  } catch (err) {
    console.warn('[Firebase Storage] Upload cloud ignoré :', err);
    return null;
  }
}

export async function getCloudDownloadUrl(serverFilename?: string | null): Promise<string | null> {
  const safeName = extractSafeUploadName(serverFilename);
  if (!safeName || !canUseCabinetCloudStorage()) return null;

  const cached = cloudUrlCache.get(safeName);
  if (cached) return cached;

  try {
    const url = await getDownloadURL(storageRefForFilename(safeName));
    cloudUrlCache.set(safeName, url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Resolves a file URL for browser preview/download:
 * prefers local `/uploads/<file>` when present on the running server,
 * and seamlessly falls back to Firebase Storage download URL when the server cache was reset.
 */
export async function resolveUploadUrl(serverFilename?: string | null): Promise<string> {
  if (!serverFilename) return '';
  if (isDirectExternalOrBlobUrl(serverFilename)) return serverFilename;

  const safeName = extractSafeUploadName(serverFilename);
  if (!safeName) return '';

  const cached = resolvedUrlCache.get(safeName);
  if (cached) return cached;

  const inflight = pendingResolutions.get(safeName);
  if (inflight) return inflight;

  const localUrl = `/uploads/${encodeURIComponent(safeName)}`;
  const promise = (async () => {
    try {
      const headRes = await fetch(localUrl, { method: 'HEAD' });
      const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
      const isHtmlFallback = contentType.includes('text/html') && !/\.html?$/i.test(safeName);
      if (headRes.ok && !isHtmlFallback) {
        resolvedUrlCache.set(safeName, localUrl);
        return localUrl;
      }
    } catch {
      // Fall through to Firebase Storage lookup
    }

    const cloudUrl = await getCloudDownloadUrl(safeName);
    if (cloudUrl) {
      resolvedUrlCache.set(safeName, cloudUrl);
      return cloudUrl;
    }

    return localUrl;
  })().finally(() => {
    pendingResolutions.delete(safeName);
  });

  pendingResolutions.set(safeName, promise);
  return promise;
}

export async function deleteFileFromCloudStorage(serverFilename?: string | null): Promise<void> {
  const safeName = extractSafeUploadName(serverFilename);
  if (!safeName) return;

  cloudUrlCache.delete(safeName);
  resolvedUrlCache.delete(safeName);

  if (!canUseCabinetCloudStorage()) return;
  try {
    await deleteObject(storageRefForFilename(safeName));
  } catch (err: any) {
    if (err?.code !== 'storage/object-not-found') {
      console.warn('[Firebase Storage] Suppression cloud ignorée :', err);
    }
  }
}

export async function fetchUploadBlobWithCloudFallback(serverFilename?: string | null): Promise<Blob | null> {
  const safeName = extractSafeUploadName(serverFilename);
  if (!safeName) return null;

  try {
    const res = await fetch(`/uploads/${encodeURIComponent(safeName)}`);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isHtmlFallback = contentType.includes('text/html') && !/\.html?$/i.test(safeName);
    if (res.ok && !isHtmlFallback) {
      return await res.blob();
    }
  } catch {
    // Fall through to Firebase Storage
  }

  if (!canUseCabinetCloudStorage()) return null;
  try {
    return await getBlob(storageRefForFilename(safeName));
  } catch {
    const url = await getCloudDownloadUrl(safeName);
    if (!url) return null;
    try {
      const cloudRes = await fetch(url);
      return cloudRes.ok ? await cloudRes.blob() : null;
    } catch {
      return null;
    }
  }
}

/**
 * Ensures any referenced files missing from the server's ephemeral disk (e.g. after Cloud Run restart)
 * are restored from Firebase Storage before server-side DOCX or ZIP generation.
 */
export async function restoreMissingUploadsToServer(
  filenames: Array<string | null | undefined>
): Promise<number> {
  const uniqueNames = Array.from(
    new Set(filenames.map((f) => extractSafeUploadName(f)).filter(Boolean))
  );
  if (uniqueNames.length === 0 || !canUseCabinetCloudStorage()) return 0;

  let missing: string[] = [];
  try {
    const checkRes = await fetch('/api/uploads/check-missing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: uniqueNames }),
    });
    if (!checkRes.ok) return 0;
    const data = await checkRes.json();
    missing = Array.isArray(data.missing) ? data.missing : [];
  } catch {
    return 0;
  }

  if (missing.length === 0) return 0;

  let restored = 0;
  const concurrency = 4;
  for (let i = 0; i < missing.length; i += concurrency) {
    const chunk = missing.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (safeName) => {
        try {
          const blob = await getBlob(storageRefForFilename(safeName));
          const fd = new FormData();
          fd.append('filename', safeName);
          fd.append('file', blob, safeName);
          const upRes = await fetch('/api/uploads/cache', { method: 'POST', body: fd });
          if (upRes.ok) {
            resolvedUrlCache.set(safeName, `/uploads/${encodeURIComponent(safeName)}`);
            restored++;
          }
        } catch {
          // Ignore individual missing files so export still succeeds
        }
      })
    );
  }

  return restored;
}
