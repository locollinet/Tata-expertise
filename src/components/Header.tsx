import React, { useState, useEffect } from 'react';
import { Calendar, FolderKanban, Receipt, Calculator, Plus, Cloud, LogIn, LogOut, CheckCircle2, Sparkles, FolderSync, Download, ExternalLink, X, FolderOpen, Laptop, Upload, RefreshCw, Mail, Lock } from 'lucide-react';
import {
  auth,
  signInWithGoogle,
  signInWithEmail,
  sendCabinetPasswordReset,
  sendCabinetEmailVerification,
  refreshCurrentUser,
  logOut,
} from '../firebase.js';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestoreCabinetStatus,
  pushCabinetStateToFirestore,
  hydrateBackendFromFirestore,
  isAuthorizedCabinetEmail,
  FirestoreCabinetStatus,
} from '../utils/firestoreSync.js';
import { 
  getLocalSyncStatus, 
  connectLocalMacFolder, 
  disconnectLocalMacFolder, 
  enableAutoDownloadSync,
  detectBrowser,
  isInsideIframe,
  isFileSystemAccessSupported
} from '../utils/localFolderSync.js';
import { restoreMissingUploadsToServer } from '../utils/storageSync.js';

interface HeaderProps {
  activeTab: 'today' | 'missions' | 'billing' | 'compta';
  setActiveTab: (tab: 'today' | 'missions' | 'billing' | 'compta') => void;
  onOpenQuickAdd: () => void;
  onOpenAssistant: () => void;
  onCloudDataChanged?: () => void;
  urgentCount?: number;
  unbilledTotal?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  onOpenAssistant,
  onCloudDataChanged,
  urgentCount = 0,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('valentine.pecheux@vpexpertise.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [authFeedback, setAuthFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncFolderName, setSyncFolderName] = useState<string | null>(null);
  const [syncLastPath, setSyncLastPath] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [iframeWarning, setIframeWarning] = useState(false);
  const [browserWarning, setBrowserWarning] = useState<string | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Firebase Firestore cloud sync modal state
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<FirestoreCabinetStatus | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudFeedback, setCloudFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentBrowser = detectBrowser();
  const insideIframe = isInsideIframe();
  const nativeSupported = isFileSystemAccessSupported();

  const refreshCloudStatus = async () => {
    try {
      const st = await getFirestoreCabinetStatus();
      setCloudStatus(st);
    } catch {
      setCloudStatus(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      refreshCloudStatus();
    });
    const refreshSync = () => {
      const s = getLocalSyncStatus();
      setSyncFolderName(s.connected ? s.folderName : null);
      setSyncLastPath(s.lastPath);
    };
    refreshSync();
    window.addEventListener('vp-local-sync-changed', refreshSync);
    window.addEventListener('vp-firestore-sync-changed', refreshCloudStatus);
    return () => {
      unsubscribe();
      window.removeEventListener('vp-local-sync-changed', refreshSync);
      window.removeEventListener('vp-firestore-sync-changed', refreshCloudStatus);
    };
  }, []);

  const handleToggleMacSync = () => {
    setIframeWarning(false);
    setBrowserWarning(null);
    setSyncSuccessMsg(null);
    setShowSyncModal(true);
  };

  const handlePickNativeFolder = async () => {
    setBrowserWarning(null);
    setIframeWarning(false);
    setSyncSuccessMsg(null);
    try {
      const res = await connectLocalMacFolder();
      if (res.iframeBlocked) {
        setIframeWarning(true);
        return;
      }
      if (res.browserNotSupported) {
        setBrowserWarning(
          "Apple Safari bloque l'ouverture du sélecteur Finder par politique de sécurité WebKit. Pour connecter directement votre dossier Finder avec écriture automatique en sous-dossiers, ouvrez Rocco dans Google Chrome sur ce Mac !"
        );
        return;
      }
      if (res.connected) {
        setSyncFolderName(res.folderName);
        setSyncSuccessMsg(
          `Dossier « ${res.folderName} » relié avec succès ! Arborescence créée sur votre Mac (${res.missionsSynced || 0} dossiers actifs préparés${res.filesSynced ? `, ${res.filesSynced} justificatifs copiés` : ''}).`
        );
      } else if (res.error) {
        setBrowserWarning(`Erreur : ${res.error}`);
      }
    } catch (err: any) {
      setBrowserWarning(err?.message || "Impossible d'accéder au dossier du Finder.");
    }
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const handleEnableAutoMirror = () => {
    const res = enableAutoDownloadSync();
    setSyncFolderName(res.folderName);
    setSyncSuccessMsg("Mode miroir automatique Safari activé. Chaque pièce sera téléchargée automatiquement.");
  };

  const handleDisconnectSync = async () => {
    await disconnectLocalMacFolder();
    setSyncFolderName(null);
    setSyncSuccessMsg(null);
  };

  const formatFirebaseAuthError = (err: any): string => {
    const code = String(err?.code || '');
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      return 'E-mail ou mot de passe incorrect.';
    }
    if (code.includes('too-many-requests')) {
      return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
    }
    if (code.includes('popup-closed-by-user')) {
      return 'Fenêtre de connexion Google fermée.';
    }
    return err?.message || 'Erreur lors de la connexion.';
  };

