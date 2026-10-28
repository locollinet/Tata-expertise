import React, { useState } from 'react';
import { Search, Plus, FolderKanban, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { Mission } from '@shared/types.js';

interface MissionsViewProps {
  missions: Mission[];
  onSelectMission: (mission: Mission) => void;
  onOpenCreateMission: () => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({
  missions,
  onSelectMission,
  onOpenCreateMission,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredMissions = missions.filter((m) => {
    const matchesSearch =
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.case_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.insurance_client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.insured_party && m.insured_party.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_cours':
        return <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 rounded-full text-xs font-medium">En cours</span>;
      case 'attente_pieces':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-medium">Attente pièces</span>;
      case 'rapport_remis':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full text-xs font-medium">Rapport remis</span>;
      case 'cloture':
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full text-xs font-medium">Clôturé</span>;
      default:
        return <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded text-xs">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FolderKanban className="w-6 h-6 text-[#0f3854]" />
            <span>Portefeuille de Dossiers</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {missions.length} dossier{missions.length > 1 ? 's' : ''} au registre — Saisie du temps, rapports et honoraires
          </p>
        </div>

        <button
          onClick={onOpenCreateMission}
          className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-4 py-2 rounded-lg text-xs font-medium shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau dossier</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par référence, code VP, affaire, assureur ou assuré..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border-slate-200 focus:border-[#0f3854] focus:ring-[#0f3854] bg-slate-50/50"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'en_cours', label: 'En cours' },
            { id: 'attente_pieces', label: 'Attente pièces' },
            { id: 'rapport_remis', label: 'Rapport remis' },
            { id: 'cloture', label: 'Clôturé' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mission Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMissions.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
            <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold">Aucun dossier trouvé</p>
            <p className="text-xs text-slate-400 mt-1">Modifiez vos termes de recherche ou créez un nouveau dossier.</p>
          </div>
        ) : (
          filteredMissions.map((mission) => {
            const hasBillingMilestone = (mission.total_unbilled_ht || 0) >= (mission.custom_billing_threshold || 3500);
            return (
              <div
                key={mission.id}
                onClick={() => onSelectMission(mission)}
                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-[#0f3854] bg-[#0f3854]/10 px-2 py-0.5 rounded">
                        {mission.code}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">Réf : {mission.case_reference}</span>
                    </div>
                    {getStatusBadge(mission.status)}
                  </div>

                  <h3 className="font-semibold text-slate-900 text-sm leading-snug group-hover:text-[#0f3854] transition-colors">
                    {mission.title}
                  </h3>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assureur / Client</span>
                      <span className="font-medium text-slate-800">{mission.insurance_client}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assuré / Partie</span>
                      <span className="font-medium text-slate-800">{mission.insured_party || "—"}</span>
                    </div>
                  </div>

                  {mission.next_action && (
                    <div className="mt-3 p-2 bg-slate-50 rounded-lg text-xs text-slate-700 flex items-start space-x-2">
                      <span className="font-semibold text-slate-500 shrink-0">Prochaine action :</span>
                      <span className="truncate">{mission.next_action}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer : Unbilled & Deadline info */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700">
                      {(mission.unbilled_hours || 0).toFixed(1).replace('.', ',')} h en cours
                    </span>
                    {(mission.total_unbilled_ht || 0) > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        hasBillingMilestone ? 'bg-sky-50 text-[#0f3854] border border-sky-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {(mission.total_unbilled_ht || 0).toFixed(2).replace('.', ',')} € HT
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-medium text-[#0f3854] flex items-center group-hover:translate-x-1 transition-transform">
                    <span>Ouvrir</span>
                    <ChevronRight className="w-4 h-4 ml-0.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
