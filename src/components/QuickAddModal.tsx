import React, { useState } from 'react';
import { X, Clock, Receipt, Check, AlertCircle } from 'lucide-react';
import { Mission } from '@shared/types.js';
import { api } from '../api.js';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  missions: Mission[];
  onSuccess: () => void;
  defaultMissionId?: string;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  missions,
  onSuccess,
  defaultMissionId,
}) => {
  const [tab, setTab] = useState<'activity' | 'expense'>('activity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // Activity fields
  const [missionId, setMissionId] = useState(defaultMissionId || (missions[0]?.id || ''));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<'etude_documents' | 'analyse' | 'expertise' | 'visio' | 'reunion' | 'redaction' | 'deplacement'>('expertise');
  const [hours, setHours] = useState('1.5');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  // Expense fields
  const [expCategory, setExpCategory] = useState<'km' | 'train' | 'hotel' | 'repas' | 'peage_parking' | 'taxi' | 'autre'>('train');
  const [expLabel, setExpLabel] = useState('');
  const [expQty, setExpQty] = useState('1');
  const [expUnitPrice, setExpUnitPrice] = useState('0');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const selectedMission = missions.find(m => m.id === missionId);
  const hourlyRate = category === 'deplacement' ? (selectedMission?.custom_travel_rate || 135) : (selectedMission?.custom_hourly_rate || 190);
  const parsedHours = parseFloat(hours.replace(',', '.')) || 0;
  const calculatedActivityHT = Math.round(parsedHours * hourlyRate * 100) / 100;

  // Expense calculation
  const parsedQty = parseFloat(expQty.replace(',', '.')) || 0;
  const parsedUnitPrice = parseFloat(expUnitPrice.replace(',', '.')) || 0;
  const calculatedExpenseHT = Math.round(parsedQty * parsedUnitPrice * 100) / 100;
  const expVatRate = expCategory === 'km' ? 0 : 0.20;
  const calculatedExpenseTTC = Math.round(calculatedExpenseHT * (1 + expVatRate) * 100) / 100;

  const handleExpenseCategoryChange = (newCat: any) => {
    setExpCategory(newCat);
    if (newCat === 'km') {
      setExpUnitPrice(String(selectedMission?.custom_km_rate || 0.95));
      if (!expLabel) setExpLabel('Frais kilométriques');
    } else if (newCat === 'repas') {
      setExpUnitPrice('25.00');
      if (!expLabel) setExpLabel('Repas de travail mission');
    } else {
      setExpUnitPrice('');
    }
  };

  const executeSubmit = async (keepOpen = false) => {
    setError(null);
    setSuccessFeedback(null);
    setLoading(true);

    try {
      if (tab === 'activity') {
        if (!label.trim()) throw new Error("Veuillez saisir un libellé descriptif");
        if (parsedHours <= 0) throw new Error("Le nombre d'heures doit être supérieur à zéro");

        await api.addActivity({
          mission_id: missionId,
          date,
          category,
          label: label.trim(),
          hours: parsedHours,
          hourly_rate: hourlyRate,
          notes: notes.trim() || undefined,
          billable: true,
        });

        if (keepOpen) {
          setLabel('');
          setNotes('');
          setSuccessFeedback(`Pointage de ${parsedHours}h enregistré sur ${selectedMission?.code || 'le dossier'} ! Prêt pour le suivant.`);
        }
      } else {
        if (!expLabel.trim()) throw new Error("Veuillez saisir un libellé de frais");
        if (parsedUnitPrice <= 0) throw new Error("Le montant unitaire doit être supérieur à zéro");

        if (receiptFile) {
          const formData = new FormData();
          formData.append('mission_id', missionId);
          formData.append('date', date);
          formData.append('category', expCategory);
          formData.append('label', expLabel.trim());
          formData.append('quantity', String(parsedQty));
          formData.append('unit_price', String(parsedUnitPrice));
          formData.append('receipt', receiptFile);

          const res = await fetch('/api/expenses', {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Erreur lors de l'enregistrement du frais");
          }
        } else {
          await api.addExpense({
            mission_id: missionId,
            date,
            category: expCategory,
            label: expLabel.trim(),
            quantity: parsedQty,
            unit_price: parsedUnitPrice,
          });
        }

        if (keepOpen) {
          setExpLabel('');
          setExpUnitPrice('0');
          setReceiptFile(null);
          setSuccessFeedback(`Frais enregistré sur ${selectedMission?.code || 'le dossier'} ! Prêt pour le suivant.`);
        }
      }

      onSuccess();
      if (!keepOpen) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSubmit(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800 text-base">Saisie rapide d'activité & frais</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 m-4 mb-2 rounded-lg">
          <button
            type="button"
            onClick={() => { setTab('activity'); setSuccessFeedback(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
              tab === 'activity'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-[#0f3854]" />
            <span>Temps & Honoraires</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('expense'); setSuccessFeedback(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
              tab === 'expense'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Frais & Déplacement</span>
          </button>
        </div>

        {/* Success feedback toast */}
        {successFeedback && (
          <div className="mx-4 mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-800 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successFeedback}</span>
          </div>
        )}

        {error && (
          <div className="mx-6 mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Mission selection */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Dossier / Mission *</label>
            <select
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
              required
              className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.title.length > 45 ? `${m.title.slice(0, 45)}...` : m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date d'intervention *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
            />
          </div>

          {tab === 'activity' ? (
            <>
              {/* Activity Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Catégorie</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                  >
                    <option value="expertise">Expertise technique</option>
                    <option value="analyse">Analyse de pièces</option>
                    <option value="etude_documents">Étude de documents</option>
                    <option value="visio">Visio-conférence</option>
                    <option value="reunion">Réunion contradictoire</option>
                    <option value="redaction">Rédaction rapport / dires</option>
                    <option value="deplacement">Temps de déplacement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Durée (heures) *</label>
                  <input
                    type="text"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="ex: 1,5 ou 0,5"
                    required
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                  />
                </div>
              </div>

              {/* Quick Hours Presets */}
              <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                <span className="text-[11px]">Raccourcis :</span>
                {['0.25', '0.5', '1', '1.5', '2', '4'].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px]"
                  >
                    {h === '0.25' ? '15m' : h === '0.5' ? '30m' : `${h}h`}
                  </button>
                ))}
              </div>

              {/* Activity Label */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Libellé / Objet *</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="ex: Réunion contradictoire sur site, examen du bogie..."
                  required
                  className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Observations internes (facultatif)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Détails techniques, participants..."
                  className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                />
              </div>

              {/* Rate & HT Preview Box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Taux appliqué : </span>
                  <span className="font-semibold text-slate-700">{hourlyRate} €/h HT</span>
                </div>
                <div>
                  <span className="text-slate-500">Montant à facturer : </span>
                  <span className="font-bold text-[#0f3854] text-sm">{calculatedActivityHT.toFixed(2).replace('.', ',')} € HT</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Expense Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nature du frais</label>
                  <select
                    value={expCategory}
                    onChange={(e: any) => handleExpenseCategoryChange(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                  >
                    <option value="km">Frais kilométriques (0,95 €/km)</option>
                    <option value="train">Train / SNCF</option>
                    <option value="hotel">Hôtel / Hébergement</option>
                    <option value="repas">Repas</option>
                    <option value="peage_parking">Péages & Parking</option>
                    <option value="taxi">Taxi / VTC</option>
                    <option value="autre">Autre frais</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {expCategory === 'km' ? 'Distance (km)' : 'Quantité'}
                  </label>
                  <input
                    type="text"
                    value={expQty}
                    onChange={(e) => setExpQty(e.target.value)}
                    required
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                  />
                </div>
              </div>

              {/* Expense Label & Unit Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Libellé du frais *</label>
                  <input
                    type="text"
                    value={expLabel}
                    onChange={(e) => setExpLabel(e.target.value)}
                    placeholder="ex: Billet TGV Paris-Lyon A/R"
                    required
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Prix Unitaire HT (€) *</label>
                  <input
                    type="text"
                    value={expUnitPrice}
                    onChange={(e) => setExpUnitPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                  />
                </div>
              </div>

              {/* Justificatif upload */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Justificatif / Reçu (facultatif)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              {/* Expense Preview */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Montant HT : </span>
                  <span className="font-semibold text-slate-700">{calculatedExpenseHT.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div>
                  <span className="text-slate-500">Montant TTC : </span>
                  <span className="font-bold text-emerald-700 text-sm">{calculatedExpenseTTC.toFixed(2).replace('.', ',')} €</span>
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => executeSubmit(true)}
              disabled={loading}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
              title="Enregistre la ligne et garde la fenêtre ouverte pour pointer un autre dossier"
            >
              + Enregistrer et enchaîner
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Fermer
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-[#0f3854] hover:bg-[#16496d] text-white text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? "Enregistrement..." : "Enregistrer et fermer"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
