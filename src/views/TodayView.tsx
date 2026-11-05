import React, { useState, useMemo } from 'react';
import {
  Clock,
  Receipt,
  Mail,
  Train,
  Calendar,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Plus,
  Search,
  AlertCircle,
  FolderKanban,
  TrendingUp,
  FileText,
  Paperclip,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  Download,
} from 'lucide-react';
import { DashboardSummary, Mission, DossierVoletKey } from '@shared/types.js';

interface TodayViewProps {
  missions?: Mission[];
  summary: DashboardSummary | null;
  loading: boolean;
  onNavigateToMission: (missionCode: string, initialVolet?: DossierVoletKey) => void;
  onNavigateToBilling: (missionCode?: string) => void;
  onOpenQuickAdd: () => void;
  onNavigateToMissions?: () => void;
  onNavigateToCompta?: () => void;
  onOpenCreateMission?: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  missions = [],
  summary,
  loading,
  onNavigateToMission,
  onNavigateToBilling,
  onOpenQuickAdd,
  onNavigateToMissions,
  onNavigateToCompta,
  onOpenCreateMission,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

  const formatStake = (amount?: number | null) => {
    if (!amount) return null;
    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M€`;
    }
    return `${amount.toLocaleString('fr-FR')} €`;
  };

  // Quick mission search matches code, title, case_ref, client, insured, adverse party
  const searchedMissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return missions.filter((m) => {
      const adv = (m.adverse_parties || [])
        .map((p) => `${p.party_name} ${p.expert_firm || ''} ${p.expert_name || ''}`)
        .join(' ')
        .toLowerCase();
      const text = `${m.code} ${m.title} ${m.case_reference} ${m.insurance_client} ${m.insured_party || ''} ${adv}`.toLowerCase();
      return text.includes(q);
    });
  }, [missions, searchQuery]);

  // Active missions prioritized (en_cours, attente_pieces, reunion_planifiee)
  const activeMissions = useMemo(() => {
    return missions
      .filter((m) => m.status !== 'cloture')
      .slice(0, 4);
  }, [missions]);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f3854]"></div>
      </div>
    );
  }

  const {
    urgent_actions,
    total_unbilled_ht,
    unbilled_hours_total,
    active_missions_count,
    monthly_revenue_ht,
    latest_invoices,
    upcoming_travels,
  } = summary;

  // Split urgent actions by real operational meaning
  const proceduralDeadlines = urgent_actions.filter((a) => a.type === 'echeance' || a.type === 'email_urgent');
  const billingReminders = urgent_actions.filter((a) => a.type === 'rappel_facturation');
  const nextTravel = upcoming_travels && upcoming_travels.length > 0 ? upcoming_travels[0] : null;

  // Toggle checklist items locally
  const toggleChecklistItem = (id: string, initialDone: boolean) => {
    setChecklistState((prev) => {
      const current = prev[id] !== undefined ? prev[id] : initialDone;
      return { ...prev, [id]: !current };
    });
  };

  const todayDateFormatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. HEADER STATUTAIRE : Bonjour Valentine + Actions Rapides Clés */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="capitalize">{todayDateFormatted}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-bold">Cabinet VP Expertise</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Bonjour Valentine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            {proceduralDeadlines.length > 0
              ? `${proceduralDeadlines.length} échéance${proceduralDeadlines.length > 1 ? 's' : ''} ou dire${proceduralDeadlines.length > 1 ? 's' : ''} à traiter • ${active_missions_count} dossiers en cours d'instruction.`
              : `Tous vos dossiers et dires contradictoires sont à jour • ${active_missions_count} dossiers en cours d'instruction.`}
          </p>
        </div>

        {/* 4 Boutons d'Action Rapide majeurs du quotidien */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuickAdd}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#0f3854] hover:bg-[#16496d] text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Enregistrer du temps passé ou des frais sur un dossier"
          >
            <Clock className="w-4 h-4" />
            <span>Pointer une intervention</span>
          </button>

