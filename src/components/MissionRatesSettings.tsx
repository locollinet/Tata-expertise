import React, { useState } from 'react';
import { Sliders, Check, RotateCcw, AlertTriangle, Shield, Save, DollarSign } from 'lucide-react';
import { Mission } from '@shared/types.js';
import { api } from '../api.js';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase.js';

interface MissionRatesSettingsProps {
  mission: Mission;
  onUpdated: () => void;
}

export const MissionRatesSettings: React.FC<MissionRatesSettingsProps> = ({
  mission,
  onUpdated,
}) => {
  // Valentine's official standard rates
  const STANDARD_HOURLY_RATE = 190;
  const STANDARD_TRAVEL_RATE = 135;
  const STANDARD_KM_RATE = 0.95;
  const STANDARD_THRESHOLD = 3500;
  const STANDARD_VAT_RATE = 0.20;

  const [hourlyRate, setHourlyRate] = useState<number>(mission.custom_hourly_rate ?? STANDARD_HOURLY_RATE);
  const [travelRate, setTravelRate] = useState<number>(mission.custom_travel_rate ?? STANDARD_TRAVEL_RATE);
  const [kmRate, setKmRate] = useState<number>(mission.custom_km_rate ?? STANDARD_KM_RATE);
  const [billingThreshold, setBillingThreshold] = useState<number>(mission.custom_billing_threshold ?? STANDARD_THRESHOLD);
  const [vatRate, setVatRate] = useState<number>(mission.custom_vat_rate ?? STANDARD_VAT_RATE);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isCustomized =
    hourlyRate !== STANDARD_HOURLY_RATE ||
    travelRate !== STANDARD_TRAVEL_RATE ||
    kmRate !== STANDARD_KM_RATE ||
    billingThreshold !== STANDARD_THRESHOLD ||
    vatRate !== STANDARD_VAT_RATE;

  const handleResetToStandard = () => {
    setHourlyRate(STANDARD_HOURLY_RATE);
    setTravelRate(STANDARD_TRAVEL_RATE);
    setKmRate(STANDARD_KM_RATE);
    setBillingThreshold(STANDARD_THRESHOLD);
    setVatRate(STANDARD_VAT_RATE);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    try {
      // 1. Update SQLite backend
      await api.updateMission(mission.id, {
        ...mission,
        custom_hourly_rate: Number(hourlyRate),
        custom_travel_rate: Number(travelRate),
        custom_km_rate: Number(kmRate),
        custom_billing_threshold: Number(billingThreshold),
        custom_vat_rate: Number(vatRate),
      });

      // 2. Also persist settings in Firestore cloud for multi-device sync
      try {
        const user = auth.currentUser;
        await setDoc(doc(db, `missions/${mission.id}/settings`, 'current'), {
          mission_id: mission.id,
          custom_hourly_rate: Number(hourlyRate),
          custom_travel_rate: Number(travelRate),
          custom_km_rate: Number(kmRate),
          custom_billing_threshold: Number(billingThreshold),
          custom_vat_rate: Number(vatRate),
          updated_by: user?.uid || 'user-expert-valentine',
          updated_at: new Date().toISOString(),
        });
      } catch (cloudErr) {
        console.warn('Persistance Firestore optionnelle:', cloudErr);
      }

      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
      onUpdated();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-[#0f3854]" />
            <h3 className="text-base font-bold text-slate-900">
              Paramètres Tarifaires & Seuil d'Alerte du Dossier
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Chaque dossier hérite des barèmes officiels de Valentine mais peut être surchargé pour un contrat ou client spécifique (AXA, Albingia, etc.).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isCustomized ? (
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold">
              Taux spécifiques dossier
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold">
              Taux standards du cabinet
            </span>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Paramètres du dossier enregistrés avec succès. Les prochains calculs et alertes utiliseront ces valeurs.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Taux horaire expert */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Taux Expert (€/h)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Défaut: 190 €</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="50"
                max="1000"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                className="w-full pl-3 pr-8 py-2 bg-white text-sm font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3854] tabular-nums"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">€</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Étude, analyse, expertise contradictoire, rédaction et visio.
            </p>
          </div>

          {/* Taux horaire déplacement */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Taux Trajet (€/h)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Défaut: 135 €</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="50"
                max="1000"
                value={travelRate}
                onChange={(e) => setTravelRate(parseFloat(e.target.value) || 0)}
                className="w-full pl-3 pr-8 py-2 bg-white text-sm font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3854] tabular-nums"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">€</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Tarif réduit pour le temps passé en train ou voiture.
            </p>
          </div>

          {/* Barème kilométrique */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Barème km (€/km)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Défaut: 0,95 €</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.10"
                max="5.00"
                value={kmRate}
                onChange={(e) => setKmRate(parseFloat(e.target.value) || 0)}
                className="w-full pl-3 pr-8 py-2 bg-white text-sm font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3854] tabular-nums"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">€</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Facturation des déplacements routiers (ex: 70 km = 66,50 €).
            </p>
          </div>

          {/* Seuil d'alerte de facturation */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Seuil Alerte (€ HT)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Défaut: 3 500 €</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="100"
                min="500"
                max="50000"
                value={billingThreshold}
                onChange={(e) => setBillingThreshold(parseFloat(e.target.value) || 0)}
                className="w-full pl-3 pr-8 py-2 bg-white text-sm font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f3854] tabular-nums"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">€</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Déclenche l'alerte d'émission d'une note d'honoraires d'étape.
            </p>
          </div>
        </div>

        {/* TVA standard section */}
        <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#0f3854]" />
            <span>
              <strong>Taux de TVA appliqué : </strong>{(vatRate * 100).toFixed(0)}% (taux normal sur prestations et frais refacturés).
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <label className="font-semibold text-slate-700">Taux de TVA :</label>
            <select
              value={vatRate}
              onChange={(e) => setVatRate(parseFloat(e.target.value))}
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-bold"
            >
              <option value={0.20}>20% (Standard France)</option>
              <option value={0.10}>10% (Taux intermédiaire)</option>
              <option value={0.00}>0% (Exonération / Autoliquidation)</option>
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleResetToStandard}
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rétablir les taux standards du cabinet</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center space-x-1.5 bg-[#0f3854] hover:bg-[#16496d] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Enregistrer les paramètres du dossier</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
