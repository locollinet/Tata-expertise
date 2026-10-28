import React, { useState, useEffect } from 'react';
import { Calendar, FolderKanban, Receipt, Calculator, Plus, Cloud, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { auth, signInWithGoogle, logOut } from '../firebase.js';
import { onAuthStateChanged, User } from 'firebase/auth';

interface HeaderProps {
  activeTab: 'today' | 'missions' | 'billing' | 'compta';
  setActiveTab: (tab: 'today' | 'missions' | 'billing' | 'compta') => void;
  onOpenQuickAdd: () => void;
  urgentCount?: number;
  unbilledTotal?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickAdd,
  urgentCount = 0,
  unbilledTotal = 0,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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
    { id: 'today', label: "Aujourd'hui", icon: Calendar, badge: urgentCount > 0 ? urgentCount : undefined, badgeColor: 'bg-amber-500' },
    { id: 'missions', label: 'Dossiers', icon: FolderKanban },
    { id: 'billing', label: 'Honoraires', icon: Receipt, badge: unbilledTotal > 3500 ? 'Rappel' : undefined, badgeColor: 'bg-rose-500' },
    { id: 'compta', label: 'Comptabilité', icon: Calculator },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('today')}>
            <img src="/logo.png" alt="VP Expertise" className="h-10 w-10 object-contain rounded-md" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">VP EXPERTISE</span>
                <span className="hidden sm:inline-block text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">Cabinet d'Ingénierie</span>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">Mécanique & Matériels Ferroviaires — Valentine Pécheux</p>
            </div>
          </div>

          {/* Center Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`ml-1 text-[10px] font-bold text-white px-1.5 py-0.2 rounded-full ${tab.badgeColor}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Actions: Firebase Cloud Status + Auth + Quick Add */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Cloud sync status indicator */}
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg text-xs font-medium">
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              <span>Firebase Cloud</span>
            </div>

            {/* User authentication */}
            {user ? (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-1 pr-2.5">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Utilisateur'} className="w-7 h-7 rounded-md object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-[#0f3854] text-white flex items-center justify-center text-xs font-bold">
                    {user.email ? user.email.slice(0, 2).toUpperCase() : 'VP'}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <span className="block text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
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
                className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-500" />
                <span>{authLoading ? 'Connexion...' : 'Connexion Google'}</span>
              </button>
            )}

            {/* Quick Add Button */}
            <button
              onClick={onOpenQuickAdd}
              className="inline-flex items-center space-x-1 sm:space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium shadow-2xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">+ Saisie rapide</span>
              <span className="sm:hidden text-xs">Saisie</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex overflow-x-auto py-2 space-x-1 border-t border-slate-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`ml-1 text-[9px] font-bold text-white px-1 rounded-full ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
