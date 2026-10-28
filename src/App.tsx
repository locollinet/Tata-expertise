import React, { useState, useEffect } from 'react';
import { Calendar, FolderKanban, Receipt, Calculator, Plus, Camera } from 'lucide-react';
import { Header } from './components/Header.js';
import { TodayView } from './views/TodayView.js';
import { MissionsView } from './views/MissionsView.js';
import { MissionDetailView } from './views/MissionDetailView.js';
import { BillingView } from './views/BillingView.js';
import { ComptaView } from './views/ComptaView.js';
import { QuickAddModal } from './components/QuickAddModal.js';
import { CreateMissionModal } from './components/CreateMissionModal.js';
import { Mission, DashboardSummary } from '@shared/types.js';
import { api } from './api.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'today' | 'missions' | 'billing' | 'compta'>('today');
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [billingPreselectedCode, setBillingPreselectedCode] = useState<string | undefined>(undefined);

  const [missions, setMissions] = useState<Mission[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Deep linking via URL query parameters (e.g. ?tab=missions&mission=m-vp2026922)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as 'today' | 'missions' | 'billing' | 'compta' | null;
    const missionId = params.get('mission');
    if (tab && ['today', 'missions', 'billing', 'compta'].includes(tab)) {
      setActiveTab(tab);
    }
    if (missionId) {
      setSelectedMissionId(missionId);
      setActiveTab('missions');
    }
  }, []);

  // Modals
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDefaultMissionId, setQuickAddDefaultMissionId] = useState<string | undefined>(undefined);
  const [isCreateMissionOpen, setIsCreateMissionOpen] = useState(false);

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

  const handleOpenQuickAdd = (missionId?: string) => {
    setQuickAddDefaultMissionId(missionId);
    setIsQuickAddOpen(true);
  };

  const handleNavigateToMission = (codeOrId: string) => {
    const target = (codeOrId || '').trim().toLowerCase();
    const found = missions.find(m => 
      m.code.toLowerCase() === target || 
      m.id.toLowerCase() === target ||
      (m.case_reference && m.case_reference.toLowerCase() === target)
    );
    if (found) {
      setSelectedMissionId(found.id);
    }
    setActiveTab('missions');
  };

  const handleNavigateToBilling = (missionCode?: string) => {
    setBillingPreselectedCode(missionCode);
    setActiveTab('billing');
    setSelectedMissionId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'missions') setSelectedMissionId(null);
        }}
        onOpenQuickAdd={() => handleOpenQuickAdd()}
        urgentCount={summary?.urgent_actions?.length || 0}
        unbilledTotal={summary?.total_unbilled_ht || 0}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
        {activeTab === 'today' && (
          <TodayView
            summary={summary}
            loading={loading}
            onNavigateToMission={handleNavigateToMission}
            onNavigateToBilling={handleNavigateToBilling}
            onOpenQuickAdd={() => handleOpenQuickAdd()}
            onNavigateToMissions={() => { setActiveTab('missions'); setSelectedMissionId(null); }}
            onNavigateToCompta={() => { setActiveTab('compta'); setSelectedMissionId(null); }}
          />
        )}

        {activeTab === 'missions' && (
          selectedMissionId ? (
            <MissionDetailView
              missionId={selectedMissionId}
              onBack={() => {
                setSelectedMissionId(null);
                refreshData();
              }}
              onOpenQuickAdd={(mId) => handleOpenQuickAdd(mId)}
              onPrepareBilling={(mId) => {
                const m = missions.find(x => x.id === mId);
                handleNavigateToBilling(m?.code);
              }}
            />
          ) : (
            <MissionsView
              missions={missions}
              onSelectMission={(m) => setSelectedMissionId(m.id)}
              onOpenCreateMission={() => setIsCreateMissionOpen(true)}
            />
          )
        )}

        {activeTab === 'billing' && (
          <BillingView
            missions={missions}
            initialMissionCode={billingPreselectedCode}
            onRefreshMissions={refreshData}
          />
        )}

        {activeTab === 'compta' && (
          <ComptaView />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Ergonomie Smartphone / Terrain) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
        <button
          type="button"
          onClick={() => { setActiveTab('today'); setSelectedMissionId(null); }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
            activeTab === 'today' ? 'text-[#0f3854]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Calendar className="w-5 h-5" />
            {(summary?.urgent_actions?.length || 0) > 0 && (
              <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {summary?.urgent_actions?.length}
              </span>
            )}
          </div>
          <span className="mt-0.5">Aujourd'hui</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('missions'); setSelectedMissionId(null); }}
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
          <span className="text-[10px] font-bold text-[#0f3854] mt-0.5">Flash</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('billing'); setSelectedMissionId(null); }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
            activeTab === 'billing' ? 'text-[#0f3854]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Receipt className="w-5 h-5" />
            {(summary?.total_unbilled_ht || 0) >= 3500 && (
              <span className="absolute -top-1 -right-2 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
            )}
          </div>
          <span className="mt-0.5">Honoraires</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('compta'); setSelectedMissionId(null); }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
            activeTab === 'compta' ? 'text-[#0f3854]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="w-5 h-5" />
          <span className="mt-0.5">Compta</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-400">
        <p>VP EXPERTISE — Cabinet d'Ingénierie Mécanique & Matériels Ferroviaires • Application Locale Conforme</p>
      </footer>

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
        onClose={() => setIsCreateMissionOpen(false)}
        onSuccess={(newId) => {
          refreshData();
          setSelectedMissionId(newId);
          setActiveTab('missions');
        }}
      />
    </div>
  );
}

export default App;
