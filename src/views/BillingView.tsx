import React, { useState, useEffect, useMemo } from 'react';
import { Receipt, Check, Download, AlertCircle, Plus, X, CornerDownRight, ShieldCheck, Search, Edit3, Layers } from 'lucide-react';
import { Invoice, Mission } from '@shared/types.js';
import { api } from '../api.js';
import { syncFileToLocalMacFolder, syncComptaFileToMac } from '../utils/localFolderSync.js';

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
  const [missionSearch, setMissionSearch] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);

  const filteredMissions = useMemo(() => {
    const q = missionSearch.trim().toLowerCase();
    return missions.filter(m => {
      if (!includeClosed && m.status === 'cloture' && m.code !== initialMissionCode) return false;
      if (!q) return true;
      return (
        m.code.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.insurance_client || '').toLowerCase().includes(q) ||
        (m.insured_party || '').toLowerCase().includes(q)
      );
    });
  }, [missions, missionSearch, includeClosed, initialMissionCode]);

  const [selectedMissionId, setSelectedMissionId] = useState<string>(
    missions.find(m => m.code === initialMissionCode)?.id || missions[0]?.id || ''
  );
  const [missionDetail, setMissionDetail] = useState<any>(null);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [subject, setSubject] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('0');
  const [enableCoInsurance, setEnableCoInsurance] = useState(false);
  const [coInsurers, setCoInsurers] = useState<Array<{ name: string; percentage: number; ref: string }>>([
    { name: '', percentage: 50, ref: '' },
    { name: '', percentage: 50, ref: '' },
  ]);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [prepSuccess, setPrepSuccess] = useState<string | null>(null);
  const [registerFilter, setRegisterFilter] = useState<string | 'all'>(initialMissionCode || 'all');

  // Inline activity hours editing state
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingHoursVal, setEditingHoursVal] = useState<string>('');

  // Draft Invoice Edit Modal state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvSubject, setEditInvSubject] = useState('');
  const [editInvAdvance, setEditInvAdvance] = useState('0');
  const [editInvLines, setEditInvLines] = useState<any[]>([]);

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
      const unbilledActIds = detail.activities?.filter((a: any) => a.status === 'a_facturer').map((a: any) => a.id) || [];
      const unbilledExpIds = detail.expenses?.filter((e: any) => e.status === 'a_facturer').map((e: any) => e.id) || [];
      setSelectedActivities(unbilledActIds);
      setSelectedExpenses(unbilledExpIds);
      const lastInvDate =
        detail.last_invoice_date ||
        (detail.invoices && detail.invoices.length > 0 ? detail.invoices[0].date : null);
      const refDate = lastInvDate || detail.reception_date;
      setSubject(`Mission d’expertise depuis le ${refDate.split('-').reverse().join('/')}`);
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

  const currentMissionCode = missions.find(m => m.id === selectedMissionId)?.code || missionDetail?.code;
  const missionInvoicesCount = currentMissionCode
    ? invoices.filter(inv => (inv.mission_code || '').toLowerCase() === currentMissionCode.toLowerCase()).length
    : 0;

  const displayedInvoices = useMemo(() => {
    if (registerFilter === 'all') return invoices;
    return invoices.filter(inv => (inv.mission_code || '').toLowerCase() === registerFilter.toLowerCase());
  }, [invoices, registerFilter]);

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

  // Live preview of grouped invoice lines (matching Valentine's Excel/Word table)
  const groupedPreviewLines = useMemo(() => {
    if (!groupByCategory) {
      return [
        ...selectedActItems.map((a: any) => ({
          desc: a.label,
          qty: 1,
          tps: a.hours,
          unit: a.hourly_rate,
          total: a.total_ht,
        })),
        ...selectedExpItems.map((e: any) => ({
          desc: e.label,
          qty: e.quantity,
          tps: 1,
          unit: e.unit_price,
          total: e.total_ht,
        })),
      ];
    }

    const preview: Array<{ desc: string; qty: number; tps: number | null; unit: number; total: number }> = [];
    const pushActGroup = (acts: any[], label: string) => {
      if (acts.length === 0) return;
      const sumH = Math.round(acts.reduce((s, a) => s + Number(a.hours), 0) * 100) / 100;
      const rate = Number(acts[0].hourly_rate);
      preview.push({ desc: label, qty: 1, tps: sumH, unit: rate, total: Math.round(sumH * rate * 100) / 100 });
    };

    const etudeActs = selectedActItems.filter((a: any) => ['etude_documents', 'analyse', 'echanges_tel'].includes(a.category));
    const expActs = selectedActItems.filter((a: any) => ['expertise', 'reunion'].includes(a.category));
    const reunionAssureursActs = selectedActItems.filter((a: any) => ['reunion_assureurs', 'visio'].includes(a.category));
    const reunionAssureActs = selectedActItems.filter((a: any) => a.category === 'reunion_assure');
    const depActs = selectedActItems.filter((a: any) => a.category === 'deplacement');
    const redActs = selectedActItems.filter((a: any) => a.category === 'redaction');

    // 1. Étude de documents, analyse, gestion du dossier
    pushActGroup(etudeActs, 'Étude de documents, analyse, gestion du dossier');

    // 2. Expertise
    if (expActs.length > 0) {
      const lastDate = expActs[expActs.length - 1].date ? expActs[expActs.length - 1].date.split('-').reverse().join('/') : '';
      pushActGroup(expActs, lastDate ? `Expertise du ${lastDate}` : 'Expertise');
    }

    // 3. Réunion avec les assureurs
    pushActGroup(reunionAssureursActs, 'Réunion avec les assureurs');

    // 4. Réunion avec l’assuré
    pushActGroup(reunionAssureActs, 'Réunion avec l’assuré');

    // 5. Déplacement expert
    pushActGroup(depActs, 'Déplacement expert');

    // 6. Frais de déplacement (train)
    const trainExps = selectedExpItems.filter((e: any) => e.category === 'train');
    if (trainExps.length > 0) {
      const sumTrain = Math.round(trainExps.reduce((s: number, e: any) => s + Number(e.total_ht), 0) * 100) / 100;
      preview.push({ desc: 'Frais de déplacement (train)', qty: 1, tps: 1, unit: sumTrain, total: sumTrain });
    }

    // 7. Frais kilométriques
    const kmExps = selectedExpItems.filter((e: any) => e.category === 'km');
    if (kmExps.length > 0) {
      const sumKm = Math.round(kmExps.reduce((s: number, e: any) => s + Number(e.quantity), 0) * 100) / 100;
      const rate = Number(kmExps[0].unit_price);
      preview.push({ desc: 'Frais kilométriques', qty: sumKm, tps: 1, unit: rate, total: Math.round(sumKm * rate * 100) / 100 });
    }

    // 8 à 13. Autres frais spécifiques
    const pushExpGroup = (cats: string[], defaultLabel: string) => {
      const matching = selectedExpItems.filter((e: any) => cats.includes(e.category));
      if (matching.length === 0) return;
      const sum = Math.round(matching.reduce((s: number, e: any) => s + Number(e.total_ht), 0) * 100) / 100;
      preview.push({ desc: defaultLabel, qty: 1, tps: 1, unit: sum, total: sum });
    };

    pushExpGroup(['peage'], 'Péage');
    pushExpGroup(['location_voiture'], 'Voiture de location');
    pushExpGroup(['repas'], 'Repas');
    pushExpGroup(['hotel'], 'Hôtel');
    pushExpGroup(['parking'], 'Parking');
    pushExpGroup(['taxi'], 'Taxi');
    pushExpGroup(['peage_parking'], 'Parking / Péage');
    pushExpGroup(['autre'], 'Autre frais de déplacement');

    // 14. Rédaction Expert
    pushActGroup(redActs, 'Rédaction Expert');
    return preview;
  }, [selectedActItems, selectedExpItems, groupByCategory]);

  const handleToggleActivity = (id: string) => {
    setSelectedActivities(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleToggleExpense = (id: string) => {
    setSelectedExpenses(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleSaveInlineHours = async (actId: string) => {
    const newHours = parseFloat(editingHoursVal.replace(',', '.'));
    if (isNaN(newHours) || newHours <= 0) return;
    try {
      await api.updateActivity(actId, { hours: newHours });
      setEditingActivityId(null);
      loadSelectedMission();
      onRefreshMissions();
    } catch (err: any) {
      setPrepError(err.message);
    }
  };

  const handlePrepareInvoice = async () => {
    setPrepError(null);
    setPrepSuccess(null);
    if (selectedActivities.length === 0 && selectedExpenses.length === 0) {
      setPrepError("Veuillez sélectionner au moins un élément non facturé.");
      return;
    }

    try {
      const splitPayload = enableCoInsurance
        ? coInsurers.filter(c => c.name.trim()).map(c => {
            const pct = Number(c.percentage) || 0;
            return {
              name: c.name.trim(),
              percentage: pct,
              ref: c.ref.trim(),
              amount_ht: Math.round((calculatedHT * pct) / 100 * 100) / 100,
              net_payable: Math.round((calculatedNetPayable * pct) / 100 * 100) / 100,
            };
          })
        : null;

      const res = await api.prepareInvoice({
        mission_id: selectedMissionId,
        activity_ids: selectedActivities,
        expense_ids: selectedExpenses,
        subject,
        advance_amount: parsedAdvance,
        group_by_category: groupByCategory,
        split_details: splitPayload,
      } as any);
      setPrepSuccess(
        `${res.message} (N° ${res.nextNum} — ${res.netPayable.toFixed(2).replace('.', ',')} € TTC). Vous pouvez télécharger le Word (.docx) ou ajuster les lignes dans le registre ci-dessous.`
      );
      loadInvoices();
      loadSelectedMission();
      onRefreshMissions();
    } catch (err: any) {
      setPrepError(err.message);
    }
  };

  const handleDownloadInvoiceDocx = async (inv: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${inv.id}/docx`);
      if (!res.ok) throw new Error('Erreur lors de la génération Word');
      const blob = await res.blob();
      const fileName = `Facture_${inv.invoice_number}.docx`;

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      // Also sync to local Mac / iCloud Drive folder if connected (both Dossier Page de garde & Compta)
      await syncFileToLocalMacFolder({
        missionCode: inv.mission_code,
        subFolder: '01_Page_de_garde',
        fileName,
        data: blob,
      });
      await syncComptaFileToMac({
        month: (inv.date || '').slice(0, 7),
        subFolder: 'Factures_emises',
        fileName,
        data: blob,
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const openEditInvoiceModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditInvSubject(inv.subject);
    setEditInvAdvance(String(inv.advance_amount || 0));
    setEditInvLines(
      (inv.lines || []).map(l => ({
        ...l,
        quantity: String(l.quantity),
        time_spent: l.time_spent !== null && l.time_spent !== undefined ? String(l.time_spent) : '',
        unit_price_ht: String(l.unit_price_ht),
      }))
    );
  };

  const handleSaveEditedInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    try {
      const cleanedLines = editInvLines.map(l => ({
        id: l.id,
        activity_id: l.activity_id,
        expense_id: l.expense_id,
        description: l.description,
        quantity: parseFloat(String(l.quantity).replace(',', '.')) || 1,
        time_spent: l.time_spent !== '' ? parseFloat(String(l.time_spent).replace(',', '.')) : null,
        unit_price_ht: parseFloat(String(l.unit_price_ht).replace(',', '.')) || 0,
      }));
      const res = await api.updateInvoice(editingInvoice.id, {
        subject: editInvSubject,
        advance_amount: parseFloat(editInvAdvance.replace(',', '.')) || 0,
        lines: cleanedLines,
      });
      setActionFeedback({ type: 'success', message: `${res.message} (Nouveau Net à payer : ${res.netPayable.toFixed(2).replace('.', ',')} € TTC)` });
      setEditingInvoice(null);
      loadInvoices();
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-[#0f3854]" />
            <span>Notes d'honoraires & Facturation</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Format officiel Century Gothic (.docx), gestion des acomptes et suivi des règlements.
          </p>
        </div>
      </div>

      {/* 1. SECTION PREPARATION DE NOTE D'HONORAIRES */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-[#0f3854]"></span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Nouvelle note d'honoraires</h2>
            <span className="text-[11px] text-slate-400 font-normal">| Facturation au temps réel (lignes archivées et soldées)</span>
          </div>

          {/* Mission selection with Search Loupe */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={missionSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setMissionSearch(val);
                  const q = val.trim().toLowerCase();
                  if (q) {
                    const match = missions.find(
                      m =>
                        m.code.toLowerCase().includes(q) ||
                        m.title.toLowerCase().includes(q) ||
                        (m.insurance_client || '').toLowerCase().includes(q)
                    );
                    if (match) setSelectedMissionId(match.id);
                  }
                }}
                placeholder="Rechercher dossier (ex: 728), client..."
                className="text-xs rounded-lg border-slate-300 pl-8 pr-3 py-1.5 bg-white border focus:border-[#0f3854] w-56"
              />
            </div>

            <select
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="text-xs rounded-lg border-slate-300 shadow-2xs focus:border-[#0f3854] focus:ring-[#0f3854] py-1.5 px-3 bg-slate-50 border font-medium text-slate-800"
            >
              {filteredMissions.map(m => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.title.slice(0, 38)}... ({(m.total_unbilled_ht || 0).toFixed(2).replace('.', ',')} € HT)
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
            {/* Unbilled activities with inline hours adjustment */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Temps pointé ({unbilledActivities.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Cliquez sur le temps pour ajuster ou arrondir
                </span>
              </div>

              {unbilledActivities.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 bg-slate-50 rounded-lg text-center">
                  Compteur à zéro • Aucun temps en attente de facturation sur ce dossier.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {unbilledActivities.map((act: any) => (
                    <div
                      key={act.id}
                      className={`p-3 flex items-center justify-between transition-colors ${
                        selectedActivities.includes(act.id) ? 'bg-sky-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <label className="flex items-center space-x-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={selectedActivities.includes(act.id)}
                          onChange={() => handleToggleActivity(act.id)}
                          className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
                        />
                        <div>
                          <p className="font-semibold text-slate-900">{act.label}</p>
                          <p className="text-slate-500 text-[11px]">
                            {act.date.split('-').reverse().join('/')}
                            {act.notes ? ` — Mémo interne : ${act.notes}` : ''}
                          </p>
                        </div>
                      </label>

                      <div className="text-right flex items-center space-x-3">
                        {editingActivityId === act.id ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              value={editingHoursVal}
                              onChange={(e) => setEditingHoursVal(e.target.value)}
                              className="w-16 text-xs border border-[#0f3854] rounded px-1.5 py-0.5 text-right font-bold"
                              autoFocus
                            />
                            <span className="text-[11px] text-slate-500">h</span>
                            <button
                              type="button"
                              onClick={() => handleSaveInlineHours(act.id)}
                              className="px-2 py-0.5 bg-[#0f3854] text-white rounded text-[10px] font-semibold"
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingActivityId(null)}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {act.total_ht.toFixed(2).replace('.', ',')} € HT
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingActivityId(act.id);
                                setEditingHoursVal(String(act.hours));
                              }}
                              title="Cliquer pour ajuster ou arrondir les heures"
                              className="text-[11px] text-[#0f3854] hover:underline font-medium inline-flex items-center space-x-1"
                            >
                              <span>{act.hours.toString().replace('.', ',')} h à {act.hourly_rate} €/h</span>
                              <Edit3 className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
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

            {/* Aperçu des lignes synthétiques qui seront imprimées dans le Word */}
            {groupedPreviewLines.length > 0 && (
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#006A8E] flex items-center space-x-1.5">
                    <Layers className="w-4 h-4" />
                    <span>Aperçu du tableau Word (Century Gothic — Format synthétique VP Expertise)</span>
                  </span>
                  <label className="inline-flex items-center space-x-1.5 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupByCategory}
                      onChange={(e) => setGroupByCategory(e.target.checked)}
                      className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
                    />
                    <span>Regrouper par grande catégorie</span>
                  </label>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600">
                      <th className="py-1 text-left font-bold">Objet</th>
                      <th className="py-1 text-center font-bold">Qté</th>
                      <th className="py-1 text-center font-bold">Tps</th>
                      <th className="py-1 text-right font-bold">Prix Unit. HT</th>
                      <th className="py-1 text-right font-bold">Mt HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60">
                    {groupedPreviewLines.map((gl, i) => (
                      <tr key={i} className="text-slate-700">
                        <td className="py-1.5 pr-2">{gl.desc}</td>
                        <td className="py-1.5 text-center">{String(gl.qty).replace('.', ',')}</td>
                        <td className="py-1.5 text-center">{gl.tps !== null ? String(gl.tps).replace('.', ',') : ''}</td>
                        <td className="py-1.5 text-right">{gl.unit.toFixed(2).replace('.', ',')} €</td>
                        <td className="py-1.5 text-right font-semibold">{gl.total.toFixed(2).replace('.', ',')} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Billing Preview & Confirmation Box */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Objet & Totaux de la Facture
              </span>

              {/* Historique des factures déjà émises sur ce dossier */}
              {missionDetail?.invoices && missionDetail.invoices.length > 0 && (
                <div className="p-2.5 bg-sky-50/80 border border-sky-200 rounded-lg text-[11px] space-y-1">
                  <span className="font-bold text-[#0f3854] block">
                    Facture(s) déjà émise(s) sur {missionDetail.code} ({missionDetail.invoices.length}) :
                  </span>
                  {missionDetail.invoices.slice(0, 3).map((prevInv: any) => (
                    <div key={prevInv.id} className="flex items-center justify-between text-slate-700">
                      <span>
                        N° <strong>{prevInv.invoice_number}</strong> du{' '}
                        {(prevInv.date || '').split('-').reverse().join('/')}
                      </span>
                      <span className="font-semibold">
                        {Number(prevInv.total_ht).toFixed(2).replace('.', ',')} € HT
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  OBJET DE LA FACTURE (imprimé sur le Word)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full text-xs rounded-lg border-slate-300 bg-white p-2 border font-semibold text-slate-900"
                />
                <span className="block text-[10px] text-slate-500 mt-1">
                  {missionDetail?.last_invoice_date
                    ? `✓ Pré-rempli automatiquement depuis la dernière facture du ${missionDetail.last_invoice_date.split('-').reverse().join('/')}`
                    : `✓ 1ère facture sur ce dossier : pré-rempli depuis la date d'ouverture`}
                </span>
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

              {/* Co-assurance & Répartition multi-payeurs */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableCoInsurance}
                    onChange={(e) => setEnableCoInsurance(e.target.checked)}
                    className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854] w-3.5 h-3.5"
                  />
                  <span className="text-[11px] font-bold text-slate-700">
                    Co-assurance / Répartition multi-payeurs
                  </span>
                </label>

                {enableCoInsurance && (
                  <div className="p-3 bg-white rounded-xl border border-sky-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">Compagnies co-assureurs :</span>
                      <button
                        type="button"
                        onClick={() => setCoInsurers(prev => [...prev, { name: '', percentage: 0, ref: '' }])}
                        className="text-[#0f3854] font-bold hover:underline"
                      >
                        + Ajouter un co-assureur
                      </button>
                    </div>

                    {coInsurers.map((co, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                        <input
                          type="text"
                          placeholder="Nom (ex: HELVETIA)"
                          value={co.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCoInsurers(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                          }}
                          className="col-span-5 p-1.5 text-xs border border-slate-300 rounded bg-slate-50 font-semibold"
                        />
                        <div className="col-span-3 flex items-center space-x-0.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="%"
                            value={co.percentage || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setCoInsurers(prev => prev.map((item, i) => i === idx ? { ...item, percentage: val } : item));
                            }}
                            className="w-full p-1.5 text-xs border border-slate-300 rounded bg-slate-50 text-right font-bold"
                          />
                          <span className="text-[10px] text-slate-500 font-bold">%</span>
                        </div>
                        <input
                          type="text"
                          placeholder="Réf"
                          value={co.ref}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCoInsurers(prev => prev.map((item, i) => i === idx ? { ...item, ref: val } : item));
                          }}
                          className="col-span-3 p-1.5 text-xs border border-slate-300 rounded bg-slate-50 font-mono text-[10px]"
                        />
                        <button
                          type="button"
                          onClick={() => setCoInsurers(prev => prev.filter((_, i) => i !== idx))}
                          className="col-span-1 text-slate-400 hover:text-rose-600 text-center font-bold"
                          title="Supprimer"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Total quotes-parts :</span>
                      <span className={`font-bold ${coInsurers.reduce((s, c) => s + (Number(c.percentage) || 0), 0) === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {coInsurers.reduce((s, c) => s + (Number(c.percentage) || 0), 0)} %
                      </span>
                    </div>
                  </div>
                )}
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
                  <span>Total TVA (20%) :</span>
                  <span>{calculatedTVA.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Total TTC :</span>
                  <span>{calculatedTTC.toFixed(2).replace('.', ',')} €</span>
                </div>
                {parsedAdvance > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Acompte :</span>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Registre des notes d'honoraires ({displayedInvoices.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Téléchargement Word (.docx), ajustement avant émission et suivi des règlements.
            </p>
          </div>

          {/* Filtres : Toutes les factures vs Ce dossier uniquement */}
          <div className="flex items-center space-x-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRegisterFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                registerFilter === 'all'
                  ? 'bg-[#0f3854] text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Toutes ({invoices.length})
            </button>
            {currentMissionCode && (
              <button
                type="button"
                onClick={() => setRegisterFilter(currentMissionCode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  registerFilter.toLowerCase() === currentMissionCode.toLowerCase()
                    ? 'bg-[#0f3854] text-white shadow-2xs'
                    : 'bg-sky-50 hover:bg-sky-100 text-[#0f3854] border border-sky-200'
                }`}
              >
                Dossier {currentMissionCode} ({missionInvoicesCount})
              </button>
            )}
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

        {displayedInvoices.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <p>Aucune facture enregistrée{registerFilter !== 'all' ? ` pour le dossier ${registerFilter}` : ''}.</p>
            {registerFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setRegisterFilter('all')}
                className="text-[#0f3854] font-semibold hover:underline"
              >
                Afficher toutes les factures ({invoices.length})
              </button>
            )}
          </div>
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
                {displayedInvoices.map((inv) => {
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
                        <div className="font-medium">{inv.client_name}</div>
                        {inv.split_details && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-0.5">
                            Co-assurance
                          </span>
                        )}
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
                        {/* Word DOCX button always available (even on Drafts!) */}
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoiceDocx(inv)}
                          title="Télécharger la Note d'honoraires Word (.docx) au format officiel"
                          className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>DOCX</span>
                        </button>

                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => openEditInvoiceModal(inv)}
                            title="Ajuster les heures, lignes ou montants de cette facture"
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-sky-50 hover:bg-sky-100 text-[#0f3854] rounded text-[11px] font-medium transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Modifier</span>
                          </button>
                        )}

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

      {/* Modal d'édition directe des lignes et heures d'une facture */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 border border-slate-200 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Modifier la Note d'honoraires N° {editingInvoice.invoice_number} ({editingInvoice.mission_code})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ajustez ou arrondissez librement les heures (Tps), quantités ou libellés : le montant HT et la TVA se recalculent automatiquement.
                </p>
              </div>
              <button onClick={() => setEditingInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Objet de la facture</label>
                  <input
                    type="text"
                    value={editInvSubject}
                    onChange={(e) => setEditInvSubject(e.target.value)}
                    className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Acompte déduit (€)</label>
                  <input
                    type="text"
                    value={editInvAdvance}
                    onChange={(e) => setEditInvAdvance(e.target.value)}
                    className="w-full rounded-lg border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Lignes du tableau de facturation</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditInvLines([
                        ...editInvLines,
                        { id: `line-new-${Date.now()}`, description: 'Expertise contradictoire', quantity: '1', time_spent: '1', unit_price_ht: '190' },
                      ])
                    }
                    className="text-[#0f3854] hover:underline font-semibold inline-flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter une ligne</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2 px-2.5 text-left">Objet</th>
                        <th className="py-2 px-2 text-center w-20">Qté</th>
                        <th className="py-2 px-2 text-center w-20">Tps (h)</th>
                        <th className="py-2 px-2 text-right w-28">Prix Unit. HT</th>
                        <th className="py-2 px-2.5 text-right w-28">Mt HT calculé</th>
                        <th className="py-2 px-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editInvLines.map((line, idx) => {
                        const q = parseFloat(String(line.quantity).replace(',', '.')) || 1;
                        const t = line.time_spent !== '' ? parseFloat(String(line.time_spent).replace(',', '.')) : null;
                        const u = parseFloat(String(line.unit_price_ht).replace(',', '.')) || 0;
                        const rowHT = Math.round((t !== null && !isNaN(t) ? q * t : q) * u * 100) / 100;

                        return (
                          <tr key={idx}>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={line.description}
                                onChange={(e) => {
                                  const copy = [...editInvLines];
                                  copy[idx].description = e.target.value;
                                  setEditInvLines(copy);
                                }}
                                className="w-full border border-slate-200 rounded px-2 py-1"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={line.quantity}
                                onChange={(e) => {
                                  const copy = [...editInvLines];
                                  copy[idx].quantity = e.target.value;
                                  setEditInvLines(copy);
                                }}
                                className="w-full border border-slate-200 rounded px-1.5 py-1 text-center"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={line.time_spent}
                                onChange={(e) => {
                                  const copy = [...editInvLines];
                                  copy[idx].time_spent = e.target.value;
                                  setEditInvLines(copy);
                                }}
                                placeholder="-"
                                className="w-full border border-slate-200 rounded px-1.5 py-1 text-center font-bold text-[#0f3854]"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={line.unit_price_ht}
                                onChange={(e) => {
                                  const copy = [...editInvLines];
                                  copy[idx].unit_price_ht = e.target.value;
                                  setEditInvLines(copy);
                                }}
                                className="w-full border border-slate-200 rounded px-1.5 py-1 text-right"
                              />
                            </td>
                            <td className="p-1.5 text-right font-bold text-slate-800 whitespace-nowrap">
                              {rowHT.toFixed(2).replace('.', ',')} €
                            </td>
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => setEditInvLines(editInvLines.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0f3854] hover:bg-[#16496d] text-white font-semibold rounded-lg"
                >
                  Enregistrer et recalculer la facture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
