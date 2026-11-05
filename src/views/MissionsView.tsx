import React, { useState } from 'react';
import { Search, Plus, FolderKanban, ChevronRight, Clock, TrendingUp, Users, Receipt, Paperclip } from 'lucide-react';
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
  const [includeClosed, setIncludeClosed] = useState<boolean>(false);

  const q = searchTerm.trim().toLowerCase();
  const pieceMatch = q.match(/pi[eè]ce\s*n?[°o]?\s*(\d+)/i);
  const searchedPieceNum = pieceMatch ? Number(pieceMatch[1]) : null;

  const filteredMissions = missions.filter((m: any) => {
    if (!includeClosed && statusFilter !== 'cloture' && m.status === 'cloture') {
      return false;
    }
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    if (!matchesStatus) return false;
    if (!q) return true;

    const advStr = (m.adverse_parties || [])
      .map((p: any) => `${p.party_name || ''} ${p.expert_firm || ''} ${p.expert_name || ''} ${p.lawyer_name || ''}`)
      .join(' ')
      .toLowerCase();

    const hay = `${m.code} ${m.title} ${m.case_reference} ${m.insurance_client} ${m.client_contact || ''} ${m.insured_party || ''} ${m.insured_reference || ''} ${m.broker_name || ''} ${m.broker_reference || ''} ${m.third_parties || ''} ${advStr}`.toLowerCase();

    if (hay.includes(q)) return true;
    if (searchedPieceNum !== null) return true; // Let user open dossier or see matched pieces
    return false;
  });

  const formatStake = (amount?: number | null) => {
    if (!amount) return null;
    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M€`;
    }
    return `${amount.toLocaleString('fr-FR')} €`;
  };

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
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FolderKanban className="w-6 h-6 text-[#0f3854]" />
            <span>Mes Dossiers d'Expertise</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cliquez sur un dossier pour ouvrir sa <strong>Page de garde</strong> (File Register) et ses 6 volets synchronisés Mac
          </p>
        </div>

        <button
          onClick={onOpenCreateMission}
          className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ouvrir un nouveau dossier</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par N/Réf. (VP...), Client, Réf. client, Assuré, Confrère (ex: Saretec, Pechereau) ou « Pièce 2 »..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:border-[#0f3854] focus:ring-[#0f3854] bg-slate-50/50"
            />
          </div>

          <label className="inline-flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none px-2">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
              className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
            />
            <span>Inclure les dossiers clos / archivés</span>
          </label>
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'Tous les dossiers actifs' },
            { id: 'en_cours', label: 'En cours' },
            { id: 'attente_pieces', label: 'Attente pièces' },
            { id: 'rapport_remis', label: 'Rapport remis' },
            { id: 'cloture', label: 'Clôturés' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#0f3854] text-white'
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
            <p className="text-sm font-semibold">Aucun dossier correspondant</p>
            <p className="text-xs text-slate-400 mt-1">Modifiez votre recherche ou cochez « Inclure les dossiers clos ».</p>
          </div>
        ) : (
          filteredMissions.map((mission: any) => {
            const hasBillingMilestone = (mission.total_unbilled_ht || 0) >= (mission.custom_billing_threshold || 3500);
            const stakeFormatted = formatStake(mission.stake_amount);
            const advParties: any[] = Array.isArray(mission.adverse_parties) ? mission.adverse_parties : [];

            return (
              <div
                key={mission.id}
                onClick={() => onSelectMission(mission)}
                className="bg-white p-5 rounded-xl border border-slate-200 hover:border-[#0f3854]/40 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar : N/Réf, V/Réf, Enjeu, Statut */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-[#0f3854] bg-[#0f3854]/10 px-2.5 py-0.5 rounded">
                        {mission.code}
                      </span>
                      <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                        Réf. client : {mission.case_reference}
                      </span>
                      {stakeFormatted && (
                        <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          <TrendingUp className="w-3 h-3 text-amber-600" />
                          <span>Enjeu : {stakeFormatted}</span>
                        </span>
                      )}
                    </div>
                    {getStatusBadge(mission.status)}
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-[#0f3854] transition-colors">
                    {mission.title}
                  </h3>

                  {/* Parties Grid : Client, Assuré, Courtier, Confrères */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Client (facturé)</span>
                      <span className="font-semibold text-slate-900">{mission.insurance_client}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assuré</span>
                      <span className="font-medium text-slate-800">{mission.insured_party || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Courtier</span>
                      <span className="font-medium text-slate-700">{mission.broker_name || '—'}</span>
                    </div>
                  </div>

                  {/* Confrères / Parties adverses */}
                  {advParties.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-start space-x-1.5 text-[11px] text-slate-600">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="truncate">
                        <span className="font-semibold text-slate-500">En face : </span>
                        {advParties.map((p, idx) => (
                          <span key={p.id || idx}>
                            {idx > 0 && ' · '}
                            <strong className="text-slate-800">{p.party_name}</strong>
                            {(p.expert_firm || p.expert_name) && (
                              <span className="text-[#0f3854]">
                                {' '}({[p.expert_firm, p.expert_name].filter(Boolean).join(' — ')})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer : Dernière facture + En cours à facturer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{(mission.unbilled_hours || 0).toFixed(1).replace('.', ',')} h à facturer</span>
                    </span>
                    {(mission.total_unbilled_ht || 0) > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          hasBillingMilestone ? 'bg-sky-50 text-[#0f3854] border border-sky-200' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {(mission.total_unbilled_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT
                      </span>
                    )}
                    {mission.last_invoice_date && (
                      <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Receipt className="w-3 h-3 text-emerald-600" />
                        <span>
                          Dernière fact. : {mission.last_invoice_date.split('-').reverse().join('/')}
                        </span>
                      </span>
                    )}
                    {(mission.documents_count || 0) > 0 && (
                      <span className="inline-flex items-center space-x-1 text-[11px] text-slate-500">
                        <Paperclip className="w-3 h-3" />
                        <span>{mission.documents_count} pièce{mission.documents_count > 1 ? 's' : ''}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-semibold text-[#0f3854] flex items-center group-hover:translate-x-1 transition-transform">
                    <span>Page de garde</span>
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
