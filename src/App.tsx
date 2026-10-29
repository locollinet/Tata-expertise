import React, { useState, useEffect } from 'react';
import { Calendar, FolderKanban, Receipt, Calculator, Plus, Camera, Sparkles } from 'lucide-react';
import { Header } from './components/Header.js';
import { TodayView } from './views/TodayView.js';
import { MissionsView } from './views/MissionsView.js';
import { MissionDetailView } from './views/MissionDetailView.js';
import { BillingView } from './views/BillingView.js';
import { ComptaView } from './views/ComptaView.js';
import { QuickAddModal } from './components/QuickAddModal.js';
import { CreateMissionModal } from './components/CreateMissionModal.js';
import { AIAssistantDrawer } from './components/AIAssistantDrawer.js';
import { Mission, DashboardSummary } from '@shared/types.js';
import { api } from './api.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'today' | 'missions' | 'billing' | 'compta'>('today');
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [sourceTab, setSourceTab] = useState<'today' | 'missions' | 'billing'>('missions');
  const [billingPreselectedCode, setBillingPreselectedCode] = useState<string | undefined>(undefined);

  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsCache, setMissionsCache] = useState<Record<string, any>>({});
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync browser URL & history without full page reload
  const updateURL = (tab: string, missionId?: string | null, replace = false) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (missionId && tab === 'missions') {
        url.searchParams.set('mission', missionId);
      } else {
        url.searchParams.delete('mission');
      }
      if (replace) {
        window.history.replaceState({ tab, missionId }, '', url.toString());
      } else {
        window.history.pushState({ tab, missionId }, '', url.toString());
      }
    } catch (_) {}
  };

  // Deep linking via URL query parameters & browser Back button support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as 'today' | 'missions' | 'billing' | 'compta' | null;
    const missionId = params.get('mission');
    const assistant = params.get('assistant');
    if (tab && ['today', 'missions', 'billing', 'compta'].includes(tab)) {
      setActiveTab(tab);
    }
    if (missionId) {
      setSelectedMissionId(missionId);
      setActiveTab('missions');
    }
    if (assistant === 'open' || assistant === 'true' || assistant === '1') {
      setIsAssistantOpen(true);
    }

    const handlePopState = (e: PopStateEvent) => {
      const p = new URLSearchParams(window.location.search);
      const curTab = (p.get('tab') as any) || e.state?.tab || 'today';
      const curMission = p.get('mission') || e.state?.missionId || null;
      setActiveTab(curTab);
      setSelectedMissionId(curMission);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Modals & Drawers
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDefaultMissionId, setQuickAddDefaultMissionId] = useState<string | undefined>(undefined);
  const [isCreateMissionOpen, setIsCreateMissionOpen] = useState(false);
  const [createMissionInitialData, setCreateMissionInitialData] = useState<any>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const refreshData = async () => {
    try {
      const [missionsData, dashboardData] = await Promise.all([
        api.getMissions(),
        api.getDashboard(),
      ]);
      setMissions(missionsData);
      setSummary(dashboardData);
    } catch (err) {
      console.error("Erreur de chargement des données :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Prefetch mission details silently in the background so opening any folder is 100% instantaneous
  useEffect(() => {
    if (missions.length > 0) {
      const timer = setTimeout(() => {
        missions.forEach((m) => {
          if (!missionsCache[m.id]) {
            api.getMission(m.id).then((full) => {
              setMissionsCache(prev => ({
                ...prev,
                [full.id]: full,
                [full.code.toLowerCase()]: full,
              }));
            }).catch(() => {});
          }
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [missions]);

  const handleOpenQuickAdd = (missionId?: string) => {
    setQuickAddDefaultMissionId(missionId);
    setIsQuickAddOpen(true);
  };

  const handleNavigateToMission = (codeOrId: string, origin?: 'today' | 'missions' | 'billing') => {
    const target = (codeOrId || '').trim().toLowerCase();
    const found = missions.find(m => 
      m.code.toLowerCase() === target || 
      m.id.toLowerCase() === target ||
      (m.case_reference && m.case_reference.toLowerCase() === target)
    );
    const mId = found ? found.id : codeOrId;
    setSelectedMissionId(mId);
    setSourceTab(origin || (activeTab === 'missions' ? 'missions' : activeTab as any));
    setActiveTab('missions');
    updateURL('missions', found ? found.code : mId);
  };

  const handleNavigateToBilling = (missionCode?: string) => {
    setBillingPreselectedCode(missionCode);
    setActiveTab('billing');
    setSelectedMissionId(null);
    updateURL('billing', null);
  };

  const handleTabChange = (tab: 'today' | 'missions' | 'billing' | 'compta') => {
    setActiveTab(tab);
    if (tab !== 'missions') {
      setSelectedMissionId(null);
      updateURL(tab, null);
    } else {
      updateURL('missions', selectedMissionId);
    }
  };

  const handleBackFromMission = () => {
    if (sourceTab === 'today') {
      setActiveTab('today');
      setSelectedMissionId(null);
      updateURL('today', null);
    } else if (sourceTab === 'billing') {
      setActiveTab('billing');
      setSelectedMissionId(null);
      updateURL('billing', null);
    } else {
      setSelectedMissionId(null);
      setActiveTab('missions');
      updateURL('missions', null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenQuickAdd={() => handleOpenQuickAdd()}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        urgentCount={summary?.urgent_actions?.length || 0}
        unbilledTotal={summary?.total_unbilled_ht || 0}
      />

      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-28 md:pb-8">
        {activeTab === 'today' && (
          <TodayView
            summary={summary}
            loading={loading}
            onNavigateToMission={(code) => handleNavigateToMission(code, 'today')}
            onNavigateToBilling={handleNavigateToBilling}
            onOpenQuickAdd={() => handleOpenQuickAdd()}
            onNavigateToMissions={() => handleTabChange('missions')}
            onNavigateToCompta={() => handleTabChange('compta')}
          />
        )}

        {activeTab === 'missions' && (
          selectedMissionId ? (
            <MissionDetailView
              key={selectedMissionId}
              missionId={selectedMissionId}
              sourceTab={sourceTab}
              initialMission={
                missionsCache[selectedMissionId] ||
                missions.find(m => m.id === selectedMissionId || m.code.toLowerCase() === selectedMissionId.toLowerCase())
              }
              onCacheMission={(fullData) => {
                setMissionsCache(prev => ({
                  ...prev,
                  [fullData.id]: fullData,
                  [fullData.code.toLowerCase()]: fullData,
                }));
              }}
              onBack={handleBackFromMission}
              onOpenQuickAdd={(mId) => handleOpenQuickAdd(mId)}
              onPrepareBilling={(mId) => {
                const m = missions.find(x => x.id === mId) || missionsCache[mId];
                handleNavigateToBilling(m?.code);
              }}
            />
          ) : (
            <MissionsView
              missions={missions}
              onSelectMission={(m) => {
                setSelectedMissionId(m.id);
                setSourceTab('missions');
                updateURL('missions', m.code);
              }}
              onOpenCreateMission={() => setIsCreateMissionOpen(true)}
            />
          )
        )}

        {activeTab === 'billing' && (
          <BillingView
            missions={missions}
            initialMissionCode={billingPreselectedCode}
            onRefreshMissions={refreshData}
            onNavigateToMission={(code) => handleNavigateToMission(code, 'billing')}
          />
        )}

        {activeTab === 'compta' && (
          <ComptaView />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Ergonomie Smartphone / Terrain) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg">
        <button
          type="button"
          onClick={() => handleTabChange('today')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
            activeTab === 'today' ? 'text-[#0f3854]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Calendar className="w-5 h-5" />
            {(summary?.urgent_actions?.length || 0) > 0 && (
              <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-slate-200 text-slate-700 rounded-full text-[9px] flex items-center justify-center font-bold">
                {summary?.urgent_actions?.length}
              </span>
            )}
          </div>
          <span className="mt-0.5">Aujourd'hui</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('missions')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
            activeTab === 'missions' ? 'text-[#0f3854]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderKanban className="w-5 h-5" />
          <span className="mt-0.5">Dossiers</span>
        </button>

        {/* Central Floating Quick Action Button for Mobile / Field */}
        <button
          type="button"
          onClick={() => handleOpenQuickAdd()}
          className="flex flex-col items-center justify-center -mt-5"
          title="Pointage flash & Photo terrain"
        >
          <div className="w-12 h-12 rounded-full bg-[#0f3854] text-white flex items-center justify-center shadow-md active:scale-95 transition-transform border-2 border-white">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-[#0f3854] mt-0.5">Terrain</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('billing')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
            activeTab === 'billing' ? 'text-[#0f3854]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Receipt className="w-5 h-5" />
          </div>
          <span className="mt-0.5">Honoraires</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAssistantOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
            isAssistantOpen ? 'text-cyan-700 font-bold' : 'text-slate-500 hover:text-cyan-800'
          }`}
        >
          <Sparkles className="w-5 h-5 text-cyan-600 animate-pulse" />
          <span className="mt-0.5">Assistant</span>
        </button>
      </nav>

      {/* Footer (Desktop) */}
      <footer className="hidden md:block border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-400">
        <p>VP EXPERTISE — Cabinet d'Ingénierie Mécanique & Matériels Ferroviaires • Application Locale Conforme</p>
      </footer>

      {/* Floating AI Assistant Trigger Button (Desktop / Tablet uniquement) */}
      <button
        type="button"
        onClick={() => setIsAssistantOpen(true)}
        className="hidden md:flex fixed bottom-6 right-6 z-30 bg-slate-900 hover:bg-slate-800 text-cyan-400 p-3 sm:p-3.5 rounded-full shadow-xl border border-cyan-500/30 hover:scale-105 active:scale-95 transition-all items-center space-x-2 group cursor-pointer"
        title="Assistant IA VP Expertise (Gemini Flash)"
      >
        <Sparkles className="w-5 h-5 animate-pulse text-cyan-400 group-hover:rotate-12 transition-transform" />
        <span className="hidden lg:inline text-xs font-bold text-white pr-1">Assistant IA</span>
      </button>

      {/* AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        selectedMissionId={selectedMissionId}
        missions={missions}
        onNavigateToMission={handleNavigateToMission}
        onOpenCreateMissionWithData={(data) => {
          setCreateMissionInitialData(data);
          setIsCreateMissionOpen(true);
        }}
        onRefreshData={refreshData}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        missions={missions}
        defaultMissionId={quickAddDefaultMissionId}
        onSuccess={refreshData}
      />

      {/* Create Mission Modal */}
      <CreateMissionModal
        isOpen={isCreateMissionOpen}
        initialValues={createMissionInitialData}
        onClose={() => {
          setIsCreateMissionOpen(false);
          setCreateMissionInitialData(null);
        }}
        onSuccess={(newId) => {
          refreshData();
          setSelectedMissionId(newId);
          setActiveTab('missions');
          setCreateMissionInitialData(null);
        }}
      />
    </div>
  );
}

export default App;
