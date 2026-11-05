import React, { useState, useEffect } from 'react';
import { Calendar, FolderKanban, Receipt, Calculator, Plus, Cloud, LogIn, LogOut, CheckCircle2, Sparkles, FolderSync, Download, ExternalLink, X, FolderOpen } from 'lucide-react';
import { auth, signInWithGoogle, logOut } from '../firebase.js';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getLocalSyncStatus, connectLocalMacFolder, disconnectLocalMacFolder, enableAutoDownloadSync } from '../utils/localFolderSync.js';

interface HeaderProps {
  activeTab: 'today' | 'missions' | 'billing' | 'compta';
  setActiveTab: (tab: 'today' | 'missions' | 'billing' | 'compta') => void;
  onOpenQuickAdd: () => void;
  onOpenAssistant: () => void;
  urgentCount?: number;
  unbilledTotal?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  onOpenAssistant,
  urgentCount = 0,
  unbilledTotal = 0,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [syncFolderName, setSyncFolderName] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [iframeWarning, setIframeWarning] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    const status = getLocalSyncStatus();
    setSyncFolderName(status.connected ? status.folderName : null);
    const onSyncChange = () => {
      const s = getLocalSyncStatus();
      setSyncFolderName(s.connected ? s.folderName : null);
    };
    window.addEventListener('vp-local-sync-changed', onSyncChange);
    return () => {
      unsubscribe();
      window.removeEventListener('vp-local-sync-changed', onSyncChange);
    };
  }, []);

  const handleToggleMacSync = () => {
    setIframeWarning(false);
    setShowSyncModal(true);
  };

  const handlePickNativeFolder = async () => {
    try {
      const res = await connectLocalMacFolder();
      if (res.iframeBlocked) {
        setIframeWarning(true);
        return;
      }
      if (res.connected) {
        setSyncFolderName(res.folderName);
        setShowSyncModal(false);
      }
    } catch {
      setIframeWarning(true);
    }
  };

  const handleEnableAutoMirror = () => {
    const res = enableAutoDownloadSync();
    setSyncFolderName(res.folderName);
    setShowSyncModal(false);
  };

  const handleDisconnectSync = async () => {
    await disconnectLocalMacFolder();
    setSyncFolderName(null);
  };

  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Erreur authentification Firebase:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error(err);
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
    { id: 'billing', label: 'Honoraires', icon: Receipt },
    { id: 'compta', label: 'Comptabilité', icon: Calculator },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-2 lg:gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer shrink-0" onClick={() => setActiveTab('today')}>
            <img src="/logo.png" alt="VP Expertise" className="h-9 w-9 object-contain rounded-md shrink-0" />
            <div className="shrink-0 flex flex-col justify-center">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 whitespace-nowrap">VP EXPERTISE</span>
                <span className="hidden 2xl:inline-block text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium whitespace-nowrap">Cabinet d'Ingénierie</span>
              </div>
              <p className="text-[11px] text-slate-500 hidden 2xl:block whitespace-nowrap">Mécanique & Matériels Ferroviaires — Valentine Pécheux</p>
            </div>
          </div>

          {/* Center Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold transition-colors whitespace-nowrap relative cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 pointer-events-none" />
                  <span className="pointer-events-none">{tab.label}</span>
                  {tab.badge && (
                    <span className={`ml-1 text-[10px] font-bold text-white px-1.5 py-0.2 rounded-full pointer-events-none ${tab.badgeColor}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Actions: Cloud Sync Status + Auth + Quick Add */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Cloud & Local Mac / iCloud Drive sync status indicator */}
            <button
              type="button"
              onClick={handleToggleMacSync}
              className={`flex items-center space-x-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                syncFolderName
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
              }`}
              title={
                syncFolderName
                  ? `Synchronisé avec votre dossier Mac / iCloud Drive « ${syncFolderName} » (cliquez pour changer de dossier)`
                  : "Cliquez pour relier un dossier de votre Mac (ex: iCloud Drive / VP Expertise) afin d'y enregistrer automatiquement toutes vos pièces et factures"
              }
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${syncFolderName ? 'bg-emerald-500 animate-pulse' : 'bg-sky-500'}`}></span>
              <FolderSync className={`w-3.5 h-3.5 shrink-0 ${syncFolderName ? 'text-emerald-600' : 'text-sky-600'}`} />
              <span className="hidden xl:inline">
                {syncFolderName ? `iCloud : ${syncFolderName}` : 'Lier dossier Mac / iCloud'}
              </span>
            </button>

            {/* User authentication */}
            {user ? (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1 pr-1.5 sm:pr-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Utilisateur'} className="w-7 h-7 rounded-md object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-[#0f3854] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {user.email ? user.email.slice(0, 2).toUpperCase() : 'VP'}
                  </div>
                )}
                <div className="hidden xl:block text-left">
                  <span className="block text-xs font-semibold text-slate-800 leading-tight truncate max-w-[100px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="block text-[10px] text-emerald-600 font-medium">Connecté</span>
                </div>
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
                onClick={handleLogin}
                disabled={authLoading}
                className="inline-flex items-center space-x-1.5 px-2 py-1.5 sm:px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors whitespace-nowrap"
                title="Connexion à votre espace sécurisé"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="hidden 2xl:inline">{authLoading ? 'Connexion...' : 'Espace sécurisé'}</span>
              </button>
            )}

            {/* AI Assistant Button (Desktop / Tablet) */}
            <button
              onClick={onOpenAssistant}
              className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg border border-cyan-300 bg-cyan-50/90 hover:bg-cyan-100 text-cyan-900 text-xs font-bold transition-all shadow-xs active:scale-95 whitespace-nowrap shrink-0"
              title="Rocco — Votre Assistant IA dévoué (Gemini Flash)"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-700 animate-pulse shrink-0" />
              <span>Rocco IA</span>
            </button>

            {/* Quick Add Button (Desktop / Tablet) */}
            <button
              onClick={onOpenQuickAdd}
              className="hidden sm:inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Saisie rapide</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Synchronisation Dossier Local Mac / iCloud Drive */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0f3854]">
                  <FolderSync className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Synchronisation Mac & iCloud Drive</h3>
                  <p className="text-xs text-slate-500">
                    Retrouvez toutes vos pièces, photos et factures Word rangées par dossier sur votre Mac
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {syncFolderName && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Synchronisation active : <strong>{syncFolderName}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectSync}
                  className="text-rose-700 hover:underline font-semibold ml-2"
                >
                  Déconnecter
                </button>
              </div>
            )}

            {iframeWarning && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                <p className="font-semibold">
                  L'aperçu intégré (iframe AI Studio) bloque l'ouverture directe du Finder macOS.
                </p>
                <p className="text-amber-800">
                  Vous pouvez soit <strong>activer la copie automatique ci-dessous</strong> (qui fonctionne immédiatement ici), soit ouvrir l'application dans un onglet dédié pour choisir directement un dossier du Finder :
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg font-semibold shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ouvrir dans un nouvel onglet plein écran</span>
                  </a>
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Option 1: Télécharger l'archive ZIP complète rangée par dossier */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <Download className="w-4 h-4 text-[#0f3854]" />
                  <span>1. Télécharger tous mes dossiers rangés pour iCloud Drive (.zip)</span>
                </div>
                <p className="text-slate-600">
                  Génère un dossier complet <code>VP_Expertise_iCloud</code> contenant chaque sous-dossier de mission (<code>VP2026728/Factures</code>, <code>Photos_Terrain</code>, <code>Documents_Pieces</code>) prêt à glisser dans votre iCloud Drive.
                </p>
                <a
                  href="/api/sync/export-zip"
                  download="VP_Expertise_iCloud_Dossiers.zip"
                  className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-3.5 py-2 rounded-lg font-semibold shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger mes dossiers iCloud (.zip)</span>
                </a>
              </div>

              {/* Option 2: Enregistrement automatique à chaque dépôt */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  <span>2. Copie automatique sur le Mac à chaque ajout (Universel / Safari)</span>
                </div>
                <p className="text-slate-600">
                  Dès que vous déposez une photo, un document ou que vous générez une facture Word dans l'application, une copie nommée avec le numéro de dossier (ex. <code>VP2026728__Factures__Facture_2026-099.docx</code>) s'enregistre automatiquement sur votre Mac.
                </p>
                <button
                  type="button"
                  onClick={handleEnableAutoMirror}
                  className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Activer la copie automatique sur mon Mac</span>
                </button>
              </div>

              {/* Option 3: Liaison directe d'un dossier Finder (Chrome / Edge hors iframe) */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <FolderOpen className="w-4 h-4 text-sky-600" />
                  <span>3. Relier directement un dossier du Finder (Chrome / URL directe)</span>
                </div>
                <p className="text-slate-600">
                  Si vous utilisez l'URL directe de l'application sur Google Chrome (hors aperçu AI Studio), sélectionnez votre dossier <code>iCloud Drive / VP Expertise</code> dans le Finder : l'application y créera les sous-dossiers toute seule.
                </p>
                <button
                  type="button"
                  onClick={handlePickNativeFolder}
                  className="inline-flex items-center space-x-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 px-3.5 py-2 rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#0f3854]" />
                  <span>Choisir mon dossier iCloud Drive dans le Finder...</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
