import React, { useState, useEffect } from 'react';
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

  const handleNavigateToMission = (code: string) => {
    const found = missions.find(m => m.code === code);
    if (found) {
      setSelectedMissionId(found.id);
      setActiveTab('missions');
    }
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

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
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
