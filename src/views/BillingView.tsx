import React, { useState, useEffect } from 'react';
import { Receipt, Check, Download, AlertCircle, FileText, Plus, X, ArrowRight, CornerDownRight, ShieldCheck } from 'lucide-react';
import { Invoice, Mission } from '@shared/types.js';
import { api } from '../api.js';

interface BillingViewProps {
  missions: Mission[];
  initialMissionCode?: string;
  onRefreshMissions: () => void;
  onNavigateToMission?: (codeOrId: string) => void;
}

export const BillingView: React.FC<BillingViewProps> = ({
  missions,
  initialMissionCode,
  onRefreshMissions,
  onNavigateToMission,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMissionId, setSelectedMissionId] = useState<string>(
    missions.find(m => m.code === initialMissionCode)?.id || missions[0]?.id || ''
  );
  const [missionDetail, setMissionDetail] = useState<any>(null);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('0');
  const [prepError, setPrepError] = useState<string | null>(null);
  const [prepSuccess, setPrepSuccess] = useState<string | null>(null);

  // Payment modal state
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('Virement');
  const [paymentAmount, setPaymentAmount] = useState('');

  // Credit Note (Avoir) state
  const [creditNoteModalInvoice, setCreditNoteModalInvoice] = useState<Invoice | null>(null);
  const [creditReason, setCreditReason] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadInvoices = async () => {
    try {
      const invs = await api.getInvoices();
      setInvoices(invs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedMission = async () => {
    if (!selectedMissionId) return;
    try {
      const detail = await api.getMission(selectedMissionId);
      setMissionDetail(detail);
      // Auto-select all unbilled activities & expenses
      const unbilledActIds = detail.activities?.filter((a: any) => a.status === 'a_facturer').map((a: any) => a.id) || [];
      const unbilledExpIds = detail.expenses?.filter((e: any) => e.status === 'a_facturer').map((e: any) => e.id) || [];
      setSelectedActivities(unbilledActIds);
      setSelectedExpenses(unbilledExpIds);
      setSubject(`Mission d’expertise depuis le ${detail.reception_date.split('-').reverse().join('/')}`);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    if (initialMissionCode && missions.length > 0) {
      const target = initialMissionCode.trim().toLowerCase();
      const match = missions.find(m => m.code.toLowerCase() === target || m.id.toLowerCase() === target);
      if (match) setSelectedMissionId(match.id);
    } else if (!selectedMissionId && missions.length > 0) {
      setSelectedMissionId(missions[0].id);
    }
  }, [missions, initialMissionCode]);

  useEffect(() => {
    loadSelectedMission();
  }, [selectedMissionId]);

  // Live calculation of preview amounts
  const unbilledActivities = missionDetail?.activities?.filter((a: any) => a.status === 'a_facturer') || [];
  const unbilledExpenses = missionDetail?.expenses?.filter((e: any) => e.status === 'a_facturer') || [];

  const selectedActItems = unbilledActivities.filter((a: any) => selectedActivities.includes(a.id));
  const selectedExpItems = unbilledExpenses.filter((e: any) => selectedExpenses.includes(e.id));

  const totalHTActivities = selectedActItems.reduce((acc: number, a: any) => acc + a.total_ht, 0);
  const totalHTExpenses = selectedExpItems.reduce((acc: number, e: any) => acc + e.total_ht, 0);
  const calculatedHT = Math.round((totalHTActivities + totalHTExpenses) * 100) / 100;
  const calculatedTVA = Math.round(calculatedHT * 0.20 * 100) / 100;
  const calculatedTTC = Math.round((calculatedHT + calculatedTVA) * 100) / 100;
  const parsedAdvance = parseFloat(advanceAmount.replace(',', '.')) || 0;
  const calculatedNetPayable = Math.round((calculatedTTC - parsedAdvance) * 100) / 100;

  const handleToggleActivity = (id: string) => {
    setSelectedActivities(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToggleExpense = (id: string) => {
    setSelectedExpenses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePrepareInvoice = async () => {
    setPrepError(null);
    setPrepSuccess(null);
    if (selectedActivities.length === 0 && selectedExpenses.length === 0) {
      setPrepError("Veuillez sélectionner au moins un élément non facturé.");
      return;
    }

    try {
      const res = await api.prepareInvoice({
        mission_id: selectedMissionId,
        activity_ids: selectedActivities,
        expense_ids: selectedExpenses,
        subject,
        advance_amount: parsedAdvance,
      });
      setPrepSuccess(`${res.message} (Réf : ${res.nextNum} pour ${res.netPayable.toFixed(2).replace('.', ',')} € TTC).`);
      loadInvoices();
      loadSelectedMission();
      onRefreshMissions();
    } catch (err: any) {
      setPrepError(err.message);
    }
  };

  const handleEmitInvoice = async (invoiceId: string) => {
    try {
      const res = await api.emitInvoice(invoiceId);
      setActionFeedback({ type: 'success', message: res.message });
      loadInvoices();
      loadSelectedMission();
      onRefreshMissions();
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: "Erreur : " + err.message });
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    try {
      const res = await api.cancelInvoice(invoiceId);
      setActionFeedback({ type: 'success', message: res.message });
      loadInvoices();
      loadSelectedMission();
      onRefreshMissions();
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: "Erreur : " + err.message });
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;
    try {
      const res = await api.recordPayment(paymentModalInvoice.id, {
        payment_date: paymentDate,
        payment_method: paymentMethod,
        paid_amount: parseFloat(paymentAmount.replace(',', '.')) || paymentModalInvoice.net_payable,
      });
      setActionFeedback({ type: 'success', message: res.message });
      setPaymentModalInvoice(null);
      loadInvoices();
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: "Erreur : " + err.message });
    }
  };

  const handleCreateCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditNoteModalInvoice || !creditReason.trim()) return;
    try {
      const res = await api.createCreditNote({
        original_invoice_id: creditNoteModalInvoice.id,
        reason: creditReason.trim(),
      });
      setActionFeedback({ type: 'success', message: res.message });
      setCreditNoteModalInvoice(null);
      setCreditReason('');
      loadInvoices();
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: "Erreur : " + err.message });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <Receipt className="w-6 h-6 text-[#0f3854]" />
          <span>Gestion des Honoraires & Facturation</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Préparation déterministe au centime, verrouillage anti-double facturation, émission Word (.docx) et continuité comptable.
        </p>
      </div>

      {/* 1. SECTION PREPARATION DE NOTE D'HONORAIRES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Étape 1</span>
            <h2 className="text-base font-bold text-slate-900">Préparer une note d'honoraires</h2>
          </div>

          {/* Mission selection dropdown */}
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-600">Dossier :</label>
            <select
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-1.5 px-3 bg-slate-50 border font-medium text-slate-800"
            >
              {missions.map(m => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.title.slice(0, 45)}... ({(m.total_unbilled_ht || 0).toFixed(2).replace('.', ',')} € HT)
                </option>
              ))}
            </select>
          </div>
        </div>

        {prepError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{prepError}</span>
          </div>
        )}
        {prepSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{prepSuccess}</span>
          </div>
        )}

        {/* Unbilled selection grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Unbilled activities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Temps à facturer ({unbilledActivities.length})
                </span>
                <span className="text-[11px] text-slate-400">Cochez les éléments à intégrer à la facture</span>
              </div>

              {unbilledActivities.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 bg-slate-50 rounded-lg text-center">
                  Aucun temps en attente de facturation pour ce dossier.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {unbilledActivities.map((act: any) => (
                    <label
                      key={act.id}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        selectedActivities.includes(act.id) ? 'bg-sky-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedActivities.includes(act.id)}
                          onChange={() => handleToggleActivity(act.id)}
                          className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{act.label}</p>
                          <p className="text-slate-500 text-[11px]">
                            {act.date.split('-').reverse().join('/')} — {act.category.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">{act.total_ht.toFixed(2).replace('.', ',')} € HT</span>
                        <span className="text-[11px] text-slate-500">{act.hours.toString().replace('.', ',')} h @ {act.hourly_rate} €</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Unbilled expenses */}
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Frais à refacturer ({unbilledExpenses.length})
              </span>
              {unbilledExpenses.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 bg-slate-50 rounded-lg text-center">
                  Aucun frais en attente pour ce dossier.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {unbilledExpenses.map((exp: any) => (
                    <label
                      key={exp.id}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        selectedExpenses.includes(exp.id) ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedExpenses.includes(exp.id)}
                          onChange={() => handleToggleExpense(exp.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{exp.label}</p>
                          <p className="text-slate-500 text-[11px]">
                            {exp.date.split('-').reverse().join('/')} — {exp.quantity} x {exp.unit_price.toFixed(2).replace('.', ',')} €
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">{exp.total_ht.toFixed(2).replace('.', ',')} € HT</span>
                        <span className="text-[11px] text-emerald-700 font-semibold">{exp.total_ttc.toFixed(2).replace('.', ',')} € TTC</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Billing Preview & Confirmation Box */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Calcul déterministe
              </span>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Objet de la facture</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-300 bg-white p-2 border"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Acompte à déduire (€)</label>
                <input
                  type="text"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-xs rounded-lg border-slate-300 bg-white p-2 border"
                />
              </div>

              {/* Totals summary breakdown */}
              <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Honoraires HT :</span>
                  <span className="font-semibold text-slate-800">{totalHTActivities.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Frais HT :</span>
                  <span className="font-semibold text-slate-800">{totalHTExpenses.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                  <span>Total HT :</span>
                  <span>{calculatedHT.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>TVA (20%) :</span>
                  <span>{calculatedTVA.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Total TTC :</span>
                  <span>{calculatedTTC.toFixed(2).replace('.', ',')} €</span>
                </div>
                {parsedAdvance > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Acompte déduit :</span>
                    <span>- {parsedAdvance.toFixed(2).replace('.', ',')} €</span>
                  </div>
                )}
                <div className="flex justify-between text-[#0f3854] font-extrabold text-sm pt-2 border-t border-slate-300">
                  <span>Net à payer :</span>
                  <span>{calculatedNetPayable.toFixed(2).replace('.', ',')} €</span>
                </div>
              </div>
            </div>

            <button
              onClick={handlePrepareInvoice}
              disabled={selectedActivities.length === 0 && selectedExpenses.length === 0}
              className="w-full py-2.5 bg-[#0f3854] hover:bg-[#16496d] disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center space-x-1.5"
            >
              <Receipt className="w-4 h-4" />
              <span>Générer le brouillon de facture</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. REGISTRE DES FACTURES EMISES & SUIVI */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Registre officiel des Notes d'honoraires & Règlements ({invoices.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Historique inaltérable — Export DOCX conforme et suivi des encaissements.
            </p>
          </div>
        </div>

        {actionFeedback && (
          <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}>
            {actionFeedback.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}

        {invoices.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">Aucune facture enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                  <th className="py-2.5 px-3 font-semibold">Numéro</th>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Dossier</th>
                  <th className="py-2.5 px-3 font-semibold">Client Assureur</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Montant HT</th>
                  <th className="py-2.5 px-3 font-semibold text-right">TVA (20%)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net à payer</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Statut</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const isDraft = inv.status === 'brouillon';
                  const isPaid = inv.status === 'regle';
                  const isCancelled = inv.status === 'annule';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-[#0f3854]">
                        {inv.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {inv.date.split('-').reverse().join('/')}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {onNavigateToMission ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToMission(inv.mission_code)}
                            className="text-[#0f3854] hover:underline font-bold text-left cursor-pointer inline-flex items-center space-x-1"
                            title={`Consulter le dossier ${inv.mission_code}`}
                          >
                            <span>{inv.mission_code}</span>
                            <CornerDownRight className="w-3 h-3 text-slate-400" />
                          </button>
                        ) : (
                          inv.mission_code
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {inv.client_name}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {inv.total_ht.toFixed(2).replace('.', ',')} €
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {inv.vat_amount.toFixed(2).replace('.', ',')} €
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {inv.net_payable.toFixed(2).replace('.', ',')} €
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isDraft ? (
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Brouillon</span>
                        ) : isPaid ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Réglé</span>
                        ) : isCancelled ? (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Annulé / Avoir</span>
                        ) : (
                          <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Émis (En attente)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                        {isDraft ? (
                          <>
                            <button
                              onClick={() => handleEmitInvoice(inv.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors"
                            >
                              Émettre
                            </button>
                            <button
                              onClick={() => handleCancelInvoice(inv.id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded text-[11px] transition-colors"
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={`/api/invoices/${inv.id}/docx`}
                              download
                              title="Télécharger le document Word (.docx)"
                              className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              <span>DOCX</span>
                            </a>

                            {!isPaid && !isCancelled && (
                              <button
                                onClick={() => {
                                  setPaymentModalInvoice(inv);
                                  setPaymentAmount(String(inv.net_payable));
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[11px] font-medium transition-colors"
                              >
                                Encaissé
                              </button>
                            )}

                            {!isCancelled && (
                              <button
                                onClick={() => setCreditNoteModalInvoice(inv)}
                                title="Émettre un avoir pour rectifier"
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] transition-colors"
                              >
                                Avoir
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Recording Modal */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Enregistrer le règlement de la facture {paymentModalInvoice.invoice_number}
              </h3>
              <button onClick={() => setPaymentModalInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-slate-600 mb-1">Date d'encaissement / Date crédit *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full rounded-md border-slate-300 p-2 border bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Mode de règlement</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-md border-slate-300 p-2 border bg-white"
                >
                  <option value="Virement">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Montant encaissé TTC (€) *</label>
                <input
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="w-full rounded-md border-slate-300 p-2 border bg-white font-bold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded"
                >
                  Valider le règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Note (Avoir) Modal */}
      {creditNoteModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Émettre un avoir sur la facture {creditNoteModalInvoice.invoice_number}
              </h3>
              <button onClick={() => setCreditNoteModalInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-600">
              Un avoir créditeur d'un montant de -{creditNoteModalInvoice.net_payable.toFixed(2).replace('.', ',')} € TTC sera créé sans supprimer la facture d'origine.
            </p>

            <form onSubmit={handleCreateCreditNote} className="space-y-3">
              <div>
                <label className="block text-slate-600 mb-1">Motif de l'avoir *</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="ex: Rectification de répartition entre payeurs ou erreur de libellé"
                  required
                  className="w-full rounded-md border-slate-300 p-2 border bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreditNoteModalInvoice(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded"
                >
                  Confirmer l'avoir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