  const handleLogin = async () => {
    setAuthFeedback(null);
    try {
      setAuthLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Erreur authentification Firebase:', err);
      setAuthFeedback({ type: 'error', text: formatFirebaseAuthError(err) });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setAuthFeedback(null);
    try {
      setAuthLoading(true);
      await signInWithEmail(loginEmail, loginPassword);
      setLoginPassword('');
    } catch (err: any) {
      console.error('Erreur authentification e-mail:', err);
      setAuthFeedback({ type: 'error', text: formatFirebaseAuthError(err) });
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!loginEmail.trim()) {
      setAuthFeedback({ type: 'error', text: 'Indiquez votre adresse e-mail ci-dessus.' });
      return;
    }
    setAuthFeedback(null);
    try {
      setAuthLoading(true);
      await sendCabinetPasswordReset(loginEmail);
      setAuthFeedback({
        type: 'success',
        text: `Un e-mail de réinitialisation vient d’être envoyé à ${loginEmail.trim()}.`,
      });
    } catch (err: any) {
      setAuthFeedback({ type: 'error', text: formatFirebaseAuthError(err) });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    setAuthFeedback(null);
    try {
      setAuthLoading(true);
      await sendCabinetEmailVerification();
      setAuthFeedback({
        type: 'success',
        text: `Lien de confirmation envoyé à ${user?.email}. Cliquez dessus dans votre boîte mail puis cliquez sur « J’ai validé — Actualiser ».`,
      });
    } catch (err: any) {
      setAuthFeedback({ type: 'error', text: formatFirebaseAuthError(err) });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRefreshVerification = async () => {
    setAuthFeedback(null);
    try {
      setAuthLoading(true);
      const updated = await refreshCurrentUser();
      setUser(updated ? ({ ...updated } as User) : null);
      if (updated?.emailVerified) {
        const res = await hydrateBackendFromFirestore(true);
        if (res.hydrated) onCloudDataChanged?.();
        await refreshCloudStatus();
        setAuthFeedback({
          type: 'success',
          text: 'Adresse e-mail confirmée ! Vos données VP Expertise sont synchronisées.',
        });
      } else {
        setAuthFeedback({
          type: 'error',
          text: 'Pas encore confirmé : cliquez d’abord sur le lien reçu dans votre boîte mail.',
        });
      }
    } catch (err: any) {
      setAuthFeedback({ type: 'error', text: formatFirebaseAuthError(err) });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setAuthFeedback(null);
      await logOut();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCloudModal = () => {
    setCloudFeedback(null);
    setAuthFeedback(null);
    setShowCloudModal(true);
    refreshCloudStatus();
  };

  const handlePushToFirestore = async () => {
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      const res = await pushCabinetStateToFirestore();
      await refreshCloudStatus();
      setCloudFeedback({
        type: 'success',
        text: `Synchronisé dans Firebase Firestore : ${res.totalMissions} dossiers, ${res.totalInvoices} factures, ${res.totalAccountingEntries} écritures compta et ${res.totalReportDrafts} rapports (${res.chunksWritten} blocs sécurisés).`,
      });
    } catch (err: any) {
      setCloudFeedback({
        type: 'error',
        text: err?.message || 'Erreur lors de la synchronisation Firebase Firestore.',
      });
    } finally {
      setCloudBusy(false);
    }
  };

  const handleReloadFromFirestore = async () => {
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      const res = await hydrateBackendFromFirestore(true);
      await refreshCloudStatus();
      if (res.hydrated) {
        onCloudDataChanged?.();
        setCloudFeedback({
          type: 'success',
          text: `Base rechargée depuis Firebase Firestore (${res.missionsCount} dossiers, ${res.invoicesCount} factures).`,
        });
      } else {
        setCloudFeedback({
          type: 'error',
          text: 'Aucune sauvegarde cloud trouvée pour le cabinet VP Expertise. Cliquez sur « Synchroniser vers le Cloud » pour initialiser l’espace partagé.',
        });
      }
    } catch (err: any) {
      setCloudFeedback({
        type: 'error',
        text: err?.message || 'Erreur lors du chargement depuis Firebase Firestore.',
      });
    } finally {
      setCloudBusy(false);
    }
  };

  interface NavTab {
    id: 'today' | 'missions' | 'billing' | 'compta';
    label: string;
    icon: typeof Calendar;
    badge?: number | string | undefined;
    badgeColor?: string;
  }

  const tabs: NavTab[] = [
    { id: 'today', label: "Aujourd'hui", icon: Calendar, badge: urgentCount > 0 ? urgentCount : undefined, badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200' },
    { id: 'missions', label: 'Dossiers', icon: FolderKanban },
    { id: 'billing', label: 'Factures', icon: Receipt },
    { id: 'compta', label: 'Compta', icon: Calculator },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs w-full overflow-x-clip">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-2 lg:gap-3 min-w-0">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 cursor-pointer shrink-0 min-w-0" onClick={() => setActiveTab('today')}>
            <img src="/logo.png" alt="VP Expertise" className="h-8 w-8 lg:h-9 lg:w-9 object-contain rounded-md shrink-0" />
            <div className="shrink-0 flex flex-col justify-center">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm lg:text-base tracking-tight text-slate-900 whitespace-nowrap">ROCCO · VP EXPERTISE</span>
                <span className="hidden 2xl:inline-block text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium whitespace-nowrap">Valentine Pécheux</span>
              </div>
              <p className="text-[11px] text-slate-500 hidden 2xl:block whitespace-nowrap">Gestion de Dossiers d'Expertise & Facturation</p>
            </div>
          </div>

          {/* Center Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-semibold transition-colors whitespace-nowrap relative cursor-pointer ${
                    isActive
                      ? 'bg-[#0f3854] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 pointer-events-none" />
                  <span className="pointer-events-none">{tab.label}</span>
                  {tab.badge && (
                    <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 leading-none rounded-full pointer-events-none ${tab.badgeColor}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Actions: Mac Sync Status + Auth + Quick Add */}
          <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleMacSync}
              className={`flex items-center space-x-1.5 px-2 lg:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                syncFolderName
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
              }`}
              title={
                syncFolderName
                  ? `Sauvegarde active sur votre Mac (${syncFolderName})${syncLastPath ? ` — Dernier fichier : ${syncLastPath}` : ''}`
                  : "Relier un dossier de votre Finder Mac pour une double sauvegarde automatique"
              }
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${syncFolderName ? 'bg-emerald-500 animate-pulse' : 'bg-sky-500'}`}></span>
              <FolderSync className={`w-3.5 h-3.5 shrink-0 ${syncFolderName ? 'text-emerald-600' : 'text-sky-600'}`} />
              <span className="hidden lg:inline">
                {syncFolderName ? '✓ Sauvegardé Mac' : 'Finder Mac'}
              </span>
              {syncFolderName && (
                <span className="hidden 2xl:inline max-w-[130px] truncate text-emerald-700 font-medium">
                  ({syncFolderName})
                </span>
              )}
            </button>

            {/* Firebase Firestore Cloud Sync Button */}
            <button
              type="button"
              onClick={handleOpenCloudModal}
              className={`flex items-center space-x-1.5 px-2 lg:px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                cloudStatus?.hasCloudData
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
              title={
                cloudStatus?.hasCloudData
                  ? `Base Firebase synchronisée (${cloudStatus.totalMissions} dossiers, ${cloudStatus.totalInvoices} factures)`
                  : 'Configurer la sauvegarde cloud Firebase Firestore'
              }
            >
              <Cloud className={`w-3.5 h-3.5 shrink-0 ${cloudStatus?.hasCloudData ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span className="hidden xl:inline">
                {cloudStatus?.hasCloudData ? 'Firebase OK' : 'Firebase'}
              </span>
            </button>

            {/* User authentication */}
            {user ? (
              <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-1 pr-1.5">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Utilisateur'} className="w-7 h-7 rounded-md object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-[#0f3854] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {user.email ? user.email.slice(0, 2).toUpperCase() : 'VP'}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  title="Déconnexion"
                  className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenCloudModal}
                disabled={authLoading}
                className="inline-flex items-center space-x-1.5 px-2 py-1.5 lg:px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Connexion à votre espace sécurisé"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="hidden 2xl:inline">{authLoading ? 'Connexion...' : 'Connexion'}</span>
              </button>
            )}

            {/* AI Assistant Button */}
            <button
              onClick={onOpenAssistant}
              className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1.5 lg:py-2 rounded-lg border border-cyan-300 bg-cyan-50/90 hover:bg-cyan-100 text-cyan-900 text-xs font-bold transition-all shadow-xs active:scale-95 whitespace-nowrap shrink-0"
              title="Rocco — Votre Assistant IA dévoué"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-700 animate-pulse shrink-0" />
              <span>Rocco</span>
            </button>

            {/* Quick Add Button */}
            <button
              onClick={onOpenQuickAdd}
              className="hidden sm:inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>
                Pointer<span className="hidden lg:inline"> / Ajouter</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Synchronisation Dossier Local Mac / Finder & Astuce Dock */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <FolderSync className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Synchronisation Finder Mac & Triple Sauvegarde</h3>
                  <p className="text-xs text-slate-500">
                    Application · Base de Données Sécurisée · Dossiers Finder de votre Mac
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Diagnostic Navigateur Mac */}
            {currentBrowser === 'safari' && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-2">
                <div className="flex items-start space-x-2">
                  <span className="text-base">🍎</span>
                  <div>
                    <strong className="font-bold text-amber-900">Vous êtes actuellement sur Safari macOS</strong>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Par politique de sécurité stricte d'Apple, <strong>Safari bloque l'ouverture directe du sélecteur Finder</strong> pour écrire dans des sous-dossiers. C'est pour cela que rien ne s'ouvre au clic dans Safari.
                    </p>
                    <p className="text-[11px] text-amber-900 font-semibold mt-1">
                      👉 <strong>Solution 100% automatique :</strong> Ouvrez Rocco dans <strong>Google Chrome</strong> (ou Edge) sur votre Mac ! Chrome autorise la sélection de dossier Finder et écrit chaque pièce directement au bon endroit.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center space-x-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <span>{copiedLink ? '✓ Lien copié !' : "Copier le lien pour l'ouvrir dans Chrome"}</span>
                  </button>
                </div>
              </div>
            )}

            {insideIframe && (
              <div className="p-3 bg-sky-50 border border-sky-300 rounded-xl text-xs text-sky-950 space-y-2">
                <div className="flex items-start space-x-2">
                  <span className="text-base">🖥️</span>
                  <div>
                    <strong className="font-bold text-sky-900">Aperçu dans un cadre intégré (iframe)</strong>
                    <p className="text-[11px] text-sky-800 mt-0.5">
                      La sécurité du navigateur bloque le sélecteur Finder à l'intérieur d'un encadré. Ouvrez Rocco en plein écran dans un onglet dédié pour connecter le Finder :
                    </p>
                  </div>
                </div>
                <div className="pt-1">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 bg-white border border-sky-300 hover:bg-sky-100 text-sky-900 px-3 py-1 rounded-md text-xs font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ouvrir dans un onglet dédié (Plein écran)</span>
                  </a>
                </div>
              </div>
            )}

            {currentBrowser === 'chrome' && !insideIframe && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Google Chrome détecté :</strong> Votre navigateur supporte l'accès direct et l'écriture automatique dans vos dossiers du Finder macOS !
                </span>
              </div>
            )}

            {browserWarning && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                {browserWarning}
              </div>
            )}

            {syncSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Parfaitement synchronisé !</strong>
                  <p className="mt-0.5">{syncSuccessMsg}</p>
                </div>
              </div>
            )}

            {syncFolderName && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span>Dossier actif : <strong>{syncFolderName}</strong></span>
                    {syncLastPath && <span className="block text-[11px] text-emerald-700 font-mono">Dernière pièce écrite : {syncLastPath}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectSync}
                  className="text-rose-700 hover:underline font-semibold ml-2 cursor-pointer"
                >
                  Changer de dossier
                </button>
              </div>
            )}

            {/* Aperçu visuel de l'arborescence créée sur le Mac */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono space-y-1">
              <div className="text-emerald-400 font-sans font-bold text-xs mb-1">
                Arborescence miroir créée automatiquement dans votre Finder :
              </div>
              <div>📁 {syncFolderName || 'Rocco_VP_Expertise'}/</div>
              <div className="pl-4">├── 📁 <span className="text-sky-300 font-bold">01_Dossiers_Expertise/</span></div>
              <div className="pl-8">└── 📁 VP2026BF50/</div>
              <div className="pl-12 text-slate-300">├── Éléments de la mission/ · Contrats/ · Préjudice/</div>
              <div className="pl-12 text-slate-300">├── RCI-Photos/ · Opérations d'expertise/ · Rapports &amp; Courriers/</div>
              <div className="pl-12 text-purple-300">└── (Si Judiciaire : NAP/ · Rapport-Pré-rapport/ · Dires de partie 1/)</div>
              <div className="pl-4">└── 📁 <span className="text-amber-300 font-bold">02_Frais_Generaux_Compta/</span> (séparé du technique)</div>
              <div className="pl-8 text-slate-300">└── 📁 2026-11/ ➔ Justificatifs/ (notes de frais) + Factures_emises/</div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <FolderOpen className="w-4 h-4 text-[#0f3854]" />
                    <span>1. Connecter un dossier du Finder sur ce Mac</span>
                    {currentBrowser === 'chrome' && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Recommandé</span>}
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Sélectionnez votre dossier sur le Mac (dans Documents ou iCloud Drive) : Rocco y crée l'arborescence complète et y dépose chaque pièce par nature.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePickNativeFolder}
                  className="shrink-0 bg-[#0f3854] hover:bg-[#16496d] text-white px-3.5 py-2 rounded-lg font-semibold cursor-pointer shadow-xs"
                >
                  Choisir dans le Finder
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <Cloud className="w-4 h-4 text-emerald-600" />
                    <span>2. Téléchargement miroir (Safari)</span>
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Pour Safari : télécharge automatiquement chaque pièce et justificatif avec son étiquette de dossier vers vos Téléchargements.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEnableAutoMirror}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-semibold cursor-pointer shadow-xs"
                >
                  Activer
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <Download className="w-4 h-4 text-slate-700" />
                    <span>3. Télécharger toute l'archive Finder (.zip)</span>
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Récupère l'intégralité des 6 volets de tous les dossiers et la Compta en un seul fichier ZIP prêt à décompresser dans le Finder.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const stateRes = await fetch('/api/sync/export-state');
                      if (stateRes.ok) {
                        const st = await stateRes.json();
                        const allFiles = [
                          ...(st.documents || []).map((d: any) => d.filename),
                          ...(st.photos || []).map((p: any) => p.filename),
                          ...(st.issued_reports || []).map((r: any) => r.filename),
                          ...(st.expenses || []).map((e: any) => e.receipt_filename),
                          ...(st.accounting_entries || []).map((a: any) => a.receipt_filename),
                        ];
                        await restoreMissingUploadsToServer(allFiles);
                      }
                    } catch {
                      // Proceed with server-side zip even if offline
                    }
                    const a = document.createElement('a');
                    a.href = '/api/sync/export-zip';
                    a.download = 'Rocco_VP_Expertise_Mac.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="shrink-0 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 px-3.5 py-2 rounded-lg font-semibold shadow-xs cursor-pointer"
                >
                  Télécharger .zip
                </button>
              </div>

              {/* Astuce Dock Mac */}
              <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200 text-sky-900 flex items-start space-x-2.5">
                <Laptop className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Astuce Pro Mac : ajouter Rocco dans le Dock</span>
                  <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
                    Dans Google Chrome sur votre Mac, cliquez sur les <strong>3 petits points en haut à droite › Enregistrer et partager › Installer Rocco</strong>. Rocco deviendra une véritable application autonome de bureau dans votre Dock avec accès direct au Finder !
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Base de Données Cloud Firebase Firestore */}
      {showCloudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0f3854]">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Espace Cloud VP Expertise (Firebase)</h3>
                  <p className="text-xs text-slate-500">
                    Base partagée et sécurisée du cabinet (valentine.pecheux@vpexpertise.com)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!user ? (
              <div className="space-y-4 text-xs">
                <form onSubmit={handleEmailLogin} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="font-semibold text-slate-800">
                    Connectez-vous avec votre accès cabinet pour synchroniser automatiquement vos dossiers et pièces :
                  </p>
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="valentine.pecheux@vpexpertise.com"
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0f3854]"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Mot de passe"
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0f3854]"
                      />
                    </div>
                  </div>
                  {authFeedback && (
                    <div className={`p-2.5 rounded-lg border text-[11px] ${authFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                      {authFeedback.text}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="inline-flex items-center space-x-2 bg-[#0f3854] hover:bg-[#16496d] disabled:opacity-60 text-white px-4 py-2 rounded-lg font-semibold cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{authLoading ? 'Connexion...' : 'Se connecter'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={handlePasswordReset}
                      className="text-[11px] text-[#0f3854] hover:underline font-medium cursor-pointer"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                </form>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span>ou connexion administrateur</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={authLoading}
                  className="w-full inline-flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 px-4 py-2 rounded-xl font-semibold cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-slate-600" />
                  <span>Continuer avec Google</span>
                </button>
              </div>
            ) : !user.emailVerified && isAuthorizedCabinetEmail(user.email) ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs text-amber-900">
                <p className="font-bold">Dernière étape : confirmer {user.email}</p>
                <p>
                  Par sécurité, Firebase demande une confirmation unique de votre adresse e-mail avant d’ouvrir l’accès aux données du cabinet.
                </p>
                {authFeedback && (
                  <div className={`p-2.5 rounded-lg border text-[11px] ${authFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                    {authFeedback.text}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={handleSendVerificationEmail}
                    className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-3.5 py-2 rounded-lg font-semibold cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Envoyer le lien de confirmation</span>
                  </button>
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={handleRefreshVerification}
                    className="inline-flex items-center space-x-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 px-3.5 py-2 rounded-lg font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>J’ai validé — Actualiser</span>
                  </button>
                </div>
              </div>
            ) : cloudStatus && !cloudStatus.authorized ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-xs text-rose-900">
                <p className="font-bold">Compte non autorisé ({user.email})</p>
                <p>
                  L’accès à la base Firebase VP Expertise est strictement réservé à <strong>valentine.pecheux@vpexpertise.com</strong> (et à l’administrateur). Déconnectez-vous puis reconnectez-vous avec votre accès cabinet.
                </p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center space-x-1.5 bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className={`p-3.5 rounded-xl border ${cloudStatus?.hasCloudData ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                  <div className="font-bold flex items-center space-x-1.5">
                    <CheckCircle2 className={`w-4 h-4 ${cloudStatus?.hasCloudData ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <span>
                      {cloudStatus?.hasCloudData
                        ? `Cloud VP Expertise synchronisé (${user.email})`
                        : `Espace Cloud prêt à être initialisé (${user.email})`}
                    </span>
                  </div>
                  {cloudStatus?.hasCloudData ? (
                    <p className="mt-1 text-[11px]">
                      {cloudStatus.totalMissions} dossiers · {cloudStatus.totalInvoices} factures · {cloudStatus.totalAccountingEntries} écritures compta · {cloudStatus.totalReportDrafts} rapports
                      {cloudStatus.updatedAt ? ` — Dernière synchro : ${new Date(cloudStatus.updatedAt).toLocaleString('fr-FR')}` : ''}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px]">
                      Cliquez ci-dessous pour enregistrer l’état complet du cabinet dans l’espace partagé Firebase. Toutes les modifications futures seront ensuite synchronisées automatiquement en arrière-plan.
                    </p>
                  )}
                </div>

                {cloudFeedback && (
                  <div className={`p-3 rounded-xl border text-xs ${cloudFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                    {cloudFeedback.text}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={cloudBusy}
                    onClick={handlePushToFirestore}
                    className="w-full inline-flex items-center justify-center space-x-2 bg-[#0f3854] hover:bg-[#16496d] disabled:opacity-60 text-white px-4 py-2.5 rounded-xl font-semibold cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{cloudBusy ? 'Synchronisation en cours...' : 'Synchroniser maintenant vers le Cloud'}</span>
                  </button>

                  {cloudStatus?.hasCloudData && (
                    <button
                      type="button"
                      disabled={cloudBusy}
                      onClick={handleReloadFromFirestore}
                      className="w-full inline-flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 px-4 py-2 rounded-xl font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Recharger la base depuis le Cloud</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
