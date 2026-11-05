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
  ShieldCheck,
  CheckCircle2,
  UploadCloud,
  FileText,
  Sparkles,
  RefreshCw,
  Search,
  ExternalLink,
  Paperclip,
  FolderOpen,
} from 'lucide-react';
import { AccountingEntry, RecurringExpense, RecurringFrequency, BankReconciliationReport, BankStatementItem } from '@shared/types.js';
import { api } from '../api.js';
import { syncComptaFileToMac, isLocalSyncConnected, getLocalSyncFolderName } from '../utils/localFolderSync.js';

export const ComptaView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [activeSubTab, setActiveSubTab] = useState<'livre' | 'recurrents' | 'tva' | 'rapprochement'>('livre');
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

  // Bank Reconciliation IA ("Tout est carré") state
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationReport, setReconciliationReport] = useState<BankReconciliationReport | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [addingEntryId, setAddingEntryId] = useState<string | null>(null);

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
  const [entryReceiptFile, setEntryReceiptFile] = useState<File | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Monthly Entry Modal (pour ajuster ponctuellement un mois ex: hors-forfait téléphone à l'étranger)
  const [editingEntry, setEditingEntry] = useState<AccountingEntry | null>(null);
  const [editObject, setEditObject] = useState('');
  const [editParty, setEditParty] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editHT, setEditHT] = useState('');
  const [editVat, setEditVat] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
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

  // Bank Reconciliation IA Handlers
  const handleReconcileStatement = async (fileToUse?: File) => {
    const targetFile = fileToUse || statementFile;
    if (!targetFile) {
      setReconcileError("Veuillez sélectionner votre relevé de compte bancaire (PDF ou image).");
      return;
    }
    setReconciling(true);
    setReconcileError(null);
    try {
      const rep = await api.reconcileBankStatement(selectedMonth, targetFile);
      setReconciliationReport(rep);
      setFeedback(rep.is_balanced ? "🎉 Tout est carré ! Votre relevé bancaire concorde avec votre compta." : "Rapprochement effectué : vérifiez les dépenses suggérées ci-dessous.");
    } catch (err: any) {
      setReconcileError(err.message || "Erreur lors de l'analyse du relevé bancaire");
    } finally {
      setReconciling(false);
    }
  };

  const handleSimulateStatement = async () => {
    const fakeContent = `RELEVE DE COMPTE BANCAIRE PROFESSIONNEL - ${selectedMonth}\nSOCIETE GENERALE / AGENCE ASNIERES\nCompte N° 00020194829\nEI VALENTINE PECHEUX\nDate Valeur | Libellé | Débit | Crédit\n`;
    const blob = new Blob([fakeContent], { type: 'text/plain' });
    const file = new File([blob], `Releve_Bancaire_${selectedMonth}.pdf`, { type: 'application/pdf' });
    setStatementFile(file);
    await handleReconcileStatement(file);
  };

  const handleAddFromBank = async (item: BankStatementItem) => {
    setAddingEntryId(item.id);
    try {
      let cleanObject = item.raw_label;
      let cleanParty = 'Fournisseur / CB';
      const upper = item.raw_label.toUpperCase();
      if (upper.includes('PEAGE') || upper.includes('APRR') || upper.includes('SANEF') || upper.includes('VINCI')) {
        cleanObject = 'Péage autoroute';
        cleanParty = upper.includes('APRR') ? 'APRR' : upper.includes('SANEF') ? 'SANEF' : 'Autoroutes';
      } else if (upper.includes('PARKING') || upper.includes('INDIGO') || upper.includes('EFFIA')) {
        cleanObject = 'Parking / Stationnement';
        cleanParty = upper.includes('INDIGO') ? 'INDIGO' : upper.includes('EFFIA') ? 'EFFIA' : 'Parking';
      } else if (upper.includes('SNCF')) {
        cleanObject = 'Billet de train (SNCF)';
        cleanParty = 'SNCF Voyageurs';
      } else if (upper.includes('REST') || upper.includes('BRASSERIE')) {
        cleanObject = 'Repas de déplacement';
        cleanParty = 'Restaurant';
      } else if (upper.includes('HOTEL') || upper.includes('IBIS') || upper.includes('ACCOR')) {
        cleanObject = 'Hôtel / Nuitée déplacement';
        cleanParty = 'Hôtel';
      } else if (upper.includes('TAXI') || upper.includes('G7') || upper.includes('UBER')) {
        cleanObject = 'Course Taxi / VTC';
        cleanParty = upper.includes('G7') ? 'Taxis G7' : 'Taxi';
      }

      await api.addAccountingEntryFromBank({
        month: selectedMonth,
        date: item.date,
        object: cleanObject,
        party: cleanParty,
        amount_ttc: item.amount,
        category: item.suggested_category,
        comment: `Rapproché automatiquement depuis le relevé bancaire : "${item.raw_label}"`,
      });

      if (reconciliationReport) {
        setReconciliationReport({
          ...reconciliationReport,
          unmatched_bank_count: Math.max(0, reconciliationReport.unmatched_bank_count - 1),
          matched_count: reconciliationReport.matched_count + 1,
          is_balanced: reconciliationReport.unmatched_bank_count <= 1,
          items: reconciliationReport.items.map(it =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'matched',
                  matched_entity_type: 'accounting_entry',
                  matched_entity_label: `${cleanObject} (${cleanParty}) — Ajouté à la compta`,
                }
              : it
          ),
          summary_message:
            reconciliationReport.unmatched_bank_count <= 1
              ? `🎉 Tout est carré ! Les ${reconciliationReport.matched_count + 1} opérations de votre relevé bancaire concordent parfaitement avec votre comptabilité de ${selectedMonth}.`
              : reconciliationReport.summary_message,
        });
      }

      setFeedback(`Écriture « ${cleanObject} » (${item.amount.toFixed(2).replace('.', ',')} €) ajoutée à votre tableau de compta !`);
      setTimeout(() => setFeedback(null), 4000);
      loadMonthData();
    } catch (err: any) {
      setReconcileError(err.message);
    } finally {
      setAddingEntryId(null);
    }
  };

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

      let res: any;
      if (entryReceiptFile) {
        const formData = new FormData();
        formData.append('month', selectedMonth);
        formData.append('type', entryType);
        formData.append('frequency', entryType === 'depense' ? entryFrequency : 'ponctuel');
        formData.append('date', entryDate);
        if (entryPiece) formData.append('piece_number', entryPiece);
        if (entryInvoice) formData.append('invoice_number', entryInvoice);
        if (entryCode) formData.append('mission_code', entryCode);
        formData.append('object', entryObject);
        formData.append('party', entryParty);
        formData.append('amount_ht', String(ht));
        formData.append('vat_rate', String(numericRate));
        formData.append('vat_amount', String(vat));
        formData.append('amount_ttc', String(ttc));
        if (entryComment) formData.append('comment', entryComment);
        formData.append('receipt', entryReceiptFile);

        res = await api.addAccountingEntry(formData);
        await syncComptaFileToMac({
          month: selectedMonth,
          subFolder: 'Justificatifs',
          fileName: `${entryDate}_${entryParty.replace(/[^a-zA-Z0-9_-]/g, '_')}_${entryReceiptFile.name}`,
          data: entryReceiptFile,
        });
      } else {
        res = await api.addAccountingEntry({
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
      }
      setShowAddModal(false);
      setModalError(null);
      setEntryObject('');
      setEntryParty('');
      setEntryAmountHT('');
      setEntryVatAmount('0');
      setEntryAmountTTC('');
      setEntryComment('');
      setEntryReceiptFile(null);
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
    setEditReceiptFile(null);
    setUpdateTemplateToo(false);
  };

  const handleSaveEditedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    const ht = parseFloat(editHT.replace(',', '.')) || 0;
    const vat = parseFloat(editVat.replace(',', '.')) || 0;
    const ttc = Math.round((ht + vat) * 100) / 100;

    if (editReceiptFile) {
      const formData = new FormData();
      formData.append('date', editDate);
      formData.append('object', editObject);
      formData.append('party', editParty);
      formData.append('amount_ht', String(ht));
      formData.append('vat_amount', String(vat));
      formData.append('amount_ttc', String(ttc));
      formData.append('comment', editComment);
      formData.append('update_recurring_template', String(updateTemplateToo));
      formData.append('receipt', editReceiptFile);
      await api.updateAccountingEntry(editingEntry.id, formData);

      await syncComptaFileToMac({
        month: selectedMonth,
        subFolder: 'Justificatifs',
        fileName: `${editDate}_${editParty.replace(/[^a-zA-Z0-9_-]/g, '_')}_${editReceiptFile.name}`,
        data: editReceiptFile,
      });
    } else {
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
    }
    setEditingEntry(null);
    setEditReceiptFile(null);
    setFeedback(
      updateTemplateToo
        ? "Écriture et modèle d'abonnement récurrent mis à jour !"
        : `Écriture modifiée ponctuellement pour ${monthLabels[selectedMonth] || selectedMonth} !`
    );
    setTimeout(() => setFeedback(null), 4000);
    loadMonthData();
  };

  const handleQuickAttachReceipt = async (entry: AccountingEntry, file: File) => {
    try {
      await api.uploadAccountingEntryReceipt(entry.id, file);
      await syncComptaFileToMac({
        month: selectedMonth,
        subFolder: 'Justificatifs',
        fileName: `${entry.date}_${entry.party.replace(/[^a-zA-Z0-9_-]/g, '_')}_${file.name}`,
        data: file,
      });
      setFeedback(`Justificatif « ${file.name} » rattaché à « ${entry.object} » et classé dans Compta/${selectedMonth}/Justificatifs !`);
      setTimeout(() => setFeedback(null), 4000);
      loadMonthData();
    } catch (err: any) {
      setFeedback(`Erreur upload justificatif : ${err.message}`);
    }
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
            <Calculator className="w-5 h-5 text-[#0f3854]" />
            <span>Comptabilité & Justificatifs</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Livre mensuel, abonnements récurrents intégrés automatiquement et classement des reçus.
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
            type="button"
            onClick={() => setActiveSubTab('rapprochement')}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors border ${
              activeSubTab === 'rapprochement'
                ? 'bg-emerald-700 text-white border-emerald-800'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Rapprocher Relevé Bancaire</span>
          </button>

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
            <button
              type="button"
              onClick={() => setActiveSubTab('rapprochement')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${
                activeSubTab === 'rapprochement'
                  ? 'bg-[#0f3854] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#0f3854] hover:bg-white/60'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeSubTab === 'rapprochement' ? 'text-emerald-300' : 'text-emerald-600'}`} />
              <span>Rapprochement Bancaire IA ("Tout est carré")</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-700 border border-emerald-500/30">
                IA
              </span>
            </button>
          </div>

          {activeSubTab === 'livre' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              {/* Bandeau discret : Dossier Mac Compta séparé */}
              <div className="py-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 text-slate-600">
                  <FolderOpen className="w-4 h-4 text-[#0f3854] shrink-0" />
                  <span>
                    Dossier Mac dédié :{' '}
                    <code className="font-mono font-semibold text-[#0f3854] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {isLocalSyncConnected() ? `${getLocalSyncFolderName()}/` : ''}02_Frais_Generaux_Compta/{selectedMonth}/Justificatifs/
                    </code>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEntryFrequency('ponctuel');
                    setShowAddModal(true);
                  }}
                  className="text-xs font-semibold text-[#0f3854] hover:underline shrink-0"
                >
                  + Nouveau frais avec justificatif →
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Livre des recettes et dépenses — {monthLabels[selectedMonth] || selectedMonth} ({data.entries.length})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Cliquez sur « + Justif » pour joindre un reçu ou sur l'icône crayon pour ajuster un montant.
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
                      <th className="py-2.5 px-2.5 font-semibold text-center">Justificatif</th>
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
                          {/* Justificatif */}
                          <td className="py-2 px-2.5 text-center whitespace-nowrap">
                            {entry.receipt_filename ? (
                              <div className="inline-flex items-center space-x-1">
                                <a
                                  href={`/uploads/${entry.receipt_filename}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={entry.receipt_original_name || entry.receipt_filename}
                                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>Voir justif</span>
                                </a>
                              </div>
                            ) : (
                              <label className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold cursor-pointer">
                                <Plus className="w-3 h-3 text-[#0f3854]" />
                                <span>Joindre justif</span>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleQuickAttachReceipt(entry, e.target.files[0]);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                            )}
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

          {activeSubTab === 'rapprochement' && (
            <div className="space-y-6">
              {/* Entête Rapprochement */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                        <ShieldCheck className="w-5 h-5" />
                      </span>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Rapprochement Bancaire IA — « Tout est carré »
                        </h2>
                        <p className="text-xs text-slate-500">
                          Déposez votre relevé bancaire professionnel ({monthLabels[selectedMonth] || selectedMonth}). Rocco pointe chaque ligne avec vos factures et votre tableau Excel de compta pour vérifier que tout est bien carré.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSimulateStatement}
                      disabled={reconciling}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors flex items-center space-x-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Simuler relevé {monthLabels[selectedMonth] || selectedMonth}</span>
                    </button>
                  </div>
                </div>

                {/* Zone de Drag & Drop Relevé */}
                <div className="mt-5 border-2 border-dashed border-slate-300 hover:border-[#0f3854] bg-slate-50/60 rounded-xl p-6 text-center transition-colors">
                  <input
                    type="file"
                    id="bank-statement-upload"
                    accept=".pdf,.png,.jpg,.jpeg,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setStatementFile(f);
                        handleReconcileStatement(f);
                      }
                    }}
                  />
                  <label htmlFor="bank-statement-upload" className="cursor-pointer block">
                    <div className="w-12 h-12 rounded-full bg-white shadow-2xs border border-slate-200 text-[#0f3854] mx-auto flex items-center justify-center mb-3">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-slate-800 block">
                      {statementFile ? statementFile.name : 'Glissez votre relevé de compte bancaire (PDF ou scan)'}
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Société Générale, BNP Paribas, BoursoBank, LCL, Crédit Agricole...
                    </span>
                    <span className="inline-block mt-3 px-3 py-1 bg-[#0f3854] text-white text-xs font-semibold rounded-lg hover:bg-[#16496d] shadow-2xs">
                      Parcourir mes fichiers
                    </span>
                  </label>
                </div>

                {reconcileError && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{reconcileError}</span>
                  </div>
                )}

                {reconciling && (
                  <div className="mt-5 p-6 bg-sky-50 border border-sky-200 rounded-xl text-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f3854] mx-auto"></div>
                    <p className="text-sm font-bold text-[#0f3854]">
                      Analyse multimodale Gemini Flash en cours...
                    </p>
                    <p className="text-xs text-slate-600">
                      Extraction des débits/crédits bancaires et lettrage avec vos factures et dépenses de {monthLabels[selectedMonth] || selectedMonth}...
                    </p>
                  </div>
                )}
              </div>

              {/* Rapport de Rapprochement IA */}
              {reconciliationReport && !reconciling && (
                <div className="space-y-5">
                  {/* Bannière de verdict "Tout est carré" */}
                  <div
                    className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      reconciliationReport.is_balanced
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                        : 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start md:items-center space-x-3.5">
                      <div
                        className={`p-2.5 rounded-full ${
                          reconciliationReport.is_balanced
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-amber-600 text-white shadow-sm'
                        }`}
                      >
                        {reconciliationReport.is_balanced ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <AlertCircle className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-extrabold tracking-tight">
                            {reconciliationReport.is_balanced
                              ? '🎉 TOUT EST CARRÉ !'
                              : '⚠️ Rapprochement à finaliser'}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              reconciliationReport.is_balanced
                                ? 'bg-emerald-200 text-emerald-900'
                                : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {reconciliationReport.matched_count} / {reconciliationReport.items.length} opérations lettrées
                          </span>
                        </div>
                        <p className="text-xs mt-1 text-slate-700">
                          {reconciliationReport.summary_message}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-slate-500 uppercase font-semibold block">Relevé analysé</span>
                      <span className="text-xs font-bold text-slate-800">{reconciliationReport.filename}</span>
                    </div>
                  </div>

                  {/* 4 KPIs de Rapprochement */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Crédits Relevé (Reçus)</span>
                      <div className="text-lg font-bold text-emerald-700 mt-1">
                        + {reconciliationReport.total_bank_credits.toFixed(2).replace('.', ',')} €
                      </div>
                      <span className="text-[10px] text-slate-400">Compta : {reconciliationReport.total_book_credits.toFixed(2).replace('.', ',')} €</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Débits Relevé (Dépenses)</span>
                      <div className="text-lg font-bold text-rose-700 mt-1">
                        − {reconciliationReport.total_bank_debits.toFixed(2).replace('.', ',')} €
                      </div>
                      <span className="text-[10px] text-slate-400">Compta : {reconciliationReport.total_book_debits.toFixed(2).replace('.', ',')} €</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Écart de Solde</span>
                      <div className="text-lg font-bold text-[#0f3854] mt-1">
                        {reconciliationReport.discrepancy === 0 ? '0,00 € (Nul)' : `${reconciliationReport.discrepancy.toFixed(2).replace('.', ',')} €`}
                      </div>
                      <span className="text-[10px] text-slate-400">{reconciliationReport.is_balanced ? 'Balance parfaite' : 'À régulariser'}</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">Statut Fiscal & TVA</span>
                      <div className="text-lg font-bold text-slate-800 mt-1">
                        {reconciliationReport.unmatched_bank_count === 0 ? '100% Déductible' : `${reconciliationReport.unmatched_bank_count} en attente`}
                      </div>
                      <span className="text-[10px] text-slate-400">Prêt pour l'expert-comptable</span>
                    </div>
                  </div>

                  {/* Tableau des opérations bancaires non encore dans la compta (Actions 1-clic) */}
                  {reconciliationReport.unmatched_bank_count > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Opérations bancaires détectées mais non saisies dans la compta ({reconciliationReport.unmatched_bank_count})
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500">
                        Ces débits apparaissent sur votre compte bancaire mais manquent dans votre tableau Excel. Cliquez sur « Ajouter à la compta » pour que l'IA calcule immédiatement la TVA déductible.
                      </p>

                      <div className="border border-amber-100 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-amber-50/70 border-b border-amber-200 text-slate-700">
                              <th className="py-2.5 px-3 font-semibold">Date</th>
                              <th className="py-2.5 px-3 font-semibold">Libellé du relevé de compte</th>
                              <th className="py-2.5 px-3 font-semibold">Catégorie suggérée</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Montant TTC</th>
                              <th className="py-2.5 px-3 font-semibold text-center">Action IA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100 bg-white">
                            {reconciliationReport.items
                              .filter((it) => it.status === 'unmatched_bank')
                              .map((it) => (
                                <tr key={it.id} className="hover:bg-amber-50/40">
                                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                    {it.date.split('-').reverse().join('/')}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-900">
                                    {it.raw_label}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                                      {it.suggested_category || 'Dépense'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-extrabold text-rose-700 whitespace-nowrap">
                                    − {it.amount.toFixed(2).replace('.', ',')} €
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleAddFromBank(it)}
                                      disabled={addingEntryId === it.id}
                                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0f3854] hover:bg-[#16496d] text-white shadow-2xs transition-colors"
                                    >
                                      {addingEntryId === it.id ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                        <>
                                          <Plus className="w-3.5 h-3.5" />
                                          <span>Ajouter à la compta</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tableau des opérations lettrées (Concordance 100%) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Opérations lettrées et validées ({reconciliationReport.matched_count})
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        100% conforme
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="py-2.5 px-3 font-semibold">Date</th>
                            <th className="py-2.5 px-3 font-semibold">Opération bancaire (Relevé)</th>
                            <th className="py-2.5 px-3 font-semibold">Écriture compta / Facture correspondante</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Montant</th>
                            <th className="py-2.5 px-3 font-semibold text-center">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reconciliationReport.items
                            .filter((it) => it.status === 'matched')
                            .map((it) => (
                              <tr key={it.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                  {it.date.split('-').reverse().join('/')}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                  {it.raw_label}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 font-semibold">
                                  <span className="text-[#0f3854]">{it.matched_entity_label}</span>
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                                    it.type === 'credit' ? 'text-emerald-700' : 'text-slate-800'
                                  }`}
                                >
                                  {it.type === 'credit' ? '+ ' : '− '}
                                  {it.amount.toFixed(2).replace('.', ',')} €
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Lettré</span>
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tableau des factures en attente d'encaissement */}
                  {reconciliationReport.unmatched_book_items.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-sky-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Factures ou écritures comptables non encore créditées / débitées ({reconciliationReport.unmatched_book_items.length})
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500">
                        Factures d'honoraires en attente de règlement par les assureurs ou dépenses comptables prévues.
                      </p>

                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                              <th className="py-2.5 px-3 font-semibold">Date compta</th>
                              <th className="py-2.5 px-3 font-semibold">Désignation</th>
                              <th className="py-2.5 px-3 font-semibold">Nature</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Montant attendu</th>
                              <th className="py-2.5 px-3 font-semibold text-center">Observation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reconciliationReport.unmatched_book_items.map((it) => (
                              <tr key={it.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                                  {it.date.split('-').reverse().join('/')}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                  {it.label}
                                </td>
                                <td className="py-2.5 px-3 capitalize text-slate-600">
                                  {it.type === 'recette' ? 'Honoraires à encaisser' : 'Charge à débiter'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-800 whitespace-nowrap">
                                  {it.amount.toFixed(2).replace('.', ',')} €
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                    En cours de traitement
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
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

              <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl space-y-1.5">
                <label className="block font-bold text-[#0f3854]">
                  📎 Justificatif (Facture PDF, ticket, reçu photo — facultatif)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setEntryReceiptFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-white file:text-[#0f3854]"
                />
                <span className="block text-[10px] text-slate-500">
                  Sera classé automatiquement dans votre dossier Mac séparé : <code>Compta/{selectedMonth}/Justificatifs/</code>
                </span>
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

              <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl space-y-1.5">
                <label className="block font-bold text-[#0f3854]">
                  📎 Justificatif ({editingEntry.receipt_filename ? 'Remplacer le justificatif existant' : 'Joindre un justificatif'})
                </label>
                {editingEntry.receipt_filename && (
                  <a
                    href={`/uploads/${editingEntry.receipt_filename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>Voir le justificatif actuel ({editingEntry.receipt_original_name || editingEntry.receipt_filename})</span>
                  </a>
                )}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setEditReceiptFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-white file:text-[#0f3854]"
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
