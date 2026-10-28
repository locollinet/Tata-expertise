import React, { useState } from 'react';
import { X, FolderPlus, AlertCircle, Check } from 'lucide-react';
import { api } from '../api.js';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMissionId: string) => void;
}

export const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const currentYear = new Date().getFullYear();
  const [code, setCode] = useState(`VP${currentYear}105`);
  const [title, setTitle] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [insuranceClient, setInsuranceClient] = useState('AXA XL');
  const [clientContact, setClientContact] = useState('');
  const [insuredParty, setInsuredParty] = useState('');
  const [thirdParties, setThirdParties] = useState('');
  const [courtReference, setCourtReference] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [currentStep, setCurrentStep] = useState('Réception du mandat et ouverture du dossier.');
  const [nextAction, setNextAction] = useState('Prise de contact avec les parties et fixation réunion contradictoire.');
  const [nextDeadline, setNextDeadline] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code || !title || !caseReference || !insuranceClient) {
      setError("Le code, le titre, la référence et l'assureur sont obligatoires.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.createMission({
        code: code.trim(),
        title: title.trim(),
        case_reference: caseReference.trim(),
        insurance_client: insuranceClient.trim(),
        client_contact: clientContact.trim() || undefined,
        insured_party: insuredParty.trim() || undefined,
        third_parties: thirdParties.trim() || undefined,
        court_reference: courtReference.trim() || undefined,
        incident_date: incidentDate || undefined,
        reception_date: receptionDate,
        description: description.trim() || title.trim(),
        current_step: currentStep.trim(),
        next_action: nextAction.trim(),
        next_deadline: nextDeadline || undefined,
        billing_address: billingAddress.trim() || undefined,
        custom_hourly_rate: 190,
        custom_travel_rate: 135,
        custom_km_rate: 0.95,
      });
      onSuccess(res.id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 text-xs">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-5 h-5 text-[#0f3854]" />
            <h2 className="text-base font-bold text-slate-900">Ouvrir un nouveau dossier d'expertise</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Code mission *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full rounded-md border-slate-300 p-2 border bg-white font-bold text-[#0f3854]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Titre de l'affaire / Sinistre *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: ALSTOM - Déraillement rame tramway à Lyon"
                required
                className="w-full rounded-md border-slate-300 p-2 border bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Compagnie d'assurance cliente *</label>
              <input
                type="text"
                value={insuranceClient}
                onChange={(e) => setInsuranceClient(e.target.value)}
                placeholder="ex: AXA XL, HELVETIA, ALBINGIA..."
                required
                className="w-full rounded-md border-slate-300 p-2 border bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Vos références (Réf. Sinistre) *</label>
              <input
                type="text"
                value={caseReference}
                onChange={(e) => setCaseReference(e.target.value)}
                placeholder="ex: 11161461 ou 26GF13102078"
                required
                className="w-full rounded-md border-slate-300 p-2 border bg-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Assuré / Demandeur</label>
              <input
                type="text"
                value={insuredParty}
                onChange={(e) => setInsuredParty(e.target.value)}
                placeholder="ex: ALSTOM, REGIORAIL, FORWARDIS..."
                className="w-full rounded-md border-slate-300 p-2 border bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Parties adverses / Tiers</label>
              <input
                type="text"
                value={thirdParties}
                onChange={(e) => setThirdParties(e.target.value)}
                placeholder="ex: SNCF Réseau, VINCI..."
                className="w-full rounded-md border-slate-300 p-2 border bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Date de réception du mandat *</label>
              <input
                type="date"
                value={receptionDate}
                onChange={(e) => setReceptionDate(e.target.value)}
                required
                className="w-full rounded-md border-slate-300 p-2 border bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Date du sinistre</label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full rounded-md border-slate-300 p-2 border bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Description sommaire des dommages</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Circonstances, matériels roulants endommagés, enjeux..."
              className="w-full rounded-md border-slate-300 p-2 border bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Prochaine action à mener</label>
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="ex: Prise de contact avec les parties"
                className="w-full rounded-md border-slate-300 p-2 border bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Échéance de l'action</label>
              <input
                type="date"
                value={nextDeadline}
                onChange={(e) => setNextDeadline(e.target.value)}
                className="w-full rounded-md border-slate-300 p-2 border bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Adresse de facturation du client</label>
            <textarea
              rows={2}
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              placeholder="Nom du payeur, adresse, service comptabilité / règlement..."
              className="w-full rounded-md border-slate-300 p-2 border bg-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#0f3854] hover:bg-[#16496d] text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? "Création..." : "Créer le dossier"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
