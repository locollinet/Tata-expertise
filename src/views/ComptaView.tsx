import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Download,
  Plus,
  AlertCircle,
  Check,
  ArrowDownRight,
  ArrowUpRight,
  FileSpreadsheet,
  Repeat,
  Edit3,
  Trash2,
  Percent,
  X,
} from 'lucide-react';
import { AccountingEntry, RecurringExpense, RecurringFrequency } from '@shared/types.js';
import { api } from '../api.js';

export const ComptaView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [activeSubTab, setActiveSubTab] = useState<'livre' | 'recurrents' | 'tva'>('livre');
  const [data, setData] = useState<{
    month: string;
    entries: AccountingEntry[];
    recurring_expenses: RecurringExpense[];
    vat_breakdown: Array<{
      label: string;
      rate_label: string;
      base_ht: number;
      vat_amount: number;
      total_ttc: number;
      count: number;
    }>;
    summary: {
      depenses_ht: number;
      depenses_tva: number;
      depenses_ttc: number;
      recettes_ht: number;
      recettes_tva: number;
      recettes_ttc: number;
      tva_nette_a_payer: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add Entry / Recurring Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryType, setEntryType] = useState<'depense' | 'recette'>('depense');
  const [entryFrequency, setEntryFrequency] = useState<RecurringFrequency>('ponctuel');
  const [entryDate, setEntryDate] = useState('2026-10-15');
  const [entryPiece, setEntryPiece] = useState('');
  const [entryInvoice, setEntryInvoice] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [entryObject, setEntryObject] = useState('');
  const [entryParty, setEntryParty] = useState('');
  const [entryAmountHT, setEntryAmountHT] = useState('');
  const [entryVatRateMode, setEntryVatRateMode] = useState<'0' | '0.055' | '0.10' | '0.20' | 'custom'>('0.20');
  const [entryVatAmount, setEntryVatAmount] = useState('0');
  const [entryAmountTTC, setEntryAmountTTC] = useState('');
  const [entryComment, setEntryComment] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Monthly Entry Modal (pour ajuster ponctuellement un mois ex: hors-forfait téléphone à l'étranger)
  const [editingEntry, setEditingEntry] = useState<AccountingEntry | null>(null);
  const [editObject, setEditObject] = useState('');
  const [editParty, setEditParty] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHT, setEditHT] = useState('');
  const [editVat, setEditVat] = useState('');
  const [editComment, setEditComment] = useState('');
  const [updateTemplateToo, setUpdateTemplateToo] = useState(false);

  // Edit Recurring Template Modal (pour modifier un abonnement une fois par an)
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [recObject, setRecObject] = useState('');
  const [recParty, setRecParty] = useState('');
  const [recFreq, setRecFreq] = useState<RecurringFrequency>('mensuel');
  const [recDay, setRecDay] = useState('5');
  const [recHT, setRecHT] = useState('');
  const [recVatRate, setRecVatRate] = useState('0');
  const [recVat, setRecVat] = useState('0');
  const [recComment, setRecComment] = useState('');

  const loadMonthData = async () => {
    setLoading(true);
    try {
      const res = await api.getAccountingEntries(selectedMonth);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEntryDate(`${selectedMonth}-15`);
    loadMonthData();
  }, [selectedMonth]);

  // Automatic HT <-> TVA <-> TTC calculation in Add Modal
  const handleHTChange = (val: string, rateMode = entryVatRateMode) => {
    setEntryAmountHT(val);
    const ht = parseFloat(val.replace(',', '.')) || 0;
    if (rateMode !== 'custom') {
      const rate = parseFloat(rateMode);
      const vat = Math.round(ht * rate * 100) / 100;
      const ttc = Math.round((ht + vat) * 100) / 100;
      setEntryVatAmount(String(vat));
      setEntryAmountTTC(String(ttc));
    } else {
      const vat = parseFloat(entryVatAmount.replace(',', '.')) || 0;
      setEntryAmountTTC(String(Math.round((ht + vat) * 100) / 100));
    }
  };

  const handleTTCChange = (val: string, rateMode = entryVatRateMode) => {
    setEntryAmountTTC(val);
    const ttc = parseFloat(val.replace(',', '.')) || 0;
    if (rateMode !== 'custom') {
      const rate = parseFloat(rateMode);
      const ht = Math.round((ttc / (1 + rate)) * 100) / 100;
      const vat = Math.round((ttc - ht) * 100) / 100;
      setEntryAmountHT(String(ht));
      setEntryVatAmount(String(vat));
    }
  };

  const handleVatRateChange = (newMode: '0' | '0.055' | '0.10' | '0.20' | 'custom') => {
    setEntryVatRateMode(newMode);
    if (entryAmountHT) {
      handleHTChange(entryAmountHT, newMode);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryObject || !entryParty || !entryAmountHT) return;
    try {
      const ht = parseFloat(entryAmountHT.replace(',', '.')) || 0;
      const vat = parseFloat(entryVatAmount.replace(',', '.')) || 0;
      const ttc = parseFloat(entryAmountTTC.replace(',', '.')) || Math.round((ht + vat) * 100) / 100;
      const numericRate = entryVatRateMode === 'custom' ? (ht > 0 ? vat / ht : 0) : parseFloat(entryVatRateMode);

      const res = await api.addAccountingEntry({
        month: selectedMonth,
        type: entryType,
        frequency: entryType === 'depense' ? entryFrequency : 'ponctuel',
        date: entryDate,
        piece_number: entryPiece || undefined,
        invoice_number: entryInvoice || undefined,
        mission_code: entryCode || undefined,
        object: entryObject,
        party: entryParty,
        amount_ht: ht,
        vat_rate: numericRate,
        vat_amount: vat,
        amount_ttc: ttc,
        comment: entryComment || undefined,
      });
      setShowAddModal(false);
      setModalError(null);
      setEntryObject('');
      setEntryParty('');
      setEntryAmountHT('');
      setEntryVatAmount('0');
      setEntryAmountTTC('');
      setEntryComment('');
      setFeedback(res.message);
      setTimeout(() => setFeedback(null), 4000);
      loadMonthData();
    } catch (err: any) {
      setModalError(err.message);
    }
  };

  const openEditEntryModal = (entry: AccountingEntry) => {
    setEditingEntry(entry);
    setEditObject(entry.object);
    setEditParty(entry.party);
    setEditDate(entry.date);
    setEditHT(String(entry.amount_ht));
    setEditVat(String(entry.vat_amount));
    setEditComment(entry.comment || '');
    setUpdateTemplateToo(false);
  };

  const handleSaveEditedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    const ht = parseFloat(editHT.replace(',', '.')) || 0;
    const vat = parseFloat(editVat.replace(',', '.')) || 0;
    const ttc = Math.round((ht + vat) * 100) / 100;

    await api.updateAccountingEntry(editingEntry.id, {
      date: editDate,
      object: editObject,
      party: editParty,
      amount_ht: ht,
      vat_amount: vat,
      amount_ttc: ttc,
      comment: editComment,
      update_recurring_template: updateTemplateToo,
    });
    setEditingEntry(null);
    setFeedback(
      updateTemplateToo
        ? "Écriture et modèle d'abonnement récurrent mis à jour !"
        : `Écriture modifiée ponctuellement pour ${monthLabels[selectedMonth] || selectedMonth} !`
    );
    setTimeout(() => setFeedback(null), 4000);
    loadMonthData();
  };

  const handleDeleteEntry = async (id: string) => {
    await api.deleteAccountingEntry(id);
    loadMonthData();
  };

  const openEditRecurringModal = (rec: RecurringExpense) => {
    setEditingRecurring(rec);
    setRecObject(rec.object);
    setRecParty(rec.party);
    setRecFreq(rec.frequency);
    setRecDay(String(rec.day_of_month));
    setRecHT(String(rec.amount_ht));
    setRecVatRate(String(rec.vat_rate));
    setRecVat(String(rec.vat_amount));
    setRecComment(rec.comment || '');
  };

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecurring) return;
    const ht = parseFloat(recHT.replace(',', '.')) || 0;
    const vat = parseFloat(recVat.replace(',', '.')) || 0;
    const ttc = Math.round((ht + vat) * 100) / 100;

    if (editingRecurring.id === 'new') {
      await api.addRecurringExpense({
        object: recObject,
        party: recParty,
        frequency: recFreq,
        day_of_month: parseInt(recDay, 10) || 5,
        amount_ht: ht,
        vat_rate: parseFloat(recVatRate) || 0,
        vat_amount: vat,
        amount_ttc: ttc,
        comment: recComment,
      });
      setFeedback("Nouvel abonnement / frais récurrent enregistré : il sera intégré automatiquement chaque mois !");
    } else {
      await api.updateRecurringExpense(editingRecurring.id, {
        object: recObject,
        party: recParty,
        frequency: recFreq,
        day_of_month: parseInt(recDay, 10) || 5,
        amount_ht: ht,
        vat_rate: parseFloat(recVatRate) || 0,
        vat_amount: vat,
        amount_ttc: ttc,
        comment: recComment,
      });
      setFeedback("Abonnement récurrent mis à jour !");
    }
    setEditingRecurring(null);
    setTimeout(() => setFeedback(null), 4000);
    loadMonthData();
  };

  const handleToggleRecurringActive = async (rec: RecurringExpense) => {
    await api.updateRecurringExpense(rec.id, { active: !rec.active });
    loadMonthData();
  };

  const handleDeleteRecurring = async (id: string) => {
    await api.deleteRecurringExpense(id);
    loadMonthData();
  };

  const monthLabels: Record<string, string> = {
    '2026-08': 'Août 2026',
    '2026-09': 'Septembre 2026',
    '2026-10': 'Octobre 2026',
    '2026-11': 'Novembre 2026',
    '2026-12': 'Décembre 2026',
  };

  const frequencyLabels: Record<string, string> = {
    ponctuel: 'Ponctuel',
    mensuel: 'Mensuel',
    trimestriel: 'Trimestriel',
    annuel: 'Annuel',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title & Month Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Calculator className="w-6 h-6 text-[#0f3854]" />
            <span>Suivi Comptable, Abonnements Récurrents & Détail TVA</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vos abonnements et charges fixes (Loyer, URSSAF, SFR, CORGECO, ADIS...) s'intègrent automatiquement chaque mois et restent modifiables ponctuellement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-semibold rounded-lg border-slate-300 shadow-2xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-3 bg-white border"
          >
            {Object.entries(monthLabels).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <a
            href={`/api/compta/export?month=${selectedMonth}`}
            download
            className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Exporter Excel (.xlsx)</span>
          </a>

          <button
            onClick={() => {
              setEntryFrequency('ponctuel');
              setShowAddModal(true);
            }}
            className="inline-flex items-center space-x-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4 text-[#0f3854]" />
            <span>+ Écriture / Frais</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{feedback}</span>
        </div>
      )}

      {loading || !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f3854]"></div>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recettes */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-[#0f3854]">Recettes du mois</span>
                <ArrowUpRight className="w-4 h-4 text-[#0f3854]" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900">
                  {data.summary.recettes_ttc.toFixed(2).replace('.', ',')} €
                </span>
                <span className="text-xs font-semibold text-slate-500">TTC</span>
              </div>
              <div className="mt-2 text-xs text-slate-600 flex justify-between border-t border-slate-100 pt-2">
                <span>HT : {data.summary.recettes_ht.toFixed(2).replace('.', ',')} €</span>
                <span className="font-semibold text-[#0f3854]">TVA collectée (20%) : {data.summary.recettes_tva.toFixed(2).replace('.', ',')} €</span>
              </div>
            </div>

            {/* Dépenses */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-rose-600">Dépenses & Charges ({monthLabels[selectedMonth]})</span>
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900">
                  {data.summary.depenses_ttc.toFixed(2).replace('.', ',')} €
                </span>
                <span className="text-xs font-semibold text-slate-500">TTC</span>
              </div>
              <div className="mt-2 text-xs text-slate-600 flex justify-between border-t border-slate-100 pt-2">
                <span>HT : {data.summary.depenses_ht.toFixed(2).replace('.', ',')} €</span>
                <span className="font-semibold text-rose-700">TVA déductible : {data.summary.depenses_tva.toFixed(2).replace('.', ',')} €</span>
              </div>
            </div>

            {/* TVA nette due */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-amber-600">TVA Nette à déclarer (DGFIP)</span>
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-[#0f3854]">
                  {data.summary.tva_nette_a_payer.toFixed(2).replace('.', ',')} €
                </span>
                <span className="text-xs font-semibold text-slate-500">À reverser</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                {data.summary.recettes_tva.toFixed(2).replace('.', ',')} € collectés − {data.summary.depenses_tva.toFixed(2).replace('.', ',')} € déductibles
              </p>
            </div>
          </div>

          {/* Sub-navigation Tabs : Livre Mensuel | Abonnements & Frais Récurrents | Détail de la TVA */}
          <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-fit">
            <button
              type="button"
              onClick={() => setActiveSubTab('livre')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${
                activeSubTab === 'livre' ? 'bg-white text-[#0f3854] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>Livre mensuel ({data.entries.length} lignes)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('recurrents')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${
                activeSubTab === 'recurrents' ? 'bg-white text-[#0f3854] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Repeat className="w-4 h-4 text-emerald-600" />
              <span>Abonnements & Charges fixes récurrentes ({data.recurring_expenses?.length || 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('tva')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${
                activeSubTab === 'tva' ? 'bg-white text-[#0f3854] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Percent className="w-4 h-4 text-amber-600" />
              <span>Détail & Ventilation de la TVA</span>
            </button>
          </div>

          {activeSubTab === 'livre' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Livre comptable — {monthLabels[selectedMonth] || selectedMonth} ({data.entries.length} écritures)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Cliquez sur « Modifier » sur n'importe quelle ligne (ex: dépassement téléphone à l'étranger, régularisation URSSAF) pour l'ajuster ce mois-ci.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('recurrents')}
                  className="text-xs font-semibold text-[#0f3854] hover:underline inline-flex items-center space-x-1"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Gérer mes abonnements mensuels / annuels →</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                      <th className="py-2.5 px-2.5 font-semibold">Date</th>
                      <th className="py-2.5 px-2.5 font-semibold">Fréquence / Dossier</th>
                      <th className="py-2.5 px-2.5 font-semibold">Objet de l'opération</th>
                      <th className="py-2.5 px-2.5 font-semibold">Tiers (Client / Fournisseur)</th>
                      <th className="py-2.5 px-2.5 font-semibold text-right text-rose-700 bg-rose-50/30">Dépense HT</th>
                      <th className="py-2.5 px-2.5 font-semibold text-right text-rose-700 bg-rose-50/30">TVA déd.</th>
                      <th className="py-2.5 px-2.5 font-semibold text-right text-rose-700 bg-rose-50/30">Dépense TTC</th>
                      <th className="py-2.5 px-2.5 font-semibold text-right text-[#0f3854] bg-sky-50/30">Recette HT</th>
                      <th className="py-2.5 px-2.5 font-semibold text-right text-[#0f3854] bg-sky-50/30">TVA coll.</th>
                      <th className="py-2.5 px-2.5 font-semibold text-right text-[#0f3854] bg-sky-50/30">Recette TTC</th>
                      <th className="py-2.5 px-2.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.entries.map((entry) => {
                      const isRec = Boolean(entry.recurring_expense_id || (entry.frequency && entry.frequency !== 'ponctuel'));
                      const tvaPct =
                        entry.amount_ht > 0 && entry.vat_amount > 0
                          ? `${Math.round((entry.vat_amount / entry.amount_ht) * 1000) / 10}%`
                          : '0%';
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">
                            {entry.date.split('-').reverse().join('/')}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            {entry.mission_code ? (
                              <span className="font-bold text-[#0f3854]">{entry.mission_code}</span>
                            ) : isRec ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Repeat className="w-2.5 h-2.5" />
                                <span>{frequencyLabels[entry.frequency || 'mensuel'] || 'Mensuel'}</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Frais cabinet</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 font-medium text-slate-900">
                            {entry.object}
                            {entry.comment && <span className="block text-[10px] text-slate-400">{entry.comment}</span>}
                          </td>
                          <td className="py-2 px-2.5 text-slate-700">{entry.party}</td>
                          {/* Dépenses */}
                          <td className="py-2 px-2.5 text-right text-slate-600 bg-rose-50/20 whitespace-nowrap">
                            {entry.type === 'depense' ? `${entry.amount_ht.toFixed(2).replace('.', ',')} €` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right text-slate-500 bg-rose-50/20 whitespace-nowrap">
                            {entry.type === 'depense' ? (
                              <span>
                                {entry.vat_amount.toFixed(2).replace('.', ',')} €{' '}
                                <span className="text-[10px] text-slate-400">({tvaPct})</span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-rose-700 bg-rose-50/20 whitespace-nowrap">
                            {entry.type === 'depense' ? `${entry.amount_ttc.toFixed(2).replace('.', ',')} €` : '—'}
                          </td>
                          {/* Recettes */}
                          <td className="py-2 px-2.5 text-right text-slate-600 bg-sky-50/20 whitespace-nowrap">
                            {entry.type === 'recette' ? `${entry.amount_ht.toFixed(2).replace('.', ',')} €` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right text-slate-500 bg-sky-50/20 whitespace-nowrap">
                            {entry.type === 'recette' ? `${entry.vat_amount.toFixed(2).replace('.', ',')} €` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-[#0f3854] bg-sky-50/20 whitespace-nowrap">
                            {entry.type === 'recette' ? `${entry.amount_ttc.toFixed(2).replace('.', ',')} €` : '—'}
                          </td>
                          <td className="py-2 px-2.5 text-right whitespace-nowrap space-x-1">
                            <button
                              type="button"
                              onClick={() => openEditEntryModal(entry)}
                              title="Modifier cette ligne pour ce mois (ex: dépassement ponctuel)"
                              className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px]"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Modifier</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              title="Retirer de ce mois"
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'recurrents' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <Repeat className="w-5 h-5 text-emerald-600" />
                    <span>Mes Abonnements & Charges fixes récurrentes</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Saisissez vos charges récurrentes une seule fois : elles s'ajoutent automatiquement chaque mois dans votre livre comptable. Vous ne les mettez à jour qu'une fois par an.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openEditRecurringModal({
                      id: 'new',
                      object: '',
                      party: '',
                      category: 'autre',
                      frequency: 'mensuel',
                      day_of_month: 5,
                      amount_ht: 0,
                      vat_rate: 0.2,
                      vat_amount: 0,
                      amount_ttc: 0,
                      active: true,
                    })
                  }
                  className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-3.5 py-2 rounded-lg text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Nouvel abonnement / charge récurrente</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                      <th className="py-2.5 px-3 font-semibold">Jour</th>
                      <th className="py-2.5 px-3 font-semibold">Fréquence</th>
                      <th className="py-2.5 px-3 font-semibold">Objet / Abonnement</th>
                      <th className="py-2.5 px-3 font-semibold">Fournisseur / Organisme</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Montant HT</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Taux & TVA</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Montant TTC</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Actif</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data.recurring_expenses || []).map((rec) => (
                      <tr key={rec.id} className={`hover:bg-slate-50/50 ${!rec.active ? 'opacity-50' : ''}`}>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">Le {rec.day_of_month} du mois</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                            {rec.frequency}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {rec.object}
                          {rec.comment && <span className="block text-[10px] text-slate-400 font-normal">{rec.comment}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{rec.party}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                          {rec.amount_ht.toFixed(2).replace('.', ',')} €
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {rec.vat_amount.toFixed(2).replace('.', ',')} € ({Math.round((rec.vat_rate || 0) * 1000) / 10}%)
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-700">
                          {rec.amount_ttc.toFixed(2).replace('.', ',')} €
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={rec.active}
                            onChange={() => handleToggleRecurringActive(rec)}
                            className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditRecurringModal(rec)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Modifier</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecurring(rec.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'tva' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Percent className="w-5 h-5 text-amber-600" />
                  <span>Détail et Ventilation de la TVA — {monthLabels[selectedMonth] || selectedMonth}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Synthèse détaillée par taux de TVA pour la déclaration mensuelle CA3 et votre expert-comptable (CORGECO).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* TVA Collectée */}
                <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/30 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f3854]">
                    1. TVA Collectée sur les Notes d'honoraires encaissées / émises
                  </h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-sky-200 text-slate-600">
                        <th className="py-1.5 text-left">Taux</th>
                        <th className="py-1.5 text-right">Base HT</th>
                        <th className="py-1.5 text-right">Montant TVA</th>
                        <th className="py-1.5 text-right">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-2 font-semibold text-slate-800">Taux normal 20% (Honoraires d'expertise)</td>
                        <td className="py-2 text-right">{data.summary.recettes_ht.toFixed(2).replace('.', ',')} €</td>
                        <td className="py-2 text-right font-bold text-[#0f3854]">{data.summary.recettes_tva.toFixed(2).replace('.', ',')} €</td>
                        <td className="py-2 text-right font-semibold">{data.summary.recettes_ttc.toFixed(2).replace('.', ',')} €</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Résumé TVA Nette */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    2. Solde de TVA du mois ({monthLabels[selectedMonth]})
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total TVA collectée (20%) :</span>
                      <span className="font-bold text-slate-900">+ {data.summary.recettes_tva.toFixed(2).replace('.', ',')} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total TVA déductible sur achats & frais :</span>
                      <span className="font-bold text-rose-700">− {data.summary.depenses_tva.toFixed(2).replace('.', ',')} €</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-amber-200 text-sm font-extrabold text-[#0f3854]">
                      <span>TVA nette à payer (DGFIP) :</span>
                      <span>{data.summary.tva_nette_a_payer.toFixed(2).replace('.', ',')} €</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ventilation TVA Déductible par taux */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  3. Ventilation détaillée de la TVA déductible par taux (Dépenses & Abonnements)
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-3 font-semibold">Catégorie / Taux de TVA</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Taux</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Nb lignes</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Base HT</th>
                        <th className="py-2.5 px-3 font-semibold text-right">TVA Déductible</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.vat_breakdown || []).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-medium text-slate-900">{row.label}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-700">{row.rate_label}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">{row.count}</td>
                          <td className="py-2.5 px-3 text-right text-slate-700">{row.base_ht.toFixed(2).replace('.', ',')} €</td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-700">{row.vat_amount.toFixed(2).replace('.', ',')} €</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{row.total_ttc.toFixed(2).replace('.', ',')} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal : Ajouter une ligne comptable ou un nouvel abonnement récurrent */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Ajouter un frais, un abonnement ou une écriture comptable</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-3">
              {modalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Type *</label>
                  <select
                    value={entryType}
                    onChange={(e: any) => setEntryType(e.target.value)}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white font-semibold"
                  >
                    <option value="depense">Dépense / Frais</option>
                    <option value="recette">Recette</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Fréquence *</label>
                  <select
                    value={entryFrequency}
                    onChange={(e: any) => setEntryFrequency(e.target.value)}
                    disabled={entryType === 'recette'}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white font-semibold text-[#0f3854]"
                  >
                    <option value="ponctuel">Ponctuel (ce mois)</option>
                    <option value="mensuel">Mensuel (Abonnement)</option>
                    <option value="trimestriel">Trimestriel</option>
                    <option value="annuel">Annuel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Date *</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Objet / Nature *</label>
                  <input
                    type="text"
                    value={entryObject}
                    onChange={(e) => setEntryObject(e.target.value)}
                    placeholder="ex: Abonnement mobile, Assurance..."
                    required
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Tiers (Fournisseur ou Client) *</label>
                  <input
                    type="text"
                    value={entryParty}
                    onChange={(e) => setEntryParty(e.target.value)}
                    placeholder="ex: SFR, April, URSSAF..."
                    required
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              {/* Détail TVA & Calcul automatique HT / TVA / TTC */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Détail HT / TVA / TTC</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-[11px] text-slate-500">Taux TVA :</span>
                    {[
                      { l: '0% (Exonéré)', v: '0' },
                      { l: '5,5%', v: '0.055' },
                      { l: '10%', v: '0.10' },
                      { l: '20%', v: '0.20' },
                      { l: 'Manuel', v: 'custom' },
                    ].map((btn) => (
                      <button
                        key={btn.v}
                        type="button"
                        onClick={() => handleVatRateChange(btn.v as any)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          entryVatRateMode === btn.v
                            ? 'bg-[#0f3854] text-white border-[#0f3854]'
                            : 'bg-white text-slate-600 border-slate-300'
                        }`}
                      >
                        {btn.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-600 mb-1">Montant HT (€) *</label>
                    <input
                      type="text"
                      value={entryAmountHT}
                      onChange={(e) => handleHTChange(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full rounded-md border-slate-300 p-2 border bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Montant TVA (€)</label>
                    <input
                      type="text"
                      value={entryVatAmount}
                      onChange={(e) => {
                        setEntryVatRateMode('custom');
                        setEntryVatAmount(e.target.value);
                        const ht = parseFloat(entryAmountHT.replace(',', '.')) || 0;
                        const v = parseFloat(e.target.value.replace(',', '.')) || 0;
                        setEntryAmountTTC(String(Math.round((ht + v) * 100) / 100));
                      }}
                      placeholder="0.00"
                      className="w-full rounded-md border-slate-300 p-2 border bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Montant TTC (€)</label>
                    <input
                      type="text"
                      value={entryAmountTTC}
                      onChange={(e) => handleTTCChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-md border-slate-300 p-2 border bg-white font-bold text-[#0f3854]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Commentaires / Références</label>
                <input
                  type="text"
                  value={entryComment}
                  onChange={(e) => setEntryComment(e.target.value)}
                  placeholder="ex: Prélèvement automatique mensuel"
                  className="w-full rounded-md border-slate-300 p-2 border bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0f3854] text-white font-semibold rounded"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal : Modifier ponctuellement une écriture du mois (ex: dépassement téléphone à l'étranger) */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Modifier l'écriture ({monthLabels[selectedMonth] || selectedMonth})
              </h3>
              <button onClick={() => setEditingEntry(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedEntry} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Tiers / Fournisseur</label>
                  <input
                    type="text"
                    value={editParty}
                    onChange={(e) => setEditParty(e.target.value)}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Objet</label>
                <input
                  type="text"
                  value={editObject}
                  onChange={(e) => setEditObject(e.target.value)}
                  className="w-full rounded-md border-slate-300 p-2 border bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Montant HT (€)</label>
                  <input
                    type="text"
                    value={editHT}
                    onChange={(e) => {
                      setEditHT(e.target.value);
                      if (editingEntry.vat_rate && editingEntry.vat_rate > 0) {
                        const h = parseFloat(e.target.value.replace(',', '.')) || 0;
                        setEditVat(String(Math.round(h * editingEntry.vat_rate * 100) / 100));
                      }
                    }}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Montant TVA (€)</label>
                  <input
                    type="text"
                    value={editVat}
                    onChange={(e) => setEditVat(e.target.value)}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Commentaire (ex: hors-forfait étranger)</label>
                <input
                  type="text"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full rounded-md border-slate-300 p-2 border bg-white"
                />
              </div>

              {editingEntry.recurring_expense_id && (
                <label className="flex items-start space-x-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateTemplateToo}
                    onChange={(e) => setUpdateTemplateToo(e.target.checked)}
                    className="rounded border-slate-300 text-[#0f3854] mt-0.5"
                  />
                  <span className="text-[11px] text-amber-900">
                    Appliquer aussi ce nouveau montant à mon modèle d'abonnement pour tous les mois suivants (décochez s'il s'agit d'un dépassement ponctuel ce mois-ci).
                  </span>
                </label>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0f3854] text-white font-semibold rounded"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal : Créer / Modifier un modèle d'abonnement récurrent */}
      {editingRecurring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingRecurring.id === 'new' ? 'Nouvel abonnement / charge récurrente' : `Modifier l'abonnement : ${editingRecurring.object}`}
              </h3>
              <button onClick={() => setEditingRecurring(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecurring} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Objet / Abonnement *</label>
                  <input
                    type="text"
                    value={recObject}
                    onChange={(e) => setRecObject(e.target.value)}
                    required
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Fournisseur / Organisme *</label>
                  <input
                    type="text"
                    value={recParty}
                    onChange={(e) => setRecParty(e.target.value)}
                    required
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Fréquence *</label>
                  <select
                    value={recFreq}
                    onChange={(e: any) => setRecFreq(e.target.value)}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white font-semibold"
                  >
                    <option value="mensuel">Mensuel (tous les mois)</option>
                    <option value="trimestriel">Trimestriel</option>
                    <option value="annuel">Annuel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Jour habituel du mois (1-28)</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={recDay}
                    onChange={(e) => setRecDay(e.target.value)}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-600 mb-1">Montant HT (€) *</label>
                  <input
                    type="text"
                    value={recHT}
                    onChange={(e) => {
                      setRecHT(e.target.value);
                      const h = parseFloat(e.target.value.replace(',', '.')) || 0;
                      const r = parseFloat(recVatRate) || 0;
                      setRecVat(String(Math.round(h * r * 100) / 100));
                    }}
                    required
                    className="w-full rounded-md border-slate-300 p-2 border bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Taux TVA</label>
                  <select
                    value={recVatRate}
                    onChange={(e) => {
                      setRecVatRate(e.target.value);
                      const h = parseFloat(recHT.replace(',', '.')) || 0;
                      const r = parseFloat(e.target.value) || 0;
                      setRecVat(String(Math.round(h * r * 100) / 100));
                    }}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  >
                    <option value="0">0% (Exonéré)</option>
                    <option value="0.055">5,5%</option>
                    <option value="0.1">10%</option>
                    <option value="0.2">20%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">TVA (€)</label>
                  <input
                    type="text"
                    value={recVat}
                    onChange={(e) => setRecVat(e.target.value)}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Note / Commentaire</label>
                <input
                  type="text"
                  value={recComment}
                  onChange={(e) => setRecComment(e.target.value)}
                  className="w-full rounded-md border-slate-300 p-2 border bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecurring(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0f3854] text-white font-semibold rounded"
                >
                  Enregistrer l'abonnement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
