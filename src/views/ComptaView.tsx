import React, { useState, useEffect } from 'react';
import { Calculator, Download, Plus, AlertCircle, Check, ArrowDownRight, ArrowUpRight, FileSpreadsheet } from 'lucide-react';
import { AccountingEntry } from '@shared/types.js';
import { api } from '../api.js';

export const ComptaView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [data, setData] = useState<{
    month: string;
    entries: AccountingEntry[];
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
  const [showAddModal, setShowAddModal] = useState(false);

  // New entry form state
  const [entryType, setEntryType] = useState<'depense' | 'recette'>('depense');
  const [entryDate, setEntryDate] = useState('2026-10-15');
  const [entryPiece, setEntryPiece] = useState('');
  const [entryInvoice, setEntryInvoice] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [entryObject, setEntryObject] = useState('');
  const [entryParty, setEntryParty] = useState('');
  const [entryAmountHT, setEntryAmountHT] = useState('');
  const [entryVatAmount, setEntryVatAmount] = useState('0');
  const [entryComment, setEntryComment] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

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
    loadMonthData();
  }, [selectedMonth]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryObject || !entryParty || !entryAmountHT) return;
    try {
      await api.addAccountingEntry({
        month: selectedMonth,
        type: entryType,
        date: entryDate,
        piece_number: entryPiece || undefined,
        invoice_number: entryInvoice || undefined,
        mission_code: entryCode || undefined,
        object: entryObject,
        party: entryParty,
        amount_ht: parseFloat(entryAmountHT.replace(',', '.')),
        vat_amount: parseFloat(entryVatAmount.replace(',', '.')) || 0,
        comment: entryComment || undefined,
      });
      setShowAddModal(false);
      setModalError(null);
      setEntryObject('');
      setEntryParty('');
      setEntryAmountHT('');
      setEntryVatAmount('0');
      loadMonthData();
    } catch (err: any) {
      setModalError(err.message);
    }
  };

  const monthLabels: Record<string, string> = {
    '2026-08': 'Août 2026',
    '2026-09': 'Septembre 2026',
    '2026-10': 'Octobre 2026',
    '2026-11': 'Novembre 2026',
    '2026-12': 'Décembre 2026',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title & Month Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Calculator className="w-6 h-6 text-[#0f3854]" />
            <span>Suivi Comptable & Déclaration TVA</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Export mensuel conforme pour votre expert-comptable (Dépenses, Recettes et ventilation TVA).
          </p>
        </div>

        <div className="flex items-center space-x-2">
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
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-xs font-medium shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4 text-[#0f3854]" />
            <span>+ Écriture</span>
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f3854]"></div>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recettes (Incomes) */}
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
                <span>TVA collectée : {data.summary.recettes_tva.toFixed(2).replace('.', ',')} €</span>
              </div>
            </div>

            {/* Dépenses (Expenses) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-rose-600">Dépenses du mois</span>
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
                <span>TVA déductible : {data.summary.depenses_tva.toFixed(2).replace('.', ',')} €</span>
              </div>
            </div>

            {/* TVA nette due */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-amber-600">TVA Nette à déclarer</span>
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-[#0f3854]">
                  {data.summary.tva_nette_a_payer.toFixed(2).replace('.', ',')} €
                </span>
                <span className="text-xs font-semibold text-slate-500">À reverser</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                Calcul : {data.summary.recettes_tva.toFixed(2).replace('.', ',')} € collectés - {data.summary.depenses_tva.toFixed(2).replace('.', ',')} € déductibles
              </p>
            </div>
          </div>

          {/* Monthly Accounting Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Livre comptable — {monthLabels[selectedMonth] || selectedMonth} ({data.entries.length} lignes)
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Facture / Pièce</th>
                    <th className="py-2.5 px-3 font-semibold">Dossier</th>
                    <th className="py-2.5 px-3 font-semibold">Objet de l'opération</th>
                    <th className="py-2.5 px-3 font-semibold">Tiers (Client / Fournisseur)</th>
                    <th className="py-2.5 px-3 font-semibold text-right text-rose-700 bg-rose-50/30">Dépense HT</th>
                    <th className="py-2.5 px-3 font-semibold text-right text-rose-700 bg-rose-50/30">Dépense TTC</th>
                    <th className="py-2.5 px-3 font-semibold text-right text-[#0f3854] bg-sky-50/30">Recette HT</th>
                    <th className="py-2.5 px-3 font-semibold text-right text-[#0f3854] bg-sky-50/30">Recette TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                        {entry.date.split('-').reverse().join('/')}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {entry.invoice_number || entry.piece_number || "—"}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {entry.mission_code || "Frais cabinet"}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {entry.object}
                        {entry.comment && <span className="block text-[11px] text-slate-400">{entry.comment}</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {entry.party}
                      </td>
                      {/* Dépenses */}
                      <td className="py-2 px-3 text-right text-slate-600 bg-rose-50/20">
                        {entry.type === 'depense' ? `${entry.amount_ht.toFixed(2).replace('.', ',')} €` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-rose-700 bg-rose-50/20">
                        {entry.type === 'depense' ? `${entry.amount_ttc.toFixed(2).replace('.', ',')} €` : "—"}
                      </td>
                      {/* Recettes */}
                      <td className="py-2 px-3 text-right text-slate-600 bg-sky-50/20">
                        {entry.type === 'recette' ? `${entry.amount_ht.toFixed(2).replace('.', ',')} €` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#0f3854] bg-sky-50/20">
                        {entry.type === 'recette' ? `${entry.amount_ttc.toFixed(2).replace('.', ',')} €` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Custom Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Ajouter une ligne comptable</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-3">
              {modalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Type *</label>
                  <select
                    value={entryType}
                    onChange={(e: any) => setEntryType(e.target.value)}
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  >
                    <option value="depense">Dépense (Achat / Frais)</option>
                    <option value="recette">Recette (Encaissement)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Date *</label>
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
                  <label className="block text-slate-600 mb-1">Objet / Nature *</label>
                  <input
                    type="text"
                    value={entryObject}
                    onChange={(e) => setEntryObject(e.target.value)}
                    placeholder="ex: Loyer bureau ou Assurance"
                    required
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Tiers (Fournisseur ou Client) *</label>
                  <input
                    type="text"
                    value={entryParty}
                    onChange={(e) => setEntryParty(e.target.value)}
                    placeholder="ex: Pecheux SCI ou April"
                    required
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Montant HT (€) *</label>
                  <input
                    type="text"
                    value={entryAmountHT}
                    onChange={(e) => setEntryAmountHT(e.target.value)}
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
                    onChange={(e) => setEntryVatAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border-slate-300 p-2 border bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Commentaires / Références</label>
                <input
                  type="text"
                  value={entryComment}
                  onChange={(e) => setEntryComment(e.target.value)}
                  placeholder="ex: Prélèvement mensuel"
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
    </div>
  );
};
