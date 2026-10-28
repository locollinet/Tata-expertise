import React, { useState } from 'react';
import { AlertCircle, Clock, Receipt, Mail, Train, Calendar, ChevronRight, CheckCircle2, ArrowRight, Filter } from 'lucide-react';
import { DashboardSummary } from '@shared/types.js';

interface TodayViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onNavigateToMission: (missionCode: string) => void;
  onNavigateToBilling: (missionCode?: string) => void;
  onOpenQuickAdd: () => void;
  onNavigateToMissions?: () => void;
  onNavigateToCompta?: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  summary,
  loading,
  onNavigateToMission,
  onNavigateToBilling,
  onOpenQuickAdd,
  onNavigateToMissions,
  onNavigateToCompta,
}) => {
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

  const [actionFilter, setActionFilter] = useState<'all' | 'echeance' | 'rappel_facturation' | 'deplacement' | 'email_urgent'>('all');

  const filteredActions = urgent_actions.filter((action) => {
    if (actionFilter === 'all') return true;
    return action.type === actionFilter;
  });

  const echeanceCount = urgent_actions.filter((a) => a.type === 'echeance').length;
  const billingCount = urgent_actions.filter((a) => a.type === 'rappel_facturation').length;
  const travelCount = urgent_actions.filter((a) => a.type === 'deplacement').length;
  const emailCount = urgent_actions.filter((a) => a.type === 'email_urgent').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Welcome banner & Focus card */}
      <div className="bg-gradient-to-r from-[#0f3854] to-[#1b4d72] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-sky-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Cockpit Quotidien — VP Expertise</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Bonjour Valentine</h1>
          <p className="text-sm text-sky-100 mt-1 max-w-xl">
            {urgent_actions.length > 0
              ? `Vous avez ${urgent_actions.length} action${urgent_actions.length > 1 ? 's' : ''} prioritaire${urgent_actions.length > 1 ? 's' : ''} à traiter aujourd'hui.`
              : "Tout est à jour ! Aucune urgence bloquante signalée."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenQuickAdd}
            className="px-4 py-2.5 bg-white text-[#0f3854] hover:bg-sky-50 rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Clock className="w-4 h-4" />
            <span>Pointer une activité</span>
          </button>
          <button
            onClick={() => onNavigateToBilling()}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Receipt className="w-4 h-4" />
            <span>Facturer</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid - All 4 cards clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => onNavigateToBilling()}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-amber-300 cursor-pointer transition-all active:scale-[0.98] group"
          title="Ouvrir la gestion des honoraires"
        >
          <span className="text-xs font-semibold text-slate-500 flex items-center justify-between group-hover:text-amber-700 transition-colors">
            <span className="truncate">À facturer</span>
            <Receipt className="w-4 h-4 text-amber-500 shrink-0 ml-1 group-hover:scale-110 transition-transform" />
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
              {total_unbilled_ht.toFixed(2).replace('.', ',')} €
            </span>
            <span className="text-[10px] text-slate-500 font-semibold ml-1">HT</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">{unbilled_hours_total}h en cours → Facturer</p>
        </div>

        <div
          onClick={() => onNavigateToMissions && onNavigateToMissions()}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-sky-300 cursor-pointer transition-all active:scale-[0.98] group"
          title="Consulter tous les dossiers"
        >
          <span className="text-xs font-semibold text-slate-500 flex items-center justify-between group-hover:text-sky-700 transition-colors">
            <span className="truncate">Dossiers actifs</span>
            <Calendar className="w-4 h-4 text-sky-600 shrink-0 ml-1 group-hover:scale-110 transition-transform" />
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-extrabold text-slate-900">{active_missions_count}</span>
            <span className="text-[10px] text-slate-500 font-semibold ml-1">affaires</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">En instruction → Voir registre</p>
        </div>

        <div
          onClick={() => onNavigateToCompta && onNavigateToCompta()}
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-emerald-300 cursor-pointer transition-all active:scale-[0.98] group"
          title="Consulter le livre comptable du mois"
        >
          <span className="text-xs font-semibold text-slate-500 flex items-center justify-between group-hover:text-emerald-700 transition-colors">
            <span className="truncate">CA émis (mois)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1 group-hover:scale-110 transition-transform" />
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
              {monthly_revenue_ht.toFixed(2).replace('.', ',')} €
            </span>
            <span className="text-[10px] text-slate-500 font-semibold ml-1">HT</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">Octobre 2026 → Voir compta</p>
        </div>

        <div
          onClick={() => upcoming_travels[0] && onNavigateToMission(upcoming_travels[0].mission_code)}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs transition-all ${
            upcoming_travels[0] ? 'hover:shadow-md hover:border-indigo-300 cursor-pointer active:scale-[0.98] group' : ''
          }`}
          title={upcoming_travels[0] ? `Ouvrir le dossier ${upcoming_travels[0].mission_code}` : ''}
        >
          <span className="text-xs font-semibold text-slate-500 flex items-center justify-between group-hover:text-indigo-700 transition-colors">
            <span className="truncate">Déplacement</span>
            <Train className="w-4 h-4 text-indigo-600 shrink-0 ml-1 group-hover:scale-110 transition-transform" />
          </span>
          <div className="mt-2">
            <span className="text-xs sm:text-sm font-bold text-slate-900 block line-clamp-1">
              {upcoming_travels[0] ? upcoming_travels[0].destination : "Aucun trajet"}
            </span>
            <span className="text-[11px] text-slate-500 block truncate">
              {upcoming_travels[0] ? `Le ${upcoming_travels[0].start_date.split('-').reverse().join('/')} → Ouvrir` : "À jour"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Action Feed: "Qu'est-ce que je dois faire maintenant ?" */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Header with interactive filter pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActionFilter('all')}
              className="flex items-center space-x-2 text-left cursor-pointer group select-none hover:opacity-90 transition-opacity"
              title="Cliquer pour afficher toutes les actions"
            >
              <div className="p-1 rounded-md bg-amber-100 text-amber-700 group-hover:bg-amber-200 transition-colors">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 group-hover:text-[#0f3854] transition-colors">
                Actions & Rappels prioritaires
              </h2>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                {urgent_actions.length}
              </span>
            </button>

            {/* Quick interactive filter pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
              <button
                type="button"
                onClick={() => setActionFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  actionFilter === 'all'
                    ? 'bg-[#0f3854] text-white shadow-2xs font-semibold'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                Tous ({urgent_actions.length})
              </button>
              {echeanceCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActionFilter('echeance')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    actionFilter === 'echeance'
                      ? 'bg-[#0f3854] text-white shadow-2xs font-semibold'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  Échéances ({echeanceCount})
                </button>
              )}
              {billingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActionFilter('rappel_facturation')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    actionFilter === 'rappel_facturation'
                      ? 'bg-amber-500 text-slate-900 font-bold shadow-2xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  Honoraires ({billingCount})
                </button>
              )}
              {travelCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActionFilter('deplacement')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    actionFilter === 'deplacement'
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}
                >
                  Déplacements ({travelCount})
                </button>
              )}
              {emailCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActionFilter('email_urgent')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    actionFilter === 'email_urgent'
                      ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  Dires & Actes ({emailCount})
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredActions.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Aucune action dans cette catégorie.</p>
                <button
                  onClick={() => setActionFilter('all')}
                  className="mt-2 text-xs text-[#0f3854] font-semibold hover:underline"
                >
                  Afficher toutes les actions ({urgent_actions.length})
                </button>
              </div>
            ) : (
              filteredActions.map((action) => {
                const isBilling = action.type === 'rappel_facturation';
                const isEmail = action.type === 'email_urgent';
                const isTravel = action.type === 'deplacement';

                return (
                  <div
                    key={action.id}
                    onClick={() => isBilling ? onNavigateToBilling(action.mission_code) : onNavigateToMission(action.mission_code)}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group shadow-2xs hover:shadow-md active:scale-[0.995] ${
                      isBilling
                        ? 'bg-amber-50/70 border-amber-200 hover:border-amber-400'
                        : isEmail
                        ? 'bg-rose-50/60 border-rose-200 hover:border-rose-400'
                        : isTravel
                        ? 'bg-indigo-50/50 border-indigo-200 hover:border-indigo-400'
                        : 'bg-white border-slate-200 hover:border-[#0f3854]/40 hover:bg-slate-50/50'
                    }`}
                    title={isBilling ? `Ouvrir la facturation de ${action.mission_code}` : `Ouvrir le dossier ${action.mission_code}`}
                  >
                    <div className="flex items-start space-x-3 pointer-events-none">
                      <div className="mt-0.5 shrink-0 group-hover:scale-110 transition-transform">
                        {isBilling ? (
                          <Receipt className="w-5 h-5 text-amber-600" />
                        ) : isEmail ? (
                          <Mail className="w-5 h-5 text-rose-600" />
                        ) : isTravel ? (
                          <Train className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Calendar className="w-5 h-5 text-[#0f3854]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-[#0f3854] transition-colors">{action.mission_code}</span>
                          <span className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-md">— {action.mission_title}</span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5 leading-snug">{action.label}</p>
                        {action.deadline && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Échéance : <span className="font-semibold text-slate-700">{action.deadline.split('-').reverse().join('/')}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-end pt-1 sm:pt-0 pointer-events-none">
                      {isBilling ? (
                        <span className="w-full sm:w-auto justify-center px-3.5 py-1.5 bg-amber-500 group-hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-bold shadow-2xs transition-all flex items-center space-x-1">
                          <span>Facturer</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      ) : (
                        <span className="w-full sm:w-auto justify-center px-3.5 py-1.5 bg-white border border-slate-200 group-hover:bg-slate-100 group-hover:border-slate-300 text-slate-800 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center space-x-1">
                          <span>Ouvrir</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-1 transition-all" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column : Upcoming travels & Latest invoices */}
        <div className="space-y-6">
          {/* Upcoming travel checklist card */}
          {upcoming_travels.length > 0 && (
            <div
              onClick={() => onNavigateToMission(upcoming_travels[0].mission_code)}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group active:scale-[0.99]"
              title={`Ouvrir le dossier ${upcoming_travels[0].mission_code}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 group-hover:text-indigo-900 transition-colors">
                  <Train className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <span>Prochain déplacement</span>
                </h3>
                <span className="text-xs text-indigo-700 bg-indigo-50 font-semibold px-2 py-0.5 rounded-full">
                  {upcoming_travels[0].start_date.split('-').reverse().join('/')}
                </span>
              </div>

              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-900 text-sm">{upcoming_travels[0].destination}</p>
                <p className="text-slate-500 font-medium">Dossier : <span className="text-[#0f3854] font-bold">{upcoming_travels[0].mission_code}</span> → Cliquer pour ouvrir</p>
                {upcoming_travels[0].train_info && (
                  <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono text-[11px]">
                    {upcoming_travels[0].train_info}
                  </p>
                )}
              </div>

              {upcoming_travels[0].checklist && upcoming_travels[0].checklist.length > 0 && (
                <div className="pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Checklist matériel :</span>
                  <div className="space-y-1.5">
                    {upcoming_travels[0].checklist.map((item: any) => (
                      <div key={item.id} className="flex items-center space-x-2 text-xs">
                        <input
                          type="checkbox"
                          checked={item.done}
                          readOnly
                          className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
                        />
                        <span className={item.done ? 'line-through text-slate-400' : 'text-slate-700'}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Latest Invoices Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Receipt className="w-4 h-4 text-[#0f3854]" />
                <span>Dernières notes d'honoraires</span>
              </h3>
              <button
                onClick={() => onNavigateToBilling()}
                className="text-xs text-[#0f3854] hover:underline font-semibold"
              >
                Voir tout →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {latest_invoices.map((inv: any) => (
                <div
                  key={inv.id}
                  onClick={() => onNavigateToBilling(inv.mission_code)}
                  className="py-2.5 px-2 -mx-2 rounded-lg flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition-colors group"
                  title={`Ouvrir la facture ${inv.invoice_number} (${inv.mission_code})`}
                >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-900 group-hover:text-[#0f3854] transition-colors">{inv.invoice_number}</span>
                      <span className="text-slate-400 font-mono text-[11px]">({inv.mission_code})</span>
                    </div>
                    <p className="text-slate-500 text-[11px] truncate max-w-[170px]">{inv.client_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-800 block group-hover:text-[#0f3854] transition-colors">
                      {inv.total_ttc.toFixed(2).replace('.', ',')} €
                    </span>
                    <span className="text-[10px] text-slate-400">{inv.date.split('-').reverse().join('/')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