          {onOpenCreateMission && (
            <button
              type="button"
              onClick={onOpenCreateMission}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Ouvrir un nouveau dossier d'expertise"
            >
              <Plus className="w-4 h-4 text-[#0f3854]" />
              <span>Nouveau dossier</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigateToBilling()}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-[#0f3854] border border-sky-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Consulter et émettre les notes d'honoraires Word"
          >
            <Receipt className="w-4 h-4 text-[#0f3854]" />
            <span>Note d'honoraires</span>
          </button>

          {onNavigateToCompta && (
            <button
              type="button"
              onClick={onNavigateToCompta}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Accéder à la comptabilité et aux justificatifs de frais"
            >
              <Paperclip className="w-4 h-4 text-slate-500" />
              <span>Frais & Compta</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. RECHERCHE DIRECTE & ACCÈS IMMÉDIAT À UN DOSSIER */}
      <div className="relative">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Accès direct : tapez n° de dossier (ex: 728), mot-clé (Alstom, SGP...), client, assuré ou confrère (Saretec)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0f3854] focus:ring-1 focus:ring-[#0f3854] shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Dropdown instantané des résultats de recherche */}
        {searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {searchedMissions.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">
                Aucun dossier ne correspond à « {searchQuery} ».
              </p>
            ) : (
              searchedMissions.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    setSearchQuery('');
                    onNavigateToMission(m.code);
                  }}
                  className="p-3 hover:bg-sky-50/60 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#0f3854] text-xs font-mono bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                        {m.code}
                      </span>
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {m.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Client : <strong className="text-slate-700">{m.insurance_client}</strong> (Réf: {m.case_reference})
                      {m.insured_party ? ` • Assuré : ${m.insured_party}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center space-x-2">
                    <span className="text-xs text-[#0f3854] font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      <span>Page de garde</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. LES 3 INDICATEURS EXÉCUTIFS DU CABINET */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Dossiers en instruction */}
        <div
          onClick={() => onNavigateToMissions && onNavigateToMissions()}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-[#0f3854]/40 hover:shadow-xs transition-all cursor-pointer group"
          title="Consulter le registre complet de tous les dossiers"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-600">Dossiers en instruction</span>
            <FolderKanban className="w-4 h-4 text-[#0f3854] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{active_missions_count}</span>
            <span className="text-xs text-[#0f3854] font-semibold group-hover:underline">Voir le registre →</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Affaires actives en cours d'expertise technique
          </p>
        </div>

        {/* Honoraires en cours non facturés */}
        <div
          onClick={() => onNavigateToBilling()}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-[#0f3854]/40 hover:shadow-xs transition-all cursor-pointer group"
          title="Consulter les heures pointées et préparer une facture"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-600">Honoraires en attente</span>
            <Receipt className="w-4 h-4 text-sky-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">
              {total_unbilled_ht.toFixed(2).replace('.', ',')} €
            </span>
            <span className="text-xs text-slate-500 font-semibold">HT</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {unbilled_hours_total} h enregistrées • Facturation au temps réel
          </p>
        </div>

        {/* Facturation émise ce mois-ci */}
        <div
          onClick={() => onNavigateToCompta && onNavigateToCompta()}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-[#0f3854]/40 hover:shadow-xs transition-all cursor-pointer group"
          title="Consulter le livre comptable et le détail de la TVA"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-600">CA facturé (Mois)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">
              {monthly_revenue_ht.toFixed(2).replace('.', ',')} €
            </span>
            <span className="text-xs text-slate-500 font-semibold">HT</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Livre comptable & ventilation TVA à jour
          </p>
        </div>
      </div>

      {/* 4. GRILLE PRINCIPALE MÉTIER : 2 COLONNES ÉQUILIBRÉES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLONNE GAUCHE (7/12) : Dossiers prioritaires + Échéances procédurales */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section A : Vos Dossiers en cours d'instruction */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#0f3854]"></span>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Dossiers en instruction active
                </h2>
              </div>
              {onNavigateToMissions && (
                <button
                  type="button"
                  onClick={onNavigateToMissions}
                  className="text-xs text-[#0f3854] hover:underline font-semibold inline-flex items-center space-x-1"
                >
                  <span>Tous les dossiers ({missions.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {activeMissions.length === 0 ? (
                <p className="py-6 text-xs text-slate-400 text-center">
                  Aucun dossier actif pour l'instant.
                </p>
              ) : (
                activeMissions.map((m: any) => {
                  const stakeFormatted = formatStake(m.stake_amount);
                  const unbilledHT = Number(m.total_unbilled_ht || 0);

                  return (
                    <div
                      key={m.id}
                      onClick={() => onNavigateToMission(m.code)}
                      className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 -mx-2 px-2 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-[#0f3854] bg-[#0f3854]/10 px-2 py-0.5 rounded font-mono">
                            {m.code}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            Réf. {m.case_reference}
                          </span>
                          {stakeFormatted && (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              <TrendingUp className="w-2.5 h-2.5 text-amber-600" />
                              <span>{stakeFormatted}</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-1 leading-snug group-hover:text-[#0f3854] transition-colors line-clamp-1">
                          {m.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                          <span>
                            Client : <strong className="text-slate-700">{m.insurance_client}</strong>
                          </span>
                          {m.insured_party && (
                            <span>
                              Assuré : <span className="text-slate-700">{m.insured_party}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center justify-between sm:justify-end gap-3 sm:text-right pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <div>
                          {unbilledHT > 0 ? (
                            <span className="text-xs font-bold text-[#0f3854] block">
                              {unbilledHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 block">Facturation à jour</span>
                          )}
                          <span className="text-[10px] text-slate-500">
                            {(m.unbilled_hours || 0).toFixed(1).replace('.', ',')} h pointées
                          </span>
                        </div>

                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 group-hover:bg-[#0f3854] group-hover:text-white rounded-lg text-xs font-semibold text-slate-700 transition-colors">
                          <span>Page de garde</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section B : Procédure Contradictoire, Dires & Échéances */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#0f3854]" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Contradictoire, Dires & Délais ({proceduralDeadlines.length})
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Observations confrères et dates butoirs
              </span>
            </div>

            {proceduralDeadlines.length === 0 ? (
              <div className="py-6 text-center text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-medium">Aucun dire ou observation en attente de réponse. Procédure à jour !</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {proceduralDeadlines.map((action) => (
                  <div
                    key={action.id}
                    onClick={() => onNavigateToMission(action.mission_code, 'contradictoire')}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-[#0f3854]/40 hover:bg-slate-50/60 transition-all cursor-pointer group flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#0f3854] font-mono">
                          {action.mission_code}
                        </span>
                        <span className="text-xs text-slate-500 truncate max-w-xs">
                          — {action.mission_title}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {action.label}
                      </p>
                      {action.deadline && (
                        <p className="text-[11px] text-rose-700 font-semibold mt-1 inline-flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          <span>Délai contradictoire : {action.deadline.split('-').reverse().join('/')}</span>
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-xs font-semibold text-[#0f3854] group-hover:translate-x-0.5 transition-transform inline-flex items-center mt-1">
                      <span>Volet 04</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLONNE DROITE (5/12) : Réunion contradictoire sur site + Facturation prête */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section C : Prochaine réunion contradictoire sur site */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Train className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Prochaine visite sur site
                </h2>
              </div>
              {nextTravel && (
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  {nextTravel.start_date.split('-').reverse().join('/')}
                </span>
              )}
            </div>

            {nextTravel ? (
              <div className="space-y-3 text-xs">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {nextTravel.destination}
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigateToMission(nextTravel.mission_code, 'constatations')}
                    className="text-[#0f3854] font-semibold hover:underline mt-0.5 inline-flex items-center space-x-1"
                  >
                    <span>Dossier {nextTravel.mission_code}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {nextTravel.train_info && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl font-mono text-[11px] text-slate-700">
                    🚆 {nextTravel.train_info}
                  </div>
                )}

                {/* Checklist matériel d'expertise */}
                {nextTravel.checklist && nextTravel.checklist.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Matériel & Pièces à emporter :
                    </span>
                    <div className="space-y-1.5">
                      {nextTravel.checklist.map((item) => {
                        const isDone = checklistState[item.id] !== undefined ? checklistState[item.id] : item.done;
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleChecklistItem(item.id, item.done)}
                            className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none hover:text-slate-900"
                          >
                            {isDone ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className={isDone ? 'line-through text-slate-400' : 'font-medium'}>
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-4 text-xs text-slate-400 text-center">
                Aucune réunion contradictoire sur site planifiée cette semaine.
              </p>
            )}
          </div>

          {/* Section D : Honoraires prêts à être émis */}
          {billingReminders.length > 0 && (
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4 text-amber-700" />
                  <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Honoraires prêts à émettre ({billingReminders.length})
                  </h2>
                </div>
              </div>

              <div className="space-y-2">
                {billingReminders.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => onNavigateToBilling(b.mission_code)}
                    className="p-3 bg-white rounded-xl border border-amber-200 hover:border-amber-400 cursor-pointer transition-all flex items-center justify-between group text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block font-mono">{b.mission_code}</span>
                      <p className="text-[11px] text-slate-600 mt-0.5">{b.label}</p>
                    </div>
                    <span className="shrink-0 ml-2 px-2.5 py-1 bg-[#0f3854] text-white rounded-lg text-[11px] font-bold group-hover:bg-[#16496d] transition-colors">
                      Facturer →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section E : Dernières notes d'honoraires émises */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#0f3854]" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Dernières notes d'honoraires
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToBilling()}
                className="text-xs text-[#0f3854] hover:underline font-semibold"
              >
                Voir tout →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {latest_invoices.length === 0 ? (
                <p className="py-4 text-xs text-slate-400 text-center">Aucune facture enregistrée.</p>
              ) : (
                latest_invoices.slice(0, 3).map((inv: any) => (
                  <div
                    key={inv.id}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900">{inv.invoice_number}</span>
                        <span className="text-slate-400 font-mono text-[11px]">({inv.mission_code})</span>
                      </div>
                      <p className="text-slate-500 text-[11px] truncate max-w-[160px]">{inv.client_name}</p>
                    </div>

                    <div className="text-right flex items-center space-x-2">
                      <div>
                        <span className="font-bold text-slate-900 block">
                          {inv.total_ttc.toFixed(2).replace('.', ',')} €
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {inv.date.split('-').reverse().join('/')}
                        </span>
                      </div>

                      <a
                        href={`/api/invoices/${inv.id}/docx`}
                        download
                        title="Télécharger la note d'honoraires Word (.docx)"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
