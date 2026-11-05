import React, { useState, useMemo, useEffect } from 'react';
import { X, Clock, Receipt, Check, AlertCircle, Camera, Users, Search, Archive } from 'lucide-react';
import { Mission, ACTIVITY_CATEGORY_LABELS, ActivityCategory } from '@shared/types.js';
import { api } from '../api.js';
import { syncFileToLocalMacFolder, syncComptaFileToMac, mirrorEvidenceToFirestore } from '../utils/localFolderSync.js';

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
  const [tab, setTab] = useState<'activity' | 'expense' | 'photo'>('activity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // Mission search & archive filter (demandé par Valentine : loupe pour chercher p.ex. "728" ou "2020" sans dérouler 250 dossiers)
  const [missionSearch, setMissionSearch] = useState('');
  const [includeClosedMissions, setIncludeClosedMissions] = useState(false);

  const filteredMissions = useMemo(() => {
    const q = missionSearch.trim().toLowerCase();
    return missions.filter(m => {
      if (!includeClosedMissions && m.status === 'cloture' && m.id !== defaultMissionId) {
        return false;
      }
      if (!q) return true;
      return (
        m.code.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.insurance_client || '').toLowerCase().includes(q) ||
        (m.insured_party || '').toLowerCase().includes(q) ||
        (m.case_reference || '').toLowerCase().includes(q)
      );
    });
  }, [missions, missionSearch, includeClosedMissions, defaultMissionId]);

  // Activity fields (Sans le champ redondant "Libellé / Objet" : la Catégorie génère la ligne de facture, et Observations internes sert de mémo perso)
  const [missionId, setMissionId] = useState(defaultMissionId || (missions[0]?.id || ''));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ActivityCategory>('etude_documents');
  const [hours, setHours] = useState('1');
  const [notes, setNotes] = useState('');

  // Expense fields
  const [expCategory, setExpCategory] = useState<'train' | 'km' | 'peage' | 'location_voiture' | 'repas' | 'hotel' | 'parking' | 'taxi' | 'autre' | 'peage_parking'>('km');
  const [expLabel, setExpLabel] = useState('Frais kilométriques');
  const [expQty, setExpQty] = useState('1');
  const [expUnitPrice, setExpUnitPrice] = useState('0.95');
  const [expVatRate, setExpVatRate] = useState<number>(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Photo / Terrain fields
  const [photoType, setPhotoType] = useState<'constat' | 'emargement' | 'justificatif'>('constat');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoForReport, setPhotoForReport] = useState(true);

  useEffect(() => {
    if (defaultMissionId) {
      setMissionId(defaultMissionId);
    } else if (filteredMissions.length > 0 && !filteredMissions.some(m => m.id === missionId)) {
      setMissionId(filteredMissions[0].id);
    }
  }, [defaultMissionId, filteredMissions]);

  if (!isOpen) return null;

  const selectedMission = missions.find(m => m.id === missionId);
  const hourlyRate =
    category === 'deplacement'
      ? (selectedMission?.custom_travel_rate || 135)
      : (selectedMission?.custom_hourly_rate || 190);
  const parsedHours = parseFloat(hours.replace(',', '.')) || 0;
  const calculatedActivityHT = Math.round(parsedHours * hourlyRate * 100) / 100;

  // Expense calculation with TVA detail
  const parsedQty = parseFloat(expQty.replace(',', '.')) || 0;
  const parsedUnitPrice = parseFloat(expUnitPrice.replace(',', '.')) || 0;
  const calculatedExpenseHT = Math.round(parsedQty * parsedUnitPrice * 100) / 100;
  const calculatedExpenseTVA = Math.round(calculatedExpenseHT * expVatRate * 100) / 100;
  const calculatedExpenseTTC = Math.round((calculatedExpenseHT + calculatedExpenseTVA) * 100) / 100;

  const handleExpenseCategoryChange = (newCat: any) => {
    setExpCategory(newCat);
    const defaultLabels: Record<string, string> = {
      train: 'Frais de déplacement (train)',
      km: 'Frais kilométriques',
      peage: 'Péage',
      location_voiture: 'Voiture de location',
      repas: 'Repas',
      hotel: 'Hôtel',
      parking: 'Parking',
      taxi: 'Taxi',
      autre: 'Autre frais de mission',
      peage_parking: 'Parking / Péage',
    };
    setExpLabel(defaultLabels[newCat] || 'Frais de déplacement');

    if (newCat === 'km') {
      setExpUnitPrice(String(selectedMission?.custom_km_rate || 0.95));
      setExpVatRate(0);
    } else if (newCat === 'train') {
      setExpUnitPrice('');
      setExpQty('1');
      setExpVatRate(0);
    } else if (newCat === 'peage' || newCat === 'parking' || newCat === 'location_voiture' || newCat === 'peage_parking') {
      setExpUnitPrice('');
      setExpQty('1');
      setExpVatRate(0.20);
    } else if (newCat === 'repas') {
      setExpUnitPrice('25.00');
      setExpQty('1');
      setExpVatRate(0.10);
    } else if (newCat === 'hotel' || newCat === 'taxi') {
      setExpUnitPrice('');
      setExpQty('1');
      setExpVatRate(0.10);
    } else {
      setExpUnitPrice('');
      setExpQty('1');
      setExpVatRate(0.20);
    }
  };

  const executeSubmit = async (keepOpen = false) => {
    setError(null);
    setSuccessFeedback(null);
    setLoading(true);

    try {
      if (!missionId) throw new Error("Veuillez sélectionner un dossier");

      if (tab === 'activity') {
        if (parsedHours <= 0) throw new Error("Le nombre d'heures doit être supérieur à zéro");

        const autoInvoiceLabel = ACTIVITY_CATEGORY_LABELS[category] || 'Expertise contradictoire';

        await api.addActivity({
          mission_id: missionId,
          date,
          category,
          label: autoInvoiceLabel,
          hours: parsedHours,
          hourly_rate: hourlyRate,
          notes: notes.trim() || undefined,
          billable: true,
        });

        if (keepOpen) {
          setNotes('');
          setSuccessFeedback(`Pointage de ${parsedHours}h (${autoInvoiceLabel}) enregistré sur ${selectedMission?.code || 'le dossier'} ! Vous pouvez enchaîner sur un autre dossier.`);
        }
      } else if (tab === 'expense') {
        if (parsedUnitPrice <= 0) throw new Error("Le montant unitaire doit être supérieur à zéro");

        if (missionId === 'CABINET') {
          // Frais généraux de cabinet hors dossier d'expertise -> écriture directe dans le livre comptable
          if (receiptFile) {
            const formData = new FormData();
            formData.append('month', date.slice(0, 7));
            formData.append('date', date);
            formData.append('type', 'depense');
            formData.append('object', expLabel.trim() || 'Frais généraux cabinet');
            formData.append('party', 'Fournisseur / Déplacement');
            formData.append('amount_ht', String(calculatedExpenseHT));
            formData.append('vat_rate', String(expVatRate));
            formData.append('vat_amount', String(calculatedExpenseTVA));
            formData.append('amount_ttc', String(calculatedExpenseTTC));
            formData.append('receipt', receiptFile);

            const res = await fetch('/api/compta/entries', {
              method: 'POST',
              body: formData,
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || "Erreur lors de l'enregistrement de la dépense comptable");
            }

            await syncComptaFileToMac({
              month: date.slice(0, 7),
              subFolder: 'Justificatifs',
              fileName: `${date}_Cabinet_${receiptFile.name}`,
              data: receiptFile,
            });
          } else {
            await api.addAccountingEntry({
              month: date.slice(0, 7),
              date,
              type: 'depense',
              object: expLabel.trim() || 'Frais généraux cabinet',
              party: 'Fournisseur / Déplacement',
              amount_ht: calculatedExpenseHT,
              vat_rate: expVatRate,
              vat_amount: calculatedExpenseTVA,
              amount_ttc: calculatedExpenseTTC,
            });
          }

          if (keepOpen) {
            setReceiptFile(null);
            setSuccessFeedback("Dépense générale enregistrée dans le livre comptable du cabinet !");
          }
        } else if (receiptFile) {
          const formData = new FormData();
          formData.append('mission_id', missionId);
          formData.append('date', date);
          formData.append('category', expCategory);
          formData.append('label', expLabel.trim() || 'Frais de déplacement');
          formData.append('quantity', String(parsedQty));
          formData.append('unit_price', String(parsedUnitPrice));
          formData.append('vat_rate', String(expVatRate));
          formData.append('receipt', receiptFile);

          const res = await fetch('/api/expenses', {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Erreur lors de l'enregistrement du frais");
          }

          // Les justificatifs de frais sont rangés dans le dossier Compta séparé des dossiers d'expertise sur le Mac
          await syncComptaFileToMac({
            month: date.slice(0, 7),
            subFolder: 'Justificatifs',
            fileName: `${date}_${selectedMission?.code || 'Frais'}_${receiptFile.name}`,
            data: receiptFile,
          });
        } else {
          await api.addExpense({
            mission_id: missionId,
            date,
            category: expCategory,
            label: expLabel.trim() || 'Frais de déplacement',
            quantity: parsedQty,
            unit_price: parsedUnitPrice,
            vat_rate: expVatRate,
          });
        }

        if (keepOpen && missionId !== 'CABINET') {
          setExpUnitPrice(expCategory === 'km' ? String(selectedMission?.custom_km_rate || 0.95) : '');
          setReceiptFile(null);
          setSuccessFeedback(`Frais enregistré sur ${selectedMission?.code || 'le dossier'} ! Prêt pour le suivant.`);
        }
      } else if (tab === 'photo') {
        if (!photoFile) throw new Error("Veuillez prendre une photo ou sélectionner un fichier");
        const defaultCaption =
          photoType === 'emargement'
            ? "Feuille d'émargement présence"
            : photoType === 'justificatif'
            ? "Justificatif de note de frais"
            : "Photo de constatation terrain";

        const formData = new FormData();
        formData.append('mission_id', missionId);
        formData.append('caption', photoCaption.trim() || defaultCaption);
        formData.append('is_selected_for_report', photoForReport ? '1' : '0');
        formData.append('photo', photoFile);

        const res = await fetch('/api/photos', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erreur lors de l'enregistrement de la photo");
        }
        const photoJson = await res.json();

        await mirrorEvidenceToFirestore({
          missionId,
          missionCode: selectedMission?.code || 'VP_Dossier',
          file: photoFile,
          title: photoCaption.trim() || defaultCaption,
          caption: photoCaption.trim() || defaultCaption,
          type: photoType === 'emargement' ? 'document' : 'photo',
          serverFilename: photoJson.filename,
          isSelectedForReport: photoForReport,
        });

        if (photoType === 'justificatif') {
          await syncComptaFileToMac({
            month: date.slice(0, 7),
            subFolder: 'Justificatifs',
            fileName: `${date}_${selectedMission?.code || 'Frais'}_${photoFile.name}`,
            data: photoFile,
          });
        } else {
          await syncFileToLocalMacFolder({
            missionCode: selectedMission?.code || 'VP_Dossier',
            subFolder: '03_Constatations_immediates',
            fileName: photoFile.name,
            data: photoFile,
          });
        }

        if (keepOpen) {
          setPhotoCaption('');
          setPhotoFile(null);
          setPhotoPreviewUrl(null);
          setSuccessFeedback(`Photo enregistrée sur ${selectedMission?.code || 'le dossier'} ! Prête pour la suivante.`);
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800 text-base">Pointage rapide & Frais de mission</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 p-1 mx-5 sm:mx-6 my-3 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => { setTab('activity'); setSuccessFeedback(null); }}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              tab === 'activity'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-[#0f3854] shrink-0" />
            <span className="sm:hidden">Temps</span>
            <span className="hidden sm:inline">Pointage temps</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('expense'); setSuccessFeedback(null); }}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              tab === 'expense'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Frais & Km</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('photo'); setSuccessFeedback(null); }}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              tab === 'photo'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="sm:hidden">Photos</span>
            <span className="hidden sm:inline">Photo terrain</span>
          </button>
        </div>

        {/* Success feedback toast */}
        {successFeedback && (
          <div className="mx-5 mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-800 animate-in fade-in">
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

        <form onSubmit={handleSubmit} className="px-5 sm:px-6 pb-6 space-y-4 overflow-y-auto flex-1">
          {/* Mission selection with instant Search (Loupe) & Archive filter */}
          <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-800">
                Dossier / Mission * ({filteredMissions.length} affiché{filteredMissions.length > 1 ? 's' : ''})
              </label>
              <label className="inline-flex items-center space-x-1.5 text-[11px] text-slate-500 cursor-pointer hover:text-slate-800">
                <input
                  type="checkbox"
                  checked={includeClosedMissions}
                  onChange={(e) => setIncludeClosedMissions(e.target.checked)}
                  className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854] w-3.5 h-3.5"
                />
                <Archive className="w-3 h-3" />
                <span>Inclure les dossiers clos / archivés</span>
              </label>
            </div>

            {/* Loupe de recherche rapide de dossier */}
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
                    const firstMatch = missions.find(
                      m =>
                        (includeClosedMissions || m.status !== 'cloture') &&
                        (m.code.toLowerCase().includes(q) ||
                          m.title.toLowerCase().includes(q) ||
                          (m.insurance_client || '').toLowerCase().includes(q))
                    );
                    if (firstMatch) setMissionId(firstMatch.id);
                  }
                }}
                placeholder="Rechercher par n° (ex: 728, 2020), client (Helvetia, AXA) ou affaire..."
                className="w-full text-xs rounded-lg border-slate-300 pl-8 pr-7 py-1.5 bg-white border focus:border-[#0f3854] focus:ring-[#0f3854]"
              />
              {missionSearch && (
                <button
                  type="button"
                  onClick={() => setMissionSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            <select
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
              required
              className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border font-medium text-slate-900"
            >
              {tab === 'expense' && (
                <option value="CABINET" className="font-bold text-[#0f3854] bg-sky-50">
                  🏢 Dépense générale de cabinet (Hors dossier d'expertise)
                </option>
              )}
              {filteredMissions.length === 0 ? (
                <option value="">Aucun dossier trouvé pour « {missionSearch} »</option>
              ) : (
                filteredMissions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.title.length > 48 ? `${m.title.slice(0, 48)}...` : m.title} ({m.insurance_client})
                    {m.status === 'cloture' ? ' [CLOS]' : ''}
                  </option>
                ))
              )}
            </select>

            {/* Pastilles d'accès rapide aux 3 dossiers récents */}
            {missions.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400 font-medium">Accès rapide :</span>
                {tab === 'expense' && (
                  <button
                    type="button"
                    onClick={() => setMissionId('CABINET')}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-bold transition-colors ${
                      missionId === 'CABINET'
                        ? 'bg-[#0f3854] text-white border-[#0f3854]'
                        : 'bg-white text-[#0f3854] border-sky-200 hover:bg-sky-50'
                    }`}
                  >
                    🏢 Cabinet
                  </button>
                )}
                {missions.filter(m => m.status !== 'cloture').slice(0, 3).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMissionId(m.id)}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold transition-colors ${
                      missionId === m.id
                        ? 'bg-[#0f3854] text-white border-[#0f3854]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {m.code}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date du travail / d'intervention *</label>
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
              {/* Activity Category & Hours */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Catégorie (Ligne de facturation) *
                  </label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border font-medium text-slate-800"
                  >
                    <option value="etude_documents">Étude de documents, analyse, gestion du dossier</option>
                    <option value="expertise">Expertise</option>
                    <option value="reunion_assureurs">Réunion avec les assureurs</option>
                    <option value="reunion_assure">Réunion avec l’assuré</option>
                    <option value="redaction">Rédaction Expert</option>
                    <option value="deplacement">Déplacement expert (taux trajet)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Durée (heures) *</label>
                  <input
                    type="text"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="ex: 1,5 ou 0,25"
                    required
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Quick Hours Presets */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="text-[11px] font-medium shrink-0">Durée rapide :</span>
                {[
                  { l: '15m (0,25)', val: '0.25' },
                  { l: '30m (0,5)', val: '0.5' },
                  { l: '1h', val: '1' },
                  { l: '1,5h', val: '1.5' },
                  { l: '2h', val: '2' },
                  { l: '3,5h', val: '3.5', title: '1/2 journée' },
                  { l: '7h', val: '7', title: '1 journée' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    title={item.title}
                    onClick={() => setHours(item.val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                      hours === item.val
                        ? 'bg-[#0f3854] text-white border-[#0f3854]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.l}
                  </button>
                ))}
              </div>

              {/* Observations internes (seul champ texte libre pour mémoire personnelle, non affiché en détail sur la facture) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Observations internes / Mémo personnel (facultatif — non détaillé sur la facture)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ex: Visio avec Alstom de 10h à 12h, relecture dire Me Garnier..."
                  className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                />
              </div>

              {/* Rate & HT Preview Box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 text-xs">
                <div className="flex items-center justify-between sm:justify-start sm:gap-1.5">
                  <span className="text-slate-500">Taux dossier appliqué :</span>
                  <span className="font-semibold text-slate-700 whitespace-nowrap">{hourlyRate} €/h HT</span>
                </div>
                <div className="flex items-center justify-between sm:justify-end sm:gap-1.5 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-200/60">
                  <span className="text-slate-500">Montant pointé :</span>
                  <span className="font-bold text-[#0f3854] text-sm whitespace-nowrap">
                    {calculatedActivityHT.toFixed(2).replace('.', ',')} € HT
                  </span>
                </div>
              </div>
            </>
          ) : tab === 'expense' ? (
            <>
              {/* Expense Category & Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Catégorie de frais</label>
                  <select
                    value={expCategory}
                    onChange={(e: any) => handleExpenseCategoryChange(e.target.value)}
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border font-medium text-slate-800"
                  >
                    <option value="train">Frais de déplacement (train)</option>
                    <option value="km">Frais kilométriques ({selectedMission?.custom_km_rate || 0.95} €/km)</option>
                    <option value="peage">Péage</option>
                    <option value="location_voiture">Voiture de location</option>
                    <option value="repas">Repas</option>
                    <option value="hotel">Hôtel</option>
                    <option value="parking">Parking</option>
                    <option value="taxi">Taxi</option>
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

              {/* Expense Label, Unit Price & TVA Rate */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Libellé facture</label>
                  <input
                    type="text"
                    value={expLabel}
                    onChange={(e) => setExpLabel(e.target.value)}
                    placeholder="ex: Parking"
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Prix Unit. HT (€) *</label>
                  <input
                    type="text"
                    value={expUnitPrice}
                    onChange={(e) => setExpUnitPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Taux TVA</label>
                  <select
                    value={String(expVatRate)}
                    onChange={(e) => setExpVatRate(parseFloat(e.target.value))}
                    className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2 bg-white border"
                  >
                    <option value="0">0% (Km / SNCF)</option>
                    <option value="0.055">5,5%</option>
                    <option value="0.1">10% (Repas/Hôtel)</option>
                    <option value="0.2">20% (Standard)</option>
                  </select>
                </div>
              </div>

              {/* Justificatif upload */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Justificatif / Reçu (facultatif)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              {/* Expense Preview with TVA Detail */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">HT : </span>
                  <span className="font-semibold text-slate-800">{calculatedExpenseHT.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div>
                  <span className="text-slate-500">TVA ({Math.round(expVatRate * 1000) / 10}%) : </span>
                  <span className="font-semibold text-slate-700">{calculatedExpenseTVA.toFixed(2).replace('.', ',')} €</span>
                </div>
                <div>
                  <span className="text-slate-500">TTC : </span>
                  <span className="font-bold text-emerald-700 text-sm">{calculatedExpenseTTC.toFixed(2).replace('.', ',')} €</span>
                </div>
              </div>
            </>
          ) : (
            /* Tab: PHOTO TERRAIN */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type de document terrain *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'constat', label: 'Constat technique', icon: Camera },
                    { id: 'emargement', label: "Feuille d'émargement", icon: Users },
                    { id: 'justificatif', label: 'Reçu / Facturette', icon: Receipt },
                  ].map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setPhotoType(pt.id as any)}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        photoType === pt.id
                          ? 'bg-sky-50 border-[#0f3854] text-[#0f3854] font-semibold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <pt.icon className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-[11px] block">{pt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Légende / Titre de la photo</label>
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder={
                    photoType === 'emargement'
                      ? "Feuille d'émargement réunion contradictoire du jour"
                      : photoType === 'justificatif'
                      ? 'Ticket péage / parking'
                      : 'Constat fissure tablier / essieu / traverse'
                  }
                  className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-[#0f3854] focus:ring-[#0f3854] py-2 px-2.5 bg-white border"
                />
              </div>

              <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50/70 hover:bg-slate-100 transition-colors">
                <input
                  type="file"
                  id="camera-upload-input"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPhotoFile(e.target.files[0]);
                      setPhotoPreviewUrl(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                  className="hidden"
                />
                {photoPreviewUrl ? (
                  <div className="space-y-2">
                    <img src={photoPreviewUrl} alt="Aperçu" className="max-h-44 mx-auto rounded-lg object-contain shadow-xs border border-slate-200" />
                    <p className="text-xs font-medium text-slate-700">{photoFile?.name} ({Math.round((photoFile?.size || 0) / 1024)} Ko)</p>
                    <label htmlFor="camera-upload-input" className="text-xs text-[#0f3854] hover:underline font-semibold cursor-pointer inline-block mt-1">
                      Reprendre la photo
                    </label>
                  </div>
                ) : (
                  <label htmlFor="camera-upload-input" className="cursor-pointer block space-y-2 py-3">
                    <div className="w-12 h-12 rounded-full bg-[#0f3854]/10 text-[#0f3854] flex items-center justify-center mx-auto">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Prendre ou glisser une photo</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">Sera rattachée au dossier (et copiée dans iCloud Drive si connecté)</span>
                    </div>
                  </label>
                )}
              </div>

              {photoType !== 'justificatif' && (
                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={photoForReport}
                    onChange={(e) => setPhotoForReport(e.target.checked)}
                    className="rounded border-slate-300 text-[#0f3854] focus:ring-[#0f3854]"
                  />
                  <span>Sélectionner directement cette photo pour le rapport Word</span>
                </label>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <button
              type="button"
              onClick={() => executeSubmit(true)}
              disabled={loading}
              className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors text-center"
              title="Enregistre la ligne et garde la fenêtre ouverte pour pointer un autre dossier"
            >
              + Enregistrer et enchaîner
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-center"
              >
                Fermer
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none px-5 py-2.5 sm:py-2 rounded-lg bg-[#0f3854] hover:bg-[#16496d] text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{loading ? "Enregistrement..." : "Enregistrer et fermer"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
