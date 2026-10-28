import React from 'react';
import { AlertCircle, Clock, Receipt, Mail, Train, Calendar, ChevronRight, CheckCircle2, ArrowRight } from 'lucide-react';
import { DashboardSummary } from '@shared/types.js';

interface TodayViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onNavigateToMission: (missionCode: string) => void;
  onNavigateToBilling: (missionCode?: string) => void;
  onOpenQuickAdd: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  summary,
  loading,
  onNavigateToMission,
  onNavigateToBilling,
  onOpenQuickAdd,
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

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span className="truncate">À facturer</span>
            <Receipt className="w-4 h-4 text-amber-500 shrink-0 ml-1" />
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {total_unbilled_ht.toFixed(2).replace('.', ',')} €
            </span>
            <span className="text-[10px] text-slate-500 font-semibold ml-1">HT</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">{unbilled_hours_total}h en cours</p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span className="truncate">Dossiers actifs</span>
            <Calendar className="w-4 h-4 text-sky-600 shrink-0 ml-1" />
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-bold text-slate-900">{active_missions_count}</span>
            <span className="text-[10px] text-slate-500 font-semibold ml-1">affaires</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">En instruction</p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span className="truncate">CA émis (mois)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {monthly_revenue_ht.toFixed(2).replace('.', ',')} €
            </span>
            <span className="text-[10px] text-slate-500 font-semibold ml-1">HT</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">Octobre 2026</p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 flex items-center justify-between">
            <span className="truncate">Déplacement</span>
            <Train className="w-4 h-4 text-indigo-600 shrink-0 ml-1" />
          </span>
          <div className="mt-2">
            <span className="text-xs sm:text-sm font-bold text-slate-900 block line-clamp-1">
              {upcoming_travels[0] ? upcoming_travels[0].destination : "Aucun trajet"}
            </span>
            <span className="text-[11px] text-slate-500 block truncate">
              {upcoming_travels[0] ? `Le ${upcoming_travels[0].start_date.split('-').reverse().join('/')}` : "À jour"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Action Feed: "Qu'est-ce que je dois faire maintenant ?" */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span>Actions & Rappels prioritaires</span>
            </h2>
            <span className="text-xs text-slate-500">{urgent_actions.length} élément(s)</span>
          </div>

          <div className="space-y-2.5">
            {urgent_actions.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Aucune action urgente en attente.</p>
                <p className="text-xs text-slate-400 mt-1">Tous les jalons et relances sont traités.</p>
              </div>
            ) : (
              urgent_actions.map((action) => {
                const isBilling = action.type === 'rappel_facturation';
                const isEmail = action.type === 'email_urgent';
                const isTravel = action.type === 'deplacement';

                return (
                  <div
                    key={action.id}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isBilling
                        ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300'
                        : isEmail
                        ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
                        : isTravel
                        ? 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5 shrink-0">
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
                          <span className="text-xs font-bold text-slate-900">{action.mission_code}</span>
                          <span className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-md">— {action.mission_title}</span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-slate-800 mt-0.5 leading-snug">{action.label}</p>
                        {action.deadline && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Échéance : <span className="font-semibold text-slate-700">{action.deadline.split('-').reverse().join('/')}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-end pt-1 sm:pt-0">
                      {isBilling ? (
                        <button
                          onClick={() => onNavigateToBilling(action.mission_code)}
                          className="w-full sm:w-auto justify-center px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center space-x-1"
                        >
                          <span>Facturer</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onNavigateToMission(action.mission_code)}
                          className="w-full sm:w-auto justify-center px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium shadow-2xs transition-colors flex items-center space-x-1"
                        >
                          <span>Ouvrir</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
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
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Train className="w-4 h-4 text-indigo-600" />
                  <span>Prochain déplacement</span>
                </h3>
                <span className="text-xs text-indigo-700 bg-indigo-50 font-medium px-2 py-0.5 rounded-full">
                  {upcoming_travels[0].start_date.split('-').reverse().join('/')}
                </span>
              </div>

              <div className="text-xs space-y-1">
                <p className="font-semibold text-slate-800">{upcoming_travels[0].destination}</p>
                <p className="text-slate-500">Dossier : {upcoming_travels[0].mission_code}</p>
                {upcoming_travels[0].train_info && (
                  <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                    {upcoming_travels[0].train_info}
                  </p>
                )}
              </div>

              {upcoming_travels[0].checklist && upcoming_travels[0].checklist.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
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
                className="text-xs text-[#0f3854] hover:underline font-medium"
              >
                Voir tout
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {latest_invoices.map((inv: any) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-900">{inv.invoice_number}</span>
                      <span className="text-slate-400">({inv.mission_code})</span>
                    </div>
                    <p className="text-slate-500 text-[11px] truncate max-w-[170px]">{inv.client_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-800 block">
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
